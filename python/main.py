"""
WordAPA7 — Servidor Principal FastAPI

Servidor Web unificado que expone los endpoints REST para la manipulacion de documentos
y sirve la interfaz estatica construida en React (dist/).
"""

import hashlib
import json
import logging
import os
import subprocess
import sys
import time
import uuid
import asyncio
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

# Asegurar path de importacion
sys.path.insert(0, str(Path(__file__).resolve().parent))

from models import (
    DocumentModel,
    ElementModel,
    ElementType,
    APARuleSet,
    PortadaData,
    ReferenciaModel,
    APAFormat,
    WorkMode,
    ParseRequest,
    ClassifyRequest,
    ApplyRequest,
    HealthResponse,
)
from parsing.docx_parser import parse_docx_bytes
from classification.llm_classifier import classify_document_with_llm, get_classify_progress
from generation.generator import generate_apa7_docx
from generation.track_changes_engine import create_tracked_changes_docx
from persistence.session_manager import (
    save_session_state,
    load_session_state,
    list_recent_sessions,
    delete_session,
    maybe_run_gc,
)
from persistence.idempotency import check_idempotency, init_sqlite_db
from modules.apa_validator import validate_apa_integrity, validate_citations_with_llm
from modules.referencias_module import resolve_doi
from create_template import create_apa7_template
from security.license import check_license_middleware, is_license_valid


# ── CONFIGURACION Y RUTAS DE ALMACENAMIENTO ──────────────────────────────────

from config import BASE_DIR, STORAGE_DIR, DIST_DIR
STORAGE_DIR.mkdir(exist_ok=True)


from contextlib import asynccontextmanager
from services.word_com_service import get_word_com_service

@asynccontextmanager
async def lifespan_app(app: FastAPI):
    print("[INFO] Arrancando LibreOffice service...")
    get_libreoffice_service().start()
    print("[INFO] Arrancando Word COM service...")
    get_word_com_service().start()
    # Limpieza inicial de sesiones expiradas al arrancar el servidor (P1.4).
    # maybe_run_gc está acelerado (GC_INTERVAL_SECONDS) y es seguro llamarlo aquí.
    try:
        maybe_run_gc(STORAGE_DIR)
    except Exception as e:
        print(f"[WARN] GC inicial de sesiones falló: {e}")
    yield
    print("[INFO] Deteniendo LibreOffice service...")
    get_libreoffice_service().stop()
    print("[INFO] Deteniendo Word COM service...")
    get_word_com_service().stop()

app = FastAPI(title="WordAPA7 API", version="1.0.0", lifespan=lifespan_app)

from services.lo_service import get_libreoffice_service

# CORS middleware para desarrollo con Vite.
# ⚠️ Antes se usaba allow_origins=["*"] con allow_credentials=True, lo cual
# es inseguro y viola la especificación CORS. Ahora se restringe a orígenes
# explícitos configurables vía WORDAPA7_ALLOWED_ORIGINS (CSV), con defaults
# seguros para desarrollo local (Vite# Enable CORS for the local Vite dev server and the Electron packaged app
_DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8742",
    "http://127.0.0.1:8742",
    "app://-",
]
_env_origins = os.environ.get("WORDAPA7_ALLOWED_ORIGINS", "").strip()
_allowed_origins = (
    [o.strip() for o in _env_origins.split(",") if o.strip()]
    if _env_origins
    else _DEFAULT_ALLOWED_ORIGINS
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from security.auth import APIKeyAuthMiddleware
app.add_middleware(APIKeyAuthMiddleware)

from routers import admin
app.include_router(admin.router)

# ── ERROR HANDLERS ESTANDARIZADOS ─────────────────────────────────────────────

def api_error(status_code: int, detail: str, error_type: str = "validation_error") -> JSONResponse:
    """Standardized error response with request tracing info."""
    return JSONResponse(
        status_code=status_code,
        content={
            "error": True,
            "type": error_type,
            "detail": detail,
            "timestamp": __import__('datetime').datetime.utcnow().isoformat() + "Z",
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "type": "http_error",
            "detail": exc.detail,
            "request_id": getattr(request.state, 'request_id', None),
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": True,
            "type": "validation_error",
            "detail": str(exc.errors()),
            "request_id": getattr(request.state, 'request_id', None),
        }
    )


# ── PROVIDER STATUS ENDPOINT ──────────────────────────────────────────────────

@app.get("/api/provider-status")
async def provider_status_endpoint() -> dict:
    """Returns the status of all configured AI providers."""
    from classification.llm_classifier import _get_active_providers, PROVIDER_CAPACITY
    import os

    all_providers = [
        {"id": "nvidia_nim", "name": "NVIDIA NIM", "env_var": "NVIDIA_API_KEY"},
        {"id": "groq", "name": "Groq", "env_var": "GROQ_API_KEY"},
        {"id": "openrouter", "name": "OpenRouter", "env_var": "OPENROUTER_API_KEY"},
        {"id": "cerebras", "name": "Cerebras", "env_var": "CEREBRAS_API_KEY"},
        {"id": "mistral", "name": "Mistral AI", "env_var": "MISTRAL_API_KEY"},
        {"id": "opencodezen", "name": "OpenCodeZen", "env_var": "OPENCODEZEN_API_KEY"},
        {"id": "zenmux", "name": "ZenMux", "env_var": "ZENMUX_API_KEY"},
        {"id": "gemini", "name": "Gemini", "env_var": "GEMINI_API_KEY"},
    ]

    active_providers = _get_active_providers()
    active_ids = {p["id"] for p in active_providers}

    providers_status = []
    for p in all_providers:
        cap = PROVIDER_CAPACITY.get(p["id"], {})
        providers_status.append({
            "id": p["id"],
            "name": p["name"],
            "active": p["id"] in active_ids,
            "capacity": {
                "timeout_s": cap.get("timeout", 25),
                "typical_latency_s": cap.get("typical_latency_s", 10),
                "max_tokens": cap.get("max_tokens_per_request", 2000),
            } if p["id"] in active_ids else None,
        })

    return {
        "providers": providers_status,
        "total_active": len(active_providers),
        "total_configured": len(all_providers),
        "classification_available": len(active_providers) > 0,
    }


# Global dict to store progress for WebSockets
_parse_progress = {}

@app.websocket("/ws/parse-progress/{session_id}")
async def parse_progress_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        while True:
            progress = _parse_progress.get(session_id)
            if progress:
                await websocket.send_json(progress)
                if progress.get("status") == "complete": 
                    break
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        pass


# Fase 8: Multi-player Collaboration Relay
class CollabManager:
    def __init__(self):
        # session_id -> list of connected websockets
        from typing import Dict, List
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast_update(self, session_id: str, message: dict, sender: WebSocket = None):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                if connection != sender:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        pass

collab_manager = CollabManager()

@app.websocket("/ws/collab/{session_id}")
async def collab_ws(websocket: WebSocket, session_id: str):
    await collab_manager.connect(websocket, session_id)
    try:
        while True:
            data = await websocket.receive_json()
            # The client sends an action (e.g. UPDATE_ELEMENT)
            # We broadcast it to other clients
            await collab_manager.broadcast_update(session_id, data, sender=websocket)
    except WebSocketDisconnect:
        collab_manager.disconnect(websocket, session_id)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


def run_background_analysis(session_id: str, storage_dir: Path):
    """Ejecuta la deteccion de IA y el layout COM en background y actualiza la sesion."""
    try:
        from classification.ai_detector import analyze_ai_risk
        from persistence.session_manager import load_session_state, save_session_state
        from parsing.page_layout_provider import get_page_layout_provider
        
        doc = load_session_state(session_id, storage_dir)
        if not doc: return
        
        modified = False
        
        # 1. Paginacion COM
        session_docx_path = storage_dir / "sessions" / session_id / "original.docx"
        try:
            provider = get_page_layout_provider()
            layout_result = provider.paginate(session_docx_path, timeout_seconds=30)
            if layout_result and layout_result.paragraph_pages:
                for i, elem in enumerate(doc.elements):
                    if i < len(layout_result.paragraph_pages):
                        elem.page_number = layout_result.paragraph_pages[i]
                
                doc.meta.page_count = layout_result.total_pages
                doc.meta.page_layout_provider = layout_result.provider_used
                doc.meta.page_layout_confidence = layout_result.confidence
                modified = True
                print(f"[INFO] Background COM Layout finished for {session_id}")
        except Exception as e:
            print(f"[WARN] Background Page layout provider fallo: {e}")

        # 2. Deteccion IA
        for elem in doc.elements:
            if elem.text and len(elem.text.strip()) >= 15:
                ai_result = analyze_ai_risk(elem.text)
                elem.ai_score = ai_result.get("score", 0.0)
                elem.ai_findings = ai_result.get("findings", [])
                modified = True
        
        if modified:
            save_session_state(doc, storage_dir)
            print(f"[INFO] Background analysis finished and saved for {session_id}")
    except Exception as e:
        print(f"[ERROR] Background analysis failed: {e}")


# ── SCHEMAS DE PETICION API ───────────────────────────────────────────────────

class UpdateElementRequest(BaseModel):
    session_id: str
    element_id: str
    type: ElementType
    heading_level: Optional[int] = 1
    text: Optional[str] = None
    image_info: Optional[dict] = None  # Campos de ImageModel para actualizar


class ReorderElementsRequest(BaseModel):
    session_id: str
    element_ids: List[str]


class GenerateRequest(BaseModel):
    session_id: str
    rules: Optional[APARuleSet] = None
    portada: Optional[PortadaData] = None
    references: Optional[List[ReferenciaModel]] = None


class PreviewRequest(BaseModel):
    session_id: str
    rules: Optional[APARuleSet] = None
    portada: Optional[PortadaData] = None
    references: Optional[List[ReferenciaModel]] = None


class ResolveDoiRequest(BaseModel):
    doi: str


class ResolveBatchRequest(BaseModel):
    references: List[str]


class SuggestCaptionRequest(BaseModel):
    session_id: str
    element_id: str
    context_text: str
    api_key: Optional[str] = None

class ExplainElementRequest(BaseModel):
    element_type: str
    text: str
    rules_applied: str
    confidence: float
    api_key: Optional[str] = None


class RewriteTextRequest(BaseModel):
    session_id: str
    element_id: str
    text: str
    instruction: str
    api_key: Optional[str] = None


# ── LICENCIAS / SEGURIDAD (PIN PC-LOCKED) ────────────────────────────────────

class LicenseRequest(BaseModel):
    pin: str

@app.post("/api/license/validate")
async def validate_license(req: LicenseRequest):
    """Valida y guarda el PIN para esta PC."""
    is_valid = check_license_middleware(req.pin)
    if is_valid:
        return {"status": "ok", "message": "Licencia validada correctamente para este hardware."}
    else:
        raise HTTPException(status_code=403, detail="PIN inválido para este hardware.")


# ── ENDPOINTS DE LA API REST ──────────────────────────────────────────────────

@app.get("/api/health")
async def health_check() -> HealthResponse:
    """Health check para Electron y monitoreo."""
    return HealthResponse(status="ok", version="1.0.0")


@app.post("/api/check-idempotency")
async def check_idempotency_endpoint(file: UploadFile = File(...)) -> dict:
    """
    Verifica si un documento ya fue procesado por WordAPA7.
    El frontend llama a esto ANTES de subir para decidir si mostrar
    el dialogo de recuperacion de sesion.
    """
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=400,
            detail="Solo se admiten archivos .docx de Microsoft Word.",
        )

    content: bytes = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=400,
            detail="El archivo esta vacio.",
        )

    # Inicializar BD si no existe
    init_sqlite_db(STORAGE_DIR)

    result = check_idempotency(content, STORAGE_DIR)
    return {
        "already_processed": result.already_processed,
        "source_hash": result.source_hash,
        "previous_session_id": result.previous_session_id,
        "processed_at": result.processed_at,
        "apa_score": result.apa_score,
        "has_marker": result.has_marker,
        "recommendation": result.recommendation,
    }


@app.post("/api/start-blank")
async def start_blank_document(background_tasks: BackgroundTasks) -> DocumentModel:
    """Inicia una nueva sesion usando la plantilla en blanco."""
    template_path = BASE_DIR / "apa7_template.docx"
    if not template_path.exists():
        raise HTTPException(status_code=500, detail="Plantilla no encontrada en el servidor.")
    
    session_id: str = uuid.uuid4().hex[:12]
    content: bytes = template_path.read_bytes()
    
    from core.parser import parse_docx
    
    doc_json, elements = parse_docx(content, session_id, BASE_DIR)
    doc_json["file_name"] = "Nuevo_Documento_APA7.docx"
    
    doc = DocumentModel(**doc_json)
    doc.elements = elements
    doc.session_id = session_id
    
    save_session_state(doc, STORAGE_DIR)
    
    return doc


@app.post("/api/upload")
async def upload_docx(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    apa_format: Optional[str] = Form(None),
    work_mode: Optional[str] = Form(None),
    cover_page: Optional[str] = Form(None),
) -> DocumentModel:
    """
    Sube un documento .docx, lo parsea, extrae imagenes y genera la sesion inicial.

    Acepta parametros del wizard:
    - apa_format: "student" o "professional" (determina formato de portada y running head)
    - work_mode: "quick" o "review" (determina si se aplican cambios automaticamente)
    - cover_page: "use_existing", "import_saved", o "none"
    """
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=400,
            detail="Solo se admiten archivos .docx de Microsoft Word. "
                   "Los archivos .doc antiguos no son compatibles.",
        )

    session_id: str = uuid.uuid4().hex[:12]
    content: bytes = await file.read()

    # Recolector de basura throttled: limpia sesiones inactivas (>24h) y
    # archivos temporales acumulados. No bloquea la subida (se ejecuta tras
    # responder, en background).
    background_tasks.add_task(maybe_run_gc, STORAGE_DIR)

    if len(content) < 4 or content[:4] != b'PK\x03\x04':
        raise HTTPException(
            status_code=400,
            detail="El archivo no es un documento .docx valido. Los archivos .docx son archivos ZIP con contenido XML."
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=400,
            detail="El archivo esta vacio. Por favor selecciona un documento .docx valido.",
        )

    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="El archivo excede el limite maximo de 50 MB.",
        )

    # Guardar original.docx en la carpeta de sesion
    session_dir = STORAGE_DIR / "sessions" / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    (session_dir / "original.docx").write_bytes(content)

    try:
        # Validar y aplicar wizard params
        fmt = APAFormat.STUDENT
        if apa_format and apa_format.lower() == "professional":
            fmt = APAFormat.PROFESSIONAL

        mode = WorkMode.REVIEW
        if work_mode and work_mode.lower() == "quick":
            mode = WorkMode.QUICK

        doc_model: DocumentModel = await asyncio.to_thread(
            parse_docx_bytes, content, file.filename, session_id, STORAGE_DIR, skip_page_layout=True
        )

        # Run AI text detector (Library patterns)
        try:
            from modules.ai_text_detector import get_ai_text_detector
            detector = get_ai_text_detector()
            # Prepare paragraphs to analyze
            paras = []
            para_indices = []
            para_shadings = []
            for idx, el in enumerate(doc_model.elements):
                # Analyze only PARAGRAPH or UNKNOWN (body text candidate)
                if el.type.value in ("PARAGRAPH", "UNKNOWN", "paragraph", "unknown") and el.text.strip():
                    paras.append(el.text)
                    para_indices.append(idx)
                    para_shadings.append(el.has_shading_residue)
                    
            if paras:
                forensic_meta = doc_model.meta.forensic_metadata if doc_model.meta else None
                results = detector.analyze_document(paras, forensic_meta, para_shadings)
                for res, el_idx in zip(results, para_indices):
                    doc_model.elements[el_idx].ai_score = res["score"]
                    doc_model.elements[el_idx].ai_matches = res["matches"]
        except Exception as e:
            logger.error(f"Error executing AI Text Detector: {e}")

        # Apply wizard settings to model
        doc_model.apa_format = fmt
        if doc_model.meta:
            doc_model.meta.apa_format = fmt
            doc_model.meta.work_mode = mode

        # Inicializar BD de sesiones
        init_sqlite_db(STORAGE_DIR)

        # Guardar sesion inicial
        save_session_state(doc_model, STORAGE_DIR)
        
        # Encolar deteccion de IA en background
        background_tasks.add_task(run_background_analysis, session_id, STORAGE_DIR)
        
        return doc_model
    except HTTPException:
        # Re-lanzar HTTPExceptions sin envolver (ej: archivo corrupto = 400, no 500)
        raise
    except Exception as e:
        print(f"[ERROR] Error parseando docx: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando el documento: {str(e)}. "
                   "Verifica que el archivo no este danado o protegido con contrasena.",
        )


class DoiRequest(BaseModel):
    doi: str


class BulkAcceptRequest(BaseModel):
    session_id: str
    element_ids: List[str]


@app.post("/api/bulk-accept")
async def bulk_accept_endpoint(req: BulkAcceptRequest) -> DocumentModel:
    """
    Aprueba atómicamente una lista de elementos en 1 solo guardado de sesión.
    """
    doc: Optional[DocumentModel] = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesion no encontrada.")
    
    target_ids = set(req.element_ids)
    for elem in doc.elements:
        if elem.id in target_ids:
            elem.needs_review = False
            elem.auto_applied = True

    save_session_state(doc, STORAGE_DIR)
    return doc


@app.post("/api/classify/{session_id}")
async def classify_with_llm(
    session_id: str,
    api_key: Optional[str] = Form(None),
    nim_url: Optional[str] = Form(None),
    use_local: Optional[str] = Form(None),
    provider_id: Optional[str] = Form(None),
) -> DocumentModel:
    """
    Ejecuta el refinamiento con LLM multi-proveedor (NVIDIA > Groq > OpenRouter > ...)
    para elementos con baja confianza. Incluye fallback automatico, batching adaptativo
    y progreso en tiempo real via GET /api/classify/progress/{session_id}.
    """
    doc: Optional[DocumentModel] = load_session_state(session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Sesion no encontrada. El documento debe ser subido primero con /api/upload.",
        )

    updated_doc: DocumentModel = await classify_document_with_llm(doc, api_key, nim_url, use_local == 'true')
    save_session_state(updated_doc, STORAGE_DIR)
    return updated_doc


@app.get("/api/classify/progress/{session_id}")
async def get_classify_progress_endpoint(session_id: str) -> dict:
    """
    Retorna el progreso actual de la clasificacion con LLM para una sesion.
    El frontend consulta este endpoint periodicamente para mostrar el progreso
    en tiempo real durante la clasificacion.
    """
    progress = get_classify_progress(session_id)
    return progress


@app.post("/api/update-element")
async def update_element(req: UpdateElementRequest) -> DocumentModel:
    """
    Permite al usuario cambiar el tipo, nivel de titulo o texto de un elemento
    manualmente desde la UI.
    """
    doc: Optional[DocumentModel] = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Sesion no encontrada. Recarga la pagina y vuelve a intentarlo.",
        )

    # Snapshot antes de modificar
    from persistence.session_manager import save_session_snapshot
    save_session_snapshot(doc, STORAGE_DIR)

    found: bool = False
    for elem in doc.elements:
        elem_id: str = elem.id if hasattr(elem, 'id') else elem.get('id', '')
        if elem_id == req.element_id:
            if hasattr(elem, 'type'):
                elem.type = req.type
            else:
                elem['type'] = req.type

            if req.heading_level is not None:
                if hasattr(elem, 'heading_level'):
                    elem.heading_level = req.heading_level
                else:
                    elem['heading_level'] = req.heading_level

            if req.text is not None:
                if hasattr(elem, 'text'):
                    elem.text = req.text
                else:
                    elem['text'] = req.text

            if hasattr(elem, 'is_user_modified'):
                elem.is_user_modified = True
                elem.confidence = 1.0
            else:
                elem['is_user_modified'] = True
                elem['confidence'] = 1.0

            # Actualizar campos de image_info si se proporcionan
            if req.image_info is not None:
                if hasattr(elem, 'image_info') and elem.image_info is not None:
                    for k, v in req.image_info.items():
                        if hasattr(elem.image_info, k):
                            setattr(elem.image_info, k, v)
                elif hasattr(elem, 'image_info') and elem.image_info is None:
                    # Crear ImageModel desde cero si no existe pero se intenta actualizar
                    from models import ImageModel
                    img = ImageModel(element_id=req.element_id, file_path="", filename="")
                    for k, v in req.image_info.items():
                        if hasattr(img, k):
                            setattr(img, k, v)
                    elem.image_info = img

            found = True
            break

    if not found:
        valid_ids = [e.id if hasattr(e, 'id') else e.get('id', '?') for e in doc.elements]
        raise HTTPException(
            status_code=404,
            detail=f"Elemento con ID '{req.element_id}' no encontrado. IDs validos: {valid_ids[:20]}",
        )

    save_session_state(doc, STORAGE_DIR)
    return doc


@app.post("/api/ai/suggest-caption")
async def api_suggest_caption(req: SuggestCaptionRequest) -> dict:
    from modules.ai_assistant import generate_caption_suggestion
    try:
        suggestion = await generate_caption_suggestion(req.context_text, req.api_key)
        return {"suggestion": suggestion}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/explain-element")
async def api_explain_element(req: ExplainElementRequest) -> dict:
    from modules.ai_assistant import explain_element
    try:
        explanation = await explain_element(req.element_type, req.text, req.rules_applied, req.confidence, req.api_key)
        return {"explanation": explanation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/rewrite")
async def api_rewrite_text(req: RewriteTextRequest) -> dict:
    from modules.ai_assistant import rewrite_text_suggestion
    try:
        rewritten = await rewrite_text_suggestion(req.text, req.instruction, req.api_key)
        return {"rewritten": rewritten}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/reorder-elements")
async def reorder_elements(req: ReorderElementsRequest) -> DocumentModel:
    """
    Reordena la lista de elementos (util para mover tablas o figuras arriba/abajo en la UI).
    """
    doc: Optional[DocumentModel] = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Sesion no encontrada.",
        )

    # Snapshot antes de reordenar
    from persistence.session_manager import save_session_snapshot
    save_session_snapshot(doc, STORAGE_DIR)

    elem_map: dict = {}
    for e in doc.elements:
        eid = e.id if hasattr(e, 'id') else e.get('id', '')
        elem_map[eid] = e

    new_elements: list = []
    for eid in req.element_ids:
        if eid in elem_map:
            new_elements.append(elem_map[eid])

    existing_ids = set(req.element_ids)
    for e in doc.elements:
        eid = e.id if hasattr(e, 'id') else e.get('id', '')
        if eid not in existing_ids:
            new_elements.append(e)

    doc.elements = new_elements
    save_session_state(doc, STORAGE_DIR)
    return doc


@app.get("/api/sessions")
async def list_sessions_endpoint() -> dict:
    """
    Lista las sesiones recientes para mostrar en el historial de la UI.
    """
    sessions = list_recent_sessions(STORAGE_DIR, limit=10)
    # Wrap in SessionRecovery format expected by frontend
    recovery_list: list[dict] = []
    for s in sessions:
        recovery_list.append({
            "session": s,
            "available": True,
        })
    return {"sessions": recovery_list}

@app.get("/api/session/{session_id}")
async def get_session(session_id: str) -> DocumentModel:
    """
    Obtiene el estado completo de la sesion.
    """
    doc: Optional[DocumentModel] = load_session_state(session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Sesion no encontrada. Es posible que haya expirado o el ID sea incorrecto.",
        )
    return doc


@app.delete("/api/session/{session_id}")
async def delete_session_endpoint(session_id: str) -> dict:
    success: bool = delete_session(session_id, STORAGE_DIR)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Sesion no encontrada o no se pudo eliminar.",
        )
    return {"status": "ok", "message": f"Sesion {session_id} eliminada correctamente."}



@app.post("/api/rollback/{session_id}")
async def rollback_session(session_id: str) -> dict:
    """
    Rollback to the previous saved state of a session.
    Allows recovery after a failed operation leaves the session in a bad state.
    """
    from persistence.session_manager import list_session_snapshots, restore_session_snapshot

    # Check if snapshots exist
    snapshots = list_session_snapshots(session_id, STORAGE_DIR)

    if not snapshots:
        raise HTTPException(
            status_code=404,
            detail="No hay snapshots disponibles para restauracion. La sesion solo tiene el estado actual."
        )

    # Restore the most recent snapshot
    restored_doc = restore_session_snapshot(session_id, STORAGE_DIR)
    if not restored_doc:
        raise HTTPException(
            status_code=500,
            detail="Error al restaurar el snapshot de la sesion."
        )

    return {
        "status": "ok",
        "message": "Sesion restaurada al estado anterior correctamente.",
        "session_id": session_id,
        "document": restored_doc.model_dump() if hasattr(restored_doc, 'model_dump') else None,
    }


@app.get("/api/images/{session_id}/{filename}")
async def get_session_image(session_id: str, filename: str) -> FileResponse:
    """
    Sirve las imagenes extraidas del documento durante el parsing.
    """
    img_path: Path = STORAGE_DIR / "sessions" / session_id / "images" / filename
    if not img_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Imagen no encontrada. Es posible que la sesion haya expirado.",
        )
    return FileResponse(img_path)


@app.post("/api/resolve-doi")
async def resolve_doi_endpoint(req: ResolveDoiRequest) -> dict:
    """
    Resuelve un DOI via Crossref content negotiation (gratis, sin API key).
    Retorna la referencia formateada en APA 7.
    """
    doi_clean: str = req.doi.strip()
    if not doi_clean:
        raise HTTPException(
            status_code=400,
            detail="El DOI no puede estar vacio.",
        )

    try:
        formatted = await resolve_doi(doi_clean)
        if formatted:
            return {"doi": doi_clean, "formatted": formatted}
        else:
            return {
                "doi": doi_clean,
                "formatted": None,
                "error": "No se pudo resolver el DOI. Verifica que sea correcto.",
            }
    except Exception as e:
        return {
            "doi": doi_clean,
            "formatted": None,
            "error": f"Error al consultar Crossref: {str(e)}",
        }


@app.post("/api/references/resolve-batch")
async def resolve_batch_endpoint(req: ResolveBatchRequest) -> dict:
    from modules.referencias_module import resolve_dois_batch
    try:
        results = await resolve_dois_batch(req.references)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/validate")
async def validate_document(req: GenerateRequest) -> dict:
    """
    Ejecuta la validacion cruzada entre citas y referencias.
    """
    doc: Optional[DocumentModel] = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Sesion no encontrada.",
        )

    issues = validate_apa_integrity(doc, req.references or [])
    return {"issues": [i.model_dump() for i in issues]}


@app.post("/api/validate/ai")
async def validate_document_with_ai(
    session_id: str = Form(...),
    references: str = Form("[]"),
    api_key: Optional[str] = Form(None),
    nim_url: Optional[str] = Form(None),
    use_local: Optional[str] = Form(None),
    provider_id: Optional[str] = Form(None),
) -> dict:
    """
    Validacion de citas potenciada por IA (opcional).
    Usa LLM para verificar matches inciertos entre citas y referencias.
    Solo se ejecuta si el usuario proporciona API key y lo habilita explicitamente.
    """
    doc: Optional[DocumentModel] = load_session_state(session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesion no encontrada.")

    refs = json.loads(references) if references else []
    ref_models = [ReferenciaModel(**r) for r in refs]

    issues = await validate_citations_with_llm(doc, ref_models, api_key, nim_url, use_local == 'true')
    return {"issues": [i.model_dump() for i in issues]}


@app.post("/api/validate-layout/{session_id}")
async def validate_layout_endpoint(session_id: str) -> dict:
    """
    Realiza una auditoría estructural del layout post-generación usando COM.
    Busca tablas huérfanas o que abarcan múltiples páginas, y verifica que
    la sección de Referencias inicie en una nueva página.
    """
    doc: Optional[DocumentModel] = load_session_state(session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesion no encontrada.")
        
    out_dir = STORAGE_DIR / "sessions" / session_id
    files = list(out_dir.glob("APA7_*.docx"))
    
    if not files:
        raise HTTPException(status_code=404, detail="No se encontró el documento generado.")
        
    target_docx = files[0]
    
    from generation.post_processor import get_com_post_processor
    post_processor = get_com_post_processor()
    
    if not post_processor.is_available():
        return {
            "status": "warning", 
            "message": "COM no está disponible en este sistema. La validación visual de layout (Fase 7+) requiere Windows y MS Word instalado.",
            "issues": []
        }
        
    result = post_processor.audit_layout(target_docx)
    return result

@app.post("/api/preview")
async def generate_preview(req: PreviewRequest) -> dict:
    """
    Genera un preview HTML rapido del documento formateado.
    Genera el DOCX APA 7 en un archivo temporal y lo convierte a HTML
    usando mammoth.js (el frontend se encarga de la conversion real
    via mammoth.js en el navegador — este endpoint solo genera el DOCX
    y retorna la URL de descarga para el preview).
    """
    doc: Optional[DocumentModel] = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Sesion no encontrada.",
        )

    rules: APARuleSet = req.rules if req.rules else APARuleSet()
    out_dir: Path = STORAGE_DIR / "sessions" / req.session_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file: Path = out_dir / f"Preview_{doc.file_name}"

    try:
        output_file: Path = generate_apa7_docx(
            doc,
            out_file,
            rules=rules,
            portada=req.portada,
            references=req.references,
        )

        return {
            "status": "ok",
            "session_id": req.session_id,
            "download_url": f"/api/download-preview/{req.session_id}",
            "output_file": str(output_file.name),
            "updated_elements_count": len(doc.elements),
        }
    except Exception as e:
        print(f"[ERROR] Error generando preview: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generando vista previa: {str(e)}",
        )


@app.post("/api/generate-preview-pdf")
async def generate_preview_pdf_endpoint(req: GenerateRequest) -> dict:
    """
    Genera un PDF rápido para previsualización usando SOLO LibreOffice.
    No ejecuta el motor COM para preservar portadas exactas, priorizando velocidad.
    """
    from services.doc_converter import get_doc_converter
    session_dir = STORAGE_DIR / "sessions" / req.session_id
    if not session_dir.exists():
        raise HTTPException(status_code=404, detail="Sesion no encontrada")

    generated_path = session_dir / "generated.docx"
    preview_pdf_path = session_dir / "preview.pdf"

    if not generated_path.exists():
        # Si aún no existe generated.docx, generar uno base
        await generate_pdf_endpoint(req)

    success = get_doc_converter().convert_docx_to_pdf_lo_only(generated_path, preview_pdf_path)
    if success and preview_pdf_path.exists():
        relative_url = f"/api/sessions/{req.session_id}/preview.pdf"
        return {"status": "ok", "download_url": relative_url}
    else:
        raise HTTPException(status_code=500, detail="Error generando PDF de vista previa")

@app.post("/api/generate-pdf")
async def generate_pdf_endpoint(req: GenerateRequest) -> dict:
    """
    Genera el archivo PDF final formateado con APA 7 a partir del DOCX.
    """
    doc: Optional[DocumentModel] = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")

    out_dir = STORAGE_DIR / "sessions" / req.session_id
    out_dir.mkdir(parents=True, exist_ok=True)

    clean_file_name = doc.file_name or "document.docx"
    clean_file_name = clean_file_name.replace(" ", "_")
    docx_name = f"APA7_{clean_file_name}"
    docx_path = out_dir / docx_name
    pdf_name = docx_name.rsplit(".", 1)[0] + ".pdf"
    pdf_path = out_dir / pdf_name

    rules = req.rules or APARuleSet()
    portada = req.portada or PortadaData()
    references = req.references or []

    from services.doc_converter import get_doc_converter
    doc_converter = get_doc_converter()
    
    preserve_cover = portada.use_original_cover and doc.portada.get("detected", False)
    
    # Remove cover paragraphs only if we have COM active, because LO doesn't do transplant yet
    is_com = doc_converter.get_active_engine() == "COM"
    
    generate_apa7_docx(
        doc, docx_path, rules=rules, portada=portada, references=references,
        remove_cover_paragraphs=preserve_cover and is_com
    )

    original_path = STORAGE_DIR / "sessions" / req.session_id / "original.docx"

    # Inyectar Post-Processor Dual Engine para PDF
    final_path = out_dir / f"FinalPDFSource_{clean_file_name}"
    
    success, pdf_out_path = doc_converter.process_and_convert(
        original_path=original_path,
        generated_path=docx_path,
        final_path=final_path,
        preserve_cover=preserve_cover,
        generate_pdf=True
    )
    
    pdf_generated = False
    
    if success and pdf_out_path and pdf_out_path.exists():
        pdf_generated = True
        # Mover el PDF al path correcto
        import shutil
        shutil.move(str(pdf_out_path), str(pdf_path))
        if final_path.exists():
            final_path.unlink()
    else:
        # Fallback a LibreOffice o docx2pdf
        try:
            res = subprocess.run(["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", str(out_dir), str(docx_path)], capture_output=True, timeout=30)
            if res.returncode == 0 and pdf_path.exists():
                pdf_generated = True
        except Exception as e:
            print(f"[WARN] LibreOffice conversion exception: {e}")

    if not pdf_generated:
        try:
            from docx2pdf import convert
            convert(str(docx_path), str(pdf_path))
            if pdf_path.exists():
                pdf_generated = True
        except Exception as e:
            print(f"[WARN] docx2pdf conversion exception: {e}")

    if pdf_generated and pdf_path.exists():
        return {
            "status": "ok",
            "session_id": req.session_id,
            "download_url": f"/api/download-pdf/{req.session_id}",
            "pdf_name": pdf_name,
        }
    else:
        return {
            "status": "fallback_docx",
            "session_id": req.session_id,
            "download_url": f"/api/download/{req.session_id}",
            "docx_name": docx_name,
            "message": "Conversión PDF no disponible en este entorno; se descargará la versión DOCX oficial.",
        }


@app.get("/api/download-pdf/{session_id}")
async def download_pdf(session_id: str):
    out_dir = STORAGE_DIR / "sessions" / session_id
    files = list(out_dir.glob("*.pdf"))
    if not files:
        raise HTTPException(status_code=404, detail="Archivo PDF no encontrado.")
    return FileResponse(
        files[0],
        media_type="application/pdf",
        filename=files[0].name,
    )


@app.get("/api/download-preview/{session_id}")
async def download_preview_docx(session_id: str) -> FileResponse:
    """
    Descarga el DOCX generado para preview.
    El frontend usa mammoth.js para convertir este DOCX a HTML en el navegador.
    """
    out_dir: Path = STORAGE_DIR / "sessions" / session_id
    files: list = list(out_dir.glob("Preview_*.docx"))
    if not files:
        raise HTTPException(
            status_code=404,
            detail="Vista previa no encontrada. Genera el preview primero con /api/preview.",
        )

    target_file: Path = files[0]
    return FileResponse(
        target_file,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=target_file.name,
    )


# ── PREVIEW VÍA LIBREOFFICE (PNG por página, fiel al DOCX real) ──────────────

import shutil
_LIBREOFFICE = shutil.which("libreoffice") or shutil.which("soffice")


@app.post("/api/preview-pages/{session_id}")
async def generate_preview_pages(session_id: str, req: PreviewRequest) -> dict:
    """
    Genera preview como imagenes PNG (una por pagina) via LibreOffice.
    Si LibreOffice no esta instalado, retorna fallback al DOCX tradicional.
    Este preview es 100% fiel porque se renderiza desde el mismo DOCX final.
    """
    doc: Optional[DocumentModel] = load_session_state(session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesion no encontrada.")

    rules = req.rules or APARuleSet()
    out_dir: Path = STORAGE_DIR / "sessions" / session_id / "preview_pages"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Limpiar previews anteriores
    for old in out_dir.glob("page_*.png"):
        old.unlink()

    # Generar DOCX
    preview_docx = out_dir / "preview.docx"
    try:
        generate_apa7_docx(doc, preview_docx, rules=rules,
                           portada=req.portada, references=req.references)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando preview: {e}")

    from services.lo_service import get_libreoffice_service
    lo = get_libreoffice_service()
    
    if not lo.is_available():
        return {
            "status": "fallback_html",
            "message": "LibreOffice no instalado",
            "pages": [],
            "total_pages": 0,
            "fallback_docx_url": f"/api/download-preview/{session_id}",
        }

    # Convertir DOCX → PDF via LibreOffice Service
    import asyncio
    try:
        # Usamos asyncio.to_thread para no bloquear si demora un poco
        success = await asyncio.to_thread(lo.convert, preview_docx, "pdf", out_dir)
        if not success:
            raise Exception("LibreOffice Falló al generar el PDF")
        
        pdf_file = out_dir / "preview.pdf"
        if not pdf_file.exists():
            raise Exception("PDF no fue creado.")
            
        return {
            "status": "pdf",
            "pdf_url": f"/api/preview-pdf/{session_id}/preview.pdf",
            "message": "Preview generado"
        }
    except Exception as e:
        return {
            "status": "fallback_html",
            "message": f"Error: {e}",
            "pages": [],
            "total_pages": 0,
            "fallback_docx_url": f"/api/download-preview/{session_id}",
        }

@app.get("/api/preview-pdf/{session_id}/preview.pdf")
async def get_preview_pdf(session_id: str) -> FileResponse:
    """
    Sirve el PDF generado para el preview de la sesión.
    """
    pdf_path: Path = STORAGE_DIR / "sessions" / session_id / "preview_pages" / "preview.pdf"
    if not pdf_path.exists():
        raise HTTPException(
            status_code=404,
            detail="PDF no encontrado. Genera el preview primero.",
        )
    return FileResponse(pdf_path, media_type="application/pdf")


@app.post("/api/export-latex/{session_id}")
async def export_latex_endpoint(session_id: str):
    """
    Fase 8: Exporta semánticamente el modelo a LaTeX compilable.
    """
    doc: Optional[DocumentModel] = load_session_state(session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")
        
    from generation.latex_exporter import export_to_latex
    try:
        latex_code = export_to_latex(doc)
        return {"latex": latex_code}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate")
async def generate_docx(req: GenerateRequest) -> dict:
    """
    Genera el archivo .docx final formateado con APA 7 para ser descargado por el usuario.
    """
    doc: Optional[DocumentModel] = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Sesion no encontrada.",
        )

    if not doc.elements or len(doc.elements) == 0:
        raise HTTPException(
            status_code=400,
            detail="El documento no tiene elementos para generar. Sube un documento primero."
        )

    rules: APARuleSet = req.rules if req.rules else APARuleSet()
    out_dir: Path = STORAGE_DIR / "sessions" / req.session_id
    out_file: Path = out_dir / f"APA7_{doc.file_name}"

    try:
        from persistence.idempotency import add_marker_to_docx

        from services.doc_converter import get_doc_converter
        doc_converter = get_doc_converter()
        preserve_cover = (req.portada is not None) and req.portada.use_original_cover and doc.portada.get("detected", False)
        
        is_com = doc_converter.get_active_engine() == "COM"
        
        generated_path: Path = generate_apa7_docx(
            doc, out_file, rules, req.portada, req.references,
            remove_cover_paragraphs=preserve_cover and is_com
        )
        
        original_path = STORAGE_DIR / "sessions" / req.session_id / "original.docx"
        
        # Inyectar Post-Processor Dual Engine
        final_path = out_dir / f"Final_{doc.file_name}"
        success, pdf_path = doc_converter.process_and_convert(
            original_path=original_path,
            generated_path=generated_path,
            final_path=final_path,
            preserve_cover=preserve_cover,
            generate_pdf=False # El endpoint de PDF se maneja en /api/generate-pdf
        )
        
        if success and final_path.exists():
            # Si COM tuvo éxito, el archivo oficial es final_path
            # Lo renombramos a APA7_...
            final_path.replace(generated_path)

        # Agregar marcador de idempotencia al DOCX generado
        try:
            with open(generated_path, "rb") as f:
                generated_bytes = f.read()
            marked_bytes = add_marker_to_docx(generated_bytes)
            with open(generated_path, "wb") as f:
                f.write(marked_bytes)
        except Exception:
            pass

        return {
            "download_url": f"/api/download/{req.session_id}",
            "filename": f"APA7_{doc.file_name}",
        }
    except Exception as e:
        print(f"[ERROR] Error generando DOCX: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generando el documento APA 7: {str(e)}",
        )


@app.get("/api/download/{session_id}")
async def download_generated_docx(session_id: str) -> FileResponse:
    """
    Descarga el archivo generado.
    """
    out_dir: Path = STORAGE_DIR / "sessions" / session_id
    files: list = list(out_dir.glob("APA7_*.docx"))
    if not files:
        raise HTTPException(
            status_code=404,
            detail="Archivo generado no encontrado. Genera el documento primero con /api/generate.",
        )

    target_file: Path = files[0]
    return FileResponse(
        target_file,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=target_file.name,
    )


@app.post("/api/toggle-layered-gen")
async def toggle_layered_gen(mode: str = Form("auto")) -> dict:
    """Toggle between layered (from-scratch) and modify-in-place generation."""
    if mode == "layered":
        os.environ["WORDAPA7_LAYERED_GEN"] = "1"
    else:
        os.environ["WORDAPA7_LAYERED_GEN"] = "0"
    return {"mode": mode, "layered_gen": os.getenv("WORDAPA7_LAYERED_GEN", "0") == "1"}


@app.post("/api/generate-tracked")
async def generate_tracked_docx_endpoint(req: GenerateRequest) -> dict:
    """
    Genera el archivo .docx con marcas de revision de cambios (Track Changes OOXML).
    """
    doc: Optional[DocumentModel] = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Sesion no encontrada.",
        )

    rules: APARuleSet = req.rules if req.rules else APARuleSet()
    out_dir: Path = STORAGE_DIR / "sessions" / req.session_id
    out_file: Path = out_dir / f"Tracked_{doc.file_name}"

    try:
        create_tracked_changes_docx(doc, out_file, rules)
        return {
            "download_url": f"/api/download-tracked/{req.session_id}",
            "filename": f"Tracked_{doc.file_name}",
        }
    except Exception as e:
        print(f"[ERROR] Error generando tracked changes: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generando documento con control de cambios: {str(e)}",
        )


@app.get("/api/download-tracked/{session_id}")
async def download_tracked_docx(session_id: str) -> FileResponse:
    """
    Descarga el archivo con control de cambios generado.
    """
    out_dir: Path = STORAGE_DIR / "sessions" / session_id
    files: list = list(out_dir.glob("Tracked_*.docx"))
    if not files:
        raise HTTPException(
            status_code=404,
            detail="Archivo de comparacion no encontrado.",
        )
    target_file: Path = files[0]
    return FileResponse(
        target_file,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=target_file.name,
    )


# ── ENDPOINTS DE FUNCIONALIDADES AVANZADAS (CITAS, REFERENCIAS, ESTRUCTURA) ──

class GenerateReferenceRequest(BaseModel):
    raw_text: str


@app.post("/api/validate-citations/{session_id}")
async def validate_citations_endpoint(session_id: str) -> dict:
    """
    Cruza las citas extraídas del texto con las referencias para detectar
    citas fantasma (ghost citations) y referencias huérfanas (orphan references).
    No usa LLM, es 100% heurístico.
    """
    doc: Optional[DocumentModel] = load_session_state(session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")
        
    from parsing.citation_matcher import cross_check_citations_and_references
    from services.graph_rag import build_citation_graph, validate_citations_against_graph
    
    # 1. Base validation
    result = cross_check_citations_and_references(doc)
    
    # 2. Advanced Graph RAG validation
    if doc.references:
        references_text = [r.text for r in doc.references if r.text]
        graph = build_citation_graph(references_text)
        
        graph_issues = []
        for elem in doc.elements:
            if elem.type == ElementType.PARAGRAPH and elem.text:
                issues = validate_citations_against_graph(elem.text, graph)
                if issues:
                    graph_issues.extend(issues)
        
        if graph_issues:
            # We append Graph RAG advanced issues
            result['ghost_citations'].extend([iss["citation"] for iss in graph_issues if iss["type"] == "missing_reference"])
            
            # For year mismatch, we can add a new field or just format it as ghost citation
            result['ghost_citations'].extend([iss["message"] for iss in graph_issues if iss["type"] == "year_mismatch"])

            # Deduplicate just in case
            result['ghost_citations'] = list(set(result['ghost_citations']))
    
    # Save the doc since we mutated `doc.citas_intext`
    save_session_state(doc, STORAGE_DIR)
    
    return result

@app.post("/api/detect-citations/{session_id}")
async def detect_citations_endpoint(session_id: str, api_key: Optional[str] = Form(None)) -> dict:
    """
    Detecta citas in-text en los párrafos del documento usando la IA.
    """
    doc: Optional[DocumentModel] = load_session_state(session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")

    from classification.citation_detector import detect_citations_in_text

    citations = []
    paras = [e for e in doc.elements if e.type == ElementType.PARAGRAPH and e.text and len(e.text.strip()) > 20]

    for p in paras[:15]:
        detected = await detect_citations_in_text(p.text, p.id, api_key)
        citations.extend([c.model_dump() for c in detected])
        if detected:
            await asyncio.sleep(1.0)

    return {
        "status": "ok",
        "session_id": session_id,
        "total_citations_found": len(citations),
        "citations": citations,
    }


@app.post("/api/generate-reference")
async def generate_reference_endpoint(req: GenerateReferenceRequest) -> dict:
    """
    Formatea una referencia bibliográfica a partir de texto libre o DOI.
    """
    raw = req.raw_text.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="El texto de la referencia no puede estar vacío.")

    import re
    doi_match = re.search(r'10\.\d{4,9}/[-._;()/:A-Z0-9]+', raw, re.IGNORECASE)
    if doi_match:
        doi_str = doi_match.group(0)
        formatted = await resolve_doi(doi_str)
        if formatted:
            return {
                "status": "ok",
                "source": "crossref",
                "formatted_apa": formatted,
                "raw_text": raw,
            }

    title_est = raw.split('.')[0] if '.' in raw else raw
    return {
        "status": "ok",
        "source": "rule_engine",
        "formatted_apa": f"{raw.rstrip('.')}.",
        "title": title_est,
        "raw_text": raw,
    }


@app.get("/api/templates")
async def list_templates_endpoint() -> dict:
    """
    Lista las plantillas de estructura de documento disponibles.
    """
    from generation.templates import AVAILABLE_TEMPLATES, DocumentTemplate

    result = []
    for t in AVAILABLE_TEMPLATES:
        result.append({
            "name": t.name,
            "description": t.description,
            "has_cover_page": t.has_cover_page,
            "has_toc": t.has_toc,
            "has_references": t.has_references,
            "section_count": len(t.sections),
        })
    return {"templates": result}


class ApplyTemplateRequest(BaseModel):
    session_id: str
    template_name: str
    numbering_style: str = "decimal"  # "decimal" | "roman"


@app.post("/api/apply-template")
async def apply_template_endpoint(req: ApplyTemplateRequest) -> dict:
    """
    Aplica una plantilla de estructura al documento:
    - Inserta secciones faltantes según la plantilla elegida
    - Reordena headings existentes
    - Retorna el resumen de cambios realizados
    """
    from generation.templates import get_template, DocumentTemplate, TemplateSection

    doc: Optional[DocumentModel] = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesion no encontrada.")

    template = get_template(req.template_name)
    if not template:
        raise HTTPException(status_code=404, detail=f"Plantilla '{req.template_name}' no encontrada.")

    # Analizar qué headings ya existen en el documento
    existing_headings: dict[str, ElementModel] = {}
    existing_heading_texts_lower: set[str] = set()
    for elem in doc.elements:
        if elem.type == ElementType.HEADING and elem.text and elem.text.strip():
            lower = elem.text.strip().lower()
            existing_headings[lower] = elem
            existing_heading_texts_lower.add(lower)

    changes_made: list[dict] = []
    sections_created: int = 0

    # Función recursiva para procesar secciones de la plantilla
    def _process_section(section: TemplateSection, parent_idx: int = -1) -> None:
        nonlocal sections_created
        text_lower = section.suggested_text.strip().lower()

        if text_lower not in existing_heading_texts_lower:
            # Crear nuevo elemento de heading faltante
            new_elem = ElementModel(
                id=f"template_elem_{len(doc.elements) + sections_created + 1}",
                type=ElementType.HEADING,
                heading_level=section.heading_level,
                text=section.suggested_text,
                original_text=section.suggested_text,
                confidence=1.0,
                is_user_modified=False,
                needs_review=False,
                auto_applied=True,
                pre_classifier_rule="template",
            )
            # Insertar al final de los elementos (antes de referencias si existen)
            insert_idx = len(doc.elements)
            for ei, existing in enumerate(doc.elements):
                if existing.type == ElementType.HEADING and existing.text:
                    et_lower = existing.text.strip().lower()
                    if any(kw in et_lower for kw in ["referencia", "bibliograf"]):
                        insert_idx = ei
                        break
            doc.elements.insert(insert_idx, new_elem)
            existing_heading_texts_lower.add(text_lower)
            sections_created += 1
            changes_made.append({
                "action": "created",
                "text": section.suggested_text,
                "level": section.heading_level,
            })
        else:
            # Ya existe: marcar como modificado por plantilla
            existing = existing_headings.get(text_lower)
            if existing:
                changes_made.append({
                    "action": "preserved",
                    "text": section.suggested_text,
                    "level": existing.heading_level,
                })

        # Procesar sub-secciones
        for sub in section.sub_sections:
            _process_section(sub)

    for section in template.sections:
        _process_section(section)

    save_session_state(doc, STORAGE_DIR)

    return {
        "status": "ok",
        "session_id": req.session_id,
        "template_applied": req.template_name,
        "sections_created": sections_created,
        "changes_made": changes_made,
    }


@app.post("/api/analyze-structure/{session_id}")
async def analyze_structure_endpoint(session_id: str) -> dict:
    """
    Analiza la estructura APA 7 del documento e identifica secciones faltantes.
    """
    doc: Optional[DocumentModel] = load_session_state(session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")

    headings_text = [e.text.lower() for e in doc.elements if e.type == ElementType.HEADING and e.text]
    full_headings_str = " ".join(headings_text)

    expected_sections = [
        ("Introducción", ["introduc", "introducción", "introduccion"]),
        ("Métodos / Metodología", ["metodolog", "método", "metodo"]),
        ("Resultados", ["resultado", "hallazgo"]),
        ("Discusión y Conclusiones", ["discusión", "discusion", "conclusi"]),
        ("Referencias Bibliográficas", ["referencia", "bibliograf"]),
    ]

    found_sections = []
    missing_sections = []

    for name, keywords in expected_sections:
        if any(kw in full_headings_str for kw in keywords):
            found_sections.append(name)
        else:
            missing_sections.append(name)

    suggestions = []
    if "Introducción" in missing_sections:
        suggestions.append("Se recomienda añadir una sección 'Introducción' clara después de la portada.")
    if "Métodos / Metodología" in missing_sections:
        suggestions.append("Falta la sección 'Metodología' para detallar el procedimiento del estudio.")
    if "Resultados" in missing_sections:
        suggestions.append("No se detectó un encabezado de 'Resultados'.")
    if "Referencias Bibliográficas" in missing_sections:
        suggestions.append("Se recomienda añadir la lista de 'Referencias Bibliográficas' al final del documento.")

    return {
        "status": "ok",
        "session_id": session_id,
        "found_sections": found_sections,
        "missing_sections": missing_sections,
        "suggestions": suggestions,
        "completeness_score": int((len(found_sections) / len(expected_sections)) * 100),
    }


# ── COVER DESIGNER ENDPOINTS ─────────────────────────────────────────────────

@app.get("/api/cover-templates")
async def list_cover_templates_endpoint() -> dict:
    """
    Lista todas las plantillas de portada disponibles (integradas + del usuario).
    """
    from modules.cover_designer import list_cover_templates, CoverTemplate
    templates = list_cover_templates(BASE_DIR)
    return {
        "templates": [
            {
                "name": t.name,
                "description": t.description,
                "source_type": t.source_type,
                "source_path": t.source_path if not t.is_builtin else "",
                "preview_path": t.preview_path if not t.is_builtin else "",
                "is_builtin": t.is_builtin,
                "created_at": t.created_at,
            }
            for t in templates
        ]
    }


class UploadCoverImageRequest(BaseModel):
    name: str
    description: str = ""


@app.post("/api/cover-templates/upload-image")
async def upload_cover_image_endpoint(
    file: UploadFile = File(...),
    name: str = Form("Mi Portada"),
    description: str = Form(""),
) -> dict:
    """
    Sube una imagen como portada y la guarda como plantilla reutilizable.
    """
    from modules.cover_designer import create_cover_from_image

    if not file.filename:
        raise HTTPException(status_code=400, detail="Archivo no valido.")

    # Guardar imagen temporalmente
    temp_dir = STORAGE_DIR / "temp_covers"
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_path = temp_dir / file.filename
    content = await file.read()

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="El archivo esta vacio.")

    temp_path.write_bytes(content)

    try:
        template = create_cover_from_image(
            temp_path, name, description, BASE_DIR
        )
        return {
            "status": "ok",
            "template": {
                "name": template.name,
                "description": template.description,
                "source_type": template.source_type,
                "source_path": template.source_path,
                "preview_path": template.preview_path,
                "is_builtin": template.is_builtin,
            },
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creando plantilla de portada: {str(e)}",
        )
    finally:
        # Limpiar archivo temporal
        if temp_path.exists():
            temp_path.unlink()


@app.post("/api/cover-templates/upload-docx")
async def upload_cover_docx_endpoint(
    file: UploadFile = File(...),
    name: str = Form("Mi Portada Word"),
    description: str = Form(""),
) -> dict:
    """
    Sube un documento Word como portada y lo guarda como plantilla reutilizable.
    """
    from modules.cover_designer import create_cover_from_docx

    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=400,
            detail="Solo se admiten archivos .docx.",
        )

    temp_dir = STORAGE_DIR / "temp_covers"
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_path = temp_dir / file.filename
    content = await file.read()

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="El archivo esta vacio.")

    temp_path.write_bytes(content)

    try:
        template = create_cover_from_docx(
            temp_path, name, description, BASE_DIR
        )
        return {
            "status": "ok",
            "template": {
                "name": template.name,
                "description": template.description,
                "source_type": template.source_type,
                "source_path": template.source_path,
                "preview_path": template.preview_path,
                "is_builtin": template.is_builtin,
            },
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creando plantilla de portada: {str(e)}",
        )
    finally:
        if temp_path.exists():
            temp_path.unlink()


@app.delete("/api/cover-templates/{name:path}")
async def delete_cover_template_endpoint(name: str) -> dict:
    """
    Elimina una plantilla de portada creada por el usuario.
    Las plantillas integradas no se pueden eliminar.
    """
    from modules.cover_designer import delete_cover_template

    success = delete_cover_template(name, BASE_DIR)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Plantilla no encontrada o no se pudo eliminar. Las plantillas integradas no se pueden eliminar.",
        )
    return {"status": "ok", "message": f"Plantilla '{name}' eliminada correctamente."}


class ApplyCoverRequest(BaseModel):
    session_id: str
    cover_template_name: str
    title: str = ""
    author: str = ""
    institution: str = ""
    course: str = ""
    instructor: str = ""
    date: str = ""


@app.post("/api/apply-cover")
async def apply_cover_endpoint(req: ApplyCoverRequest) -> dict:
    """
    Aplica una plantilla de portada al documento generado.
    La portada se antepone al inicio del documento sin ser modificada por APA 7.
    """
    from modules.cover_designer import list_cover_templates, apply_cover_to_document, CoverTemplate

    doc: Optional[DocumentModel] = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesion no encontrada.")

    # Snapshot antes de modificar portada
    from persistence.session_manager import save_session_snapshot
    save_session_snapshot(doc, STORAGE_DIR)

    # Buscar la plantilla por nombre
    templates = list_cover_templates(BASE_DIR)
    template: Optional[CoverTemplate] = None
    for t in templates:
        if t.name == req.cover_template_name:
            template = t
            break

    if not template:
        raise HTTPException(
            status_code=404,
            detail=f"Plantilla '{req.cover_template_name}' no encontrada.",
        )

    # Guardar la seleccion de portada en la sesion para que generator.py la use
    doc.portada = doc.portada or {}
    if isinstance(doc.portada, dict):
        doc.portada["cover_template_id"] = req.cover_template_name
        doc.portada["use_original_cover"] = False
        doc.portada["force_skip_cover"] = True
    save_session_state(doc, STORAGE_DIR)

    # Reload to return updated doc state
    updated_doc = load_session_state(req.session_id, STORAGE_DIR)

    response: dict = {
        "status": "ok",
        "message": f"Portada '{req.cover_template_name}' aplicada correctamente.",
        "cover_template_name": req.cover_template_name,
    }

    if updated_doc:
        response["document"] = updated_doc.model_dump()

    return response


class ServeCoverPreviewRequest(BaseModel):
    name: str


@app.get("/api/cover-templates/preview/{name:path}")
async def serve_cover_preview(name: str) -> FileResponse:
    """
    Sirve la imagen de preview de una plantilla de portada.
    """
    from modules.cover_designer import list_cover_templates

    templates = list_cover_templates(BASE_DIR)
    for t in templates:
        if t.name == name and t.preview_path:
            preview_file = Path(t.preview_path)
            if preview_file.exists():
                return FileResponse(preview_file, media_type="image/png")

    # Fallback: retornar placeholder
    raise HTTPException(status_code=404, detail="Preview no disponible para esta plantilla.")


# ── BUILD HASH CACHE ─────────────────────────────────────────────────────────

_build_hash_cache: str | None = None
_build_hash_cache_time: float = 0.0


def _read_build_hash() -> str:
    """Lee build_hash de dist/version.json con caché de 60 segundos."""
    global _build_hash_cache, _build_hash_cache_time
    import time
    now = time.time()
    if _build_hash_cache and (now - _build_hash_cache_time) < 60:
        return _build_hash_cache

    version_file = DIST_DIR / "version.json"
    try:
        if version_file.exists():
            with open(version_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            _build_hash_cache = data.get("build_hash", "unknown")
            _build_hash_cache_time = now
            return _build_hash_cache
    except Exception:
        pass
    _build_hash_cache = "unknown"
    _build_hash_cache_time = now
    return _build_hash_cache


# ── DEBUG LOGGING Y TRACING ───────────────────────────────────────────────────
import datetime

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "ts": datetime.datetime.fromtimestamp(record.created).astimezone().isoformat(),
            "level": record.levelname.lower(),
            "module": record.name,
            "msg": record.getMessage()
        }
        if record.exc_info:
            log_record["msg"] += f" | Exception: {self.formatException(record.exc_info)}"
        return json.dumps(log_record)

# Determine the log file path based on APP_USERDATA env var or default STORAGE_DIR
user_data_dir = os.environ.get('APP_USERDATA', str(STORAGE_DIR))
log_file_path = os.path.join(user_data_dir, 'python-backend.log')

file_handler = logging.FileHandler(log_file_path, encoding='utf-8')
file_handler.setFormatter(JsonFormatter())

stream_handler = logging.StreamHandler()
stream_handler.setFormatter(JsonFormatter())

logging.basicConfig(
    level=logging.DEBUG,
    handlers=[file_handler, stream_handler]
)

logger = logging.getLogger('wordapa7')


@app.middleware("http")
async def debug_logging_middleware(request: Request, call_next):
    """Log ALL requests and responses for debugging (pre-production)."""
    request_id = uuid.uuid4().hex[:8]
    start = time.time()

    logger.info(f"[REQ {request_id}] {request.method} {request.url.path}")

    response = await call_next(request)

    duration_ms = (time.time() - start) * 1000
    logger.info(
        f"[RES {request_id}] {response.status_code} | "
        f"Duration: {duration_ms:.1f}ms"
    )

    response.headers["X-Request-ID"] = request_id
    return response





@app.get("/api/debug-log/{lines}")
async def get_debug_log(lines: int = 50) -> dict:
    """Returns the last N lines of the debug log for review."""
    log_file = STORAGE_DIR / 'debug.log'
    if not log_file.exists():
        return {"lines": [], "total": 0}

    with open(log_file, 'r', encoding='utf-8') as f:
        all_lines = f.readlines()

    recent = all_lines[-lines:] if len(all_lines) > lines else all_lines
    return {
        "lines": [l.strip() for l in recent],
        "total": len(all_lines),
    }


# ── SERVIR FRONTEND ESTATICO ──────────────────────────────────────────────────

@app.get("/api/word/recent-files")
async def get_recent_files():
    try:
        from services.word_com_service import get_word_com_service
        word_service = get_word_com_service()
        word = word_service.word
        if not word:
            return {"files": [], "error": "Word COM Service no disponible"}
            
        recent = []
        for i in range(1, min(6, word.RecentFiles.Count + 1)):
            recent.append({
                "name": word.RecentFiles.Item(i).Name,
                "path": word.RecentFiles.Item(i).Path
            })
        return {"files": recent}
    except Exception as e:
        return {"files": [], "error": str(e)}

@app.get("/api/spelling/{session_id}")
async def check_spelling(session_id: str, api_key: Optional[str] = None):
    doc_model = load_session_state(session_id, STORAGE_DIR)
    if not doc_model:
        raise HTTPException(status_code=404, detail="Sesion no encontrada")
    
    session_dir = STORAGE_DIR / "sessions" / session_id
    docx_path = session_dir / "original.docx"
    if not docx_path.exists():
        raise HTTPException(status_code=404, detail="Archivo original no encontrado")
        
    from modules.spelling_validator import validate_spelling_and_grammar, check_spelling_with_ia
    
    result = await validate_spelling_and_grammar(str(docx_path))
    if result.get("status") == "ok" and api_key and result.get("spelling_errors"):
        result["spelling_errors"] = await check_spelling_with_ia(result["spelling_errors"], api_key)
        
    return result

# ── MONTAJE DEL FRONTEND (SPA) ───────────────────────────────────────────────

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path

    # X-Build-Hash en todas las respuestas para debug
    build_hash = _read_build_hash()
    response.headers["X-Build-Hash"] = build_hash

    # Estrategia de caché por tipo de archivo
    if path == "/" or path.endswith("/index.html") or path.endswith("version.json"):
        # HTML raíz y manifest NUNCA se cachean
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    elif path.startswith("/assets/"):
        # Assets con hash de Vite (inmutables por build) → 24h
        if any(ext in path for ext in (".js", ".css", ".woff", ".woff2", ".ttf")):
            response.headers["Cache-Control"] = "public, max-age=86400, immutable"
        else:
            response.headers["Cache-Control"] = "public, max-age=3600, must-revalidate"
    elif any(path.endswith(ext) for ext in (".js", ".css", ".json", ".svg", ".png", ".jpg", ".ico", ".woff2")):
        # Otros archivos estáticos
        response.headers["Cache-Control"] = "public, max-age=3600, must-revalidate"

    return response


@app.get("/api/version")
async def get_version():
    """Retorna la versión y build_hash actual para que el frontend detecte cambios."""
    build_hash = _read_build_hash()
    version_file = DIST_DIR / "version.json"
    build_time = None
    if version_file.exists():
        try:
            with open(version_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            build_time = data.get("build_time")
        except Exception:
            pass

    return {
        "version": "1.0.0",
        "build_hash": build_hash,
        "build_time": build_time,
        "stale": build_hash == "unknown",
    }


def _compute_src_content_hash(src_dir: Path) -> str:
    """Hash SHA-256 compuesto del contenido de src/ para detectar cambios reales."""
    if not src_dir.exists():
        return "no-src"
    h = hashlib.sha256()
    for fp in sorted(src_dir.rglob("*")):
        if fp.is_file() and "node_modules" not in fp.parts:
            rel = fp.relative_to(src_dir).as_posix()
            h.update(rel.encode())
            try:
                with open(fp, "rb") as f:
                    while chunk := f.read(65536):
                        h.update(chunk)
            except Exception:
                pass
    return h.hexdigest()[:12]


def check_and_auto_build_frontend() -> None:
    """
    Verifica si el frontend necesita recompilación comparando hash de contenido
    de src/ contra el build_hash guardado en dist/version.json.
    Si dist/ no existe, version.json no existe, o los hashes difieren, hace rebuild.
    """
    src_dir = BASE_DIR / "src"
    dist_index = BASE_DIR / "dist" / "index.html"
    version_file = BASE_DIR / "dist" / "version.json"

    if not src_dir.exists():
        return

    should_build = False
    reason = ""

    if not dist_index.exists():
        should_build = True
        reason = "dist/index.html no existe"
    elif not version_file.exists():
        should_build = True
        reason = "dist/version.json no existe (build manifest)"
    else:
        # Comparar hash de contenido, no mtime
        src_hash = _compute_src_content_hash(src_dir)
        try:
            with open(version_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            stored_hash = data.get("build_hash", "")
        except Exception:
            stored_hash = ""

        if src_hash != stored_hash:
            should_build = True
            reason = f"src_hash={src_hash} != build_hash={stored_hash} (cambios detectados en código fuente)"

    if should_build:
        print(f"[AUTO-BUILD] {reason}. Recompilando con 'npm run build'...")
        try:
            cmd = ["npm.cmd", "run", "build"] if os.name == 'nt' else ["npm", "run", "build"]
            res = subprocess.run(cmd, cwd=str(BASE_DIR), capture_output=True, text=True)
            if res.returncode == 0:
                print("[AUTO-BUILD] ✅ Recompilación exitosa del frontend!")
                # Invalidar caché de build_hash
                global _build_hash_cache, _build_hash_cache_time
                _build_hash_cache = None
                _build_hash_cache_time = 0.0
            else:
                print(f"[WARN] Error durante npm run build: {res.stderr[:200]}")
        except Exception as e:
            print(f"[WARN] No se pudo ejecutar npm run build automáticamente: {e}")


if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="static")
else:
    @app.get("/")
    async def serve_index():
        return JSONResponse({
            "message": (
                "Servidor backend de WordAPA7 listo. "
                "Construye la UI con 'npm run build' para servir la interfaz estatica aqui."
            ),
        })


# ── INICIO DEL SERVIDOR ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8742, help='Port to run the server on')
    args, unknown = parser.parse_known_args()

    # 1. Verificar y recompilar frontend si hubo cambios en src/
    check_and_auto_build_frontend()

    # 2. Crear plantilla inicial si no existe
    template_path: Path = BASE_DIR / "apa7_template.docx"
    if not template_path.exists():
        try:
            create_apa7_template(template_path)
            print(f"[INFO] Plantilla APA 7 creada en: {template_path}")
        except Exception as e:
            print(f"[WARN] No se pudo crear la plantilla APA 7: {e}")

    print("=" * 60)
    print(f" WordAPA7 — Servidor iniciado en http://localhost:{args.port}")
    print(" Presiona Ctrl+C para detener")
    print("=" * 60)
    uvicorn.run(app, host="127.0.0.1", port=args.port)

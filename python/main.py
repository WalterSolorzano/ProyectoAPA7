"""
WordAPA7 — Servidor Principal FastAPI

Servidor Web unificado que expone los endpoints REST para la manipulacion de documentos
y sirve la interfaz estatica construida en React (dist/).
"""

import os
import sys
import uuid
from pathlib import Path
from typing import List, Optional

from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
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
from classification.llm_classifier import classify_document_with_llm
from generation.generator import generate_apa7_docx
from generation.track_changes_engine import create_tracked_changes_docx
from persistence.session_manager import (
    save_session_state,
    load_session_state,
    list_recent_sessions,
    delete_session,
)
from persistence.idempotency import check_idempotency, init_sqlite_db
from modules.apa_validator import validate_apa_integrity
from modules.referencias_module import resolve_doi
from create_template import create_apa7_template


# ── CONFIGURACION Y RUTAS DE ALMACENAMIENTO ──────────────────────────────────

BASE_DIR: Path = Path(__file__).resolve().parent.parent
STORAGE_DIR: Path = BASE_DIR / "storage"
STORAGE_DIR.mkdir(exist_ok=True)

DIST_DIR: Path = BASE_DIR / "dist"

app = FastAPI(title="WordAPA7 API", version="1.0.0")

# CORS middleware para desarrollo con Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── SCHEMAS DE PETICION API ───────────────────────────────────────────────────

class UpdateElementRequest(BaseModel):
    session_id: str
    element_id: str
    type: ElementType
    heading_level: Optional[int] = 1
    text: Optional[str] = None


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
        "message": result.message,
    }


@app.post("/api/upload")
async def upload_docx(
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

    if len(content) == 0:
        raise HTTPException(
            status_code=400,
            detail="El archivo esta vacio. Por favor selecciona un documento .docx valido.",
        )

    try:
        # Validar y aplicar wizard params
        fmt = APAFormat.STUDENT
        if apa_format and apa_format.lower() == "professional":
            fmt = APAFormat.PROFESSIONAL

        mode = WorkMode.REVIEW
        if work_mode and work_mode.lower() == "quick":
            mode = WorkMode.QUICK

        doc_model: DocumentModel = parse_docx_bytes(
            content, file.filename, session_id, STORAGE_DIR
        )

        # Apply wizard settings to model
        doc_model.apa_format = fmt
        if doc_model.meta:
            doc_model.meta.apa_format = fmt
            doc_model.meta.work_mode = mode

        # Inicializar BD de sesiones
        init_sqlite_db(STORAGE_DIR)

        # Guardar sesion
        save_session_state(doc_model, STORAGE_DIR)
        return doc_model
    except Exception as e:
        print(f"[ERROR] Error parseando docx: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando el documento: {str(e)}. "
                   "Verifica que el archivo no este danado o protegido con contrasena.",
        )


class DoiRequest(BaseModel):
    doi: str


@app.post("/api/resolve-doi")
async def resolve_doi_endpoint(req: DoiRequest):
    """
    Resuelve una referencia bibliográfica usando DOI content negotiation.
    """
    from modules.referencias_module import resolve_doi
    doi_clean = req.doi.strip()
    formatted = await resolve_doi(doi_clean)
    if formatted:
        return {
            "status": "ok",
            "doi": doi_clean,
            "apa_formatted": formatted,
            "title": formatted.split('.')[0] if '.' in formatted else formatted,
            "authors": [formatted.split('(')[0].strip()] if '(' in formatted else ["Autor"]
        }
    return {
        "status": "not_found",
        "doi": doi_clean,
        "apa_formatted": f"DOI: {doi_clean} (No se pudo recuperar formato automático)"
    }


@app.post("/api/classify/{session_id}")
async def classify_with_llm(
    session_id: str,
    api_key: Optional[str] = Form(None),
) -> DocumentModel:
    """
    Ejecuta el refinamiento con LLM (NVIDIA NIM) para elementos con baja confianza.
    Solo procesa elementos marcados como needs_review.
    """
    doc: Optional[DocumentModel] = load_session_state(session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Sesion no encontrada. El documento debe ser subido primero con /api/upload.",
        )

    updated_doc: DocumentModel = await classify_document_with_llm(doc, api_key)
    save_session_state(updated_doc, STORAGE_DIR)
    return updated_doc


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

            found = True
            break

    if not found:
        raise HTTPException(
            status_code=404,
            detail="Elemento no encontrado en el documento. Es posible que la sesion se haya modificado.",
        )

    save_session_state(doc, STORAGE_DIR)
    return doc


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
    """
    Elimina una sesion y todos sus archivos asociados.
    """
    success: bool = delete_session(session_id, STORAGE_DIR)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Sesion no encontrada o no se pudo eliminar.",
        )
    return {"status": "ok", "message": f"Sesion {session_id} eliminada correctamente."}


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
        generated_path: Path = generate_apa7_docx(
            doc, out_file, rules, req.portada, req.references
        )

        return {
            "html": "",
            "preview_url": f"/api/download-preview/{req.session_id}",
            "filename": f"Preview_{doc.file_name}",
            "generated": True,
        }
    except Exception as e:
        print(f"[ERROR] Error generando preview: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generando vista previa: {str(e)}",
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

    rules: APARuleSet = req.rules if req.rules else APARuleSet()
    out_dir: Path = STORAGE_DIR / "sessions" / req.session_id
    out_file: Path = out_dir / f"APA7_{doc.file_name}"

    try:
        from persistence.idempotency import add_marker_to_docx

        generated_path: Path = generate_apa7_docx(
            doc, out_file, rules, req.portada, req.references
        )

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


# ── SERVIR FRONTEND ESTATICO ──────────────────────────────────────────────────

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

    # Crear plantilla inicial si no existe
    template_path: Path = BASE_DIR / "apa7_template.docx"
    if not template_path.exists():
        try:
            create_apa7_template(template_path)
            print(f"[INFO] Plantilla APA 7 creada en: {template_path}")
        except Exception as e:
            print(f"[WARN] No se pudo crear la plantilla APA 7: {e}")

    print("=" * 60)
    print(" WordAPA7 — Servidor iniciado en http://localhost:8742")
    print(" Presiona Ctrl+C para detener")
    print("=" * 60)
    uvicorn.run(app, host="127.0.0.1", port=8742)

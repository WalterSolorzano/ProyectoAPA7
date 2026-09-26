"""
WordAPA7 — Servidor Principal FastAPI

Servidor Web unificado que expone los endpoints REST para la manipulacion de documentos
y sirve la interfaz estatica construida en React (dist/).
"""

import asyncio
import datetime
import hashlib
import json
import logging
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import List, Optional

# Asegurar que el directorio de este script esté en sys.path
_current_dir = str(Path(__file__).resolve().parent)
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Restaurar claves de IA guardadas por el usuario (sobreviven a reinicios del backend)
try:
    from persistence.ai_keys import load_provider_keys_into_env
    _restored = load_provider_keys_into_env()
    if _restored:
        print(f"[AI] {_restored} claves de IA restauradas desde almacenamiento persistente")
except Exception as _e:
    print(f"[WARN] No se pudieron restaurar claves persistidas de IA: {_e}")

# Fallback: claves de IA embebidas (ofuscadas) que viajan en el instalador,
# para que funcione sin que el usuario configure nada. Prioridad menor a las
# anteriores (solo se usan las que ya no esten definidas en os.environ).
try:
    from embedded_secrets import load_embedded_into_env
    _emb = load_embedded_into_env()
    if _emb:
        print(f"[AI] {_emb} claves de IA cargadas desde paquete embebido (ofuscadas)")
except Exception as _e2:
    print(f"[WARN] No se pudieron cargar las claves embebidas de IA: {_e2}")

from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Asegurar path de importacion
sys.path.insert(0, str(Path(__file__).resolve().parent))


# ── CONFIGURACION Y RUTAS DE ALMACENAMIENTO ──────────────────────────────────
import build_info
from build_info import _read_build_hash
from config import BASE_DIR, DIST_DIR, STORAGE_DIR, get_apa7_template_path
from create_template import ensure_apa7_template
from generation.generator import generate_apa7_docx
from generation.track_changes_engine import create_tracked_changes_docx
from models import (
    APAFormat,
    APARuleSet,
    DocumentModel,
    ElementModel,
    ElementType,
    PortadaData,
    ReferenciaModel,
)
from modules.apa_validator import validate_apa_integrity, validate_citations_with_llm
from modules.referencias_module import resolve_doi
from persistence.session_manager import (
    load_session_state,
    maybe_run_gc,
    save_session_state,
)
from profiles import get_profile

STORAGE_DIR.mkdir(exist_ok=True)


from contextlib import asynccontextmanager

from services.word_com_service import get_word_com_service


@asynccontextmanager
async def lifespan_app(app: FastAPI):
    # Limpieza inicial de sesiones expiradas al arrancar el servidor (P1.4).
    # maybe_run_gc está acelerado (GC_INTERVAL_SECONDS) y es seguro llamarlo aquí.
    try:
        maybe_run_gc(STORAGE_DIR)
    except Exception as e:
        print(f"[WARN] GC inicial de sesiones falló: {e}")

    # Generar/actualizar manifest.xml dinámico en STORAGE_DIR al arrancar (sideload local)
    try:
        from routers.addin_static import (
            _DEV_ADDIN_URL,
            _DEV_ADDIN_URLS,
            _get_addin_manifest_path,
            _resolve_addin_base_url,
        )
        manifest_src = _get_addin_manifest_path()
        if manifest_src and manifest_src.exists():
            dest_manifest = STORAGE_DIR / "manifest.xml"
            xml_content = manifest_src.read_text(encoding="utf-8")
            addin_base_url = _resolve_addin_base_url()
            xml_content = xml_content.replace(_DEV_ADDIN_URL, addin_base_url)
            for _old_url in _DEV_ADDIN_URLS:
                xml_content = xml_content.replace(_old_url, addin_base_url)
            dest_manifest.write_text(xml_content, encoding="utf-8")
            print(f"[INFO] [ADD-IN] Manifiesto generado en: {dest_manifest} -> apuntando a {addin_base_url}")
        else:
            print("[WARN] [ADD-IN] No se encontró el manifest.xml original de origen para copiar.")
    except Exception as e:
        print(f"[ERROR] [ADD-IN] Error al generar manifest.xml en almacenamiento: {e}")

    yield
    # Shutdown: liberar Word COM heredado del bridge del add-in (antes
    # @app.on_event("shutdown"), deprecated — migrado al lifespan).
    if _rwa:
        try:
            _rwa(force=False)
        except Exception as e:
            print(f"[WARN] release_word_app fallo en shutdown: {e}")
    print("[INFO] Deteniendo LibreOffice service...")
    get_libreoffice_service().stop()
    print("[INFO] Deteniendo Word COM service...")
    get_word_com_service().stop()

app = FastAPI(title="WordAPA7 API", version="1.0.0", lifespan=lifespan_app)

from services.lo_service import get_libreoffice_service

# CORS middleware para desarrollo con Vite.
#  Antes se usaba allow_origins=["*"] con allow_credentials=True, lo cual
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

# Produccion: el add-in puede servirse desde URL publica (WORDAPA7_ADDIN_PUBLIC_URL)
# y llama al backend local en loopback => su origen debe entrar a la allowlist.
from urllib.parse import urlparse as _urlparse

_public_addin = os.environ.get("WORDAPA7_ADDIN_PUBLIC_URL", "").strip()
if _public_addin:
    _p = _urlparse(_public_addin if "//" in _public_addin else "https://" + _public_addin)
    if _p.netloc:
        _origin = f"{_p.scheme or 'https'}://{_p.netloc}"
        if _origin not in _DEFAULT_ALLOWED_ORIGINS:
            _DEFAULT_ALLOWED_ORIGINS.append(_origin)


def _session_rules(doc: DocumentModel, req_rules: Optional[APARuleSet] = None) -> APARuleSet:
    """Reglas de formato: las del request (perfil elegido en el cliente) o, si
    no vienen, las persistidas en la sesión (perfil del documento)."""
    if req_rules is not None:
        return req_rules
    return doc.apa_rules if doc.apa_rules else APARuleSet()
_env_origins = os.environ.get("WORDAPA7_ALLOWED_ORIGINS", "").strip()
_allowed_origins = (
    [o.strip() for o in _env_origins.split(",") if o.strip()]
    if _env_origins
    else _DEFAULT_ALLOWED_ORIGINS
)
app.add_middleware(
    CORSMiddleware,
    # Allowlist explícita (el comentario histórico ya lo prometía). "*" con
    # credenciales es inválido y expone la API local a cualquier página web
    # abierta en el navegador del usuario (drive-by CSRF hacia 127.0.0.1).
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from security.auth import APIKeyAuthMiddleware

app.add_middleware(APIKeyAuthMiddleware)

from routers import admin

app.include_router(admin.router)

# ── WORD ADD-IN ROUTERS (Office.js) ──────────────────────────────────────────
# Endpoints del Task Pane que vive dentro de Microsoft Word + archivos estaticos.
from routers import addin

app.include_router(addin.router)

from routers import addin_static

app.include_router(addin_static.router)

# ── PROOFREAD BATCH ROUTER (revisor proactivo: ortografia/IA/pegado) ──────────
from routers import proofread

app.include_router(proofread.router)

from routers import pagination as pagination_router

app.include_router(pagination_router.router)
from routers import presets as presets_router

app.include_router(presets_router.router)
from routers import spec as spec_router

app.include_router(spec_router.router)
from routers import ws as ws_router

app.include_router(ws_router.router)
from routers import sessions as sessions_router

app.include_router(sessions_router.router)
from routers import addin_extras as addin_extras_router

app.include_router(addin_extras_router.router)
from routers import system as system_router

app.include_router(system_router.router)
from routers import ai as ai_router

app.include_router(ai_router.router)

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


class ResolveGhostCitationRequest(BaseModel):
    authors: List[str]
    year: str


class DoiRequest(BaseModel):
    doi: str


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


@app.post("/api/resolve-ghost-citation")
async def resolve_ghost_citation_endpoint(req: ResolveGhostCitationRequest):
    """
    Busca en cascada (Crossref -> OpenAlex -> Semantic Scholar) referencias por autor + año.
    """
    from modules.referencias_module import search_academic_metadata_cascade
    query = f"{' '.join(req.authors)} {req.year}".strip()
    result = await search_academic_metadata_cascade(query, authors=req.authors, year=req.year)
    if result:
        return {"found": True, "candidates": [result], "total_results": 1}
    return {"found": False, "candidates": [], "total_results": 0}


@app.post("/api/references/import-file")
async def import_references_file_endpoint(
    file: Optional[UploadFile] = File(None),
    content: Optional[str] = Form(None),
    file_type: Optional[str] = Form(None),
):
    """Importa bibliotecas de Zotero/Mendeley en formato BibTeX (.bib) o RIS (.ris)."""
    from parsing.bibtex_ris_parser import parse_bibtex_text, parse_ris_text

    raw_text = ""
    filename = ""
    if file:
        raw_bytes = await file.read()
        raw_text = raw_bytes.decode("utf-8", errors="ignore")
        filename = file.filename or ""
    elif content:
        raw_text = content

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="No se proporcionó contenido para importar.")

    is_ris = (file_type and file_type.lower() == "ris") or filename.lower().endswith(".ris") or "TY  -" in raw_text or "ER  -" in raw_text
    if is_ris:
        imported = parse_ris_text(raw_text)
    else:
        imported = parse_bibtex_text(raw_text)

    return {
        "success": True,
        "count": len(imported),
        "imported_references": [r.model_dump() for r in imported],
    }


@app.post("/api/export/audit-pdf-visual")
async def audit_pdf_visual_endpoint(file: UploadFile = File(...)):
    """Audita el maquetado visual de un archivo PDF renderizado usando PyMuPDF."""
    from modules.visual_auditor import audit_pdf_visual_layout
    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Archivo PDF vacío.")
    audit_res = audit_pdf_visual_layout(pdf_bytes)
    return audit_res


@app.post("/api/validate")
async def validate_document(req: GenerateRequest) -> dict:
    """
    Ejecuta la validacion cruzada entre citas y referencias, más las
    verificaciones científicas APA 7 (resumen, palabras clave, notación
    estadística, figuras/tablas, running head, niveles y formato de refs).
    """
    doc: Optional[DocumentModel] = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Sesion no encontrada.",
        )

    references = req.references if req.references is not None else (doc.referencias or [])
    issues = validate_apa_integrity(doc, references)
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

    rules: APARuleSet = _session_rules(doc, req.rules)
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



# ????????????????????????? WordAPA7 add-in bridge & infra (2026-08) ?????????????????????????
try:
    from modules.word_com import release_word_app as _rwa
except Exception:
    _rwa = None


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

    rules = _session_rules(doc, req.rules)
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

    # Inyectar Post-Processor Dual Engine para PDF.
    # El archivo intermedio DEBE tener extensión .docx: Word COM decide el
    # formato de apertura/guardado por extensión y con alertas suprimidas
    # (DisplayAlerts=0) un nombre sin extensión produce aperturas erráticas
    # (formato incorrecto o recuperación de texto).
    final_path = out_dir / f"FinalPDFSource_{clean_file_name}"
    if final_path.suffix.lower() != ".docx":
        final_path = final_path.with_suffix(".docx")

    engine_used = doc_converter.get_active_engine()

    success, pdf_out_path = doc_converter.process_and_convert(
        original_path=original_path,
        generated_path=docx_path,
        final_path=final_path,
        preserve_cover=preserve_cover,
        generate_pdf=True,

        rules=rules
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
        # Fallback a LibreOffice vía el servicio singleton (resuelve la ruta
        # real de soffice.exe en Windows y usa perfil aislado). El subprocess
        # directo con "libreoffice" no existe en el PATH de Windows y este
        # eslabón moría SIEMPRE en silencio.
        try:
            lo = get_libreoffice_service()
            if lo.convert(docx_path, "pdf", out_dir) and pdf_path.exists():
                pdf_generated = True
                engine_used = "LO"
        except Exception as e:
            print(f"[WARN] LibreOffice conversion exception: {e}")

    if not pdf_generated:
        try:
            from services.doc_converter import get_doc_converter
            dc_ok, dc_pdf = get_doc_converter().process_and_convert(
                docx_path, docx_path, docx_path, preserve_cover=False, generate_pdf=True
            )
            if dc_ok and dc_pdf and dc_pdf.exists():
                shutil.move(str(dc_pdf), str(pdf_path))
                pdf_generated = True
                engine_used = "COM"
        except Exception as e:
            print(f"[WARN] Fallback PDF converter exception: {e}")

    if pdf_generated and pdf_path.exists():
        return {
            "status": "ok",
            "session_id": req.session_id,
            "download_url": f"/api/download-pdf/{req.session_id}",
            "pdf_name": pdf_name,
            "file_path": str(pdf_path.resolve()),
            "engine": engine_used or "COM",
        }
    else:
        return {
            "status": "fallback_docx",
            "session_id": req.session_id,
            "download_url": f"/api/download/{req.session_id}",
            "docx_name": docx_name,
            "engine": engine_used,
            "message": "No se pudo generar el PDF en este entorno; se descarga la versión DOCX oficial.",
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

    rules = _session_rules(doc, req.rules)
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

    # Convertir DOCX → PDF via DocConverterService (Word COM si está disponible, o LibreOffice)
    try:
        from services.doc_converter import get_doc_converter
        dc = get_doc_converter()
        pdf_generated = False
        pdf_file = out_dir / "preview.pdf"

        # Intentar con DocConverterService (que usa Word COM de alta fidelidad en Windows)
        success, dc_pdf = await asyncio.to_thread(
            dc.process_and_convert, preview_docx, preview_docx, preview_docx, False, True
        )
        if success and dc_pdf and dc_pdf.exists():
            if dc_pdf.resolve() != pdf_file.resolve():
                shutil.move(str(dc_pdf), str(pdf_file))
            pdf_generated = True

        # Fallback a LibreOffice si Word COM no produjo el PDF
        if not pdf_generated and lo.is_available():
            lo_success = await asyncio.to_thread(lo.convert, preview_docx, "pdf", out_dir)
            if lo_success and pdf_file.exists():
                pdf_generated = True

        if not pdf_generated or not pdf_file.exists():
            raise Exception("No se pudo generar el PDF de vista previa.")

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

def _safe_output_path(target_path: Path) -> Path:
    """Verifica si el archivo está bloqueado por Word en Windows y devuelve una ruta escribible."""
    if not target_path.exists():
        return target_path
    try:
        with open(target_path, "a+b"):
            pass
        return target_path
    except (PermissionError, OSError):
        stem = target_path.stem
        parent = target_path.parent
        for i in range(1, 100):
            cand = parent / f"{stem}_v{i}.docx"
            if not cand.exists():
                return cand
            try:
                with open(cand, "a+b"):
                    return cand
            except (PermissionError, OSError):
                continue
        import time
        return parent / f"{stem}_{int(time.time())}.docx"


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
        latex_code = export_to_latex(doc, profile_id=doc.profile_id)
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

    rules: APARuleSet = _session_rules(doc, req.rules)
    out_dir: Path = STORAGE_DIR / "sessions" / req.session_id
    raw_out_file: Path = out_dir / f"APA7_{doc.file_name}"
    out_file: Path = _safe_output_path(raw_out_file)

    # RUTA IN-PLACE (default): edita el original; portada/secciones intocables
    export_mode = getattr(rules, "export_mode", "inplace")
    use_orig_cover = req.portada is None or getattr(req.portada, "use_original_cover", True)
    if export_mode == "inplace" and use_orig_cover:
        original_path_ip: Path = out_dir / "original.docx"
        if original_path_ip.exists():
            try:
                from generation.inplace_editor import apply_inplace
                apply_inplace(original_path_ip, out_file, doc, rules, scopes=None)
                try:
                    from persistence.idempotency import add_marker_to_docx
                    marked = add_marker_to_docx(out_file)
                    if marked is not None and Path(marked).exists():
                        Path(marked).replace(out_file)
                except Exception:
                    pass
                return {
                    "success": True,
                    "download_url": f"/api/download/{req.session_id}",
                    "file_name": out_file.name,
                    "mode": "inplace",
                    "message": "Documento formateado in-place: portada y estructura originales intactas.",
                }
            except RuntimeError as rip:
                try:
                    from wordapa7_logger import log_event as _lf
                    _lf("generate", "inplace_fallback_rebuild", data={"reason": str(rip)[:200]})
                except Exception:
                    pass
            except Exception as exc_ip:
                try:
                    from wordapa7_logger import log_error as _lg
                    _lg("generate", "inplace_failed", exc_ip)
                except Exception:
                    pass


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
            generate_pdf=True,
            rules=rules
        )

        if success and final_path.exists():
            generated_path = final_path

        # Agregar marcador de idempotencia al DOCX generado
        try:
            marked_bytes = add_marker_to_docx(generated_path.read_bytes())
            with open(generated_path, "wb") as f:
                f.write(marked_bytes)
        except Exception:
            pass

        return {
            "download_url": f"/api/download/{req.session_id}",
            "filename": out_file.name,
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
    files: list = sorted(list(out_dir.glob("APA7_*.docx")), key=lambda p: p.stat().st_mtime, reverse=True)
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

    rules: APARuleSet = _session_rules(doc, req.rules)
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
    if doc.referencias:
        references_text = [(r.raw_text or r.formatted_apa or "") for r in doc.referencias]
        references_text = [t for t in references_text if t]
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


@app.get("/api/templates")
async def list_templates_endpoint() -> dict:
    """
    Lista las plantillas de estructura de documento disponibles.
    """
    from generation.templates import AVAILABLE_TEMPLATES

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


class CreateFromTemplateRequest(BaseModel):
    template_id: str
    profile_id: str = "apa7"


def _get_section_guide_text(heading_text: str) -> str:
    h = heading_text.lower().strip()
    if "índice" in h or "tabla de contenido" in h:
        return "La tabla de contenidos se genera de forma automática a partir de los títulos y subtítulos del documento."
    if "introducción" in h:
        return "Esta sección presenta el planteamiento general del trabajo, los antecedentes teóricos más relevantes, la justificación de la investigación y los objetivos específicos que guían el estudio."
    if "antecedente" in h:
        return "Se revisan las investigaciones previas nacionales e internacionales directamente relacionadas con el objeto de estudio, destacando sus aportes y vacíos de conocimiento."
    if "problema" in h:
        return "Describe con claridad la situación problemática observada, su delimitación contextual y la formulación formal de la pregunta principal de investigación."
    if "objetivo" in h:
        return "Establece el objetivo general y los objetivos específicos que delimitan el alcance analítico y metodológico del proyecto."
    if "justificación" in h:
        return "Expone la relevancia teórica, metodológica y práctica del estudio, argumentando el valor añadido de sus resultados para la comunidad académica."
    if "marco teórico" in h or "marco conceptual" in h:
        return "Desarrolla las teorías, modelos y conceptos fundamentales que sustentan el análisis. Las citas en el texto deben seguir el formato APA 7 (Apellido, Año)."
    if "metodología" in h or "método" in h:
        return "Describe detalladamente el enfoque de investigación, el diseño metodológico, la población, muestra y las técnicas e instrumentos de recolección de datos."
    if "tipo de investigación" in h:
        return "Especifica el paradigma, nivel (descriptivo, correlacional, explicativo) y diseño (experimental o no experimental) adoptado en el estudio."
    if "población" in h or "muestra" in h:
        return "Define las características de la unidad de análisis, los criterios de inclusión/exclusión y el método de muestreo probabilístico o no probabilístico."
    if "instrumento" in h:
        return "Describe las herramientas de medición o recolección de datos empleadas, detallando sus propiedades de validez y confiabilidad."
    if "resultado" in h:
        return "Presenta de manera objetiva los hallazgos empíricos obtenidos. Incluya tablas y figuras numeradas secuencialmente conforme a las directrices APA 7ma Edición."
    if "discusión" in h:
        return "Interpreta y contrasta los resultados alcanzados con las hipótesis planteadas y los hallazgos de investigaciones previas citadas en el marco teórico."
    if "conclusión" in h or "conclusiones" in h:
        return "Sintetiza las principales conclusiones derivadas del estudio, responde a los objetivos planteados y propone recomendaciones para futuras líneas de investigación."
    if "referencia" in h:
        return "Lista alfabética de todas las fuentes citadas en el texto, con sangría francesa de 1.27 cm (0.5 in) e interlineado doble según Normas APA 7."
    if "resumen" in h:
        return "Párrafo único sin sangría de entre 150 y 250 palabras que sintetiza el objetivo, metodología, resultados principales y conclusiones del trabajo."
    return f"Desarrollo académico correspondiente a la sección de {heading_text}, estructurado con interlineado doble, sangría de primera línea de 1.27 cm y tipografía uniforme APA 7."


@app.post("/api/create-from-template")
async def create_from_template_endpoint(req: CreateFromTemplateRequest) -> DocumentModel:
    """
    Crea una NUEVA sesión de trabajo a partir de una plantilla de estructura:
    genera el DocumentModel con los títulos de la plantilla y párrafos guía,
    lo persiste como sesión y lo devuelve con el mismo shape que /api/upload.
    """
    from routers.sessions import _TEMPLATE_ID_MAP

    profile = get_profile(req.profile_id)
    template = _TEMPLATE_ID_MAP.get(req.template_id)
    if template is None:
        raise HTTPException(
            status_code=400,
            detail=f"Plantilla desconocida: {req.template_id}.",
        )

    elements: list[ElementModel] = []

    def _add_sections(sections) -> None:
        for section in sections:
            # 1. Título estructurado
            elements.append(
                ElementModel(
                    id=f"tpl-{req.template_id}-{len(elements)}",
                    type=ElementType.HEADING,
                    heading_level=section.heading_level,
                    text=section.suggested_text,
                    original_text=section.suggested_text,
                    confidence=1.0,
                    is_cover_section=False,
                    needs_review=False,
                )
            )
            # 2. Párrafo guía explicativo de la sección
            guide_text = _get_section_guide_text(section.suggested_text)
            elements.append(
                ElementModel(
                    id=f"tpl-{req.template_id}-{len(elements)}",
                    type=ElementType.PARAGRAPH,
                    text=guide_text,
                    original_text=guide_text,
                    confidence=1.0,
                    is_cover_section=False,
                    needs_review=False,
                )
            )
            _add_sections(section.sub_sections)

    _add_sections(template.sections)

    fmt = profile.cover_apa_format
    apa_format = APAFormat.PROFESSIONAL if fmt == "professional" else APAFormat.STUDENT

    sample_refs = [
        ReferenciaModel(
            id="ref-tpl-1",
            raw_text="Hernández-Sampieri, R., & Mendoza, C. P. (2018). Metodología de la investigación: Las rutas cuantitativa, cualitativa y mixta. McGraw-Hill Education.",
            authors=["Hernández-Sampieri, R.", "Mendoza, C. P."],
            year="2018",
            title="Metodología de la investigación: Las rutas cuantitativa, cualitativa y mixta",
            source="McGraw-Hill Education",
        ),
        ReferenciaModel(
            id="ref-tpl-2",
            raw_text="American Psychological Association. (2020). Publication manual of the American Psychological Association (7th ed.). https://doi.org/10.1037/0000165-000",
            authors=["American Psychological Association"],
            year="2020",
            title="Publication manual of the American Psychological Association",
            source="American Psychological Association",
            doi_or_url="10.1037/0000165-000",
        ),
    ]

    doc = DocumentModel(
        session_id=f"sess-{uuid.uuid4().hex[:12]}",
        file_name=f"{template.name.split('(')[0].strip()}.docx",
        apa_format=apa_format,
        profile_id=profile.profile_id,
        elements=elements,
        referencias=sample_refs,
        apa_rules=profile.rules.model_copy(deep=True),
    )

    save_session_state(doc, STORAGE_DIR)
    return doc


@app.post("/api/apply-template")
async def apply_template_endpoint(req: ApplyTemplateRequest) -> dict:
    """
    Aplica una plantilla de estructura al documento:
    - Inserta secciones faltantes según la plantilla elegida
    - Reordena headings existentes
    - Retorna el resumen de cambios realizados
    """
    from generation.templates import TemplateSection, get_template

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


# ── COVER DESIGNER ENDPOINTS ─────────────────────────────────────────────────

@app.get("/api/cover-templates")
async def list_cover_templates_endpoint() -> dict:
    """
    Lista todas las plantillas de portada disponibles (integradas + del usuario).
    """
    from modules.cover_designer import list_cover_templates
    templates = list_cover_templates(STORAGE_DIR)
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
            temp_path, name, description, STORAGE_DIR
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
            temp_path, name, description, STORAGE_DIR
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

    success = delete_cover_template(name, STORAGE_DIR)
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
    from modules.cover_designer import CoverTemplate, list_cover_templates

    doc: Optional[DocumentModel] = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesion no encontrada.")

    # Snapshot antes de modificar portada
    from persistence.session_manager import save_session_snapshot
    save_session_snapshot(doc, STORAGE_DIR)

    # Buscar la plantilla por nombre
    templates = list_cover_templates(STORAGE_DIR)
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

    templates = list_cover_templates(STORAGE_DIR)
    for t in templates:
        if t.name == name and t.preview_path:
            preview_file = Path(t.preview_path)
            if preview_file.exists():
                return FileResponse(preview_file, media_type="image/png")

    # Fallback: retornar placeholder
    raise HTTPException(status_code=404, detail="Preview no disponible para esta plantilla.")


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

# Log rotativo (máx. 5 MB por archivo, 3 copias): el log NO debe crecer sin límite.
from logging.handlers import RotatingFileHandler

file_handler = RotatingFileHandler(
    log_file_path, maxBytes=5 * 1024 * 1024, backupCount=3, encoding='utf-8'
)
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





# ── SERVIR FRONTEND ESTATICO ──────────────────────────────────────────────────

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
        # Comparar hash de contenido de src/ contra el src_hash guardado por
        # build_manifest.py en el momento del build (mismo algoritmo, mismos archivos).
        src_hash = _compute_src_content_hash(src_dir)
        try:
            with open(version_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            stored_src_hash = data.get("src_hash", "")
        except Exception:
            stored_src_hash = ""

        if stored_src_hash == "":
            should_build = True
            reason = "version.json sin src_hash (manifest de build anterior)"
        elif src_hash != stored_src_hash:
            should_build = True
            reason = f"src_hash={src_hash} != src_hash={stored_src_hash} (cambios detectados en c\u00f3digo fuente)"

    if should_build:
        print(f"[AUTO-BUILD] {reason}. Recompilando con 'npm run build'...")
        try:
            cmd = ["npm.cmd", "run", "build"] if os.name == 'nt' else ["npm", "run", "build"]
            res = subprocess.run(cmd, cwd=str(BASE_DIR), capture_output=True, text=True)
            if res.returncode == 0:
                print("[AUTO-BUILD] [OK] Recompilacion exitosa del frontend!")
                # Invalidar caché de build_hash
                build_info._build_hash_cache = None
                build_info._build_hash_cache_time = 0.0
            else:
                print(f"[WARN] Error durante npm run build: {res.stderr[:200]}")
        except Exception as e:
            print(f"[WARN] No se pudo ejecutar npm run build automáticamente: {e}")


# Montar archivos estaticos del Word Add-in (Office.js) en /addin/.
# Debe ir ANTES del montaje catch-all del SPA para que las rutas /addin/*
# sean interceptadas correctamente por Starlette.
from routers.addin_static import init_addin_static

init_addin_static(app)

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

def _setup_ssl_for_addin() -> tuple[Optional[Path], Optional[Path]]:
    """
    Genera certificados SSL auto-firmados para el Word Add-in.

    Office Add-ins requieren HTTPS incluso en localhost. Esta funcion sigue
    una estrategia de respaldo en cascada:

    1. PRIMERO intenta generar los certs con el modulo Python ``ssl_cert_gen``
       (usa la libreria ``cryptography``, incluida en el instalador). NO
       depende de herramientas CLI externas, asi que funciona en cualquier
       maquina sin instalacion adicional.
    2. Si eso falla, recurre a ``mkcert`` (CLI externa) si esta en el PATH
       (instalada por setup.bat o manualmente).
    3. Si ambos fallan, retorna ``(None, None)`` y el backend corre en HTTP
       (Word puede rechazar el Add-in).

    Los certs persisten entre reinicios en ``STORAGE_DIR/ssl/`` (AppData del
    usuario en produccion) y no se regeneran si ya existen y son validos.

    Retorna: (cert_path, key_path) o (None, None).
    """
        # ── SSL es el COMPORTAMIENTO POR DEFECTO en Windows ─────────
    # Office Add-ins REQUIEREN HTTPS incluso en localhost. Sin SSL, Word
    # rechaza el Add-in (panel en blanco o no aparece). El módulo
    # ssl_cert_gen genera certificados auto-firmados y los instala
    # silenciosamente en el Trusted Root store de Windows via CryptoAPI.
    #
    # SSL se DESACTIVA solo si:
    #   1. WORDAPA7_USE_SSL=false (desactivación explícita)
    #   2. WORDAPA7_ADDIN_PUBLIC_URL está seteada (modo producción con URL pública HTTPS)
    public_url = os.environ.get("WORDAPA7_ADDIN_PUBLIC_URL", "").strip()
    ssl_disabled = os.environ.get("WORDAPA7_USE_SSL", "").strip().lower() == "false"

    if ssl_disabled or public_url:
        if public_url:
            print(f"[SSL] Desactivado — Add-in servido desde URL pública: {public_url}")
        else:
            print("[SSL] Desactivado explícitamente (WORDAPA7_USE_SSL=false)")
        return None, None

    import shutil
    import subprocess as _sp

    certs_dir = STORAGE_DIR / "ssl"
    cert_path = certs_dir / "localhost.pem"
    key_path = certs_dir / "localhost-key.pem"

    # ------------------------------------------------------------------
    # 1. Intento: generador Python puro (libreria cryptography).
    #    No requiere herramientas externas; funciona en el instalador
    #    empaquetado con PyInstaller. Maneja idempotencia internamente:
    #    si los certs ya existen y son validos (no expirados, clave
    #    coherente), los reutiliza sin regenerar.
    # ------------------------------------------------------------------
    try:
        from ssl_cert_gen import generate_self_signed_cert
    except Exception as _e:
        print(f"[SSL] No se pudo importar el modulo ssl_cert_gen: {_e}")
        generate_self_signed_cert = None

    if generate_self_signed_cert is not None:
        _cert, _key = generate_self_signed_cert(cert_path, key_path)
        if _cert is not None and _key is not None:
            return _cert, _key
        print("[SSL] El generador Python (cryptography) fallo — intentando mkcert como respaldo...")
    else:
        print("[SSL] ssl_cert_gen no disponible — intentando mkcert como respaldo...")

    # ------------------------------------------------------------------
    # 2. Respaldo: mkcert (CLI externa).
    #    Se conserva para compatibilidad con instalaciones donde mkcert ya
    #    estaba configurado y su CA raiz confia en el sistema.
    # ------------------------------------------------------------------

    # Reutilizar certs existentes si el generador Python no estuvo disponible.
    if cert_path.exists() and key_path.exists():
        print(f"[SSL] Reutilizando certificados Add-in existentes: {cert_path}")
        return cert_path, key_path

    mkcert_bin = shutil.which("mkcert")
    if not mkcert_bin:
        print(
            "[SSL] mkcert tampoco esta disponible — el Add-in correra en HTTP "
            "(Word puede rechazarlo). El generador Python (cryptography) deberia "
            "ser suficiente; revisa los logs de [SSL] arriba."
        )
        return None, None

    # Generar certificados con mkcert
    certs_dir.mkdir(parents=True, exist_ok=True)
    try:
        # Instalar CA local (si no esta ya instalada; mkcert -install es idempotente)
        _sp.run([mkcert_bin, "-install"], check=True, capture_output=True, timeout=30)
        # Generar cert para localhost / 127.0.0.1
        _sp.run(
            [mkcert_bin, "-key-file", str(key_path), "-cert-file", str(cert_path),
             "localhost", "127.0.0.1"],
            check=True,
            cwd=str(certs_dir),
            capture_output=True,
            timeout=30,
        )
        print(f"[SSL] Certificados Add-in generados con mkcert: {cert_path}")
        return cert_path, key_path
    except Exception as e:
        print(f"[SSL] Error al generar certificados con mkcert: {e}")
        return None, None

def _backend_already_running(port: int) -> bool:
    """Detecta si ya hay una instancia del backend respondiendo en 127.0.0.1:<port>.

    Prueba HTTPS primero (aceptando el certificado auto-firmado) y luego HTTP.
    Si /api/version responde 200, otra instancia vive (arrancada por el watcher,
    la app Electron o manualmente) y esta NO debe arrancar: pelear por el bind
    produce [Errno 10048], crash-loop del watchdog y churn de servicios
    (Word COM / LibreOffice) que desestabiliza todo el sistema.
    """
    import http.client

    try:
        import ssl as _ssl
        ctx = _ssl._create_unverified_context()
    except Exception:
        ctx = None

    for use_tls in (True, False):
        try:
            if use_tls and ctx is not None:
                conn = http.client.HTTPSConnection("127.0.0.1", port, context=ctx, timeout=2)
            else:
                conn = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
            conn.request("GET", "/api/version")
            resp = conn.getresponse()
            ok = resp.status == 200
            resp.read()
            conn.close()
            if ok:
                return True
        except Exception:
            continue
    return False




def _port_in_use(port: int) -> bool:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sk:
        sk.settimeout(0.4)
        return sk.connect_ex(("127.0.0.1", port)) == 0


if __name__ == "__main__":
    import argparse

    # En builds empaquetados (PyInstaller, console=False) los streams pueden ser
    # None y uvicorn crashea al configurar logging (sys.stderr.isatty()).
    import os

    import uvicorn
    if sys.stdout is None or sys.stderr is None:
        devnull = open(os.devnull, "w")
        if sys.stdout is None:
            sys.stdout = devnull
        if sys.stderr is None:
            sys.stderr = devnull

    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8742, help='Port to run the server on')
    parser.add_argument('--watcher', action='store_true',
                        help='Run as lightweight Word watcher (starts backend when Word opens, stops when closed)')
    args, unknown = parser.parse_known_args()

    # Modo Watcher: proceso ligero que detecta Word y arranca el backend.
    # Si se pasa --watcher, NO arrancamos uvicorn. En su lugar, ejecutamos
    # el bucle del watcher (word_watcher.py) que monitorea si Word esta
    # abierto y arranca/detiene el backend segun sea necesario.
    # Esto permite que el mismo ejecutable (python-backend.exe en produccion)
    # funcione tanto como servidor como como watcher.
    if args.watcher:
        from word_watcher import run_watcher
        run_watcher()
        sys.exit(0)

    # 0. Single-instance: si ya hay un backend sano en este puerto, salir
    # limpio en vez de pelear por el bind (evita [Errno 10048] + crash-loop).
    if _backend_already_running(args.port):
        print(f"[BACKEND] Instancia ya activa en el puerto {args.port} — saliendo (single-instance).")
        sys.exit(0)

    # 1. Verificar y recompilar frontend si hubo cambios en src/
    check_and_auto_build_frontend()

    # 2. Crear o verificar la plantilla inicial (una sola ruta de generacion)
    try:
        template_path: Path = ensure_apa7_template(get_apa7_template_path())
        print(f"[INFO] Plantilla APA 7 verificada en: {template_path}")
    except Exception as e:
        print(f"[WARN] No se pudo crear la plantilla APA 7: {e}")

    # 3. Configurar SSL para el Word Add-in (requiere mkcert instalado)
    ssl_certfile, ssl_keyfile = _setup_ssl_for_addin()

    print("=" * 60)
    protocol = "https" if ssl_certfile else "http"
    print(f" WordAPA7 — Servidor iniciado en {protocol}://localhost:{args.port}")
    if ssl_certfile:
        print(" Modo: DESARROLLO HTTPS (SSL activo)")
        print(" Add-in HTTPS: ACTIVO — sirve el panel en HTTPS local")
    else:
        addin_pub = os.environ.get("WORDAPA7_ADDIN_PUBLIC_URL", "").strip()
        if addin_pub:
            print(f" Modo: PRODUCCION (Add-in desde {addin_pub})")
            print(f" Backend API: http://127.0.0.1:{args.port} (HTTP plano)")
            print(" El Add-in se carga desde la URL publica y llama a este backend local.")
        else:
            print(" Modo: LOCAL HTTPS (SSL automatico)")
            print(f" Backend API: https://127.0.0.1:{args.port}")
            print(" Add-in: se sirve desde el backend en HTTPS. Word deberia cargarlo sin problemas.")
            print(" El complemento se registra automaticamente en Word al iniciar.")
    print(" Presiona Ctrl+C para detener")
    print("=" * 60)

    if ssl_certfile and ssl_keyfile:
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=args.port,
            ssl_certfile=str(ssl_certfile),
            ssl_keyfile=str(ssl_keyfile),
        )
    else:
        uvicorn.run(app, host="127.0.0.1", port=args.port)

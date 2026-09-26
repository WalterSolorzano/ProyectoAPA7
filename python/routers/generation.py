"""Generacion: preview, PDF, DOCX, LaTeX y validacion - extraido de main.py (mejora #4 / E-02)."""
from __future__ import annotations

import asyncio
import json
import shutil
from pathlib import Path
from typing import List, Optional

from config import STORAGE_DIR
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from generation.generator import generate_apa7_docx
from generation.track_changes_engine import create_tracked_changes_docx
from models import APARuleSet, DocumentModel, ElementType, PortadaData, ReferenciaModel
from modules.apa_validator import validate_apa_integrity, validate_citations_with_llm
from persistence.session_manager import load_session_state, save_session_state
from pydantic import BaseModel
from services.lo_service import get_libreoffice_service

router = APIRouter(tags=["generation"])


def _session_rules(doc: DocumentModel, req_rules: Optional[APARuleSet] = None) -> APARuleSet:
    """Reglas de formato: las del request (perfil elegido en el cliente) o, si
    no vienen, las persistidas en la sesión (perfil del documento)."""
    if req_rules is not None:
        return req_rules
    return doc.apa_rules if doc.apa_rules else APARuleSet()


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


@router.post("/api/export/audit-pdf-visual")
async def audit_pdf_visual_endpoint(file: UploadFile = File(...)):
    """Audita el maquetado visual de un archivo PDF renderizado usando PyMuPDF."""
    from modules.visual_auditor import audit_pdf_visual_layout
    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Archivo PDF vacío.")
    audit_res = audit_pdf_visual_layout(pdf_bytes)
    return audit_res


@router.post("/api/validate")
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


@router.post("/api/validate/ai")
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


@router.post("/api/preview")
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



@router.post("/api/generate-pdf")
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


@router.get("/api/download-pdf/{session_id}")
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


@router.get("/api/download-preview/{session_id}")
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


@router.post("/api/preview-pages/{session_id}")
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


@router.get("/api/preview-pdf/{session_id}/preview.pdf")
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


@router.post("/api/export-latex/{session_id}")
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


@router.post("/api/generate")
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


@router.get("/api/download/{session_id}")
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


@router.post("/api/generate-tracked")
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


@router.get("/api/download-tracked/{session_id}")
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


@router.post("/api/validate-citations/{session_id}")
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

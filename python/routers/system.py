"""Sistema: salud, version, diagnostico - extraido de main.py (mejora #4 / E-02)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from build_info import _read_build_hash
from config import DIST_DIR
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from models import HealthResponse
from pydantic import BaseModel

router = APIRouter(tags=["system"])


@router.get("/api/health")
async def health_check() -> HealthResponse:
    """Health check para Electron y monitoreo."""
    return HealthResponse(status="ok", version="1.0.0")


@router.get("/api/version")
async def get_version_endpoint() -> dict:
    """Retorna la versiÃ³n del backend para detecciÃ³n de protocolo y readiness."""
    return {"version": "1.0.0", "mode": "main", "status": "ok"}


@router.get("/api/test/sample-documents")
async def api_get_sample_documents() -> dict:
    """Retorna la lista de documentos de prueba y estrÃ©s disponibles."""
    return {
        "samples": [
            {
                "id": "citations",
                "name": "Citas Complejas y BibliografÃ­a",
                "desc": "Citas parentÃ©ticas, narrativas, 3+ autores (et al.), secundarias, citas fantasma y referencias huÃ©rfanas.",
            },
            {
                "id": "headings",
                "name": "JerarquÃ­a de TÃ­tulos y Estructura",
                "desc": "TÃ­tulos desordenados (H1 -> H3 -> H2), numeraciÃ³n romana/arÃ¡biga y detecciÃ³n de encabezados.",
            },
            {
                "id": "tables_figures",
                "name": "Tablas y Figuras sin Formato",
                "desc": "Tablas estadÃ­sticas sin formato APA y pÃ¡rrafos contextuales para auto-captioning.",
            },
        ]
    }


@router.get("/api/test/sample-documents/{doc_type}")
async def api_download_sample_document(doc_type: str):
    """Genera y descarga el documento de prueba seleccionado."""
    from tools.stress_doc_generator import (
        generate_stress_citations_doc,
        generate_stress_headings_and_structure_doc,
        generate_stress_tables_and_figures_doc,
    )
    if doc_type == "citations":
        path = generate_stress_citations_doc()
    elif doc_type == "headings":
        path = generate_stress_headings_and_structure_doc()
    elif doc_type == "tables_figures":
        path = generate_stress_tables_and_figures_doc()
    else:
        raise HTTPException(status_code=404, detail="Tipo de documento de prueba no encontrado")

    return FileResponse(
        path,
        filename=f"stress_{doc_type}.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.get("/api/assets/logo_uni.png")
async def get_uni_logo() -> FileResponse:
    """
    Sirve el logo institucional UNI para la portada universitaria
    (preview en el lienzo y generacion).
    """
    logo_path: Path = Path(__file__).parent / "assets" / "logo_uni.png"
    if not logo_path.exists():
        raise HTTPException(status_code=404, detail="Logo UNI no encontrado.")
    return FileResponse(logo_path)


class ClientLogRequest(BaseModel):
    component: str = "renderer"
    event: str
    data: Optional[dict] = None
    level: str = "info"


@router.post("/api/client-log")
async def client_log_endpoint(req: ClientLogRequest) -> dict:
    """Receptor de logs del frontend y del add-in."""
    from wordapa7_logger import log_error as _le2
    from wordapa7_logger import log_event as _lv2
    comp = (req.component or "client").replace("/", "_")[:24]
    if req.level == "error":
        _le2(comp, req.event, Exception(str(req.data)), req.data)
    _lv2(comp, req.event, req.data, level=req.level)
    return {"ok": True}


@router.get("/api/diagnostics")
async def diagnostics_endpoint() -> dict:
    from wordapa7_logger import collect_diagnostics
    return collect_diagnostics()


@router.get("/api/version")
async def get_version():
    """Retorna la versiÃ³n y build_hash actual para que el frontend detecte cambios."""
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

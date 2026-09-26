"""Referencias: DOI, importacion y citaciones - extraido de main.py (mejora #4 / E-02)."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from modules.referencias_module import resolve_doi
from pydantic import BaseModel

router = APIRouter(tags=["references"])


class ResolveDoiRequest(BaseModel):
    doi: str


class ResolveBatchRequest(BaseModel):
    references: List[str]


class ResolveGhostCitationRequest(BaseModel):
    authors: List[str]
    year: str


class DoiRequest(BaseModel):
    doi: str


@router.post("/api/resolve-doi")
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


@router.post("/api/references/resolve-batch")
async def resolve_batch_endpoint(req: ResolveBatchRequest) -> dict:
    from modules.referencias_module import resolve_dois_batch
    try:
        results = await resolve_dois_batch(req.references)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/resolve-ghost-citation")
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


@router.post("/api/references/import-file")
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


"""Referencias: resolver un DOI a una referencia APA 7.

Vive en su propio router, y sin prefijo del `/api`, por una razon concreta:
`documentSlice.resolveDoiReference` llama a `${getApiBase()}/resolve-doi`, o sea
`/api/resolve-doi`. El endpoint estaba montado en `/api/addin/resolve-doi`, una
ruta que no existia: la resolucion de DOI de la interfaz no funcionaba y el
boton no daba error claro porque el 404 venia de otra parte del flujo.

El contrato de la respuesta es PLANO, con `apa_formatted`, porque es el que ese
llamador ya lee. Cambiar el consumidor para que calce con un backend nuevo es al
reves: el que manda el contrato es el que ya esta en uso.
"""

from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["references"])


class ResolveDoiRequest(BaseModel):
    doi: str
    """Por defecto NO se guarda en el store del addin.

    El llamador guarda la referencia en su propio estado. Escribir tambien en el
    store del addin seria un efecto lateral que nadie lee y que el usuario no
    pidio. Se activa con `guardar: true` desde los flujos que si usan ese store.
    """
    guardar: bool = False


class ResolveDoisRequest(BaseModel):
    """Un bloque de DOIs, uno por linea. Tipo Zotero: copiar y pegar."""
    text: str
    guardar: bool = False


@router.post("/api/resolve-dois")
async def resolve_dois(req: ResolveDoisRequest) -> Dict[str, Any]:
    """Resuelve un BLOQUE de DOIs, uno por linea, y devuelve el lote.

    Tipo Zotero: se seleccionan veinte papers en el navegador, se copian, se
    pega. El bloque se resuelve entero y **lo que falla se reporta uno por uno**,
    porque un DOI malo no puede tirar abajo los otros diecinueve: perder el
    trabajo de veinte referencias por un typo es la peor falla posible de un
    pegado masivo.

    Reutiliza `resolve_doi` en vez de reimplementar la consulta a CrossRef: dos
    caminos a la misma API significa que uno de los dos se queda sin arreglar.
    """
    from modules.doi_resolver import normalize_doi

    lineas = [ln.strip() for ln in (req.text or "").splitlines()]
    entradas: List[str] = []
    vistas = set()
    for ln in lineas:
        if not ln:
            continue
        # Deduplicar POR NORMALIZADO: "10.1/a", "doi:10.1/a" y
        # "https://doi.org/10.1/a" son el mismo DOI, y pegarlo dos veces no
        # tiene que duplicar la referencia.
        clave = normalize_doi(ln) or ln.lower()
        if clave in vistas:
            continue
        vistas.add(clave)
        entradas.append(ln)

    resueltas: List[Dict[str, Any]] = []
    fallidas: List[Dict[str, str]] = []

    for entrada in entradas:
        try:
            resueltas.append(await resolve_doi(
                ResolveDoiRequest(doi=entrada, guardar=req.guardar)))
        except HTTPException as e:
            det = e.detail if isinstance(e.detail, dict) else {"mensaje": str(e.detail)}
            fallidas.append({
                "entrada": entrada,
                "codigo": str(det.get("codigo", "error")),
                "mensaje": str(det.get("mensaje", "No se pudo resolver.")),
            })

    return {"total": len(entradas), "resueltas": resueltas, "fallidas": fallidas}


@router.post("/api/resolve-doi")
async def resolve_doi(req: ResolveDoiRequest) -> Dict[str, Any]:
    """Resuelve un DOI contra CrossRef o una URL web contra sus metadatos y devuelve la referencia APA 7."""
    from modules.doi_resolver import (
        crossref_to_reference,
        crossref_url,
        normalize_doi,
        normalize_web_url,
        resolve_web_metadata,
    )

    doi = normalize_doi(req.doi)
    web_url = normalize_web_url(req.doi) if not doi else None

    if not doi and not web_url:
        raise HTTPException(status_code=400, detail={
            "codigo": "no_es_doi_ni_url",
            "mensaje": "Eso no parece un DOI ni un enlace web válido. Se aceptan 10.xxxx/yyy, "
                       "doi:10.xxxx/yyy, https://doi.org/... o URLs tipo https://sitio.com/articulo.",
        })

    # Caso 1: Enlace web ordinario (no DOI)
    if web_url:
        try:
            ref = await resolve_web_metadata(web_url)
        except Exception as e:
            raise HTTPException(status_code=422, detail={
                "codigo": "error_pagina_web",
                "mensaje": f"No se pudieron extraer metadatos de {web_url}: {e}",
            })

        guardada = False
        if req.guardar and (ref.get("title") or ref.get("authors")):
            from modules.addin_references_store import save_reference
            try:
                save_reference(ref)
                guardada = True
            except Exception:
                guardada = False

        return {
            "doi": None,
            "authors": ref["authors"],
            "year": ref["year"],
            "title": ref["title"],
            "source": ref["source"],
            "doi_or_url": ref["doi_or_url"],
            "apa_formatted": ref["formatted_apa"],
            "guardada": guardada,
            "tipo": "web",
        }

    # Caso 2: DOI (vía CrossRef)
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            r = await c.get(
                crossref_url(doi),
                # El mailto es el "polite pool" de CrossRef: mas lento para
                # ellos, mas estable para nosotros.
                headers={"User-Agent": "WordAPA7/1.0 (mailto:soporte@wordapa7.app)",
                         "Accept": "application/json"},
            )
    except Exception as e:  # noqa: BLE001
        # Red caida no es "no existe": son dos respuestas distintas para la
        # persona, y confundirlas le hace creer que la obra no existe.
        raise HTTPException(status_code=502, detail={
            "codigo": "crossref_no_responde",
            "mensaje": f"No se pudo consultar CrossRef: {e}",
        })

    if r.status_code == 404:
        raise HTTPException(status_code=404, detail={
            "codigo": "no_resuelto",
            "mensaje": f"CrossRef no conoce el DOI {doi}. Revisa que no le falte "
                       f"ni le sobre un caracter.",
        })
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail={
            "codigo": "crossref_error",
            "mensaje": f"CrossRef respondio {r.status_code}.",
        })

    try:
        work = r.json().get("message") or {}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail={
            "codigo": "crossref_respuesta_ilegible",
            "mensaje": f"CrossRef devolvio algo que no es JSON: {e}",
        })

    ref = crossref_to_reference(work)

    guardada = False
    if req.guardar and (ref["title"] or ref["authors"]):
        from modules.addin_references_store import save_reference
        try:
            save_reference(ref)
            guardada = True
        except Exception:
            # Se devuelve la referencia igual: perder el DOI resuelto porque el
            # store fallo seria peor que no guardarlo.
            guardada = False

    # Plano, porque es lo que lee el llamador. `apa_formatted` es el nombre que
    # ya usa: cambiarlo seria romper el consumidor sin arreglar nada.
    return {
        "doi": doi,
        "authors": ref["authors"],
        "year": ref["year"],
        "title": ref["title"],
        "source": ref["source"],
        "doi_or_url": ref["doi_or_url"],
        "apa_formatted": ref["formatted_apa"],
        "guardada": guardada,
        "tipo": "doi",
    }


class FormatReferenceRequest(BaseModel):
    authors: List[str] = []
    year: Optional[str] = None
    title: str = ""
    source: str = ""
    doi_or_url: Optional[str] = None
    raw_text: str = ""
    tipo: Optional[str] = None


@router.post("/api/references/format")
async def format_reference(req: FormatReferenceRequest) -> Dict[str, Any]:
    """Devuelve la línea APA 7 segmentada. El backend es el único autor.

    Lo consumen los formularios manuales (agregar/editar referencia) para dejar
    de componer APA en TypeScript: lo que la persona ve es lo que el documento
    recibe, con la misma cursiva y la misma limpieza.
    """
    from models import ReferenciaModel
    from modules.apa_format import build_apa_segments, inferir_tipo

    ref = ReferenciaModel(
        id="format", authors=req.authors, year=req.year, title=req.title,
        source=req.source, doi_or_url=req.doi_or_url, raw_text=req.raw_text,
        tipo=req.tipo or "otro",
    )
    segs = build_apa_segments(ref)
    return {
        "formatted_apa": "".join(s.text for s in segs).strip(),
        "apa_segments": [s.model_dump() for s in segs],
        "tipo": inferir_tipo(ref),
    }

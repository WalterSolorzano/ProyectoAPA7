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

from typing import Any, Dict, Optional

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


@router.post("/api/resolve-doi")
async def resolve_doi(req: ResolveDoiRequest) -> Dict[str, Any]:
    """Resuelve un DOI contra CrossRef y devuelve la referencia APA 7."""
    from modules.doi_resolver import (
        crossref_to_reference,
        crossref_url,
        normalize_doi,
    )

    doi = normalize_doi(req.doi)
    if not doi:
        # Distinto de un 404 de CrossRef: aca el usuario pego otra cosa (un link
        # de Google Scholar o de la editorial) y hay que decirle eso, no
        # mostrarle un error de red.
        raise HTTPException(status_code=400, detail={
            "codigo": "no_es_doi",
            "mensaje": "Eso no parece un DOI. Se aceptan 10.xxxx/yyy, "
                       "doi:10.xxxx/yyy o https://doi.org/10.xxxx/yyy.",
        })

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
    }

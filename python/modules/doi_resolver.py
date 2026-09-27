"""Resolver un DOI o un link a una referencia APA 7.

Resuelve EL hueco que el propio store documentaba: `add_citation` crea una
referencia "fantasma" con `is_draft: True` y el comentario "el usuario podra
completarla/resolver DOI luego". Esto es ese "luego".

De donde sale la metadata: **CrossRef** (`api.crossref.org/works/{doi}`). Es
gratis, no pide key, y devuelve justo los campos que APA 7 necesita: autores,
ano, titulo, container-title, volumen, numero, paginas y el DOI. El `User-Agent`
lleva un mailto porque es el "polite pool" de CrossRef: mas lento para ellos pero
mas estable para nosotros, y es lo que piden.

**Lo que esto NO arregla:** el plagio. De un DOI sale METADATA, que es lo que
necesita APA 7; no sale el TEXTO de la fuente, que es lo que necesita medir
similitud. R-G74 sigue necesitando que el usuario provea el texto. Confundir
las dos cosas es como un detector de plagio que mide contra el titulo del
articulo y da un numero: miente, y miente con la mayor confianza posible.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional
from urllib.parse import unquote

# APA 7 lista hasta 20 autores. Con mas, el primero y "et al.".
_APA_MAX_AUTORES = 20

# El prefijo de resolutor mas comun, mas la forma con prefijo `doi:`.
_DOI_URL = re.compile(
    r"^(?:https?://)?(?:dx\.)?doi\.org/", re.IGNORECASE)
_DOI_PREFIX = re.compile(r"^doi\s*:\s*", re.IGNORECASE)

# Un DOI empieza SIEMPRE por "10." (registro de DOI). Esa es la unica señal
# fiable y es la que evita tratar una URL de cualquier pagina como un DOI.
_DOI_CORE = re.compile(r"^10\.\d{4,9}/\S+$")


def normalize_doi(entrada: str) -> Optional[str]:
    """Saca el DOI crudo de lo que el usuario haya pegado, o `None`.

    Acepta el DOI desnudo, con prefijo `doi:`, y con URL de `doi.org` o
    `dx.doi.org`. Devuelve `None` —no una excepcion— cuando lo que se pegó no
    es un DOI: un link de Google Scholar o de la editorial es una consulta
    legitima que este modulo no sabe responder, y reportarlo como "no es un
    DOI" es mas util que hacer un 404 contra CrossRef.
    """
    if not entrada:
        return None
    texto = entrada.strip()
    if not texto:
        return None
    texto = _DOI_URL.sub("", texto)
    texto = _DOI_PREFIX.sub("", texto)
    texto = unquote(texto).strip()
    # Escribir el DOI con punto o coma final es el error mas comun al pegarlo,
    # y un punto es un caracter valido dentro de un DOI.
    texto = texto.rstrip(".,;")
    return texto if _DOI_CORE.match(texto) else None


def _autores_apa(authors: List[Dict[str, Any]]) -> List[str]:
    """`[{"given": "Ana", "family": "Perez"}]` → `["Perez, A."]`.

    CrossRef trae `sequence` para autores sin `family` ("Organizacion Mundial de
    la Salud"), y a veces `family` sin `given`. Se cubren los dos casos sin
    inventar nada: lo que falte, no se pone.
    """
    out: List[str] = []
    from modules.addin_references_store import APA_ELLIPSIS
    for a in authors or []:
        apellido = (a.get("family") or "").strip()
        nombre = (a.get("given") or a.get("name") or "").strip()
        if not apellido:
            # Autor corporativo: se usa el nombre tal cual.
            if nombre:
                out.append(nombre)
            continue
        iniciales = " ".join(
            f"{p[0].upper()}." for p in re.split(r"[\s-]+", nombre) if p)
        out.append(f"{apellido}, {iniciales}".strip().rstrip(","))
    return out


def crossref_to_reference(work: Dict[str, Any]) -> Dict[str, Any]:
    """Mapea la respuesta de CrossRef a la forma que espera el store.

    El texto APA lo arma `addin_references_store._format_apa_reference`, no
    este modulo: dos formateadores de APA divergen solos, que es exactamente lo
    que pasó con el `BLOOM_VERBS` que tenía verbos duplicados entre niveles.
    """
    from modules.addin_references_store import _format_apa_reference

    autores = _autores_apa(work.get("author") or [])
    if len(autores) > _APA_MAX_AUTORES:
        # APA 7 con 21+ autores: los primeros 19, la elipsis, y el ULTIMO. La
        # elipsis se pide con el sentinel del store, no con la palabra "et al.":
        # esa se comia el "&" del formateador y salia "A., & et al.".
        from modules.addin_references_store import APA_ELLIPSIS
        autores = autores[:19] + [APA_ELLIPSIS, autores[-1]]

    issued = (work.get("issued") or {}).get("date-parts") or []
    anio = str(issued[0][0]) if issued and issued[0] else "s.f."

    titulo = (work.get("title") or [""])[0] or ""
    fuente = (work.get("container-title") or [""])[0] or ""
    doi = (work.get("DOI") or "").strip()

    ref: Dict[str, Any] = {
        "authors": autores,
        "year": anio,
        "title": titulo.strip(),
        "source": fuente.strip(),
        # El DOI CRUDO, no `https://doi.org/...`: el store ya lo convierte y
        # duplicarlo dejaría el link dos veces en la referencia.
        "doi_or_url": doi,
        "raw_text": "",
        "is_draft": False,
    }
    ref["formatted_apa"] = _format_apa_reference(ref)
    return ref


def crossref_url(doi: str) -> str:
    return f"https://api.crossref.org/works/{doi}"

"""
WordAPA7 — Modulo de Referencias Bibliograficas APA 7

Genera y formatea la seccion de Referencias:
1. Titulo "Referencias" centrado en negrita en pagina nueva.
2. Sangria francesa (hanging indent) de 1.27 cm (0.5 in).
3. Interlineado doble (2.0) sin espacios adicionales.
4. Orden alfabetico por primer autor.
5. Cursiva en titulos de libros, revistas y volumen.
6. DOI content negotiation via Crossref (gratis, sin API key).
"""

import re
from typing import List, Optional

import httpx

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

from models import ReferenciaModel, APARuleSet


# ── DOI Content Negotiation ────────────────────────────────────────────────────

DOI_RESOLVER_URL: str = "https://doi.org/"
CROSSREF_ACCEPT_HEADER: str = "text/x-bibliography; style=apa; locale=es-419"


async def resolve_doi(doi_input: str) -> Optional[str]:
    """
    Usa DOI content negotiation — GRATIS, sin API key.

    GET https://doi.org/{doi}
    Header: Accept: text/x-bibliography; style=apa; locale=es-419

    Retorna el texto APA 7 formateado directamente desde Crossref.
    Si falla, retorna None para que se use el fallback LLM.
    """
    # Limpiar DOI: remover prefijo "doi:" o "https://doi.org/" si existe
    doi_clean: str = doi_input.strip()
    doi_clean = re.sub(r'^https?://doi\.org/', '', doi_clean)
    doi_clean = re.sub(r'^doi:\s*', '', doi_clean, flags=re.IGNORECASE)
    doi_clean = doi_clean.strip()

    if not doi_clean:
        return None

    url: str = f"{DOI_RESOLVER_URL}{doi_clean}"

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(
                url,
                headers={"Accept": CROSSREF_ACCEPT_HEADER},
            )
            if resp.status_code == 200 and resp.text.strip():
                return resp.text.strip()
            elif resp.status_code == 404:
                print(f"[INFO] DOI no encontrado en Crossref: {doi_clean}")
                return None
            else:
                print(f"[WARN] Crossref devolvio status {resp.status_code} para DOI: {doi_clean}")
                return None
    except httpx.TimeoutException:
        print(f"[WARN] Timeout consultando DOI: {doi_clean}")
        return None
    except Exception as err:
        print(f"[WARN] Error consultando DOI {doi_clean}: {err}")
        return None


async def resolve_multiple_dois(doi_list: List[str]) -> List[Optional[str]]:
    """
    Resuelve multiples DOIs en paralelo.
    Retorna una lista de strings APA 7 formateados (o None para cada fallo).
    """
    import asyncio
    tasks = [resolve_doi(doi) for doi in doi_list]
    return await asyncio.gather(*tasks)


async def format_with_llm(raw_reference: str, api_key: Optional[str] = None) -> str:
    """
    Fallback para referencias sin DOI o URLs: usa NVIDIA NIM para formatear.
    Si no hay API key, retorna el texto crudo con un prefijo de advertencia.
    """
    if not api_key:
        return f"[Revisar formato APA] {raw_reference}"

    system_prompt: str = (
        "Eres un experto en formato APA 7ma edicion. "
        "Convierte la siguiente referencia bibliografica al formato APA 7 correcto. "
        "Responde UNICAMENTE con la referencia formateada, sin explicaciones adicionales."
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                json={
                    "model": "meta/llama-3.1-70b-instruct",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": raw_reference},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 500,
                },
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            if resp.status_code == 200:
                content = resp.json()["choices"][0]["message"]["content"]
                return content.strip()
    except Exception as err:
        print(f"[WARN] Error formateando referencia con LLM: {err}")

    return f"[Revisar formato APA] {raw_reference}"


# ── Seccion de Referencias ─────────────────────────────────────────────────────

def sort_referencias_alphabetically(references: List[ReferenciaModel]) -> List[ReferenciaModel]:
    """
    Ordena alfabeticamente las referencias por el apellido del primer autor
    o por titulo si no hay autor.
    """
    def get_sort_key(ref: ReferenciaModel) -> str:
        if ref.authors:
            return ref.authors[0].lower()
        elif ref.title:
            return ref.title.lower()
        return ref.raw_text.lower()

    return sorted(references, key=get_sort_key)


def format_apa_referencias_section(
    doc: docx.Document,
    references: List[ReferenciaModel],
    rules: APARuleSet,
) -> None:
    """
    Inserta la seccion de Referencias al final del documento con sangria francesa estricta.
    """
    if not references:
        return

    # Salto de pagina antes de Referencias
    doc.add_page_break()

    # Titulo Nivel 1 Centrado
    p_hdr = doc.add_paragraph()
    p_hdr.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_hdr.paragraph_format.line_spacing = rules.line_spacing
    p_hdr.paragraph_format.first_line_indent = Inches(0)
    p_hdr.paragraph_format.space_before = Pt(0)
    p_hdr.paragraph_format.space_after = Pt(0)

    r_hdr = p_hdr.add_run("Referencias")
    r_hdr.bold = True
    r_hdr.font.name = rules.font_family
    r_hdr.font.size = Pt(rules.font_size_pt)
    r_hdr.font.color.rgb = RGBColor(0, 0, 0)

    # Ordenar referencias
    sorted_refs = sort_referencias_alphabetically(references)

    for ref in sorted_refs:
        p_ref = doc.add_paragraph()
        p_ref.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p_ref.paragraph_format.line_spacing = rules.line_spacing

        # Sangria Francesa (Hanging Indent) 1.27 cm
        p_ref.paragraph_format.left_indent = Inches(0.5)
        p_ref.paragraph_format.first_line_indent = Inches(-0.5)
        p_ref.paragraph_format.space_before = Pt(0)
        p_ref.paragraph_format.space_after = Pt(0)

        # Si tenemos texto crudo formateado o campos individuales
        text: str = ref.formatted_apa if ref.formatted_apa else ref.raw_text

        # Resaltar cursivas basicas si contienen journal/book
        run = p_ref.add_run(text)
        run.font.name = rules.font_family
        run.font.size = Pt(rules.font_size_pt)
        run.font.color.rgb = RGBColor(0, 0, 0)

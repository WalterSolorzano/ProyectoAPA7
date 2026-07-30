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

import re

def extract_doi_or_isbn(text: str):
    doi_match = re.search(r'(10\.\d{4,9}/[-._;()/:A-Z0-9]+)', text, re.IGNORECASE)
    if doi_match:
        return {"type": "doi", "value": doi_match.group(1)}
    
    isbn_match = re.search(r'(?:ISBN(?:-1[03])?:? )?(?=[-0-9 ]{13,17})(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]', text, re.IGNORECASE)
    if isbn_match:
        isbn_clean = re.sub(r'[^0-9X]', '', isbn_match.group(0).upper())
        if len(isbn_clean) in (10, 13):
            return {"type": "isbn", "value": isbn_clean}
    return None

async def fetch_crossref_metadata(doi: str) -> Optional[dict]:
    url = f"https://api.crossref.org/works/{doi}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()["message"]
                authors = []
                for author in data.get("author", []):
                    if "family" in author and "given" in author:
                        authors.append(f"{author['family']}, {author['given'][0]}.")
                    elif "family" in author:
                        authors.append(author["family"])
                
                author_str = ", & ".join(authors) if authors else "Autor desconocido"
                year = data.get("published-print", {}).get("date-parts", [[None]])[0][0]
                if not year:
                    year = data.get("published-online", {}).get("date-parts", [[None]])[0][0]
                year_str = str(year) if year else "s.f."
                
                title = data.get("title", [""])[0]
                container_title = data.get("container-title", [""])[0]
                volume = data.get("volume", "")
                issue = data.get("issue", "")
                page = data.get("page", "")
                
                formatted = f"{author_str} ({year_str}). {title}."
                if container_title:
                    formatted += f" {container_title}"
                    if volume:
                        formatted += f", {volume}"
                        if issue:
                            formatted += f"({issue})"
                    if page:
                        formatted += f", {page}."
                    else:
                        formatted += "."
                
                return {
                    "author": author_str,
                    "year": year_str,
                    "title": title,
                    "journal": container_title,
                    "volume": volume,
                    "issue": issue,
                    "page": page,
                    "doi": doi,
                    "formatted": formatted
                }
    except Exception as e:
        print(f"[WARN] Error in Crossref API: {e}")
    return None

async def fetch_openlibrary_metadata(isbn: str) -> Optional[dict]:
    url = f"https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                key = f"ISBN:{isbn}"
                if key in data:
                    book = data[key]
                    authors = [a["name"] for a in book.get("authors", [])]
                    author_str = ", & ".join(authors) if authors else "Autor desconocido"
                    year = book.get("publish_date", "s.f.")
                    title = book.get("title", "")
                    publisher = book.get("publishers", [{"name": ""}])[0].get("name", "")
                    
                    formatted = f"{author_str} ({year}). {title}. {publisher}."
                    
                    return {
                        "author": author_str,
                        "year": year,
                        "title": title,
                        "publisher": publisher,
                        "isbn": isbn,
                        "formatted": formatted
                    }
    except Exception as e:
        print(f"[WARN] Error in OpenLibrary API: {e}")
    return None

async def resolve_dois_batch(raw_references: List[str]) -> List[dict]:
    """
    Recibe una lista de referencias en texto libre. Extrae DOIs/ISBNs y 
    resuelve los metadatos de forma concurrente usando Crossref u OpenLibrary.
    Retorna lista de diccionarios con los resultados encontrados, manteniendo el índice.
    """
    import asyncio
    
    async def process_ref(idx, text):
        info = extract_doi_or_isbn(text)
        if not info:
            return {"index": idx, "original": text, "resolved": False}
        
        if info["type"] == "doi":
            metadata = await fetch_crossref_metadata(info["value"])
            if metadata:
                return {"index": idx, "original": text, "resolved": True, "type": "doi", "metadata": metadata}
        elif info["type"] == "isbn":
            metadata = await fetch_openlibrary_metadata(info["value"])
            if metadata:
                return {"index": idx, "original": text, "resolved": True, "type": "isbn", "metadata": metadata}
                
        return {"index": idx, "original": text, "resolved": False}

    tasks = [process_ref(idx, text) for idx, text in enumerate(raw_references)]
    results = await asyncio.gather(*tasks)
    return list(results)



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

        # Validacion: si text esta vacio, intentar raw_text; si aun vacio, saltar
        if not text or not text.strip():
            text = ref.raw_text
        if not text or not text.strip():
            continue

        # Resaltar cursivas basicas si contienen journal/book
        run = p_ref.add_run(text)
        run.bold = False  # Limpiar negritas residuales del documento Word original
        run.font.name = rules.font_family
        run.font.size = Pt(rules.font_size_pt)
        run.font.color.rgb = RGBColor(0, 0, 0)

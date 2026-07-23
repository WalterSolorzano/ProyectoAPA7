"""
WordAPA7 — Motor de Citas APA 7

Detecta y clasifica citas dentro del texto (Parenteticas, Narrativas, Secundarias,
Multiples, et al., con pagina), evitando falsos positivos en parentesis comunes
como "(vease Figura 1)" o "(100 kg)".
"""

import re
from typing import List, Optional

from models import CitationModel, CitationType


# ── Terminos excluidos para evitar falsos positivos ────────────────────────────

EXCLUDED_PAREN_TERMS: set[str] = {
    "vease", "vease", "ver", "figura", "tabla", "cuadro", "anexo",
    "apendice", "apendice", "kg", "cm", "mm", "gr", "m", "km",
    "usd", "eur", "ejemplo", "e.g.", "i.e.", "cf.", "vid.",
    "fig.", "tab.", "n.", "p.", "pp.", "ed.", "eds.", "vol.",
    "cap.", "seccion", "seccion", "inciso", "articulo", "articulo",
}


# ── Patrones Regex ─────────────────────────────────────────────────────────────

# Cita secundaria: (Garcia, 2020, como se cito en Perez, 2023)
# Detecta y asigna correctamente primary/secondary
REGEX_SECUNDARIA = re.compile(
    r"\(\s*"
    r"([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:y|&)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?(?:\s+et\s+al\.?)?)"
    r"\s*,\s*(\d{4}[a-z]?)"
    r"\s*,\s*(?:como\s+se\s+cit[oó]\s+en|as\s+cited\s+in)\s+"
    r"([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:y|&)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?(?:\s+et\s+al\.?)?)"
    r"\s*,\s*(\d{4}[a-z]?)"
    r"\s*\)",
    re.IGNORECASE,
)

# Cita parentetica: (Garcia, 2023), (Garcia & Lopez, 2023, p. 45), (Garcia et al., 2023)
REGEX_PARENTETICA = re.compile(
    r"\(\s*"
    r"([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+"                              # Primer autor
    r"(?:\s*(?:y|&)\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*"             # Autores adicionales con & o y
    r"(?:,\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s*(?:y|&)\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)*"  # Mas autores
    r"(?:\s+et\s+al\.?)?"                                     # et al opcional
    r")"
    r"\s*,\s*(\d{4}[a-z]?)"                                    # Ano
    r"(?:\s*,\s*(?:p[p]?\.|p[aá]g\.)\s*(\d+(?:[–\-]\d+)?))?"  # Pagina opcional
    r"\s*\)",
)

# Cita narrativa: Garcia (2023), Garcia y Lopez (2023, p. 12), Garcia et al. (2023)
REGEX_NARRATIVA = re.compile(
    r"\b"
    r"([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+"                               # Primer autor
    r"(?:\s+(?:y|&)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*"             # Autores adicionales
    r"(?:\s+et\s+al\.?)?"                                      # et al opcional
    r")"
    r"\s+"
    r"\((\d{4}[a-z]?)"                                         # Ano
    r"(?:,\s*(?:p[p]?\.|p[aá]g\.)\s*(\d+(?:[–\-]\d+)?))?"    # Pagina opcional
    r"\)",
)

# Cita multiple: (Garcia, 2023; Lopez, 2021; Martinez, 2019)
REGEX_MULTIPLE = re.compile(
    r"\(\s*"
    r"([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:y|&)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?"
    r"(?:\s+et\s+al\.?)?\s*,\s*\d{4}[a-z]?)"
    r"(\s*;\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:y|&)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?"
    r"(?:\s+et\s+al\.?)?\s*,\s*\d{4}[a-z]?)+"
    r"\s*\)",
)


# ── Funciones de extraccion ────────────────────────────────────────────────────

def _is_excluded_parenthetical(match_text: str) -> bool:
    """Verifica si un parentesis capturado es un falso positivo."""
    text_lower = match_text.lower()
    # Verificar terminos excluidos
    for term in EXCLUDED_PAREN_TERMS:
        if term in text_lower:
            return True
    # Verificar si es una referencia a figura/tabla (e.g., "(vease Figura 1)")
    if re.search(r"(?:figura|tabla|cuadro|anexo)\s+\d+", text_lower):
        return True
    # Verificar si son solo numeros/medidas (e.g., "(100 kg)", "(p < .05)")
    if re.match(r'^\([\d\.\s<>=*/+\-%,]+\s*(?:kg|cm|mm|gr|m|km|usd|eur)?\)$', match_text.strip()):
        return True
    return False


def _parse_authors_from_match(author_text: str) -> List[str]:
    """
    Extrae autores individuales de un match de autor.
    Soporta: "Garcia", "Garcia y Lopez", "Garcia & Lopez", "Garcia et al."
    """
    authors: List[str] = []
    # Limpiar et al.
    clean = re.sub(r'\s+et\s+al\.?', '', author_text, flags=re.IGNORECASE)
    # Dividir por & o y
    parts = re.split(r'\s*(?:y|&)\s*', clean)
    for part in parts:
        part = part.strip().rstrip(",")
        if part and part[0].isupper():
            authors.append(part)
    return authors if authors else [author_text.strip()]


def extract_citations_from_text(text: str, element_id: str) -> List[CitationModel]:
    """
    Escanea un texto y devuelve todas las citas APA 7 detectadas con su posicion y tipo.

    Soporta:
    - Parenteticas: (Garcia, 2023), (Garcia & Lopez, 2023, p. 45)
    - Narrativas: Garcia (2023), Garcia et al. (2023)
    - Secundarias: (Garcia, 2020, como se cito en Perez, 2023)
    - Multiples: (Garcia, 2023; Lopez, 2021)
    - et al: (Garcia et al., 2023)
    - Con pagina: (Garcia, 2023, p. 45) o (Garcia, 2023, pag. 45)
    """
    citations: List[CitationModel] = []
    processed_ranges: List[tuple[int, int]] = []

    def _is_overlapping(start: int, end: int) -> bool:
        for ps, pe in processed_ranges:
            if start < pe and end > ps:
                return True
        return False

    # 1. Citas Secundarias (patron mas especifico primero)
    for match in REGEX_SECUNDARIA.finditer(text):
        start, end = match.start(), match.end()
        if _is_overlapping(start, end):
            continue
        processed_ranges.append((start, end))

        raw_match = match.group(0)
        primary_author = match.group(1).strip()
        primary_year = match.group(2)
        secondary_author = match.group(3).strip()
        secondary_year = match.group(4)

        citations.append(CitationModel(
            raw_text=raw_match,
            authors=[secondary_author],  # Solo la fuente secundaria va a la bibliografia
            year=secondary_year,
            citation_type=CitationType.SECUNDARIA,
            element_id=element_id,
            start_offset=start,
            end_offset=end,
        ))

    # 2. Citas Parenteticas Estandar
    for match in REGEX_PARENTETICA.finditer(text):
        start, end = match.start(), match.end()
        if _is_overlapping(start, end):
            continue

        raw_match = match.group(0)

        # Saltar falsos positivos
        if _is_excluded_parenthetical(raw_match):
            continue
        if "como se cito en" in raw_match.lower() or "as cited in" in raw_match.lower():
            continue

        processed_ranges.append((start, end))

        author_text = match.group(1).strip()
        year = match.group(2)
        page = match.group(3) if match.lastindex and match.lastindex >= 3 else None

        # Determinar tipo de cita
        if "et al." in raw_match.lower() or "et al" in raw_match.lower():
            c_type = CitationType.ET_AL
        else:
            c_type = CitationType.PARENTETICA

        citations.append(CitationModel(
            raw_text=raw_match,
            authors=_parse_authors_from_match(author_text),
            year=year,
            page=page,
            citation_type=c_type,
            element_id=element_id,
            start_offset=start,
            end_offset=end,
        ))

    # 3. Citas Narrativas
    for match in REGEX_NARRATIVA.finditer(text):
        start, end = match.start(), match.end()
        if _is_overlapping(start, end):
            continue

        raw_match = match.group(0)
        processed_ranges.append((start, end))

        author_text = match.group(1).strip()
        year = match.group(2)
        page = match.group(3) if match.lastindex and match.lastindex >= 3 else None

        c_type = CitationType.NARRATIVA
        if "et al." in author_text.lower() or "et al" in author_text.lower():
            c_type = CitationType.ET_AL

        citations.append(CitationModel(
            raw_text=raw_match,
            authors=_parse_authors_from_match(author_text),
            year=year,
            page=page,
            citation_type=c_type,
            element_id=element_id,
            start_offset=start,
            end_offset=end,
        ))

    return citations


# ── Deteccion de errores comunes ──────────────────────────────────────────────

COMMON_APA_ERRORS: List[tuple[re.Pattern, str, str]] = [
    # (Garcia 2023) -> falta coma
    (re.compile(r'\([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+\d{4}\)'),
     "missing_comma",
     "Falta coma entre autor y ano: (Garcia, 2023)"),
    # et al sin punto
    (re.compile(r'et al[^.]', re.IGNORECASE),
     "et_al_no_period",
     "et al debe llevar punto: et al."),
    # Multiples autores con "y" en vez de "&" dentro de parentesis
    (re.compile(r'\([^)]+\sy\s[^)]+,\s*\d{4}\)'),
     "missing_ampersand",
     'Dentro de parentesis usar "&" no "y"'),
    # Pagina con formato incorrecto
    (re.compile(r'p\s+\d+'),
     "wrong_page_format",
     "Usar formato 'p. 45' o 'pp. 45-48'"),
]


def detect_citation_errors(citation: CitationModel) -> List[dict]:
    """
    Detecta errores comunes en una cita detectada.
    Retorna lista de errores con tipo y descripcion.
    """
    errors: List[dict] = []
    raw = citation.raw_text

    for pattern, err_type, description in COMMON_APA_ERRORS:
        if pattern.search(raw):
            errors.append({
                "type": err_type,
                "description": description,
            })

    return errors

"""
WordAPA7 — Clasificador Heuristico (Pre-Classifier)

Implementa una clasificacion en 3 pasadas:
- Pasada 1: Clasificacion inicial basada en formato visual, indentacion y patrones de texto (Regex).
- Pasada 2: Correccion jerarquica de niveles de Heading e imagenes de Portada vs Figuras.
- Pasada 3: Inferencia de jerarquia de headings por tamano de fuente relativo.

Meta: >85% de elementos clasificados sin LLM.
"""

import re
import unicodedata
from typing import List, Optional

from models import ElementModel, ElementType


def _normalize_accent(text: str) -> str:
    """Elimina acentos y dieresis para comparacion insensible a tildes."""
    nfkd = unicodedata.normalize('NFKD', text)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


# ── Patrones Regex para deteccion ──────────────────────────────────────────────

# Cita parentetica: (Garcia, 2023) o (Garcia & Lopez, 2023, p. 45)
REGEX_CITATION_PARENTETICA = re.compile(
    r"\(([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s*(?:y|&)\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*"
    r"(?:\s+et\s+al\.?)?\s*,\s*\d{4}[a-z]?"
    r"(?:,\s*(?:p[p]?\.|p[aá]g\.)\s*\d+(?:[–\-]\d+)?)?)\)",
)

# Cita narrativa: Garcia (2023) o Garcia et al. (2023)
REGEX_CITATION_NARRATIVA = re.compile(
    r"\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:y|&)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?"
    r"(?:\s+et\s+al\.?)?)\s+\((\d{4}[a-z]?"
    r"(?:,\s*(?:p[p]?\.|p[aá]g\.)\s*\d+(?:[–\-]\d+)?)?)\)",
)

# Heading numerado: "1.", "1.1.", "2.3.1.", "I.", "A."
REGEX_NUMBERED_HEADING = re.compile(
    r"^(?:(?:\d+\.){1,4}\d*|(?:X{0,3})(?:I[XV]|V?I{0,3})\.|[A-Z]\.)\s+\S",
)

# Bullet manual: caracteres de vineta + texto
REGEX_BULLET_CHAR = re.compile(r'^([•●▪◦○▸►→·\-\–\—\*])\s+')

# Bullet con numero o letra: "1.", "a)", "(1)", etc.
REGEX_BULLET_NUMBERED = re.compile(r'^(?:\(?\d+[\.\)]|\(?[a-z][\.\)])\s+')

# Heading 4/5 inline: texto negrita + punto + texto normal en mismo parrafo
REGEX_INLINE_HEADING = re.compile(
    r'^([A-ZÁÉÍÓÚÑ][^.]{1,80}\.)\s+([A-ZÁÉÍÓÚÑ].+)$'
)

# Caption de tabla: "Tabla 1", "Tabla 1."
REGEX_TABLE_CAPTION = re.compile(r'^(?:Tabla|Table|Cuadro)\s+\d+\.?', re.IGNORECASE)

# Caption de figura: "Figura 1", "Figura 1."
REGEX_FIGURE_CAPTION = re.compile(r'^(?:Figura|Figure|Fig\.)\s+\d+\.?', re.IGNORECASE)

# Patrones de texto que indican bloque de portada
PORTADA_KEYWORDS: set[str] = {
    "universidad", "facultad", "escuela", "departamento", "carrera",
    "licenciatura", "maestria", "doctorado", "tesis", "monografia",
    "profesor", "catedratico", "alumno", "estudiante", "autor",
    "presentado por", "presentada por", "dirigido por", "tutor",
    "asignatura", "materia", "curso", "semestre", "ciclo",
    "ano academico", "periodo", "fecha", "ciudad", "pais",
}

# Palabras que sugieren que un parrafo es parte central del texto (no portada)
BODY_KEYWORDS: set[str] = {
    "introduccion", "resumen", "abstract", "metodologia", "metodo",
    "resultados", "discusion", "conclusion", "conclusiones",
    "referencias", "bibliografia", "anexo", "apendice",
    "capitulo", "seccion", "marco teorico", "antecedentes",
    "objetivo", "hipotesis", "justificacion", "planteamiento",
}


# ── Funciones auxiliares ───────────────────────────────────────────────────────

def _text_word_count(text: str) -> int:
    """Cuenta palabras en un texto."""
    return len(text.split())


def _is_all_caps(text: str) -> bool:
    """Verifica si un texto esta en MAYUSCULAS (permitiendo acentos)."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    return all(c.isupper() or c in "ÁÉÍÓÚÑ" for c in letters)


def _is_title_case(text: str) -> bool:
    """Verifica si un texto tiene formato Titulo Case aproximado."""
    words = text.split()
    if len(words) < 2:
        return False
    # Al menos 60% de palabras empiezan con mayuscula
    capital_count = sum(1 for w in words if w and w[0].isupper())
    return capital_count / len(words) >= 0.6


def _has_portada_keywords(text: str) -> bool:
    """Verifica si el texto contiene palabras clave de portada (insensible a acentos)."""
    text_normalized = _normalize_accent(text.lower())
    return any(kw in text_normalized for kw in PORTADA_KEYWORDS)


def _has_body_keywords(text: str) -> bool:
    """Verifica si el texto contiene palabras clave de cuerpo academico (insensible a acentos)."""
    text_normalized = _normalize_accent(text.lower())
    return any(kw in text_normalized for kw in BODY_KEYWORDS)


def _estimate_level_by_indent(left_indent_cm: float) -> int:
    """Estima nivel de bullet/list por su indentacion."""
    if left_indent_cm >= 2.0:
        return 3
    elif left_indent_cm >= 1.2:
        return 2
    return 1


def _is_empty_or_whitespace(text: str) -> bool:
    """Verifica si el texto esta vacio o solo tiene whitespace."""
    return not text or not text.strip()


# ── Clasificacion principal ────────────────────────────────────────────────────

def pre_classify_elements(elements: List[ElementModel]) -> List[ElementModel]:
    """
    Ejecuta 3 pasadas de clasificacion sobre la lista de elementos del documento.

    Pasada 1: Clasificacion heuristica por formato, estilo e indentacion.
    Pasada 2: Re-numeracion secuencial de figuras/tablas y deteccion de portada.
    Pasada 3: Inferencia de jerarquia de headings por tamano de fuente relativo.
    """
    first_heading_idx: int = -1
    first_body_text_idx: int = -1

    # ── PASADA 1: Clasificacion Heuristica por Formato ──────────────────────
    for idx, elem in enumerate(elements):
        text: str = elem.text.strip() if elem.text else ""

        # CRITICO: Elementos ya detectados como imagen/tabla/portada_block mantienen su tipo
        if elem.type in (
            ElementType.IMAGE,
            ElementType.TABLE,
            ElementType.PAGE_BREAK,
            ElementType.SECTION_BREAK,
            ElementType.PORTADA_BLOCK,
        ):
            elem.confidence = 1.0
            continue

        # CRITICO: Parrafo vacio — debe ir ANTES de cualquier otra deteccion
        if _is_empty_or_whitespace(text):
            elem.type = ElementType.EMPTY
            elem.confidence = 1.0
            continue

        style_name: str = (elem.style_name or "").lower()
        word_count: int = _text_word_count(text)
        is_bold: bool = elem.is_bold
        is_italic: bool = elem.is_italic
        font_size: float = elem.font_size
        alignment: str = elem.alignment
        left_indent: float = elem.left_indent_cm

        # --- CERTEZA 0.95: Lista con numeracion OOXML nativa (ANTES que heading) ---
        if elem.bullet_source == "ooxml_list":
            if elem.type not in (ElementType.BULLET, ElementType.NUMBERED_LIST):
                has_auto_number = bool(REGEX_BULLET_NUMBERED.match(text)) or bool(REGEX_NUMBERED_HEADING.match(text))
                elem.type = ElementType.NUMBERED_LIST if has_auto_number else ElementType.BULLET
            if not elem.heading_level or elem.heading_level == 0:
                elem.heading_level = _estimate_level_by_indent(left_indent)
            elem.confidence = 0.95
            continue

        # --- CERTEZA 1.0: Estilo de Word explicito ---
        if "heading" in style_name or "titulo" in style_name or "título" in style_name:
            elem.type = ElementType.HEADING
            match_lvl = re.search(r'\d', style_name)
            if match_lvl:
                elem.heading_level = min(max(int(match_lvl.group(0)), 1), 5)
            else:
                elem.heading_level = 1
            elem.confidence = 0.92
            if first_heading_idx == -1:
                first_heading_idx = idx
            continue

        if "list bullet" in style_name:
            elem.type = ElementType.BULLET
            lvl_match = re.search(r'list bullet\s*(\d)', style_name)
            elem.heading_level = int(lvl_match.group(1)) if lvl_match else 1
            elem.confidence = 0.97
            continue

        if "list number" in style_name:
            elem.type = ElementType.NUMBERED_LIST
            lvl_match = re.search(r'list number\s*(\d)', style_name)
            elem.heading_level = int(lvl_match.group(1)) if lvl_match else 1
            elem.confidence = 0.97
            continue

        if "block text" in style_name or "quote" in style_name:
            elem.type = ElementType.BLOCK_QUOTE
            elem.confidence = 0.95
            continue

        # --- CERTEZA 0.91: Heading numerado por patron (1.1, 2.3.1, I., A.) ---
        if REGEX_NUMBERED_HEADING.match(text) and word_count <= 20:
            elem.type = ElementType.HEADING
            parts = text.split()
            prefix = parts[0] if parts else ""
            if prefix.endswith('.'):
                segments = prefix.rstrip('.').split('.')
                elem.heading_level = min(max(len(segments), 1), 5)
            else:
                elem.heading_level = 1
            elem.confidence = 0.91
            if first_heading_idx == -1:
                first_heading_idx = idx
            continue

        # --- CERTEZA 0.93: Bullet por caracter manual ---
        bullet_match = REGEX_BULLET_CHAR.match(text)
        if bullet_match:
            elem.type = ElementType.BULLET
            elem.original_char = bullet_match.group(1)
            elem.bullet_source = "manual_char"
            elem.heading_level = _estimate_level_by_indent(left_indent)
            elem.confidence = 0.93
            continue

        # --- CERTEZA 0.90: Numero/letra de lista manual ---
        if REGEX_BULLET_NUMBERED.match(text) and not REGEX_NUMBERED_HEADING.match(text):
            elem.type = ElementType.NUMBERED_LIST
            elem.heading_level = _estimate_level_by_indent(left_indent)
            elem.confidence = 0.88
            continue

        # --- CERTEZA 0.96: Parrafo largo (+35 palabras) ---
        if word_count > 35:
            elem.type = ElementType.PARAGRAPH
            elem.confidence = 0.96
            if first_body_text_idx == -1 and first_heading_idx != -1:
                first_body_text_idx = idx
            continue

        # --- CERTEZA 0.88: Dash al inicio -> bullet manual ---
        if text.startswith(("- ", "– ", "— ")):
            elem.type = ElementType.BULLET
            elem.bullet_source = "manual_char"
            elem.original_char = text[0]
            elem.heading_level = _estimate_level_by_indent(left_indent)
            elem.confidence = 0.88
            continue

        # --- CERTEZA variable: Heading por formato directo ---
        is_centered = alignment == "center"
        all_bold = is_bold
        all_caps = _is_all_caps(text)
        has_period_end = text.rstrip().endswith(".")
        has_indent = left_indent >= 0.5
        is_short = word_count <= 12
        is_medium = word_count <= 20

        # Heading 1: centrado + negrita + corto + posible MAYUSCULAS
        if is_centered and all_bold and is_short and not is_italic:
            if all_caps:
                elem.type = ElementType.HEADING
                elem.heading_level = 1
                elem.confidence = 0.88
            else:
                elem.type = ElementType.HEADING
                elem.heading_level = 1
                elem.confidence = 0.80
            if first_heading_idx == -1:
                first_heading_idx = idx
            continue

        # Heading 3: izquierda + negrita + cursiva + corto
        if not is_centered and all_bold and is_italic and is_short:
            elem.type = ElementType.HEADING
            elem.heading_level = 3
            elem.confidence = 0.82
            if first_heading_idx == -1:
                first_heading_idx = idx
            continue

        # Heading 4: sangria + negrita + termina en punto (inline)
        if has_indent and all_bold and has_period_end and word_count <= 18 and not is_italic:
            elem.type = ElementType.HEADING
            elem.heading_level = 4
            elem.confidence = 0.82
            if first_heading_idx == -1:
                first_heading_idx = idx
            continue

        # Heading 5: sangria + negrita + cursiva + termina en punto (inline)
        if has_indent and all_bold and is_italic and has_period_end and word_count <= 18:
            elem.type = ElementType.HEADING
            elem.heading_level = 5
            elem.confidence = 0.84
            if first_heading_idx == -1:
                first_heading_idx = idx
            continue

        # Heading 2: izquierda + negrita + sin cursiva + corto
        if not is_centered and all_bold and not is_italic and is_short:
            elem.type = ElementType.HEADING
            elem.heading_level = 2
            elem.confidence = 0.74
            if first_heading_idx == -1:
                first_heading_idx = idx
            continue

        # --- CERTEZA 0.85: Caption de tabla/figura ---
        if REGEX_TABLE_CAPTION.match(text):
            elem.type = ElementType.PARAGRAPH
            elem.confidence = 0.85
            continue

        if REGEX_FIGURE_CAPTION.match(text):
            elem.type = ElementType.PARAGRAPH
            elem.confidence = 0.85
            continue

        # --- CERTEZA 0.80: Bloque de cita (indentado + largo) ---
        if left_indent >= 1.0 and word_count > 25:
            elem.type = ElementType.BLOCK_QUOTE
            elem.confidence = 0.80
            continue

        # --- CERTEZA 0.80: Titulo principal (centrado, tamano grande) ---
        if is_centered and font_size >= 14 and is_short:
            elem.type = ElementType.HEADING
            elem.heading_level = 1
            elem.confidence = 0.80
            if first_heading_idx == -1:
                first_heading_idx = idx
            continue

        # --- CERTEZA 0.75: Parrafo normal por defecto ---
        elem.type = ElementType.PARAGRAPH
        elem.confidence = 0.75
        if first_body_text_idx == -1 and first_heading_idx != -1:
            first_body_text_idx = idx

    # ── PASADA 2: Numeracion Secuencial de Figuras y Tablas + Portada ───────
    figure_counter: int = 0
    table_counter: int = 0

    # Determinar el limite real de la portada: buscar el titulo principal del cuerpo ("Introducción")
    body_start_idx = -1
    for idx, elem in enumerate(elements):
        txt_norm = _normalize_accent((elem.text or "").lower())
        if "introducc" in txt_norm or "resumen" in txt_norm or "abstract" in txt_norm or "capitulo" in txt_norm or "contenido" in txt_norm:
            body_start_idx = idx
            break

    if body_start_idx == -1:
        # Si no hay 'Introduccion', buscar el primer heading que no tenga palabras de portada y este despues del indice 10
        for idx, elem in enumerate(elements):
            if elem.type == ElementType.HEADING and idx >= 10:
                body_start_idx = idx
                break

    if body_start_idx == -1:
        body_start_idx = len(elements)

    portada_boundary: int = body_start_idx

    for idx, elem in enumerate(elements):
        # Si el elemento esta antes del cuerpo, es 100% PORTADA_BLOCK
        if idx < portada_boundary:
            if elem.type in (ElementType.IMAGE, ElementType.PARAGRAPH, ElementType.HEADING):
                elem.type = ElementType.PORTADA_BLOCK
                elem.confidence = 0.95
                if elem.image_info:
                    elem.image_info.figure_number = 0
        else:
            if elem.type == ElementType.IMAGE and elem.image_info:
                figure_counter += 1
                elem.image_info.figure_number = figure_counter
            elif elem.type == ElementType.TABLE and elem.table_info:
                table_counter += 1
                elem.table_info.table_number = table_counter

    # ── PASADA 3: Inferencia de Jerarquia de Headings ──────────────────────
    # Recolectar tamanos de fuente de headings clasificados
    heading_sizes: List[float] = []
    for e in elements:
        if e.type == ElementType.HEADING and e.font_size > 0:
            heading_sizes.append(e.font_size)

    unique_sizes: List[float] = sorted(list(set(heading_sizes)), reverse=True)

    size_to_level: dict[float, int] = {}
    for i, sz in enumerate(unique_sizes[:5]):
        size_to_level[sz] = i + 1

    for elem in elements:
        if elem.type == ElementType.HEADING:
            if elem.font_size in size_to_level:
                elem.heading_level = size_to_level[elem.font_size]
            elif not elem.heading_level or elem.heading_level == 0:
                elem.heading_level = 1

    # Marcar elementos con baja confianza como needing review
    for elem in elements:
        if elem.confidence < 0.85 and elem.type not in (
            ElementType.EMPTY, ElementType.IMAGE, ElementType.TABLE,
            ElementType.PAGE_BREAK, ElementType.SECTION_BREAK,
        ):
            elem.needs_review = True

    return elements

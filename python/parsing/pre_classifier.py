"""
WordAPA7 — Clasificador Heuristico (Pre-Classifier)

Implementa una clasificacion en 3 pasadas:
- Pasada 1: Clasificacion inicial basada en formato visual, indentacion y patrones de texto (Regex).
- Pasada 2: Correccion jerarquica de niveles de Heading e imagenes de Portada vs Figuras.
- Pasada 3: Inferencia de jerarquia de headings por tamano de fuente relativo.

Meta: >85% de elementos clasificados sin LLM.
"""

import re
import math
import unicodedata
from typing import List, Optional

from models import ElementModel, ElementType
from parsing.clustering_classifier import ClusteringHeadingClassifier


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

# Palabras clave que, cuando aparecen SOLAS o como titulo principal
# de un parrafo con formato de heading, deben clasificarse como HEADING 1
HEADING1_KEYWORDS: set[str] = {
    "introduccion", "introduccion",
    "indice", "indice",
    "conclusion", "conclusion",
    "conclusiones",
    "desarrollo",
    "antecedentes",
    "resultados",
    "objetivos",
    "objetivo general", "objetivos especificos",
    "marco teorico", "marco teorico",
    "metodologia", "metodologia",
    "metodo", "metodo",
    "recomendaciones",
    "referencias",
    "bibliografia", "bibliografia",
    "anexos", "anexo",
    "apendice", "apendice",
    "resumen",
    "abstract",
    "dedicatoria",
    "agradecimientos",
    "epigrafe", "epigrafe",
    "glosario",
    "planteamiento del problema",
    "justificacion", "justificacion",
    "hipotesis", "hipotesis",
    "alcance",
    "limitaciones",
    "capitulo I", "capitulo ii", "capitulo iii", "capitulo iv", "capitulo v",
    "capitulo vi", "capitulo vii", "capitulo viii", "capitulo ix", "capitulo x",
    "capitulo i", "capitulo ii", "capitulo iii", "capitulo iv", "capitulo v",
    "capitulo vi", "capitulo vii", "capitulo viii", "capitulo ix", "capitulo x",
    "diagnostico", "diagnostico",
    "estado del arte",
    "fundamentacion teorica",
    "base teorica", "bases teoricas",
    "analisis de resultados",
    "discusion de resultados",
    "propuesta",
    "cronograma",
    "presupuesto",
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
            ElementType.TOC,  # TOC nativo se preserva tal cual
        ):
            elem.confidence = 1.0
            elem.needs_review = False
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
        # Variables de formato (definidas temprano para que esten disponibles en toda la pasada)
        is_centered: bool = alignment == "center"
        all_bold: bool = is_bold
        all_caps: bool = _is_all_caps(text)
        has_period_end: bool = text.rstrip().endswith(".")
        has_indent: bool = left_indent >= 0.5
        is_short: bool = word_count <= 12
        is_medium: bool = word_count <= 20

        # Guard: Elementos sin texto que no son imagen ni tabla siempre son EMPTY
        if not text and not elem.image_info and not elem.table_info and elem.type not in (ElementType.IMAGE, ElementType.TABLE):
            elem.type = ElementType.EMPTY
            elem.heading_level = None
            elem.confidence = 1.0
            continue

        # --- CERTEZA 0.95: Lista con numeración OOXML nativa (ANTES que heading) ---
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

        # --- CERTEZA 0.95: Palabras clave como Heading 1 (introduccion, conclusion, etc.) ---
        # Si el parrafo tiene formato de heading (centrado, bold, tamano grande) y su texto
        # normalizado coincide EXACTAMENTE con una keyword de HEADING1_KEYWORDS (o es solo eso)
        text_clean = text.rstrip(".:;,").strip().lower()
        text_normalized = _normalize_accent(text_clean)
        # Tambien verificar si la palabra esta sola o es el unico contenido significativo
        is_keyword_only = text_normalized in HEADING1_KEYWORDS
        # O si comienza con la palabra clave y es corto (max 5 palabras)
        words_in_text = text_clean.split()
        first_words_normalized = _normalize_accent(" ".join(words_in_text[:3]))
        is_keyword_heading = (
            is_keyword_only
            or (len(words_in_text) <= 5 and any(
                text_normalized.startswith(kw) or text_normalized == kw
                for kw in HEADING1_KEYWORDS
            ))
        )
        if is_keyword_heading and (is_centered or all_bold or font_size >= 14):
            elem.type = ElementType.HEADING
            elem.heading_level = 1
            # Si el texto es exactamente la keyword, confianza maxima
            if is_keyword_only:
                elem.confidence = 0.97
            else:
                elem.confidence = 0.90
            elem.pre_classifier_rule = "heading1_keyword"
            if first_heading_idx == -1:
                first_heading_idx = idx
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

        # Heading 2: izquierda + negrita + sin cursiva + corto + fuente >= 13pt
        # ponytail: font_size >= 13 gate prevents bold phrases in body text
        # from being falsely classified as Heading 2 (confidence raised from 0.74)
        if not is_centered and all_bold and not is_italic and is_short and font_size >= 13:
            elem.type = ElementType.HEADING
            elem.heading_level = 2
            elem.confidence = 0.80
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
        if is_centered and font_size >= 14:
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

    # ── PASADA 2: Portada inteligente + Numeración secuencial ───────
    figure_counter: int = 0
    table_counter: int = 0

    # --- Señales múltiples para detección robusta de portada ---

    portada_boundary = None
    if elements and getattr(elements[0], "page_number", None) is not None:
        portada_boundary = 0
        for idx, elem in enumerate(elements):
            if getattr(elem, "page_number", None) == 1:
                portada_boundary = idx + 1
            else:
                break

    # Señal A: Palabras clave de cuerpo (body_start)
    body_start_idx = -1
    for idx, elem in enumerate(elements):
        txt_norm = _normalize_accent((elem.text or "").lower())
        if any(kw in txt_norm for kw in [
            "introducc", "resumen", "abstract", "marco teorico",
            "antecedentes", "metodologia", "resultado", "discusion",
            "conclusion", "referencias", "bibliografia", "anexo",
            "planteamiento del problema", "justificacion"
        ]):
            body_start_idx = idx
            break

    # Señal B: Palabras clave explícitas de portada
    cover_kw_list = [
        "universidad", "facultad", "carrera", "elaborado por", "tutor", "carnet",
        "managua", "nicaragua", "proyecto de estudio", "area de conocimiento",
        "área de conocimiento", "presentado por", "docente",
        "monografia", "monografía", "tesis", "seminario de", "catedratico",
        "catedrático", "licenciatura", "maestria", "maestría", "doctorado",
        "trabajo de investigacion", "trabajo de investigación",
        "departamento de", "escuela de", "instituto de", "plan de estudio",
        "asignatura", "materia", "curso de", "dirigido por", "revisado por",
        "miembro del tribunal", "tribunal examinador", "carnet universitario",
        "numero de carnet", "presentada por", "presentado por", "para optar",
    ]

    has_explicit_cover_keywords = False
    cover_keyword_count = 0
    for e in elements[:40]:
        text_norm = _normalize_accent((e.text or "").lower())
        for kw in cover_kw_list:
            if kw in text_norm:
                has_explicit_cover_keywords = True
                cover_keyword_count += 1
                break

    # Señal C: Imágenes en primeros elementos (logotipos de portada)
    images_in_first_page = sum(
        1 for e in elements[:25] if e.image_info is not None
    )

    # Señal D: Bloques de texto centrado y corto en los primeros elementos (portada)
    # NOTA: Solo contar elementos que NO son headings (los headings son centrados y cortos por diseño)
    centered_short_blocks = 0
    for e in elements[:20]:
        if e.text and e.text.strip():
            words = len(e.text.split())
            is_heading_style = (e.style_name or "").lower().startswith("heading")
            if e.alignment == "center" and words <= 10 and not is_heading_style:
                centered_short_blocks += 1

    # Señal E: Densidad de palabras clave de portada en primeros 15 elementos
    strong_keyword_density = cover_keyword_count >= 3

    # Decisión combinada: portada_boundary
    if portada_boundary is None:
        if has_explicit_cover_keywords and body_start_idx != -1:
            portada_boundary = body_start_idx
        elif has_explicit_cover_keywords:
            portada_boundary = min(len(elements), 40)
        elif images_in_first_page >= 1 and centered_short_blocks >= 2:
            portada_boundary = 15
        elif centered_short_blocks >= 3:
            portada_boundary = 15
        elif strong_keyword_density:
            portada_boundary = min(len(elements), 40)
        else:
            portada_boundary = 0

    for idx, elem in enumerate(elements):
        if idx < portada_boundary:
            elem.is_cover_section = True
            if elem.type == ElementType.PARAGRAPH:
                elem.type = ElementType.PORTADA_BLOCK
                elem.confidence = 0.95
            if elem.image_info:
                elem.image_info.figure_number = 0
        else:
            elem.is_cover_section = False
            if elem.type == ElementType.IMAGE and elem.image_info:
                figure_counter += 1
                elem.image_info.figure_number = figure_counter
                
                # Buscar caption arriba (idx-1) o abajo (idx+1)
                for offset in [-1, 1, -2, 2]:
                    neighbor_idx = idx + offset
                    if 0 <= neighbor_idx < len(elements):
                        neighbor = elements[neighbor_idx]
                        if neighbor.text and REGEX_FIGURE_CAPTION.match(neighbor.text):
                            # Extraer número de figura del caption
                            caption_num_match = re.search(r'\d+', neighbor.text)
                            if caption_num_match and int(caption_num_match.group()) == figure_counter:
                                elem.image_info.caption = neighbor.text
                                neighbor.type = ElementType.EMPTY  # Consumido como caption
                                break

            elif elem.type == ElementType.TABLE and elem.table_info:
                table_counter += 1
                elem.table_info.table_number = table_counter

    # ── PASADA 3: Scoring Multi-Criterio e Inferencia de Jerarquía ─────────────
    # Calcular mediana de tamaño de fuente
    body_sizes = [e.font_size for e in elements if e.font_size and e.font_size > 0 and not e.is_cover_section]
    median_size = sorted(body_sizes)[len(body_sizes) // 2] if body_sizes else 12.0

    highest_level_seen = 0

    for elem in elements:
        if elem.is_cover_section or elem.type == ElementType.PORTADA_BLOCK:
            elem.heading_level = None
            elem.needs_review = False
            continue

        style_lower = (elem.style_name or "").lower()
        txt = (elem.text or "").strip()
        words = txt.split()

        if not txt and not elem.image_info and not elem.table_info and elem.type not in (ElementType.IMAGE, ElementType.TABLE):
            elem.type = ElementType.EMPTY
            elem.heading_level = None
            elem.needs_review = False
            continue

        # 1. Caso A: Estilos Nativos de Word (Confianza Máxima 0.99)
        if "heading 1" in style_lower or "título 1" in style_lower or "titulo 1" in style_lower:
            elem.type = ElementType.HEADING
            elem.heading_level = 1
            elem.confidence = 0.99
            elem.needs_review = False
            highest_level_seen = max(highest_level_seen, 1)
            continue
        elif "heading 2" in style_lower or "título 2" in style_lower or "titulo 2" in style_lower:
            elem.type = ElementType.HEADING
            elem.heading_level = 2
            elem.confidence = 0.99
            elem.needs_review = False
            highest_level_seen = max(highest_level_seen, 2)
            continue
        elif "heading 3" in style_lower or "título 3" in style_lower or "titulo 3" in style_lower:
            elem.type = ElementType.HEADING
            elem.heading_level = 3
            elem.confidence = 0.99
            elem.needs_review = False
            highest_level_seen = max(highest_level_seen, 3)
            continue
        elif "heading 4" in style_lower or "título 4" in style_lower:
            elem.type = ElementType.HEADING
            elem.heading_level = 4
            elem.confidence = 0.99
            elem.needs_review = False
            highest_level_seen = max(highest_level_seen, 4)
            continue
        elif "heading 5" in style_lower or "título 5" in style_lower:
            elem.type = ElementType.HEADING
            elem.heading_level = 5
            elem.confidence = 0.99
            elem.needs_review = False
            highest_level_seen = max(highest_level_seen, 5)
            continue

        # Preservar elementos clasificados con alta confianza en Pasada 1 (bullets, tablas, etc.)
        if elem.confidence >= 0.85 and elem.type not in (ElementType.PARAGRAPH, ElementType.HEADING):
            elem.needs_review = False
            continue

        # Skip non-textual or special elements
        if elem.type in (ElementType.EMPTY, ElementType.IMAGE, ElementType.TABLE, ElementType.PAGE_BREAK, ElementType.SECTION_BREAK, ElementType.TOC):
            elem.needs_review = False
            continue

        # 2. Caso B: Algoritmo de Scoring Heurístico Multi-Criterio
        score = 0.0

        if elem.is_bold:
            score += 0.4
        if len(words) < 12:
            score += 0.2
        if txt and not txt.endswith("."):
            score += 0.1
        if elem.font_size > median_size:
            score += 0.2
        if elem.alignment == "center":
            score += 0.15
        if len(words) > 25 or (txt and txt.count(".") > 1):
            score -= 0.5

        # Decisiones por Umbral de Score
        # Heuristically-detected headings always need review so the user
        # can confirm or correct; only native Word styles skip the review gate.
        if score >= 0.7:
            elem.type = ElementType.HEADING
            elem.confidence = min(0.95, 0.70 + (score * 0.25))
            elem.needs_review = True
        elif 0.4 <= score < 0.7:
            elem.type = ElementType.HEADING
            elem.confidence = 0.65
            elem.needs_review = True
        else:
            if elem.type == ElementType.HEADING and not elem.style_name:
                elem.type = ElementType.PARAGRAPH
                elem.confidence = 0.75
                elem.needs_review = True
            else:
                elem.needs_review = elem.confidence < 0.80

        # Inferencia de Jerarquía Incremental
        if elem.type == ElementType.HEADING:
            if re.match(r'^\d+\.\d+\.\d+\s', txt):
                target_lvl = 3
            elif re.match(r'^\d+\.\d+\s', txt):
                target_lvl = 2
            elif re.match(r'^\d+\.\s', txt):
                target_lvl = 1
            elif re.match(r'^(?:X{0,3})(?:I[XV]|V?I{1,3})\.\s', txt):
                target_lvl = 1
            elif elem.alignment == "center" or elem.font_size > median_size:
                target_lvl = 1
            elif elem.is_bold and elem.is_italic:
                target_lvl = 3
            else:
                target_lvl = 2

            # Garantizar desarrollo incremental de la jerarquía (no saltar a H3 si no hay H1/H2)
            if target_lvl > highest_level_seen + 1:
                target_lvl = min(target_lvl, highest_level_seen + 1 if highest_level_seen > 0 else 1)

            elem.heading_level = target_lvl
            highest_level_seen = max(highest_level_seen, target_lvl)

    # ── PASADA 4: Clustering Global (Huella de Estilo) ─────────────────────────
    # Agrupa los elementos según su huella visual y les asigna nivel,
    # sobreescribiendo inferencias débiles anteriores.
    classifier = ClusteringHeadingClassifier()
    elements = classifier.classify(elements)

    return elements

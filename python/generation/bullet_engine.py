"""
WordAPA7 — Motor de Listas y Viñetas APA 7

Formatea listas con vinetas o numeradas con sangria APA 7 por nivel:

Indentacion APA (por nivel):
- Nivel 1: cuerpo 1.27cm, marker 0.63cm
- Nivel 2: cuerpo 1.90cm, marker 1.27cm
- Nivel 3: cuerpo 2.54cm, marker 1.90cm

Para documentos nuevos (generados desde cero), se usa formato basado en texto
con sangria precisa. Para documentos existentes, se reutiliza el num_id del
template APA para evitar corrupcion de numbering.xml.
"""

import re
from typing import Optional

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from models import BulletStyle, NumberStyle, APARuleSet


# ── Simbolos de vineta ─────────────────────────────────────────────────────────

BULLET_SYMBOLS: dict[BulletStyle, str] = {
    BulletStyle.DISC: "•",     # bullet
    BulletStyle.CIRCLE: "○",   # white circle
    BulletStyle.SQUARE: "▪",   # black small square
    BulletStyle.DASH: "–",     # en dash
}

# Indentacion APA por nivel de lista
# (left_indent_inches, first_line_indent_inches)
APA_LIST_INDENT: dict[int, tuple[float, float]] = {
    1: (0.5, -0.25),    # Nivel 1: cuerpo 1.27cm, marker 0.63cm
    2: (0.75, -0.25),   # Nivel 2: cuerpo 1.90cm, marker 1.27cm
    3: (1.0, -0.25),    # Nivel 3: cuerpo 2.54cm, marker 1.90cm
}


def clean_bullet_prefix(text: str) -> str:
    """
    Remueve prefijos de vineta o numero existentes en el texto del usuario
    para evitar duplicaciones como '• • Texto' o '1. 1. Texto'.
    """
    # Eliminar vinetas tipo simbolo o numeros iniciales
    cleaned = re.sub(
        r'^(?:[•○▪–\-\*]|\(?\d+[\.\)]|\(?[a-zA-Z][\.\)])\s*',
        '',
        text.strip(),
    )
    return cleaned


def _get_indent_for_level(level: int) -> tuple[float, float]:
    """Obtiene la indentacion APA para un nivel de lista (1-3)."""
    clamped: int = min(max(level, 1), 3)
    return APA_LIST_INDENT.get(clamped, (0.5, -0.25))


def apply_bullet_from_template(
    paragraph_el,
    num_id: int,
    level: int,
) -> None:
    """
    Inyecta w:numPr en el parrafo usando el num_id del template.

    NUNCA crea numbering.xml desde cero — siempre usa IDs del template APA.
    Esto evita corrupcion del documento al editar documentos existentes.

    Args:
        paragraph_el: Elemento XML del parrafo (w:p)
        num_id: ID de numeracion del template APA
        level: Nivel de bullet (0-indexed, 0 = nivel 1)
    """
    pPr = paragraph_el.find(qn('w:pPr'))
    if pPr is None:
        pPr = OxmlElement('w:pPr')
        paragraph_el.insert(0, pPr)

    # Remover numPr existente si hay
    existing_numPr = pPr.find(qn('w:numPr'))
    if existing_numPr is not None:
        pPr.remove(existing_numPr)

    numPr = OxmlElement('w:numPr')

    ilvl = OxmlElement('w:ilvl')
    ilvl.set(qn('w:val'), str(level))
    numPr.append(ilvl)

    numId_el = OxmlElement('w:numId')
    numId_el.set(qn('w:val'), str(num_id))
    numPr.append(numId_el)

    pPr.append(numPr)


def format_bullet_item(
    p,
    text: str,
    bullet_style: BulletStyle,
    rules: APARuleSet,
    level: int = 1,
    is_bold: bool = False,
    is_italic: bool = False,
) -> None:
    """
    Formatea un elemento de lista con vineta usando sangria APA 7.

    Args:
        p: Paragraph de python-docx
        text: Texto del elemento
        bullet_style: Estilo de vineta (disc, circle, square, dash)
        rules: Reglas APA activas
        level: Nivel de la lista (1-3)
        is_bold: Si el texto debe ir en negrita
        is_italic: Si el texto debe ir en cursiva
    """
    cleaned_text: str = clean_bullet_prefix(text)
    symbol: str = BULLET_SYMBOLS.get(bullet_style, BULLET_SYMBOLS[BulletStyle.DISC])
    left_indent, first_line = _get_indent_for_level(level)

    p.text = ""
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.left_indent = Inches(left_indent)
    p.paragraph_format.first_line_indent = Inches(first_line)
    p.paragraph_format.line_spacing = rules.line_spacing
    p.paragraph_format.space_before = Pt(rules.space_before_pt)
    p.paragraph_format.space_after = Pt(rules.space_after_pt)

    # Agregar vineta + tabulacion
    r_symbol = p.add_run(f"{symbol}\t")
    r_symbol.font.name = rules.font_family
    r_symbol.font.size = Pt(rules.font_size_pt)
    r_symbol.font.color.rgb = RGBColor(0, 0, 0)
    r_symbol.bold = is_bold
    r_symbol.italic = is_italic

    r_text = p.add_run(cleaned_text)
    r_text.font.name = rules.font_family
    r_text.font.size = Pt(rules.font_size_pt)
    r_text.font.color.rgb = RGBColor(0, 0, 0)
    r_text.bold = is_bold
    r_text.italic = is_italic


def format_numbered_item(
    p,
    text: str,
    index: int,
    num_style: NumberStyle,
    rules: APARuleSet,
    level: int = 1,
    is_bold: bool = False,
    is_italic: bool = False,
) -> None:
    """
    Formatea un elemento de lista numerada APA 7.

    Tipos soportados:
    - decimal: 1. 2. 3.
    - lowerLetter: a. b. c.
    - upperLetter: A. B. C.
    - lowerRoman: i. ii. iii.
    - upperRoman: I. II. III.

    Args:
        p: Paragraph de python-docx
        text: Texto del elemento
        index: Indice del elemento (1-based)
        num_style: Estilo de numeracion
        rules: Reglas APA activas
        level: Nivel de la lista (1-3)
        is_bold: Si el texto debe ir en negrita
        is_italic: Si el texto debe ir en cursiva
    """
    cleaned_text: str = clean_bullet_prefix(text)
    left_indent, first_line = _get_indent_for_level(level)

    # Generar prefijo segun el estilo
    prefix_str: str = _format_number_prefix(index, num_style)

    p.text = ""
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.left_indent = Inches(left_indent)
    p.paragraph_format.first_line_indent = Inches(first_line)
    p.paragraph_format.line_spacing = rules.line_spacing
    p.paragraph_format.space_before = Pt(rules.space_before_pt)
    p.paragraph_format.space_after = Pt(rules.space_after_pt)

    r_num = p.add_run(f"{prefix_str}\t")
    r_num.font.name = rules.font_family
    r_num.font.size = Pt(rules.font_size_pt)
    r_num.font.color.rgb = RGBColor(0, 0, 0)
    r_num.bold = is_bold
    r_num.italic = is_italic

    r_text = p.add_run(cleaned_text)
    r_text.font.name = rules.font_family
    r_text.font.size = Pt(rules.font_size_pt)
    r_text.font.color.rgb = RGBColor(0, 0, 0)
    r_text.bold = is_bold
    r_text.italic = is_italic


def _format_number_prefix(index: int, num_style: NumberStyle) -> str:
    """Formatea el prefijo numerico segun el estilo APA."""
    if num_style == NumberStyle.DECIMAL:
        return f"{index}."
    elif num_style == NumberStyle.LOWER_LETTER:
        # a=97, b=98, ..., z=122, luego aa, ab, etc.
        letter: str = ""
        n: int = index - 1
        while n >= 0:
            letter = chr(97 + (n % 26)) + letter
            n = n // 26 - 1
        return f"{letter}."
    elif num_style == NumberStyle.UPPER_LETTER:
        letter = ""
        n = index - 1
        while n >= 0:
            letter = chr(65 + (n % 26)) + letter
            n = n // 26 - 1
        return f"{letter}."
    elif num_style == NumberStyle.LOWER_ROMAN:
        return f"{_to_roman(index).lower()}."
    elif num_style == NumberStyle.UPPER_ROMAN:
        return f"{_to_roman(index)}."
    elif num_style == NumberStyle.NONE:
        return ""
    return f"{index}."


def _to_roman(n: int) -> str:
    """Convierte un numero entero a numeracion romana (mayusculas)."""
    val: list[int] = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
    syms: list[str] = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"]
    roman_num: str = ""
    for i in range(len(val)):
        count = n // val[i]
        if count:
            roman_num += syms[i] * count
            n -= val[i] * count
    return roman_num

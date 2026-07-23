"""
WordAPA7 — Motor de Estilos APA 7

Aplica reglas estrictas APA 7 a nivel de tipografia, parrafos y titulos (Nivel 1 a 5).
Normaliza la fuente en todo el documento para evitar mezclas indeseadas.
"""

from typing import Optional

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

from models import APARuleSet


def apply_page_setup(doc: docx.Document, rules: APARuleSet, preserve_landscape: bool = True) -> None:
    """
    Aplica margenes APA 7 (2.54 cm / 1 in) respetando secciones en landscape si existen.
    """
    margin_inches = rules.margins_cm / 2.54

    for section in doc.sections:
        is_landscape: bool = False
        try:
            pg_sz = section._sectPr.find(qn("w:pgSz"))
            if pg_sz is not None:
                orient = pg_sz.attrib.get(qn("w:orient"))
                if orient == "landscape":
                    is_landscape = True
        except Exception:
            pass

        if not (preserve_landscape and is_landscape):
            section.top_margin = Inches(margin_inches)
            section.bottom_margin = Inches(margin_inches)
            section.left_margin = Inches(margin_inches)
            section.right_margin = Inches(margin_inches)


def normalize_all_fonts(
    doc: docx.Document,
    target_font: str = "Times New Roman",
    target_size_pt: int = 12,
) -> None:
    """
    Normaliza TODAS las fuentes en el documento a la fuente APA.

    REGLA DURA — se aplica a:
    - Parrafos normales
    - Runs dentro de parrafos (fuentes mixtas pegadas de internet)
    - Texto dentro de celdas de tabla (ALL cells)
    - Encabezados y pies de pagina

    EXCEPCION: Preserva negrita/italica intencional (solo limpia font_name y font_size)
    NO AFECTA: Ecuaciones OMML, objetos OLE, texto en imagenes
    """
    target_font_pt = Pt(target_size_pt)

    # Normalizar parrafos del cuerpo
    for para in doc.paragraphs:
        _normalize_paragraph_runs(para, target_font, target_font_pt)

    # Normalizar celdas de tabla
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    _normalize_paragraph_runs(para, target_font, target_font_pt)

    # Normalizar encabezados y pies de pagina
    for section in doc.sections:
        # Header
        for para in section.header.paragraphs:
            _normalize_paragraph_runs(para, target_font, target_font_pt)
        # Footer
        for para in section.footer.paragraphs:
            _normalize_paragraph_runs(para, target_font, target_font_pt)

    # Normalizar estilos de la plantilla tambien
    try:
        style_names: list[str] = ["Normal", "Heading 1", "Heading 2", "Heading 3",
                                    "Heading 4", "Heading 5", "List Bullet", "List Number"]
        for name in style_names:
            try:
                style = doc.styles[name]
                style.font.name = target_font
                style.font.size = target_font_pt
            except KeyError:
                pass
    except Exception:
        pass


def _normalize_paragraph_runs(para, target_font: str, target_size) -> None:
    """Normaliza fuente y tamano en todos los runs de un parrafo."""
    for run in para.runs:
        run.font.name = target_font
        run.font.size = target_size


def _all_runs_bold(paragraph) -> bool:
    """Verifica si todos los runs con texto tienen bold=True."""
    text_runs = [r for r in paragraph.runs if r.text.strip()]
    if not text_runs:
        return False
    return all(r.bold for r in text_runs)


def apply_style_clean(
    paragraph,
    style_name: str,
    preserve_inline_emphasis: bool = True,
) -> None:
    """
    Aplica estilo APA limpiando formato directo conflictivo.

    Preserva negrita parcial (enfasis intencional en una palabra).
    Limpia negrita total (era un heading manual mal formateado).
    """
    all_bold = _all_runs_bold(paragraph)
    paragraph.style = style_name

    for run in paragraph.runs:
        run.font.name = None   # Hereda del estilo
        run.font.size = None   # Hereda del estilo
        if all_bold and not preserve_inline_emphasis:
            run.bold = None
        # NO limpiar negrita parcial -> es enfasis intencional


def format_heading_paragraph(p, level: int, text: str, rules: APARuleSet) -> None:
    """
    Formatea un titulo estrictamente segun los 5 niveles APA 7:
    - Nivel 1: Centrado, Negrita, Caso Titulo
    - Nivel 2: Izquierda, Negrita, Caso Titulo
    - Nivel 3: Izquierda, Negrita y Cursiva, Caso Titulo
    - Nivel 4: Sangria 1.27cm, Negrita, Termina en punto. Texto en la misma linea
    - Nivel 5: Sangria 1.27cm, Negrita y Cursiva, Termina en punto. Texto en la misma linea
    """
    p.text = ""  # Limpiar runs
    p.paragraph_format.line_spacing = rules.line_spacing
    p.paragraph_format.space_before = Pt(rules.space_before_pt)
    p.paragraph_format.space_after = Pt(rules.space_after_pt)

    font_name: str = rules.font_family
    font_size = Pt(rules.font_size_pt)

    if level == 1:
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.first_line_indent = Inches(0)
        run = p.add_run(text)
        run.bold = True
        run.font.name = font_name
        run.font.size = font_size
        run.font.color.rgb = RGBColor(0, 0, 0)

    elif level == 2:
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.first_line_indent = Inches(0)
        run = p.add_run(text)
        run.bold = True
        run.font.name = font_name
        run.font.size = font_size
        run.font.color.rgb = RGBColor(0, 0, 0)

    elif level == 3:
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.first_line_indent = Inches(0)
        run = p.add_run(text)
        run.bold = True
        run.italic = True
        run.font.name = font_name
        run.font.size = font_size
        run.font.color.rgb = RGBColor(0, 0, 0)

    elif level == 4:
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.first_line_indent = Inches(rules.paragraph_indent_cm / 2.54)
        formatted_text: str = text if text.endswith(".") else text + "."
        run = p.add_run(formatted_text + " ")
        run.bold = True
        run.font.name = font_name
        run.font.size = font_size
        run.font.color.rgb = RGBColor(0, 0, 0)

    elif level == 5:
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.first_line_indent = Inches(rules.paragraph_indent_cm / 2.54)
        formatted_text = text if text.endswith(".") else text + "."
        run = p.add_run(formatted_text + " ")
        run.bold = True
        run.italic = True
        run.font.name = font_name
        run.font.size = font_size
        run.font.color.rgb = RGBColor(0, 0, 0)


def format_normal_paragraph(p, text: str, rules: APARuleSet) -> None:
    """
    Formatea un parrafo normal APA 7:
    - Fuente uniforme (ej. Times New Roman 12pt)
    - Alineado a la izquierda sin justificar
    - Interlineado 2.0 (doble)
    - Sangria en primera linea de 1.27 cm (0.5 in)
    - Sin espacio entre parrafos (0 pt antes y despues)
    """
    p.text = ""
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.line_spacing = rules.line_spacing
    p.paragraph_format.first_line_indent = Inches(rules.paragraph_indent_cm / 2.54)
    p.paragraph_format.space_before = Pt(rules.space_before_pt)
    p.paragraph_format.space_after = Pt(rules.space_after_pt)

    run = p.add_run(text)
    run.font.name = rules.font_family
    run.font.size = Pt(rules.font_size_pt)
    run.font.color.rgb = RGBColor(0, 0, 0)


def format_block_quote(p, text: str, rules: APARuleSet) -> None:
    """
    Formatea una cita en bloque (mas de 40 palabras):
    - Todo el bloque sangrado 1.27 cm desde la izquierda
    - Interlineado 2.0
    - Sin comillas alrededor
    """
    p.text = ""
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.left_indent = Inches(rules.paragraph_indent_cm / 2.54)
    p.paragraph_format.first_line_indent = Inches(0)
    p.paragraph_format.line_spacing = rules.line_spacing
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)

    run = p.add_run(text)
    run.font.name = rules.font_family
    run.font.size = Pt(rules.font_size_pt)
    run.font.color.rgb = RGBColor(0, 0, 0)

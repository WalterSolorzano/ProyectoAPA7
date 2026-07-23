"""
WordAPA7 — Motor de Tablas APA 7

Aplica el formato estricto de tablas APA 7:
1. Bordes horizontales unicamente en la parte superior, inferior y debajo del encabezado.
2. Cero bordes verticales (left, right, insideV eliminados).
3. Numero de tabla ("Tabla 1") en negrita arriba.
4. Titulo de la tabla en cursiva en la siguiente linea.
5. Nota de tabla al pie si existe.
"""

from typing import Optional

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

from models import TableModel, APARuleSet


def set_table_apa7_borders(table) -> None:
    """
    Modifica el XML de la tabla para establecer bordes APA 7:
    - Borde superior: simple (0.75 pt) en toda la tabla
    - Borde inferior bajo el encabezado: simple (0.75 pt) SOLO en celdas de primera fila
    - Borde inferior de tabla: simple (0.75 pt)
    - Sin bordes verticales (left, right, insideV = none)
    - Sin bordes horizontales internos (insideH = none, excepto bajo header)
    """
    tbl = table._tbl
    tblPr = tbl.tblPr
    if tblPr is None:
        tblPr = OxmlElement("w:tblPr")
        tbl.insert(0, tblPr)

    # Reemplazar tblBorders existente
    existing = tblPr.find(qn("w:tblBorders"))
    if existing is not None:
        tblPr.remove(existing)

    borders_xml = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'  <w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
        f'  <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
        f'  <w:left w:val="none"/>'
        f'  <w:right w:val="none"/>'
        f'  <w:insideH w:val="none"/>'
        f'  <w:insideV w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders_xml)

    # Evitar division de filas entre paginas (w:cantSplit)
    for row in table.rows:
        trPr = row._tr.get_or_add_trPr()
        trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))

    # Marcar primera fila como encabezado repetible (w:tblHeader)
    if len(table.rows) > 0:
        hdr_trPr = table.rows[0]._tr.get_or_add_trPr()
        hdr_trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

    # Borde inferior SOLO en la primera fila (encabezado)
    if len(table.rows) > 0:
        for cell in table.rows[0].cells:
            tcPr = cell._tc.get_or_add_tcPr()

            # Eliminar bordes existentes de la celda
            existing_cell_borders = tcPr.find(qn("w:tcBorders"))
            if existing_cell_borders is not None:
                tcPr.remove(existing_cell_borders)

            # Agregar solo borde inferior al encabezado
            cell_borders = parse_xml(
                f'<w:tcBorders {nsdecls("w")}>'
                f'  <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
                f'  <w:top w:val="none"/>'
                f'  <w:left w:val="none"/>'
                f'  <w:right w:val="none"/>'
                f'</w:tcBorders>'
            )
            tcPr.append(cell_borders)

    # Limpiar bordes de celdas en filas de datos
    for row in table.rows[1:]:
        for cell in row.cells:
            tcPr = cell._tc.get_or_add_tcPr()
            existing_cell_borders = tcPr.find(qn("w:tcBorders"))
            if existing_cell_borders is not None:
                tcPr.remove(existing_cell_borders)
            # Agregar sin bordes
            cell_borders = parse_xml(
                f'<w:tcBorders {nsdecls("w")}>'
                f'  <w:top w:val="none"/>'
                f'  <w:bottom w:val="none"/>'
                f'  <w:left w:val="none"/>'
                f'  <w:right w:val="none"/>'
                f'</w:tcBorders>'
            )
            tcPr.append(cell_borders)


def _normalize_cell_text(cell, font_name: str, font_size_pt: int) -> None:
    """Normaliza fuente en todos los runs de una celda."""
    for para in cell.paragraphs:
        for run in para.runs:
            run.font.name = font_name
            run.font.size = Pt(font_size_pt)


def format_apa_table(
    doc: docx.Document,
    table_data: TableModel,
    rules: APARuleSet,
) -> None:
    """
    Inserta y formatea una tabla completa siguiendo las normas APA 7.
    """
    font_name: str = rules.font_family
    font_size: Pt = Pt(rules.font_size_pt)

    # 1. Numero de Tabla ("Tabla 1") en negrita
    p_num = doc.add_paragraph()
    p_num.paragraph_format.space_before = Pt(6)
    p_num.paragraph_format.space_after = Pt(0)
    p_num.paragraph_format.line_spacing = rules.line_spacing
    p_num.paragraph_format.first_line_indent = Inches(0)
    r_num = p_num.add_run(f"{rules.table_label_prefix} {table_data.table_number}")
    r_num.bold = True
    r_num.font.name = font_name
    r_num.font.size = font_size
    r_num.font.color.rgb = RGBColor(0, 0, 0)

    # 2. Titulo de Tabla en cursiva
    if table_data.caption:
        p_cap = doc.add_paragraph()
        p_cap.paragraph_format.space_before = Pt(0)
        p_cap.paragraph_format.space_after = Pt(6)
        p_cap.paragraph_format.line_spacing = rules.line_spacing
        p_cap.paragraph_format.first_line_indent = Inches(0)
        r_cap = p_cap.add_run(table_data.caption)
        r_cap.italic = True
        r_cap.font.name = font_name
        r_cap.font.size = font_size
        r_cap.font.color.rgb = RGBColor(0, 0, 0)

    # 3. Crear Estructura de Tabla
    num_rows: int = len(table_data.rows) + (1 if table_data.headers else 0)
    num_cols: int = (
        len(table_data.headers)
        if table_data.headers
        else (len(table_data.rows[0]) if table_data.rows else 1)
    )

    table = doc.add_table(rows=num_rows, cols=num_cols)
    set_table_apa7_borders(table)

    current_row_idx: int = 0

    # Llenar Encabezados (primera fila en negrita)
    if table_data.headers:
        hdr_cells = table.rows[0].cells
        for col_idx, cell_text in enumerate(table_data.headers):
            if col_idx < len(hdr_cells):
                hdr_cells[col_idx].text = ""
                p = hdr_cells[col_idx].paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                r = p.add_run(cell_text)
                r.bold = True
                r.font.name = font_name
                r.font.size = font_size
                r.font.color.rgb = RGBColor(0, 0, 0)
        current_row_idx = 1

    # Llenar Filas de Datos
    for row_data in table_data.rows:
        if current_row_idx >= len(table.rows):
            break
        row_cells = table.rows[current_row_idx].cells
        for col_idx, val in enumerate(row_data):
            if col_idx < len(row_cells):
                row_cells[col_idx].text = ""
                p = row_cells[col_idx].paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                r = p.add_run(str(val))
                r.font.name = font_name
                r.font.size = font_size
                r.font.color.rgb = RGBColor(0, 0, 0)
        current_row_idx += 1

    # 4. Nota al pie de tabla si existe
    if table_data.note:
        p_note = doc.add_paragraph()
        p_note.paragraph_format.space_before = Pt(4)
        p_note.paragraph_format.space_after = Pt(12)
        p_note.paragraph_format.first_line_indent = Inches(0)
        p_note.paragraph_format.line_spacing = rules.line_spacing

        r_label = p_note.add_run("Nota. ")
        r_label.italic = True
        r_label.font.name = font_name
        r_label.font.size = Pt(10)
        r_label.font.color.rgb = RGBColor(0, 0, 0)

        r_text = p_note.add_run(table_data.note)
        r_text.font.name = font_name
        r_text.font.size = Pt(10)
        r_text.font.color.rgb = RGBColor(0, 0, 0)

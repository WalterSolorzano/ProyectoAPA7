"""
WordAPA7 — Módulo de Recreación de Portada UNI (Nicaragua)

Genera una portada idéntica a la estructura institucional de la
Universidad Nacional de Ingeniería con:
- Logo UNI real (extraído de los .docx originales)
- Departamento/Área de Conocimiento
- Título del trabajo y asignatura
- Autores en columnas con carnets (igual que la portada real)
- Profesor/Tutor con su nombre
- Fecha y lugar

La portada generada reemplaza completamente la portada original si:
  cover_mode == 'generate_apa7_template' (pero con estructura UNI)
o se usa cuando el documento no tiene portada detectable.
"""

from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import math
import os


# Ruta al logo UNI (relativa al módulo)
LOGO_PATH = Path(__file__).parent.parent / "assets" / "logo_uni.png"

# Colores institucionales UNI Nicaragua
UNI_BLUE = RGBColor(0x00, 0x33, 0x7F)   # Azul UNI oscuro
UNI_TEXT = RGBColor(0x0F, 0x17, 0x2A)   # Negro académico


def _set_cell_no_border(cell):
    """Elimina bordes de una celda de tabla."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for side in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
        border = OxmlElement(f'w:{side}')
        border.set(qn('w:val'), 'nil')
        tcBorders.append(border)
    tcPr.append(tcBorders)


def _add_run_styled(paragraph, text: str, bold=False, size_pt=12,
                    color: RGBColor = UNI_TEXT, font="Times New Roman"):
    """Agrega un run con estilo específico a un párrafo."""
    run = paragraph.add_run(text)
    run.bold = bold
    run.font.name = font
    run.font.size = Pt(size_pt)
    run.font.color.rgb = color
    return run


def _set_paragraph_spacing(p, before=0, after=0, line_spacing=1.0):
    """Configura el espaciado de un párrafo."""
    pf = p.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing = line_spacing


def generate_uni_cover(
    doc: Document,
    titulo: str,
    asignatura: str,
    autores: list[dict],   # [{nombre, carnet}, ...]
    tutor: str,
    grupo: str,
    departamento: str = "Área de Conocimiento de Ingeniería y Afines",
    fecha: str = "",
    lugar: str = "Managua, Nicaragua",
) -> int:
    """
    Inserta al inicio del documento una portada institucional UNI.
    
    Args:
        doc: Documento python-docx a modificar (se inserta al inicio)
        titulo: Título del trabajo
        asignatura: Nombre de la asignatura/evaluación
        autores: Lista de dicts con 'nombre' y 'carnet'
        tutor: Nombre del docente/tutor
        grupo: Grupo (ej: "3T1 IND")
        departamento: Área de conocimiento
        fecha: Fecha de entrega
        lugar: Ciudad y país
    
    Returns:
        Número de párrafos insertados (para calcular cover_paragraph_count)
    """
    if not fecha:
        from datetime import date
        d = date.today()
        months = ["enero","febrero","marzo","abril","mayo","junio",
                  "julio","agosto","septiembre","octubre","noviembre","diciembre"]
        fecha = f"{d.day} de {months[d.month-1]} del año {d.year}"

    paragraphs_inserted = 0

    # ── FILA 1: Logo UNI ──────────────────────────────────────────────────────
    # Tabla invisible 1x2: [Logo | Espacio]
    logo_table = doc.add_table(rows=1, cols=2)
    logo_table.style = "Table Grid"
    _set_cell_no_border(logo_table.cell(0, 0))
    _set_cell_no_border(logo_table.cell(0, 1))
    
    logo_cell = logo_table.cell(0, 0)
    logo_para = logo_cell.paragraphs[0]
    logo_para.alignment = WD_ALIGN_PARAGRAPH.LEFT

    if LOGO_PATH.exists():
        run_logo = logo_para.add_run()
        run_logo.add_picture(str(LOGO_PATH), width=Inches(2.2))
    else:
        _add_run_styled(logo_para, "Universidad Nacional de Ingeniería",
                        bold=True, size_pt=12, color=UNI_BLUE)

    paragraphs_inserted += 1

    # ── LÍNEA SEPARADORA ─────────────────────────────────────────────────────
    sep = doc.add_paragraph()
    sep.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _add_run_styled(sep, "─" * 65, size_pt=10, color=UNI_BLUE)
    _set_paragraph_spacing(sep, before=4, after=4)
    paragraphs_inserted += 1

    # ── DEPARTAMENTO ─────────────────────────────────────────────────────────
    dept_p = doc.add_paragraph()
    dept_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _add_run_styled(dept_p, departamento.upper(), bold=True, size_pt=11, color=UNI_BLUE)
    _set_paragraph_spacing(dept_p, before=2, after=2)
    paragraphs_inserted += 1

    # ── ESPACIO ───────────────────────────────────────────────────────────────
    for _ in range(2):
        sp = doc.add_paragraph()
        _set_paragraph_spacing(sp, before=0, after=0)
        paragraphs_inserted += 1

    # ── ASIGNATURA / EVALUACIÓN ──────────────────────────────────────────────
    asig_p = doc.add_paragraph()
    asig_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _add_run_styled(asig_p, asignatura, bold=True, size_pt=14, color=UNI_TEXT)
    _set_paragraph_spacing(asig_p, before=4, after=4)
    paragraphs_inserted += 1

    # ── TÍTULO DEL TRABAJO ────────────────────────────────────────────────────
    titulo_p = doc.add_paragraph()
    titulo_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _add_run_styled(titulo_p, titulo, bold=True, size_pt=14, color=UNI_TEXT)
    _set_paragraph_spacing(titulo_p, before=2, after=8)
    paragraphs_inserted += 1

    # ── ESPACIO ───────────────────────────────────────────────────────────────
    for _ in range(2):
        sp = doc.add_paragraph()
        _set_paragraph_spacing(sp, before=0, after=0)
        paragraphs_inserted += 1

    # ── ETIQUETA "ELABORADO POR" ──────────────────────────────────────────────
    elab_p = doc.add_paragraph()
    elab_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    _add_run_styled(elab_p, "Elaborado por:", bold=True, size_pt=12, color=UNI_TEXT)
    _set_paragraph_spacing(elab_p, before=0, after=4)
    paragraphs_inserted += 1

    # ── AUTORES EN COLUMNAS (tabla sin bordes) ────────────────────────────────
    # Distribuir autores en columnas de max 2 por columna
    # El tutor va en la última columna
    estudiantes = [a for a in autores if not a.get("es_tutor", False)]
    
    # Agrupar en columnas de 2 estudiantes
    cols_data = []
    for i in range(0, len(estudiantes), 2):
        cols_data.append(estudiantes[i:i+2])
    
    # Añadir columna del tutor al final
    if tutor:
        cols_data.append([{"nombre": tutor, "carnet": f"Grupo: {grupo}" if grupo else "", "es_tutor": True}])
    
    n_cols = max(len(cols_data), 1)
    
    if cols_data:
        authors_table = doc.add_table(rows=2, cols=n_cols)
        authors_table.style = "Table Grid"
        
        for col_i, col_autores in enumerate(cols_data):
            for row_i, autor in enumerate(col_autores):
                cell = authors_table.cell(row_i, col_i)
                _set_cell_no_border(cell)
                p = cell.paragraphs[0]
                _add_run_styled(p, autor.get("nombre", ""), bold=False, size_pt=11)
                p.add_run("\n")
                carnet_text = autor.get("carnet", "")
                if carnet_text:
                    _add_run_styled(p, carnet_text, bold=False, size_pt=10,
                                    color=RGBColor(0x47, 0x55, 0x69))
            
            # Rellenar celdas vacías
            for empty_row in range(len(col_autores), 2):
                cell = authors_table.cell(empty_row, col_i)
                _set_cell_no_border(cell)
        
        paragraphs_inserted += 3  # tabla + espacios contextuales

    # ── ESPACIO ───────────────────────────────────────────────────────────────
    for _ in range(2):
        sp = doc.add_paragraph()
        _set_paragraph_spacing(sp, before=0, after=0)
        paragraphs_inserted += 1

    # ── PIE DE PORTADA: FECHA Y LUGAR ─────────────────────────────────────────
    fecha_p = doc.add_paragraph()
    fecha_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _add_run_styled(fecha_p, f"{fecha}", bold=False, size_pt=12, color=UNI_TEXT)
    _set_paragraph_spacing(fecha_p, before=0, after=0)
    paragraphs_inserted += 1

    lugar_p = doc.add_paragraph()
    lugar_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _add_run_styled(lugar_p, lugar, bold=False, size_pt=12, color=UNI_TEXT)
    _set_paragraph_spacing(lugar_p, before=0, after=0)
    paragraphs_inserted += 1

    # ── SALTO DE PÁGINA AL FINAL DE PORTADA ───────────────────────────────────
    page_break_p = doc.add_paragraph()
    page_break_p.add_run().add_break(__import__('docx.enum.text', fromlist=['WD_BREAK']).WD_BREAK.PAGE)
    paragraphs_inserted += 1

    return paragraphs_inserted

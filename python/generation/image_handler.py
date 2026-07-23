"""
WordAPA7 — Manejador de Imágenes y Figuras APA 7

Inserta y formatea figuras de acuerdo con el estándar APA 7:
1. "Figura X" en negrita arriba.
2. Título de la figura en cursiva debajo del número.
3. Imagen centrada.
4. Nota de la figura opcional abajo.
"""

import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from models import ImageModel, APARuleSet


def format_apa_figure(doc: docx.Document, img_data: ImageModel, rules: APARuleSet):
    """
    Inserta la imagen en el documento con la estructura y encabezados APA 7.
    """
    # 1. Número de Figura ("Figura 1")
    p_num = doc.add_paragraph()
    p_num.paragraph_format.space_before = Pt(12)
    p_num.paragraph_format.space_after = Pt(0)
    p_num.paragraph_format.line_spacing = rules.line_spacing
    p_num.paragraph_format.first_line_indent = Inches(0)
    
    r_num = p_num.add_run(f"Figura {img_data.figure_number}")
    r_num.bold = True
    r_num.font.name = rules.font_family
    r_num.font.size = Pt(rules.font_size_pt)

    p_num.paragraph_format.keep_with_next = True

    # 2. Título de la Figura en Cursiva
    if img_data.caption:
        p_cap = doc.add_paragraph()
        p_cap.paragraph_format.space_before = Pt(0)
        p_cap.paragraph_format.space_after = Pt(6)
        p_cap.paragraph_format.line_spacing = rules.line_spacing
        p_cap.paragraph_format.first_line_indent = Inches(0)
        p_cap.paragraph_format.keep_with_next = True
        
        r_cap = p_cap.add_run(img_data.caption)
        r_cap.italic = True
        r_cap.font.name = rules.font_family
        r_cap.font.size = Pt(rules.font_size_pt)

    # 3. Imagen Centrada
    p_img = doc.add_paragraph()
    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img.paragraph_format.space_before = Pt(6)
    p_img.paragraph_format.space_after = Pt(6)
    p_img.paragraph_format.first_line_indent = Inches(0)

    if img_data.file_path and os.path.exists(img_data.file_path):
        width = Inches(img_data.width_cm / 2.54) if img_data.width_cm > 0 else Inches(5.0)
        p_img.add_run().add_picture(img_data.file_path, width=width)
    else:
        # Placeholder si no está la imagen en disco
        r_ph = p_img.add_run(f"[Imagen: {img_data.filename}]")
        r_ph.italic = True

    # 4. Nota al pie de figura si existe
    if img_data.note:
        p_note = doc.add_paragraph()
        p_note.paragraph_format.space_before = Pt(4)
        p_note.paragraph_format.space_after = Pt(12)
        p_note.paragraph_format.first_line_indent = Inches(0)
        
        r_label = p_note.add_run("Nota. ")
        r_label.italic = True
        r_label.font.name = rules.font_family
        r_label.font.size = Pt(10)

        r_text = p_note.add_run(img_data.note)
        r_text.font.name = rules.font_family
        r_text.font.size = Pt(10)

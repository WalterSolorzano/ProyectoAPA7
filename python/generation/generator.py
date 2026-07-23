"""
WordAPA7 — Generador Final de Documentos DOCX (Con Preservación de Portada Original)

Ensambla todo el documento formateado segun APA 7:
1. Portada (Original intacta preservada O Formulario Estudiante/Profesional)
2. Cuerpo del Documento (Titulos Nivel 1-5, Parrafos, Listas, Tablas, Imagenes)
3. Seccion de Referencias con Sangria Francesa
"""

from pathlib import Path
from typing import List, Optional

import docx
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

from models import (
    DocumentModel,
    ElementModel,
    ElementType,
    APARuleSet,
    PortadaData,
    ReferenciaModel,
)
from generation.style_engine import (
    apply_page_setup,
    format_heading_paragraph,
    format_normal_paragraph,
    format_block_quote,
    normalize_all_fonts,
)
from generation.table_engine import format_apa_table
from generation.bullet_engine import format_bullet_item, format_numbered_item
from generation.image_handler import format_apa_figure
from generation.document_structure import setup_apa_header
from modules.portada_module import format_apa_portada
from modules.referencias_module import format_apa_referencias_section


def generate_apa7_docx(
    doc_model: DocumentModel,
    output_filepath: Path | str,
    rules: APARuleSet | None = None,
    portada: PortadaData | None = None,
    references: List[ReferenciaModel] | None = None,
) -> Path:
    """
    Genera el archivo .docx final aplicando todas las reglas APA 7.
    Preserva la portada original intacta si use_original_cover es True.
    """
    if rules is None:
        rules = APARuleSet()

    out_path = Path(output_filepath)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    doc = docx.Document()

    # 1. Configuracion de pagina y margenes
    apply_page_setup(doc, rules, preserve_landscape=doc_model.has_landscape_sections)

    # 2. Encabezado y numero de pagina
    running_head: str = portada.running_head if portada else ""
    setup_apa_header(doc, doc_model.apa_format, running_head, rules)

    # 3. Portada
    use_orig_cover = getattr(portada, 'use_original_cover', True) if portada else True
    if not use_orig_cover and portada and (portada.title or portada.author):
        format_apa_portada(doc, portada, rules)

    # 4. Cuerpo del documento
    numbered_counters: dict[int, int] = {1: 0, 2: 0, 3: 0}
    last_numbered_level: int = 0

    for item in doc_model.elements:
        if isinstance(item, dict):
            elem = ElementModel.model_validate(item)
        else:
            elem = item

        elem_type = elem.type
        elem_level: int = elem.heading_level if elem.heading_level else 1

        if elem_type == ElementType.EMPTY:
            continue

        elif elem_type == ElementType.PORTADA_BLOCK:
            # EXCLUIDO DE FORMATO APA 7: Preservar elemento original de portada intacto
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if elem.alignment == 'center' else WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.first_line_indent = Inches(0)
            if elem.text:
                r = p.add_run(elem.text)
                r.bold = elem.is_bold
                r.italic = elem.is_italic

        elif elem_type == ElementType.HEADING:
            numbered_counters = {1: 0, 2: 0, 3: 0}
            last_numbered_level = 0
            p = doc.add_paragraph()
            lvl: int = elem.heading_level if elem.heading_level else 1
            format_heading_paragraph(p, lvl, elem.text or "", rules)

        elif elem_type == ElementType.PARAGRAPH:
            p = doc.add_paragraph()
            format_normal_paragraph(p, elem.text or "", rules)

        elif elem_type == ElementType.BLOCK_QUOTE:
            numbered_counters = {1: 0, 2: 0, 3: 0}
            last_numbered_level = 0
            p = doc.add_paragraph()
            format_block_quote(p, elem.text or "", rules)

        elif elem_type == ElementType.BULLET:
            numbered_counters = {1: 0, 2: 0, 3: 0}
            last_numbered_level = 0
            p = doc.add_paragraph()
            bullet_lvl = elem_level if elem_level in (1, 2, 3) else 1
            format_bullet_item(p, elem.text or "", bullet_lvl, rules)

        elif elem_type == ElementType.NUMBERED_LIST:
            p = doc.add_paragraph()
            num_lvl = elem_level if elem_level in (1, 2, 3) else 1

            if num_lvl <= last_numbered_level:
                for l in range(num_lvl + 1, 4):
                    numbered_counters[l] = 0

            numbered_counters[num_lvl] = numbered_counters.get(num_lvl, 0) + 1
            last_numbered_level = num_lvl
            item_index = numbered_counters[num_lvl]

            format_numbered_item(p, elem.text or "", num_lvl, item_index, rules)

        elif elem_type == ElementType.IMAGE:
            if elem.image_info:
                format_apa_figure(doc, elem.image_info, rules)

        elif elem_type == ElementType.TABLE:
            if elem.table_info:
                format_apa_table(doc, elem.table_info, rules)

        elif elem_type == ElementType.PAGE_BREAK:
            doc.add_page_break()

    # 5. Seccion de Referencias Bibliograficas
    if references:
        format_apa_referencias_section(doc, references, rules)

    # 6. Normalizar fuentes y guardar
    normalize_all_fonts(doc, rules.font_family)
    doc.save(str(out_path))

    return out_path

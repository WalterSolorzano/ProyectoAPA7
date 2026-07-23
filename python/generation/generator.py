"""
WordAPA7 — Generador Final de Documentos DOCX (Con Modificación Directa sobre Original)

Abre el archivo original.docx de la sesión y le aplica los estilos APA 7
sin destruir imágenes, tablas, shapes, logos, cuadros de texto o fórmulas.
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
)
from generation.table_engine import set_table_apa7_borders, format_apa_table
from generation.image_handler import format_apa_figure
from generation.bullet_engine import format_bullet_item, format_numbered_item
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
    Modifica el archivo original.docx de la sesión conservando shapes, logos y layout intactos.
    """
    if rules is None:
        rules = APARuleSet()

    out_path = Path(output_filepath)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # 1. Intentar cargar el archivo original.docx de la sesión
    session_id = doc_model.session_id
    base_dir = out_path.parent.parent.parent  # storage/sessions/
    original_file = out_path.parent / "original.docx"

    if not original_file.exists() and session_id:
        alt_orig = Path("storage") / "sessions" / session_id / "original.docx"
        if alt_orig.exists():
            original_file = alt_orig

    if original_file.exists():
        doc = docx.Document(original_file)
    else:
        # Fallback si no existe original (ej: pruebas unitarias sintéticas)
        doc = docx.Document()

    # 2. Configuración de página y márgenes
    apply_page_setup(doc, rules, preserve_landscape=doc_model.has_landscape_sections)

    # 3. Encabezado y número de página
    running_head: str = portada.running_head if portada else ""
    setup_apa_header(doc, doc_model.apa_format, running_head, rules)

    # 4. Portada sintética (si no existe archivo original o el usuario la solicito explícitamente)
    use_orig_cover = getattr(portada, 'use_original_cover', True) if portada else True
    if (not original_file.exists() or not use_orig_cover) and portada and (portada.title or portada.author):
        format_apa_portada(doc, portada, rules)

    # 5. Formatear tablas existentes con bordes APA 7
    for table in doc.tables:
        set_table_apa7_borders(table)

    # 6. Mapear y aplicar estilos sobre los párrafos existentes del documento
    elem_map: dict[str, ElementModel] = {}
    for item in doc_model.elements:
        elem = ElementModel.model_validate(item) if isinstance(item, dict) else item
        if elem.id:
            elem_map[elem.id] = elem

    numbered_counters: dict[int, int] = {1: 0, 2: 0, 3: 0}
    last_numbered_level: int = 0
    p_idx = 0

    # Iterar párrafos existentes o crear nuevos si no existen suficientes
    existing_paragraphs = list(doc.paragraphs)

    for item in doc_model.elements:
        elem = ElementModel.model_validate(item) if isinstance(item, dict) else item
        elem_type = elem.type
        elem_level: int = elem.heading_level if elem.heading_level else 1
        list_lvl: int = elem.list_level if elem.list_level else 1

        if elem_type == ElementType.EMPTY:
            continue

        # No formatear párrafos pertenecientes a la sección de portada
        if elem.is_cover_section or elem_type == ElementType.PORTADA_BLOCK:
            continue

        # Obtener o crear párrafo objetivo
        if p_idx < len(existing_paragraphs):
            p = existing_paragraphs[p_idx]
            p_idx += 1
        else:
            p = doc.add_paragraph()

        if elem_type == ElementType.HEADING:
            numbered_counters = {1: 0, 2: 0, 3: 0}
            last_numbered_level = 0
            lvl: int = elem.heading_level if elem.heading_level else 1
            format_heading_paragraph(p, lvl, elem.text or p.text, rules)

        elif elem_type == ElementType.PARAGRAPH:
            format_normal_paragraph(p, elem.text or p.text, rules)

        elif elem_type == ElementType.BLOCK_QUOTE:
            numbered_counters = {1: 0, 2: 0, 3: 0}
            last_numbered_level = 0
            format_block_quote(p, elem.text or p.text, rules)

        elif elem_type == ElementType.BULLET:
            numbered_counters = {1: 0, 2: 0, 3: 0}
            last_numbered_level = 0
            format_bullet_item(p, elem.text or p.text, list_lvl, rules)

        elif elem_type == ElementType.NUMBERED_LIST:
            num_lvl = list_lvl if list_lvl in (1, 2, 3) else 1
            if num_lvl <= last_numbered_level:
                for l in range(num_lvl + 1, 4):
                    numbered_counters[l] = 0

            numbered_counters[num_lvl] = numbered_counters.get(num_lvl, 0) + 1
            last_numbered_level = num_lvl
            item_index = numbered_counters[num_lvl]
            format_numbered_item(p, elem.text or p.text, num_lvl, item_index, rules)

        elif elem_type == ElementType.IMAGE:
            if elem.image_info:
                format_apa_figure(doc, elem.image_info, rules)

        elif elem_type == ElementType.TABLE:
            if elem.table_info:
                format_apa_table(doc, elem.table_info, rules)

        elif elem_type == ElementType.PAGE_BREAK:
            doc.add_page_break()

    # 7. Sección de Referencias Bibliográficas
    if references:
        format_apa_referencias_section(doc, references, rules)

    # 8. Guardar resultado final
    doc.save(out_path)

    # 9. Activar updateFields en settings.xml para que Word recalcule TOC/PAGEREF automáticamente
    try:
        from parsing.field_guard import enable_word_update_fields
        enable_word_update_fields(out_path)
    except Exception as e:
        print(f"[WARN] Error activando updateFields: {e}")

    # 10. Gate de Sanidad: verificar que no haya pérdida silenciosa de texto
    if original_file.exists():
        try:
            from parsing.sanity_check import verify_document_content_integrity
            verify_document_content_integrity(original_file, out_path, tolerance=0.05)
        except Exception as e:
            print(f"[WARN] Alerta de Sanidad en exportación: {e}")

    return out_path

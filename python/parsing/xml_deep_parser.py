"""
WordAPA7 — Parser de XML profundo para DOCX

Maneja:
1. `sanitize_numbering_xml`: Sanitización del zip docx para evitar fallos de python-docx
   cuando w:numId apunta a definiciones inexistentes.
2. `extract_textboxes_xml`: Extracción de cajas de texto (w:txbxContent).
3. `preserve_landscape_sections`: Detección de secciones en modo horizontal para preservar sus márgenes.
"""

import io
import zipfile
from xml.etree import ElementTree as ET
from typing import List, Dict, Any, Tuple

NAMESPACES = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
    'v': 'urn:schemas-microsoft-com:vml',
    'wps': 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape',
    'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
}


def sanitize_numbering_xml(docx_bytes: bytes) -> bytes:
    """
    Lee el paquete zip del DOCX y valida/corrige el archivo word/numbering.xml
    si contiene w:numId sin su w:abstractNumId correspondiente.
    Devuelve los bytes del DOCX sanitizado.
    """
    try:
        in_stream = io.BytesIO(docx_bytes)
        out_stream = io.BytesIO()

        with zipfile.ZipFile(in_stream, 'r') as in_zip:
            if 'word/numbering.xml' not in in_zip.namelist():
                return docx_bytes  # No hay numbering.xml, nada que arreglar

            numbering_xml = in_zip.read('word/numbering.xml')
            root = ET.fromstring(numbering_xml)

            # Obtener abstractNumIds declarados
            abstract_ids = set()
            for elem in root.findall('.//w:abstractNum', NAMESPACES):
                ab_id = elem.attrib.get(f'{{{NAMESPACES["w"]}}}abstractNumId')
                if ab_id:
                    abstract_ids.add(ab_id)

            # Verificar numId que apuntan a abstractNumId inexistentes
            modified = False
            for num_elem in list(root.findall('.//w:num', NAMESPACES)):
                ab_ref = num_elem.find('.//w:abstractNumId', NAMESPACES)
                if ab_ref is not None:
                    ref_val = ab_ref.attrib.get(f'{{{NAMESPACES["w"]}}}val')
                    if ref_val and ref_val not in abstract_ids:
                        # Referencia rota detectada, remover el elemento num corrupto
                        root.remove(num_elem)
                        modified = True

            if not modified:
                return docx_bytes

            # Reconstruir zip con numbering.xml sanitizado
            new_numbering_bytes = ET.tostring(root, encoding='utf-8', xml_declaration=True)

            with zipfile.ZipFile(out_stream, 'w', zipfile.ZIP_DEFLATED) as out_zip:
                for item in in_zip.infolist():
                    if item.filename == 'word/numbering.xml':
                        out_zip.writestr(item, new_numbering_bytes)
                    else:
                        out_zip.writestr(item, in_zip.read(item.filename))

            return out_stream.getvalue()
    except Exception as err:
        # Si la sanitización falla por alguna razón XML, devolver bytes originales
        print(f"[WARN] Error sanitizando numbering.xml: {err}")
        return docx_bytes


def extract_textbox_paragraphs(doc_element) -> List[str]:
    """
    Extrae texto contenido dentro de cuadros de texto (w:txbxContent)
    y formas de Word (wps:wsp) que contienen su propio txbxContent.
    Cubre portadas basadas en shapes y formularios.
    """
    textbox_texts: List[str] = []
    try:
        root = doc_element._element

        # 1. Extraer de w:txbxContent directo (text boxes clasicos)
        for txbx in root.findall('.//w:txbxContent', NAMESPACES):
            _extract_paragraphs_from_element(txbx, textbox_texts)

        # 2. Extraer de formas Word (wps:wsp → wps:txbx → w:txbxContent)
        wps_ns = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape'
        for wsp in root.findall(f'.//{{{wps_ns}}}wsp', NAMESPACES):
            for txbx in wsp.findall('.//w:txbxContent', NAMESPACES):
                _extract_paragraphs_from_element(txbx, textbox_texts)

        # 3. Extraer de grupos de formas (wpg:wgp)
        wpg_ns = 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup'
        for wgp in root.findall(f'.//{{{wpg_ns}}}wgp', NAMESPACES):
            for txbx in wgp.findall('.//w:txbxContent', NAMESPACES):
                _extract_paragraphs_from_element(txbx, textbox_texts)

    except Exception as e:
        print(f"[WARN] Error en extract_textbox_paragraphs: {e}")
    return textbox_texts


def _extract_paragraphs_from_element(parent_element, output_list: List[str]) -> None:
    """Extrae texto de todos los w:p dentro de un elemento XML."""
    for p in parent_element.findall('.//w:p', NAMESPACES):
        texts = [t.text for t in p.findall('.//w:t', NAMESPACES) if t.text]
        p_text = "".join(texts).strip()
        if p_text:
            output_list.append(p_text)


def is_inside_textbox_or_shape(element) -> bool:
    """
    Verifica si un elemento XML esta dentro de un cuadro de texto (w:txbxContent)
    o una forma de Word (wps:wsp). Util para descartar imagenes decorativas de portada.
    """
    parent = element
    wps_ns = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape'
    wpg_ns = 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup'
    while parent is not None:
        tag = parent.tag.split('}')[-1] if '}' in parent.tag else parent.tag
        if tag in ('txbxContent', 'wsp', 'wgp'):
            return True
        # Check by full namespace
        if (parent.tag == f'{{{NAMESPACES["w"]}}}txbxContent'
                or parent.tag == f'{{{wps_ns}}}wsp'
                or parent.tag == f'{{{wpg_ns}}}wgp'):
            return True
        parent = parent.getparent() if hasattr(parent, 'getparent') else None
    return False


def get_section_orientation_info(doc_element) -> List[Dict[str, Any]]:
    """
    Obtiene metadatos de las secciones del documento, identificando orientaciones
    landscape u orientaciones horizontales para evitar sobreescribir márgenes.
    """
    sections_info = []
    for idx, section in enumerate(doc_element.sections):
        is_landscape = False
        try:
            sect_pr = section._sectPr
            pg_sz = sect_pr.find(f'{{{NAMESPACES["w"]}}}pgSz')
            if pg_sz is not None:
                orient = pg_sz.attrib.get(f'{{{NAMESPACES["w"]}}}orient')
                if orient == 'landscape':
                    is_landscape = True
        except Exception:
            pass

        sections_info.append({
            "index": idx,
            "is_landscape": is_landscape,
            "top_margin": section.top_margin.cm if section.top_margin else 2.54,
            "bottom_margin": section.bottom_margin.cm if section.bottom_margin else 2.54,
            "left_margin": section.left_margin.cm if section.left_margin else 2.54,
            "right_margin": section.right_margin.cm if section.right_margin else 2.54,
        })
    return sections_info

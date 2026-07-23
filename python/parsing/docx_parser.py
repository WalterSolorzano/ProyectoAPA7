"""
WordAPA7 — Parser Principal de Archivos DOCX

Convierte un archivo .docx subido por el usuario en una estructura `DocumentModel`
completamente procesada y clasificada con imagenes extraidas en el almacenamiento local de sesion.
"""

import io
import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import docx

from models import (
    DocumentModel,
    DocumentMeta,
    ElementModel,
    ElementType,
    ImageModel,
    TableModel,
    APAFormat,
    WorkMode,
    NumberStyle,
    BulletStyle,
)
from parsing.xml_deep_parser import (
    sanitize_numbering_xml,
    extract_textbox_paragraphs,
    get_section_orientation_info,
    is_inside_textbox_or_shape,
)
from parsing.pre_classifier import pre_classify_elements


def _infer_portada_from_textboxes(textbox_texts: list[str]) -> dict[str, str]:
    """
    Analiza el texto extraido de cuadros de texto/shapes de Word e infiere
    los campos de portada APA (title, author, institution, course, instructor, date).

    Estrategia:
    1. Buscar keywords institucionales ("universidad", "facultad", etc.) → institution
    2. Buscar keywords de curso ("seminario", "curso", etc.) → course
    3. Buscar keywords de instructor ("profesor", "dr.", etc.) → instructor
    4. Buscar patron de fecha (año, formato fecha) → date
    5. Intentar detectar nombre de autor (patrones nombre+apellido)
    6. El texto restante mas largo/substancial → title

    Retorna un dict con los campos inferidos (solo los que se detectaron).
    """
    import re

    fields: dict[str, str] = {}

    if not textbox_texts:
        return fields

    # Normalizar: eliminar textos vacios y limpiar whitespace
    cleaned = [t.strip() for t in textbox_texts if t.strip()]
    if not cleaned:
        return fields

    # Track de indices ya asignados para no reusar el mismo texto
    assigned: set[int] = set()
    remaining: list[str] = list(cleaned)  # copia para indexado

    # ── Patrones de deteccion ──────────────────────────────────────────────
    INSTITUTION_KW = [
        "universidad", "facultad", "escuela", "instituto", "colegio",
        "departamento", "universidad de", "universidad del",
        "universidad autonoma", "universidad nacional",
        "politecnico", "politécnico",
    ]
    COURSE_KW = [
        "curso", "asignatura", "materia", "seminario", "taller",
        "catedra", "cátedra", "modulo", "módulo",
    ]
    INSTRUCTOR_KW = [
        "profesor", "profesora", "prof.", "prof ",
        "docente", "tutor", "tutora",
        "dr.", "dra.", "doctor", "doctora",
        "mgtr.", "magister", "máster", "ph.d.", "phd",
        "lic.", "ing.", "arq.", "abg.", "eco.",
        "director", "directora",
    ]
    DATE_PATTERNS = [
        re.compile(r'\b(20\d{2})\b'),                       # año solo: 2024
        re.compile(r'\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(de\s+)?(20\d{2})\b', re.IGNORECASE),
        re.compile(r'\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(de\s+)?(20\d{2})\b', re.IGNORECASE),
        re.compile(r'\b(\d{1,2})/(\d{1,2})/(20\d{2})\b'),
    ]

    # ── Paso 1: Detectar institution ───────────────────────────────────────
    for i, text in enumerate(remaining):
        if i in assigned:
            continue
        text_lower = text.lower()
        if any(kw in text_lower for kw in INSTITUTION_KW):
            fields["institution"] = text
            assigned.add(i)
            break

    # ── Paso 2: Detectar course ────────────────────────────────────────────
    for i, text in enumerate(remaining):
        if i in assigned:
            continue
        text_lower = text.lower()
        if any(kw in text_lower for kw in COURSE_KW):
            fields["course"] = text
            assigned.add(i)
            break

    # ── Paso 3: Detectar instructor ────────────────────────────────────────
    for i, text in enumerate(remaining):
        if i in assigned:
            continue
        text_lower = text.lower()
        if any(kw in text_lower for kw in INSTRUCTOR_KW):
            fields["instructor"] = text
            assigned.add(i)
            break

    # ── Paso 4: Detectar date ──────────────────────────────────────────────
    for i, text in enumerate(remaining):
        if i in assigned:
            continue
        for pat in DATE_PATTERNS:
            m = pat.search(text)
            if m:
                fields["date"] = text.strip()
                assigned.add(i)
                break
        if i in assigned:
            break

    # ── Paso 5: Detectar author ────────────────────────────────────────────
    # Patron heuristico: texto corto (1-4 palabras) que parece nombre propio
    # (capitalizacion adecuada, sin keywords institucionales ni de curso)
    name_pattern = re.compile(
        r'^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3}$'
    )
    for i, text in enumerate(remaining):
        if i in assigned:
            continue
        # El texto debe verse como nombre (2-4 palabras capitalizadas)
        words = text.split()
        if 2 <= len(words) <= 5:
            all_capitalized = all(
                w[0].isupper() or w[0] in "ÁÉÍÓÚÑ"
                for w in words if w and w[0].isalpha()
            )
            # No debe contener keywords de institution, course, o instructor
            text_lower = text.lower()
            is_not_other = not any(
                kw in text_lower
                for kw in INSTITUTION_KW + COURSE_KW + INSTRUCTOR_KW
            )
            if all_capitalized and is_not_other:
                fields["author"] = text
                assigned.add(i)
                break

    # ── Paso 6: Detectar title ─────────────────────────────────────────────
    # El texto mas largo no asignado (o el primero si hay empate)
    unassigned = [
        (i, remaining[i])
        for i in range(len(remaining))
        if i not in assigned
    ]
    if unassigned:
        # Elegir el texto mas largo (tipicamente el titulo es lo mas extenso)
        unassigned.sort(key=lambda x: len(x[1]), reverse=True)
        fields["title"] = unassigned[0][1]
        # El resto de textos no asignados los concatenamos al title
        # como subtitulo si hay mas de 1
        # No asignamos — se pierden si no se detectaron como otros campos

    return fields


def _get_numbering_type_map(docx_bytes: bytes) -> dict[str, str]:
    """
    Lee numbering.xml del zip para obtener un mapping numId -> numFmt.
    Retorna dict donde key=numId, value=numFmt (decimal, bullet, upperLetter, etc.)
    """
    import zipfile
    from xml.etree import ElementTree as ET

    W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    result: dict[str, str] = {}

    try:
        with zipfile.ZipFile(io.BytesIO(docx_bytes), 'r') as z:
            if 'word/numbering.xml' not in z.namelist():
                return result

            num_xml = z.read('word/numbering.xml')
            root = ET.fromstring(num_xml)

            # Paso 1: numId -> abstractNumId
            num_to_ab: dict[str, str] = {}
            for num_elem in root.findall(f'.//{{{W_NS}}}num'):
                num_id = num_elem.attrib.get(f'{{{W_NS}}}numId')
                ab_ref = num_elem.find(f'{{{W_NS}}}abstractNumId')
                if num_id and ab_ref is not None:
                    ab_id = ab_ref.attrib.get(f'{{{W_NS}}}val')
                    if ab_id:
                        num_to_ab[num_id] = ab_id

            # Paso 2: abstractNumId -> numFmt (nivel 0)
            ab_to_fmt: dict[str, str] = {}
            for ab_elem in root.findall(f'.//{{{W_NS}}}abstractNum'):
                ab_id = ab_elem.attrib.get(f'{{{W_NS}}}abstractNumId')
                # Buscar formato del nivel 0 (ilvl=0)
                for lvl in ab_elem.findall(f'.//{{{W_NS}}}lvl'):
                    ilvl = lvl.attrib.get(f'{{{W_NS}}}ilvl', '0')
                    if ilvl == '0':
                        numFmt = lvl.find(f'{{{W_NS}}}numFmt')
                        if numFmt is not None:
                            ab_to_fmt[ab_id] = numFmt.attrib.get(f'{{{W_NS}}}val', 'bullet')
                        break

            # Paso 3: numId -> numFmt
            for num_id, ab_id in num_to_ab.items():
                result[num_id] = ab_to_fmt.get(ab_id, 'bullet')

    except Exception as e:
        print(f"[WARN] Error leyendo numbering.xml: {e}")

    return result


# Mapping de numFmt OOXML a estilos APA
OOXML_NUMFMT_TO_NUMBER_STYLE: dict[str, NumberStyle] = {
    'decimal': NumberStyle.DECIMAL,
    'upperLetter': NumberStyle.UPPER_LETTER,
    'lowerLetter': NumberStyle.LOWER_LETTER,
    'upperRoman': NumberStyle.UPPER_ROMAN,
    'lowerRoman': NumberStyle.LOWER_ROMAN,
}


def parse_docx_bytes(
    file_bytes: bytes,
    file_name: str,
    session_id: str,
    storage_dir: Path,
) -> DocumentModel:
    """
    Parsea los bytes de un DOCX en un DocumentModel.

    - Sanitiza numbering.xml
    - Extrae elementos (parrafos, titulos, listas, tablas, imagenes)
    - Extrae imagenes a archivos locales bajo storage_dir/session_id/images/
    - Ejecuta pre-clasificador de 3 pasadas
    - Inicializa metadatos completos del documento
    """
    # Calcular hash para idempotencia
    source_hash: str = hashlib.sha256(file_bytes).hexdigest()

    sanitized_bytes = sanitize_numbering_xml(file_bytes)

    # Obtener el mapping de numbering: numId -> (numFmt, abstractNumId)
    numbering_type_map: dict[str, str] = _get_numbering_type_map(sanitized_bytes)

    # Crear directorio de imagenes de sesion
    session_img_dir = storage_dir / "sessions" / session_id / "images"
    session_img_dir.mkdir(parents=True, exist_ok=True)

    # Cargar documento docx desde bytes
    doc = docx.Document(io.BytesIO(sanitized_bytes))

    elements: List[ElementModel] = []
    element_counter: int = 0
    total_words: int = 0
    has_images: bool = False
    has_tables_detected: bool = False

    # Extraer info de secciones
    sections_info = get_section_orientation_info(doc)
    has_landscape: bool = any(s.get("is_landscape", False) for s in sections_info)

    # Detectar OMML (ecuaciones) y OLE (objetos Excel)
    has_equations: bool = False
    has_ole: bool = False
    try:
        root = doc._element
        nsmap = {
            'm': 'http://schemas.openxmlformats.org/officeDocument/2006/math',
            'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        }
        omath_elems = root.findall('.//m:oMath', nsmap)
        if omath_elems:
            has_equations = True
        ole_elems = root.findall('.//w:object', nsmap)
        if ole_elems:
            has_ole = True
    except Exception:
        pass

    # Extraer texto de cuadros de texto y shapes ANTES de recorrer parrafos
    # (para detectar portadas basadas en shapes que no tienen parrafos normales)
    textbox_texts = extract_textbox_paragraphs(doc)
    textbox_has_content = any(t.strip() for t in textbox_texts)

    # Recorrer parrafos y elementos del cuerpo principal
    for p in doc.paragraphs:
        element_counter += 1
        text: str = p.text.strip() if p.text else ""

        # Contar palabras
        if text:
            total_words += len(text.split())

        # Detectar formato directo
        is_bold: bool = False
        is_italic: bool = False
        font_size: float = 12.0
        font_name: str = "Times New Roman"

        for r in p.runs:
            if r.bold:
                is_bold = True
            if r.italic:
                is_italic = True
            if r.font.size and r.font.size.pt:
                font_size = float(r.font.size.pt)
            if r.font.name:
                font_name = r.font.name

        # Determinar alineacion
        align_str: str = "left"
        if p.alignment is not None:
            raw_align = str(p.alignment)
            if "CENTER" in raw_align.upper():
                align_str = "center"
            elif "RIGHT" in raw_align.upper():
                align_str = "right"
            elif "JUSTIFY" in raw_align.upper():
                align_str = "justify"

        # Obtener indentacion
        left_indent_cm: float = 0.0
        try:
            pf = p.paragraph_format
            if pf.left_indent:
                left_indent_cm = pf.left_indent.cm if pf.left_indent.cm else 0.0
        except Exception:
            pass

        # Deteccion de imagenes inline en el parrafo
        # IMPORTANTE: Saltar imagenes dentro de cuadros de texto o shapes (decoracion de portada)
        images_in_p: List[ImageModel] = []
        for r in p.runs:
            drawing_elems = r._element.findall(
                './/{http://schemas.openxmlformats.org/drawingml/2006/main}blip'
            )
            for blip in drawing_elems:
                # Si esta dentro de un textbox/shape de portada, extraer igualmente como elemento de portada

                r_id = blip.attrib.get(
                    '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed'
                )
                if r_id and r_id in doc.part.rels:
                    rel = doc.part.rels[r_id]
                    if "image" in rel.target_ref:
                        try:
                            image_part = rel.target_part
                            img_filename: str = f"img_{uuid.uuid4().hex[:8]}.png"
                            img_path = session_img_dir / img_filename

                            with open(img_path, "wb") as f_img:
                                f_img.write(image_part.blob)

                            # Determinar si es linea vertical u objeto por proporcion de aspecto real
                            img_note = None
                            try:
                                from PIL import Image as PILImage
                                with PILImage.open(img_path) as pimg:
                                    pw, ph = pimg.size
                                    if ph > 2.0 * pw:
                                        img_note = "vertical_line"
                                    else:
                                        img_note = "author_card"
                            except Exception:
                                pass

                            has_images = True
                            img_model = ImageModel(
                                element_id=f"elem_{element_counter}",
                                file_path=str(img_path),
                                filename=img_filename,
                                relative_url=f"/api/images/{session_id}/{img_filename}",
                                width_cm=12.0,
                                height_cm=8.0,
                                caption="",
                                figure_number=0,  # Se asigna en pre_classifier
                                note=img_note,
                            )
                            images_in_p.append(img_model)
                        except Exception as img_err:
                            print(f"[WARN] Error extrayendo imagen: {img_err}")

        # Si el parrafo solo contiene una imagen sin texto
        if images_in_p and not text:
            for img in images_in_p:
                elem = ElementModel(
                    id=f"elem_{element_counter}",
                    type=ElementType.IMAGE,
                    text="",
                    confidence=1.0,
                    image_info=img,
                )
                elements.append(elem)
            continue

        # Construir elemento de texto normal
        style_name: str = p.style.name if p.style else "Normal"

        # Detectar numeracion OOXML (w:numPr) para preservar listas existentes
        bullet_source: Optional[str] = None
        num_level: Optional[int] = None
        detected_number_style: Optional[NumberStyle] = None
        detected_bullet_style: Optional[BulletStyle] = None
        detected_element_type = ElementType.PARAGRAPH
        try:
            pPr_ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
            num_pr = p._element.find(f'{pPr_ns}pPr/{pPr_ns}numPr')
            if num_pr is not None:
                bullet_source = "ooxml_list"
                ilvl_el = num_pr.find(f'{pPr_ns}ilvl')
                if ilvl_el is not None:
                    num_level = int(ilvl_el.attrib.get(f'{pPr_ns}val', '0'))

                # Obtener numId y consultar el tipo de numeracion
                numId_el = num_pr.find(f'{pPr_ns}numId')
                if numId_el is not None:
                    num_id_val = numId_el.attrib.get(f'{pPr_ns}val', '')
                    numfmt = numbering_type_map.get(num_id_val, 'bullet')

                    if numfmt == 'bullet':
                        detected_element_type = ElementType.BULLET
                        detected_bullet_style = BulletStyle.DISC
                    else:
                        detected_element_type = ElementType.NUMBERED_LIST
                        detected_number_style = OOXML_NUMFMT_TO_NUMBER_STYLE.get(
                            numfmt, NumberStyle.DECIMAL
                        )
        except Exception:
            pass

        # Si no se detecto OOXML, mantener PARAGRAPH (el pre_classifier decide)
        initial_type = detected_element_type if bullet_source == "ooxml_list" else ElementType.PARAGRAPH

        elem = ElementModel(
            id=f"elem_{element_counter}",
            type=initial_type,
            text=text,
            original_text=text,
            style_name=style_name,
            alignment=align_str,
            font_name=font_name,
            font_size=font_size,
            is_bold=is_bold,
            is_italic=is_italic,
            left_indent_cm=left_indent_cm,
            confidence=0.95 if bullet_source == "ooxml_list" else 0.5,
            bullet_source=bullet_source,
            bullet_style=detected_bullet_style,
            number_style=detected_number_style,
            heading_level=(num_level + 1) if num_level is not None else None,
        )
        elements.append(elem)

    # Recorrer Tablas
    for t in doc.tables:
        element_counter += 1
        has_tables_detected = True
        headers: List[str] = []
        rows_data: List[List[str]] = []

        # Obtener numero real de columnas desde tblGrid (mas fiable que rows)
        num_cols: int = len(t.columns) if t.columns else 0
        try:
            tbl_grid = t._tbl.find(
                '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tblGrid'
            )
            if tbl_grid is not None:
                grid_cols = tbl_grid.findall(
                    '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}gridCol'
                )
                if grid_cols:
                    num_cols = len(grid_cols)
        except Exception:
            pass

        for row_idx, row in enumerate(t.rows):
            row_cells = [cell.text.strip() for cell in row.cells]
            # Asegurar que la fila tenga el numero correcto de columnas
            while len(row_cells) < num_cols:
                row_cells.append("")
            if row_idx == 0:
                headers = row_cells
            else:
                rows_data.append(row_cells)

        tbl_model = TableModel(
            element_id=f"elem_{element_counter}",
            headers=headers,
            rows=rows_data,
            caption="",
            table_number=0,  # Se asigna en pre_classifier
        )

        elem = ElementModel(
            id=f"elem_{element_counter}",
            type=ElementType.TABLE,
            text=f"Tabla con {len(headers)} columnas",
            confidence=1.0,
            table_info=tbl_model,
        )
        elements.append(elem)

    # Fallback: agregar texto de cuadros de texto/shapes si el doc parece vacio de parrafos
    if not elements or all(
        e.type == ElementType.EMPTY
        for e in elements
        if e.type != ElementType.IMAGE and e.type != ElementType.TABLE
    ):
        for t_text in textbox_texts:
            element_counter += 1
            if t_text.strip():
                total_words += len(t_text.split())
            elem = ElementModel(
                id=f"elem_{element_counter}",
                type=ElementType.PORTADA_BLOCK,
                text=t_text,
                original_text=t_text,
                confidence=0.70,
            )
            elements.append(elem)

    # NOTA: Ya NO insertamos textbox_texts como PORTADA_BLOCK al inicio de documentos
    # con contenido real. El texto de cuadros de texto SOLO se usa para inferir metadatos
    # de portada (guardados en doc_model.portada). La portada original NO se toca —
    # el usuario llena el formulario y se genera una portada APA limpia.

    # Detectar si hay elementos que parecen portada (antes del primer heading)
    portada_detected: bool = False
    for elem in elements:
        if elem.type == ElementType.IMAGE or (
            elem.text and any(
                kw in elem.text.lower()
                for kw in ["universidad", "facultad", "escuela", "tesis", "monografia"]
            )
        ):
            portada_detected = True
            break

    # Pre-clasificar con 3 pasadas
    elements = pre_classify_elements(elements)

    # Construir metadatos
    meta = DocumentMeta(
        source_file=file_name,
        source_hash=source_hash,
        wordapa7_version="1.0.0",
        previously_processed=False,
        parsed_at=datetime.now(timezone.utc).isoformat(),
        page_count=max(1, total_words // 250),  # Estimacion aproximada
        word_count=total_words,
        has_images=has_images,
        has_tables=has_tables_detected,
        has_equations=has_equations,
        has_ole_objects=has_ole,
        portada_detected=portada_detected,
        apa_format=APAFormat.STUDENT,
        work_mode=WorkMode.REVIEW,
    )

    # Inferir campos de portada desde el texto de cuadros de texto/shapes
    inferred_portada_fields: dict[str, str] = {}
    if textbox_has_content:
        inferred_portada_fields = _infer_portada_from_textboxes(textbox_texts)

    doc_model = DocumentModel(
        session_id=session_id,
        file_name=file_name,
        apa_format=APAFormat.STUDENT,
        elements=elements,
        has_landscape_sections=has_landscape,
        meta=meta,
    )

    # Guardar texto de textboxes y campos inferidos en el modelo
    # para que el frontend pueda pre-llenar el formulario de portada
    # y el generador pueda preservar el contenido original
    if textbox_has_content:
        doc_model.portada = {
            "detected": portada_detected or textbox_has_content,
            "element_ids": [
                e.id for e in elements
                if e.type == ElementType.PORTADA_BLOCK
            ],
            "textbox_texts": textbox_texts,
            "fields": inferred_portada_fields,
            "profile_name": None,
        }

    return doc_model

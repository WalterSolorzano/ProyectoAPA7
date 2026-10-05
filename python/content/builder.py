from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Union

from models import (
    DocumentModel,
    ElementModel,
    ElementType,
    ImageModel,
    PortadaData,
    ReferenciaModel,
    TableModel,
)

from content.schema import ContentDocument, ContentItem, parse_content_document
from diagrams.render import render_diagram
from modules.captions import scan_existing


@dataclass
class BuildResult:
    document: DocumentModel
    warnings: list[str] = field(default_factory=list)


def _new_id() -> str:
    import uuid

    return uuid.uuid4().hex


def _collect_existing_texts(doc: DocumentModel) -> list[str]:
    texts = []
    for e in doc.elements:
        if e.text:
            texts.append(e.text)
        if e.type == ElementType.IMAGE and e.image_info and e.image_info.caption:
            texts.append(e.image_info.caption)
        if e.type == ElementType.TABLE and e.table_info and e.table_info.caption:
            texts.append(e.table_info.caption)
    return texts


def _heading(level: int, text: str) -> ElementModel:
    return ElementModel(id=_new_id(), type=ElementType.HEADING, heading_level=level, text=text)


def _paragraph(text: str) -> ElementModel:
    return ElementModel(id=_new_id(), type=ElementType.PARAGRAPH, text=text)


def _diagram_element(item: ContentItem, doc: DocumentModel, images_dir: Path, figure_number: int) -> tuple[ElementModel, list[str]]:
    payload = item.diagram
    warnings: list[str] = []
    result = render_diagram(payload.kind, payload.dsl)
    warnings.extend(result.warnings)
    filename = f"diagrama_{figure_number}_{_new_id()[:8]}.png"
    images_dir.mkdir(parents=True, exist_ok=True)
    file_path = images_dir / filename
    file_path.write_bytes(result.png)
    image = ImageModel(
        element_id="",
        file_path=str(file_path),
        filename=filename,
        relative_url=f"/api/images/{doc.session_id}/{filename}",
        caption=payload.caption,
        note=payload.note,
        figure_number=figure_number,
        design_style=payload.style,
        width_cm=payload.width_cm,
        height_cm=payload.height_cm,
    )
    element = ElementModel(id=_new_id(), type=ElementType.IMAGE, image_info=image)
    image.element_id = element.id
    return element, warnings


def _table_element(item: ContentItem, table_number: int) -> ElementModel:
    payload = item.table
    table = TableModel(
        element_id="",
        headers=list(payload.headers),
        rows=[list(r) for r in payload.rows],
        caption=payload.caption,
        note=payload.note,
        table_number=table_number,
    )
    element = ElementModel(id=_new_id(), type=ElementType.TABLE, table_info=table)
    table.element_id = element.id
    return element


def _references(refs: list[str]) -> list[ReferenciaModel]:
    out = []
    for i, raw in enumerate(refs):
        out.append(ReferenciaModel(id=f"ref-{i + 1}", raw_text=raw, formatted_apa=raw, title=raw))
    return out


def build_content_document(
    payload: Union[dict, ContentDocument],
    storage_dir: Path,
    session_id: Optional[str] = None,
) -> BuildResult:
    spec: ContentDocument = parse_content_document(payload)
    sid = session_id or _new_id()
    images_dir = Path(storage_dir) / "sessions" / sid / "images"

    doc = DocumentModel(
        session_id=sid,
        file_name=(spec.meta.title or "documento") + ".docx",
        elements=[],
    )
    doc.meta.autor = spec.meta.author or None
    doc.portada = PortadaData(
        title=spec.meta.title,
        institution=spec.meta.institution,
        course=spec.meta.course or None,
        date=spec.meta.date or None,
        use_original_cover=spec.meta.use_original_cover,
    ).model_dump(mode="json")

    warnings: list[str] = []
    counters = scan_existing(_collect_existing_texts(doc))
    figure_number = counters["max_figure"] + 1
    table_number = counters["max_table"] + 1

    for item in spec.content:
        if item.page_break:
            doc.elements.append(ElementModel(id=_new_id(), type=ElementType.PAGE_BREAK))
        if item.h1 is not None:
            doc.elements.append(_heading(1, item.h1))
        if item.h2 is not None:
            doc.elements.append(_heading(2, item.h2))
        if item.h3 is not None:
            doc.elements.append(_heading(3, item.h3))
        if item.p is not None:
            text = item.p if not item.cite else f"{item.p} {item.cite}".strip()
            doc.elements.append(_paragraph(text))
        for b in item.bullets or []:
            doc.elements.append(ElementModel(id=_new_id(), type=ElementType.BULLET, text=b))
        for n in item.numbered or []:
            doc.elements.append(ElementModel(id=_new_id(), type=ElementType.NUMBERED_LIST, text=n))
        if item.table is not None:
            doc.elements.append(_table_element(item, table_number))
            table_number += 1
        if item.diagram is not None:
            element, w = _diagram_element(item, doc, images_dir, figure_number)
            warnings.extend(w)
            doc.elements.append(element)
            figure_number += 1

    doc.referencias = _references(spec.references)
    return BuildResult(document=doc, warnings=warnings)

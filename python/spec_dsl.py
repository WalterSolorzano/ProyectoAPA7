"""DSL compacto spec -> docx. Contrato de agentes IA para POST /api/spec.

Solo datos JSON: el agente describe el documento; el motor lo expande al
modelo interno (ElementModel) y genera el .docx con el pipeline existente.
"""
from __future__ import annotations

import re
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator, model_validator

SPEC_VERSION = "1"

MAX_ELEMENTS = 200
MAX_IMAGES = 50
MAX_ROWS = 500
MAX_COLS = 30
MAX_REFS = 50
MAX_TEXT = 4096

_ILLEGAL_FILENAME = re.compile(r"[^A-Za-z0-9_\-\.]")


class OutputSpec(BaseModel):
    filename: str = "documento_apa.docx"


class CoverSpec(BaseModel):
    """Portada: template de la tienda cover-templates + campos."""
    template: str = ""
    title: str = ""
    author: str = ""
    institution: str = ""
    course: str = ""
    instructor: str = ""
    date: str = ""


class PresetRefs(BaseModel):
    """Nombres de presets (None = default del motor)."""
    table: Optional[str] = None
    heading: Optional[str] = None
    layout: Optional[str] = None


class SpecOptions(BaseModel):
    resolve_doi: bool = False
    mode: Literal["inplace", "rebuild"] = "inplace"


class HeadingElement(BaseModel):
    type: Literal["heading"] = "heading"
    level: int = Field(ge=1, le=5)
    text: str = Field(max_length=MAX_TEXT)


class ParagraphElement(BaseModel):
    type: Literal["paragraph"] = "paragraph"
    text: str = Field(max_length=MAX_TEXT)


class TableElement(BaseModel):
    type: Literal["table"] = "table"
    caption: str = ""          # etiqueta visible, p. ej. "Tabla 1"
    title: str = ""
    columns: list[str] = Field(min_length=1, max_length=MAX_COLS)
    rows: list[list[str]] = Field(default_factory=list)
    note: Optional[str] = Field(default=None, max_length=MAX_TEXT)
    repeat_header: bool = True
    preset: Optional[str] = None   # preset table nombrado (override)

    @field_validator("rows")
    @classmethod
    def _rows_limits(cls, v: list[list[str]]) -> list[list[str]]:
        if len(v) > MAX_ROWS:
            raise ValueError(f"LIMIT: maximo {MAX_ROWS} filas")
        for row in v:
            if len(row) > MAX_COLS:
                raise ValueError(f"LIMIT: maximo {MAX_COLS} columnas")
            for cell in row:
                if len(cell) > MAX_TEXT:
                    raise ValueError(f"LIMIT: celda > {MAX_TEXT} chars")
        return v


class FigureElement(BaseModel):
    type: Literal["figure"] = "figure"
    image: str
    caption: str = ""
    title: str = Field(default="", max_length=MAX_TEXT)

    @field_validator("image")
    @classmethod
    def _no_data_uri(cls, v: str) -> str:
        if v.lower().startswith("data:"):
            raise ValueError("URIs data: prohibidos; usa ruta local absoluta")
        return v


class EquipmentCardElement(BaseModel):
    type: Literal["equipment_card"] = "equipment_card"
    number: str = Field(max_length=16)     # p. ej. "A2"
    title: str = Field(max_length=MAX_TEXT)
    image: str
    specs: dict[str, str] = Field(default_factory=dict)

    @field_validator("image")
    @classmethod
    def _no_data_uri(cls, v: str) -> str:
        if v.lower().startswith("data:"):
            raise ValueError("URIs data: prohibidos; usa ruta local absoluta")
        return v


class ReferenceItem(BaseModel):
    apa: Optional[str] = Field(default=None, max_length=MAX_TEXT)
    doi: Optional[str] = None


class ReferencesElement(BaseModel):
    type: Literal["references"] = "references"
    items: list[ReferenceItem] = Field(max_length=MAX_REFS)


ElementUnion = Annotated[
    Union[HeadingElement, ParagraphElement, TableElement, FigureElement,
          EquipmentCardElement, ReferencesElement],
    Field(discriminator="type"),
]


class SpecDocument(BaseModel):
    """Raiz del DSL."""
    spec_version: Literal["1"]
    output: OutputSpec = Field(default_factory=OutputSpec)
    cover: Optional[CoverSpec] = None
    presets: PresetRefs = Field(default_factory=PresetRefs)
    elements: list[ElementUnion] = Field(min_length=1)
    options: SpecOptions = Field(default_factory=SpecOptions)

    @model_validator(mode="after")
    def _global_limits(self) -> "SpecDocument":
        if len(self.elements) > MAX_ELEMENTS:
            raise ValueError(f"LIMIT: maximo {MAX_ELEMENTS} elementos")
        images = sum(1 for e in self.elements
                     if e.type in ("figure", "equipment_card"))
        if images > MAX_IMAGES:
            raise ValueError(f"LIMIT: maximo {MAX_IMAGES} imagenes")
        for i, e in enumerate(self.elements):
            if e.type == "paragraph" and len(e.text) > MAX_TEXT:
                raise ValueError(f"LIMIT: elements[{i}].text > {MAX_TEXT}")
        return self


def sanitize_filename(raw: str) -> str:
    """Quita cualquier ruta/tipo de archivo peligroso; devuelve solo nombre .docx."""
    name = raw.replace("\\", "/").split("/")[-1]
    name = _ILLEGAL_FILENAME.sub("_", name).strip("._") or "documento_apa"
    if not name.lower().endswith(".docx"):
        name += ".docx"
    if len(name) > 120:
        name = name[:116] + ".docx"
    return name

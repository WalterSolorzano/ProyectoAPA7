"""Tests de validación y expansión del DSL spec -> modelo interno."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from pydantic import ValidationError

from spec_dsl import SpecDocument


def _minimal(**over):
    base = {
        "spec_version": "1",
        "elements": [{"type": "heading", "level": 1, "text": "1. Intro"},
                     {"type": "paragraph", "text": "Cuerpo."}],
    }
    base.update(over)
    return base


def test_minimal_spec_parses():
    spec = SpecDocument.model_validate(_minimal())
    assert spec.spec_version == "1" and len(spec.elements) == 2


def test_unknown_version_rejected():
    with pytest.raises(ValidationError):
        SpecDocument.model_validate(_minimal(spec_version="2"))


def test_data_uri_rejected():
    bad = _minimal(elements=[{"type": "figure", "image": "data:image/png;base64,AAA",
                              "caption": "Figura 1", "title": "T"}])
    with pytest.raises(ValidationError):
        SpecDocument.model_validate(bad)


def test_too_many_elements_rejected():
    elems = [{"type": "paragraph", "text": "x"} for _ in range(201)]
    with pytest.raises(ValidationError):
        SpecDocument.model_validate(_minimal(elements=elems))


def test_too_many_rows_rejected():
    table = {"type": "table", "caption": "Tabla 1", "title": "T",
             "columns": ["a"], "rows": [["1"] for _ in range(501)]}
    with pytest.raises(ValidationError):
        SpecDocument.model_validate(_minimal(elements=[table]))


def test_text_over_limit_rejected():
    with pytest.raises(ValidationError):
        SpecDocument.model_validate(
            _minimal(elements=[{"type": "paragraph", "text": "x" * 4097}]))


def test_heading_level_bounds():
    with pytest.raises(ValidationError):
        SpecDocument.model_validate(
            _minimal(elements=[{"type": "heading", "level": 6, "text": "x"}]))


def test_equipment_card_parses():
    spec = SpecDocument.model_validate(_minimal(elements=[
        {"type": "equipment_card", "number": "A1", "title": "Refrigerador",
         "image": "C:/fotos/refri.jpg", "specs": {"Potencia": "120 W"}}]))
    assert spec.elements[0].type == "equipment_card"

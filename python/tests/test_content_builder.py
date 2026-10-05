import uuid

from content.builder import build_content_document
from models import ElementType


def _sid():
    return "t" + uuid.uuid4().hex[:8]


def test_builds_elements_and_numbers_figures(tmp_path):
    payload = {
        "meta": {"title": "Informe", "author": "Ana", "institution": "UNI"},
        "content": [
            {"h1": "Método"},
            {"p": "Cuerpo.", "cite": "(Pérez, 2020)"},
            {"diagram": {"kind": "flow", "dsl": "A > B", "caption": "Fases", "style": "scientific"}},
            {"table": {"caption": "Datos", "rows": [["a", "b"]]}},
            {"diagram": {"kind": "tree", "dsl": "R\n- H", "caption": "Árbol"}},
        ],
    }
    result = build_content_document(payload, tmp_path, session_id=_sid())
    doc = result.document
    types = [e.type for e in doc.elements]
    assert types[0] == ElementType.HEADING
    assert types[1] == ElementType.PARAGRAPH
    figs = [e for e in doc.elements if e.type == ElementType.IMAGE]
    assert [f.image_info.figure_number for f in figs] == [1, 2]
    assert figs[0].image_info.design_style == "scientific"
    tbl = next(e for e in doc.elements if e.type == ElementType.TABLE)
    assert tbl.table_info.table_number == 1


def test_empty_content_is_valid(tmp_path):
    result = build_content_document({"content": []}, tmp_path, session_id=_sid())
    assert result.document.elements == []


def test_unknown_kind_warns_but_still_builds(tmp_path):
    result = build_content_document(
        {"content": [{"diagram": {"kind": "sequence", "dsl": "A -> B"}}]},
        tmp_path, session_id=_sid(),
    )
    assert result.warnings
    assert any(e.type == ElementType.IMAGE for e in result.document.elements)

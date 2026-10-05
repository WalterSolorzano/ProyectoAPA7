import uuid

from content.builder import build_content_document
from content.emit import emit_docx
from docx import Document


def test_emit_produces_openable_docx(tmp_path):
    result = build_content_document(
        {
            "meta": {"title": "Tesis", "use_original_cover": False},
            "content": [
                {"h1": "Método"},
                {"p": "Cuerpo."},
                {"diagram": {"kind": "flow", "dsl": "A > B", "caption": "Fases"}},
            ],
        },
        tmp_path, session_id="e" + uuid.uuid4().hex[:8],
    )
    out = tmp_path / "salida.docx"
    final = emit_docx(result.document, out, try_com=False)
    assert final.exists()
    opened = Document(str(final))
    assert len(opened.paragraphs) > 0


def test_emit_without_word_falls_back(tmp_path):
    result = build_content_document({"content": [{"p": "x"}]}, tmp_path, session_id="f" + uuid.uuid4().hex[:8])
    out = tmp_path / "s.docx"
    final = emit_docx(result.document, out, try_com=True)
    assert final.exists()

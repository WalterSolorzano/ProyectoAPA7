"""Tests de integracion de POST /api/spec (generacion mockeada salvo E2E)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session", autouse=True)
def _ensure_template():
    """Crea la plantilla APA base una vez (en tests no corre el lifespan)."""
    from config import get_apa7_template_path
    p = get_apa7_template_path()
    if not p.exists():
        from create_template import create_apa7_template
        create_apa7_template(p)


@pytest.fixture
def client():
    """TestClient sin context manager (evita lifespan/COM)."""
    from main import app
    return TestClient(app)


def _spec(**over):
    base = {
        "spec_version": "1",
        "elements": [{"type": "heading", "level": 1, "text": "1. Marco"},
                     {"type": "paragraph", "text": "Texto de prueba."}],
    }
    base.update(over)
    return base


def test_unknown_version_422(client):
    r = client.post("/api/spec", json=_spec(spec_version="9"))
    assert r.status_code == 422


def test_unknown_preset_404_with_available(client):
    r = client.post("/api/spec", json=_spec(presets={"table": "no_existe"}))
    assert r.status_code == 404
    body = r.json()["detail"]
    assert "tabla_apa_generica" in body["available"]


def test_unknown_cover_404_with_available(client):
    r = client.post("/api/spec", json=_spec(cover={"template": "portada_fantasma"}))
    assert r.status_code == 404
    assert "available" in r.json()["detail"]


def test_data_uri_422(client):
    r = client.post("/api/spec", json=_spec(elements=[
        {"type": "figure", "image": "data:image/png;base64,AA",
         "caption": "Figura 1", "title": "T"}]))
    assert r.status_code == 422


def test_happy_path_200(client, monkeypatch):
    """Generacion mockeada: valida orquestacion, sesion y respuesta."""
    import docx
    import main

    async def fake_generate(req):
        out = Path(main.STORAGE_DIR) / "sessions" / req.session_id
        out.mkdir(parents=True, exist_ok=True)
        d = docx.Document()
        d.add_paragraph("1. Marco")
        d.save(str(out / "APA7_test.docx"))
        return {"download_url": f"/api/download/{req.session_id}",
                "filename": "APA7_test.docx"}

    monkeypatch.setattr(main, "generate_docx", fake_generate)
    r = client.post("/api/spec", json=_spec(presets={"layout": "layout_uni"}))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["session_id"] and body["download_url"].endswith(body["session_id"])
    assert body["filename"] == "APA7_test.docx"
    assert isinstance(body["warnings"], list)


def test_missing_image_warning_200(client, monkeypatch):
    import docx
    import main

    async def fake_generate(req):
        out = Path(main.STORAGE_DIR) / "sessions" / req.session_id
        out.mkdir(parents=True, exist_ok=True)
        docx.Document().save(str(out / "APA7_w.docx"))
        return {"download_url": f"/api/download/{req.session_id}",
                "filename": "APA7_w.docx"}

    monkeypatch.setattr(main, "generate_docx", fake_generate)
    r = client.post("/api/spec", json=_spec(elements=[
        {"type": "paragraph", "text": "x"},
        {"type": "figure", "image": "C:/no_existe/a.png",
         "caption": "Figura 1", "title": "T"}]))
    assert r.status_code == 200
    assert any("no_existe" in w for w in r.json()["warnings"])

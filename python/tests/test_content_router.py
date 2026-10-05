from fastapi.testclient import TestClient

from main import app


def test_build_endpoint_returns_download_url():
    client = TestClient(app)
    payload = {
        "meta": {"title": "Tesis", "use_original_cover": False},
        "content": [{"h1": "Método"}, {"p": "Cuerpo."}],
    }
    res = client.post("/api/content/build", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert body["session_id"]
    assert body["download_url"].startswith("/api/download-artifact/")
    assert body["warnings"] == []


def test_build_endpoint_rejects_empty_content():
    client = TestClient(app)
    res = client.post("/api/content/build", json={"content": []})
    assert res.status_code == 400

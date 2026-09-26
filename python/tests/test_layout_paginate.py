# python/tests/test_layout_paginate.py
"""FASE 2 — POST /api/layout/paginate: contrato del endpoint y del servicio.

Word se simula (monkeypatch de COMPageLayoutProvider / apply_inplace):
el test nunca toma una instancia COM real.
"""
import sys
import pathlib
import types
import uuid

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient


def _client():
    from main import app
    return TestClient(app)


def test_endpoint_404_sesion_desconocida():
    r = _client().post("/api/layout/paginate",
                       json={"session_id": f"nope-{uuid.uuid4().hex}"})
    assert r.status_code == 404
    assert r.json()["detail"] == "Sesión no encontrada."


def test_endpoint_shape_with_mocked_service(monkeypatch):
    from persistence import session_manager as sm
    monkeypatch.setattr(sm, "load_session_state", lambda sid, st: object())
    from services import layout_service as ls
    monkeypatch.setattr(ls, "paginate_session", lambda doc, sd: {
        "available": True, "provider": "com", "reason": None,
        "total_pages": 7,
        "elements": [{"element_id": "e0", "page_start": 1},
                     {"element_id": "e1", "page_start": 2}],
        "line_cuts": [{"element_id": "e1",
                       "cuts": [{"offset": 120, "page": 2}]}],
        "page_setup": {"width_pt": 612.0, "height_pt": 792.0,
                       "margin_top_pt": 72.0, "margin_bottom_pt": 72.0,
                       "margin_left_pt": 72.0, "margin_right_pt": 72.0},
        "elapsed_ms": 5,
    })
    r = _client().post("/api/layout/paginate", json={"session_id": "abc"})
    assert r.status_code == 200
    data = r.json()
    assert data["session_id"] == "abc"
    assert data["available"] is True and data["total_pages"] == 7
    assert data["elements"][1]["page_start"] == 2
    assert data["line_cuts"][0]["cuts"][0] == {"offset": 120, "page": 2}
    assert data["page_setup"]["width_pt"] == 612.0

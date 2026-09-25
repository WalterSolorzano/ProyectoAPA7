"""Tests del almacén de presets (builtin + usuario, merge, borrado)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from fastapi.testclient import TestClient
from preset_store import (
    BuiltinDeleteError,
    PresetExists,
    PresetNotFound,
    PresetPayload,
    delete_preset,
    get_preset,
    list_names,
    save_preset,
)
from pydantic import ValidationError


def _payload(name="mi_tabla", type_="table", definition=None, overwrite=False):
    return PresetPayload(name=name, type=type_,
                         definition=definition or {"border_style": "grid"},
                         overwrite=overwrite)


def test_list_includes_builtins(tmp_path):
    names = list_names(tmp_path)
    assert "tabla_apa_generica" in names and "layout_uni" in names


def test_get_builtin_record(tmp_path):
    rec = get_preset("tabla_apa_generica", tmp_path)
    assert rec.origin == "builtin" and rec.type == "table"
    assert rec.definition["border_style"] == "apa"


def test_get_unknown_raises_with_available(tmp_path):
    with pytest.raises(PresetNotFound) as exc:
        get_preset("no_existe", tmp_path)
    assert "tabla_apa_generica" in exc.value.available


def test_save_user_preset(tmp_path):
    save_preset(_payload(), tmp_path)
    rec = get_preset("mi_tabla", tmp_path)
    assert rec.origin == "user" and rec.definition["border_style"] == "grid"


def test_user_override_wins_on_merge(tmp_path):
    save_preset(_payload(name="tabla_apa_generica",
                         definition={"border_style": "grid"}, overwrite=True),
                tmp_path)
    rec = get_preset("tabla_apa_generica", tmp_path)
    assert rec.origin == "user" and rec.definition["border_style"] == "grid"


def test_save_duplicate_without_overwrite_raises(tmp_path):
    save_preset(_payload(), tmp_path)
    with pytest.raises(PresetExists):
        save_preset(_payload(), tmp_path)


def test_delete_builtin_rejected(tmp_path):
    with pytest.raises(BuiltinDeleteError):
        delete_preset("layout_uni", tmp_path)


def test_delete_user_ok(tmp_path):
    save_preset(_payload(), tmp_path)
    delete_preset("mi_tabla", tmp_path)
    with pytest.raises(PresetNotFound):
        get_preset("mi_tabla", tmp_path)


def test_invalid_name_rejected(tmp_path):
    with pytest.raises(ValidationError):
        PresetPayload(name="MAL Nombre!", type="table", definition={})


def test_definition_type_validation(tmp_path):
    from preset_store import TablePresetDef
    with pytest.raises(ValidationError):
        TablePresetDef(border_style="dashed")


# ── Integración: endpoints CRUD (/api/presets) ───────────────────────────────

@pytest.fixture
def client():
    """TestClient sin context manager (evita lifespan/COM)."""
    from main import app
    return TestClient(app)


@pytest.fixture(autouse=True)
def _isolated_storage(tmp_path, monkeypatch):
    """Aísla STORAGE_DIR del router para no ensuciar el storage real."""
    import routers.presets as rp
    monkeypatch.setattr(rp, "STORAGE_DIR", tmp_path)
    yield


def test_list_endpoint(client):
    r = client.get("/api/presets")
    assert r.status_code == 200
    names = [p["name"] for p in r.json()]
    assert "tabla_apa_generica" in names


def test_list_type_filter(client):
    r = client.get("/api/presets", params={"type": "layout"})
    assert r.status_code == 200
    assert all(p["type"] == "layout" for p in r.json())


def test_get_detail(client):
    r = client.get("/api/presets/tabla_apa_generica")
    assert r.status_code == 200
    assert r.json()["definition"]["border_style"] == "apa"


def test_post_and_delete_roundtrip(client):
    body = {"name": "tabla_grid_prueba", "type": "table",
            "definition": {"border_style": "grid"}}
    r = client.post("/api/presets", json=body)
    assert r.status_code == 200 and r.json()["origin"] == "user"
    assert client.delete("/api/presets/tabla_grid_prueba").status_code == 200


def test_post_conflict_409(client):
    body = {"name": "conflict_prueba", "type": "table", "definition": {}}
    client.post("/api/presets", json=body)
    r = client.post("/api/presets", json=body)
    assert r.status_code == 409
    r2 = client.post("/api/presets", json={**body, "overwrite": True})
    assert r2.status_code == 200
    client.delete("/api/presets/conflict_prueba")


def test_delete_builtin_400(client):
    r = client.delete("/api/presets/layout_uni")
    assert r.status_code == 400


def test_get_missing_404_available(client):
    r = client.get("/api/presets/no_tal")
    assert r.status_code == 404
    assert "tabla_apa_generica" in r.json()["detail"]["available"]

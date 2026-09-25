"""Tests del almacén de presets (builtin + usuario, merge, borrado)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from pydantic import ValidationError

from preset_store import (
    BuiltinDeleteError,
    PresetExists,
    PresetNotFound,
    PresetPayload,
    delete_preset,
    get_preset,
    list_names,
    list_presets,
    save_preset,
)


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

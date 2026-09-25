"""CRUD de presets de estilo. Builtin en repo, usuario en STORAGE_DIR/presets."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

from config import STORAGE_DIR
from preset_store import (
    BuiltinDeleteError,
    PresetExists,
    PresetNotFound,
    PresetPayload,
    delete_preset,
    get_preset,
    list_presets,
    save_preset,
)

router = APIRouter(tags=["presets"])


@router.get("/api/presets")
async def list_presets_endpoint(type: Optional[str] = None) -> list[dict]:
    """Lista presets (filtro opcional por tipo)."""
    try:
        return [p.model_dump() for p in list_presets(STORAGE_DIR, type)]
    except KeyError:
        raise HTTPException(status_code=422,
                            detail=f"Tipo desconocido: {type}")


@router.get("/api/presets/{name}")
async def get_preset_endpoint(name: str) -> dict:
    """Detalle de un preset (usuario pisa builtin)."""
    try:
        return get_preset(name, STORAGE_DIR).model_dump()
    except PresetNotFound as e:
        raise HTTPException(status_code=404,
                            detail={"detail": str(e), "available": e.available})


@router.post("/api/presets")
async def save_preset_endpoint(payload: PresetPayload) -> dict:
    """Guarda un preset (explícito). Sin overwrite y ya existe -> 409."""
    try:
        return save_preset(payload, STORAGE_DIR).model_dump()
    except PresetExists:
        raise HTTPException(status_code=409,
                            detail=f"Preset '{payload.name}' ya existe. "
                                   f"Usa overwrite=true.")


@router.delete("/api/presets/{name}")
async def delete_preset_endpoint(name: str) -> dict:
    """Borra preset de usuario. Builtin -> 400."""
    try:
        delete_preset(name, STORAGE_DIR)
        return {"status": "ok", "deleted": name}
    except BuiltinDeleteError:
        raise HTTPException(status_code=400,
                            detail=f"'{name}' es builtin y no se puede borrar.")
    except PresetNotFound as e:
        raise HTTPException(status_code=404,
                            detail={"detail": str(e), "available": e.available})

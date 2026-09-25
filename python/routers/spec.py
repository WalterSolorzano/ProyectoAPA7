"""Endpoint atomico POST /api/spec: DSL JSON -> docx APA 7 en un llamado.

Enfoque A: reutiliza las rutas existentes de main.py como funciones
(start_blank_document, apply_cover_endpoint, generate_docx) + post-paso.
IMPORT: los imports de main van DENTRO del handler (circulo de import).
"""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, HTTPException

from config import STORAGE_DIR
from persistence.session_manager import maybe_run_gc, save_session_state
from preset_store import PresetNotFound, get_preset
from spec_dsl import SpecDocument, expand_spec
from spec_postpass import (apply_heading_styles, apply_table_border_override,
                           append_equipment_cards)

router = APIRouter(tags=["spec"])


def _resolve_preset(name: str | None, expected_type: str):
    """Resuelve un preset nombrado y lo valida a su modelo de definicion.

    Devuelve TablePresetDef | HeadingPresetDef | LayoutPresetDef o None.
    404 con nombres disponibles; tipo incorrecto -> 422.
    """
    if not name:
        return None
    from preset_store import PRESET_TYPES
    try:
        rec = get_preset(name, STORAGE_DIR)
    except PresetNotFound as e:
        raise HTTPException(status_code=404,
                            detail={"detail": str(e), "available": e.available})
    if rec.type != expected_type:
        raise HTTPException(status_code=422,
                            detail=f"Preset '{name}' es tipo {rec.type}, "
                                   f"se esperaba {expected_type}.")
    return PRESET_TYPES[rec.type](**rec.definition)


def _check_cover(name: str | None) -> None:
    if not name:
        return
    from modules.cover_designer import list_cover_templates
    names = [t.name for t in list_cover_templates(STORAGE_DIR)]
    if name not in names:
        raise HTTPException(status_code=404,
                            detail={"detail": f"Portada '{name}' no existe.",
                                    "available": names})


@router.post("/api/spec")
async def generate_from_spec(spec: SpecDocument,
                             background_tasks: BackgroundTasks) -> dict:
    """Genera un docx APA 7 completo desde un spec JSON (un solo llamado)."""
    from main import (ApplyCoverRequest, GenerateRequest,
                      apply_cover_endpoint, generate_docx,
                      start_blank_document)

    # 1. Resolver presets y portada (404 con available)
    table_rec = _resolve_preset(spec.presets.table, "table")
    heading_rec = _resolve_preset(spec.presets.heading, "heading")
    layout_rec = _resolve_preset(spec.presets.layout, "layout")
    _check_cover(spec.cover.template if spec.cover else None)

    # 2. Expandir DSL (propaga PresetNotFound de presets por tabla)
    try:
        exp = await expand_spec(
            spec,
            table_def=table_rec,
            layout_def=layout_rec,
            heading_def=heading_rec,
            table_defs_by_caption={}, storage_dir=STORAGE_DIR)
    except PresetNotFound as e:
        raise HTTPException(status_code=404,
                            detail={"detail": str(e), "available": e.available})

    warnings = list(exp.warnings)

    # 3. Sesion blank (template APA base)
    doc = await start_blank_document(background_tasks)
    doc.elements = exp.elements
    doc.file_name = exp.filename
    save_session_state(doc, STORAGE_DIR)

    try:
        # 4. Portada si se pidio
        if spec.cover and spec.cover.template:
            await apply_cover_endpoint(ApplyCoverRequest(
                session_id=doc.session_id, cover_template_name=spec.cover.template,
                title=spec.cover.title, author=spec.cover.author,
                institution=spec.cover.institution, course=spec.cover.course,
                instructor=spec.cover.instructor, date=spec.cover.date))

        # 5. Generar con el pipeline existente
        result = await generate_docx(GenerateRequest(
            session_id=doc.session_id, rules=exp.rules,
            references=exp.references or None))

        # 6. Post-paso: headings nativos, bordes por caption, tarjetas de anexo
        out_dir = STORAGE_DIR / "sessions" / doc.session_id
        outs = sorted(out_dir.glob("APA7_*.docx"),
                      key=lambda p: p.stat().st_mtime, reverse=True)
        if outs:
            out_file = outs[0]
            if exp.heading_preset:
                apply_heading_styles(out_file, exp.heading_preset.levels)
            for ov in exp.table_overrides:
                if not apply_table_border_override(out_file, ov.caption_label,
                                                   ov.border_style):
                    warnings.append(f"Tabla '{ov.caption_label}' no localizada "
                                    f"para aplicar preset de bordes.")
            try:
                append_equipment_cards(out_file, exp.equipment_cards, exp.rules)
            except Exception as e:  # anexos no deben romper la descarga
                warnings.append(f"Tarjetas de anexo fallaron: {e}")
        else:
            warnings.append("Salida no encontrada tras generar.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail={"detail": str(e),
                                    "session_id": doc.session_id})

    # 7. GC diferido (patron /api/upload); la sesion vive para la descarga
    background_tasks.add_task(maybe_run_gc, STORAGE_DIR)

    filename = (result.get("filename") or result.get("file_name")
                or exp.filename)
    return {"download_url": result.get("download_url",
                                       f"/api/download/{doc.session_id}"),
            "filename": filename, "session_id": doc.session_id,
            "warnings": warnings}

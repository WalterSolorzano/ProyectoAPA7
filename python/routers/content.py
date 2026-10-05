from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

from config import STORAGE_DIR
from content.builder import build_content_document
from content.emit import emit_docx
from persistence.session_manager import save_session_state

router = APIRouter(tags=["content"])


def _write_manifest(session_dir: Path, artifact_id: str, **data: Any) -> None:
    import json

    exports = session_dir / "exports"
    exports.mkdir(parents=True, exist_ok=True)
    (exports / f"{artifact_id}.json").write_text(
        json.dumps({"artifact_id": artifact_id, **data}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


@router.post("/api/content/build")
async def build_content(payload: dict) -> dict:
    if not (payload.get("content") or []):
        raise HTTPException(status_code=400, detail="El payload no tiene contenido.")

    session_id = str(uuid.uuid4())
    result = build_content_document(payload, STORAGE_DIR, session_id=session_id)
    doc = result.document
    save_session_state(doc, STORAGE_DIR)

    session_dir = Path(STORAGE_DIR) / "sessions" / session_id
    artifact_id = uuid.uuid4().hex[:12]
    out_dir = session_dir / "exports"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{artifact_id}_{doc.file_name}"
    emit_docx(doc, out_path, try_com=True)

    _write_manifest(
        session_dir,
        artifact_id,
        file_name=doc.file_name,
        source="content.build",
        warnings=result.warnings,
    )
    return {
        "session_id": session_id,
        "download_url": f"/api/download-artifact/{session_id}/{artifact_id}",
        "warnings": result.warnings,
    }

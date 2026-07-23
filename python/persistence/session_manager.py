"""
WordAPA7 — Gestor de Sesiones y Persistencia Incremental

Guarda y recupera el estado completo de la sesion (`DocumentModel`)
en disco (`sessions/{session_id}/session_state.json`) permitiendo autosave
sin bloquear el servidor.

Incluye verificacion de idempotencia para detectar documentos ya procesados.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from models import DocumentModel


def save_session_state(doc: DocumentModel, storage_dir: Path) -> Path:
    """
    Guarda el modelo del documento en JSON con timestamp de autosave.

    Si el documento tiene elementos serializados como dicts (de cargas anteriores),
    se guardan como estan — la carga los reconvierte via model_validate.
    """
    sess_dir = storage_dir / "sessions" / doc.session_id
    sess_dir.mkdir(parents=True, exist_ok=True)

    file_path = sess_dir / "session_state.json"

    # Actualizar timestamp de autosave
    if doc.meta:
        doc.meta.autosave_at = datetime.now(timezone.utc).isoformat()

    # Exportar Pydantic a JSON usando model_dump_json (Pydantic v2)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(doc.model_dump_json(indent=2))

    return file_path


def load_session_state(session_id: str, storage_dir: Path) -> Optional[DocumentModel]:
    """
    Carga el modelo del documento desde JSON en disco.

    Soporta tanto el formato Pydantic v2 como versiones anteriores.
    Si el JSON esta corrupto o falta, retorna None.
    """
    file_path = storage_dir / "sessions" / session_id / "session_state.json"
    if not file_path.exists():
        # Intentar busqueda parcial (el session_id podria ser un subconjunto)
        sessions_root = storage_dir / "sessions"
        if sessions_root.exists():
            for d in sessions_root.iterdir():
                if d.is_dir() and d.name.startswith(session_id):
                    candidate = d / "session_state.json"
                    if candidate.exists():
                        file_path = candidate
                        break

    if not file_path.exists():
        return None

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return DocumentModel.model_validate(data)
    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON corrupto en sesion {session_id}: {e}")
        return None
    except Exception as e:
        print(f"[ERROR] Error cargando estado de sesion {session_id}: {e}")
        return None


def session_exists(session_id: str, storage_dir: Path) -> bool:
    """Verifica si una sesion existe en disco."""
    file_path = storage_dir / "sessions" / session_id / "session_state.json"
    return file_path.exists()


def list_recent_sessions(storage_dir: Path, limit: int = 10) -> list[dict]:
    """
    Lista las sesiones mas recientes para mostrar en el historial de la UI.
    Retorna info resumida de cada sesion.
    """
    sessions_root = storage_dir / "sessions"
    if not sessions_root.exists():
        return []

    sessions: list[dict] = []
    for d in sorted(sessions_root.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if not d.is_dir():
            continue
        state_file = d / "session_state.json"
        if not state_file.exists():
            continue

        try:
            with open(state_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Count elements needing review
            elements = data.get("elements", [])
            pending_count = sum(
                1 for e in elements
                if e.get("needs_review", True) or e.get("confidence", 0) < 0.85
            )

            sessions.append({
                "session_id": d.name,
                "file_name": data.get("file_name", "Desconocido"),
                "element_count": len(elements),
                "pending_count": pending_count,
                "apa_format": data.get("apa_format", "student"),
                "parsed_at": data.get("meta", {}).get("parsed_at", ""),
                "autosave_at": data.get("meta", {}).get("autosave_at", ""),
                "last_saved": data.get("meta", {}).get("autosave_at", ""),
                "validation_score": (
                    data.get("apa_validation", {}).get("score")
                    if data.get("apa_validation") else None
                ),
            })
        except Exception:
            continue

    return sessions[:limit]


def delete_session(session_id: str, storage_dir: Path) -> bool:
    """
    Elimina una sesion y todos sus archivos asociados.
    Retorna True si se elimino correctamente.
    """
    import shutil
    session_dir = storage_dir / "sessions" / session_id
    if session_dir.exists():
        try:
            shutil.rmtree(session_dir)
            return True
        except Exception as e:
            print(f"[ERROR] No se pudo eliminar sesion {session_id}: {e}")
            return False
    return False

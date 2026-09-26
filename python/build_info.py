"""Build hash: cache y lectura de version.json - extraido de main.py (mejora #4 / E-02)."""
from __future__ import annotations

import json

from config import DIST_DIR

# ── BUILD HASH CACHE ─────────────────────────────────────────────────────────

_build_hash_cache: str | None = None


_build_hash_cache_time: float = 0.0


def _read_build_hash() -> str:
    """Lee build_hash de dist/version.json con caché de 60 segundos."""
    global _build_hash_cache, _build_hash_cache_time
    import time
    now = time.time()
    if _build_hash_cache and (now - _build_hash_cache_time) < 60:
        return _build_hash_cache

    version_file = DIST_DIR / "version.json"
    try:
        if version_file.exists():
            with open(version_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            _build_hash_cache = data.get("build_hash", "unknown")
            _build_hash_cache_time = now
            return _build_hash_cache
    except Exception:
        pass
    _build_hash_cache = "unknown"
    _build_hash_cache_time = now
    return _build_hash_cache


# ── DEBUG LOGGING Y TRACING ───────────────────────────────────────────────────

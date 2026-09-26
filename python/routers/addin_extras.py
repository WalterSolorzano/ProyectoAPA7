"""Add-in y estado - extraido de main.py (mejora #4 / E-02)."""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import List, Optional

from build_info import _read_build_hash
from config import STORAGE_DIR
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["addin"])


_ADDIN_LAST_SEEN: dict = {}


@router.post("/api/addin/heartbeat")
async def addin_heartbeat() -> dict:
    import time as _t
    _ADDIN_LAST_SEEN["ts"] = _t.time()
    return {"ok": True}


@router.get("/api/addin/sideload-status-v2")
async def addin_sideload_status_v2() -> dict:
    import time as _t
    age = None
    if _ADDIN_LAST_SEEN.get("ts"):
        age = round(_t.time() - _ADDIN_LAST_SEEN["ts"], 1)
    return {"installed": True, "heartbeat_age_s": age,
            "active_in_word": age is not None and age < 120}


class OpenLocalReq(BaseModel):
    path: str


@router.post("/api/open-local")
async def open_local_document(req: OpenLocalReq) -> dict:
    """Flujo click-derecho: abre un .docx local (misma maquina)."""
    src = Path(req.path)
    if not src.exists() or src.suffix.lower() != ".docx":
        raise HTTPException(status_code=400, detail="Archivo .docx no encontrado")
    import io as _io

    from fastapi import UploadFile as _UF
    from routers.sessions import upload_docx
    _up = _UF(file=_io.BytesIO(src.read_bytes()), filename=src.name)
    return await upload_docx(_up)


class FormatPlanReq(BaseModel):
    texts: List[str] = []
    full: bool = False


class CaptionsPlanReq(BaseModel):
    texts: List[str] = []
    tables: List[int] = []   # indices de tablas (orden documento)
    figures: List[int] = []  # indices de parrafos con imagen


@router.post("/api/addin/captions-plan")
async def addin_captions_plan(req: CaptionsPlanReq) -> dict:
    """Que captions FALTAN y con que numero (serie continua, idempotente)."""
    from modules.captions import scan_existing
    base = scan_existing(req.texts)
    nt, nf = base["max_table"], base["max_figure"]
    ops = []
    for i in req.tables:
        nt += 1
        ops.append({"i": i, "kind": "table", "number": nt})
    for i in req.figures:
        nf += 1
        ops.append({"i": i, "kind": "figure", "number": nf})
    return {"ops": ops}


@router.post("/api/addin/format-plan")
async def addin_format_plan(req: FormatPlanReq) -> dict:
    """Piso de portada + reglas desde el MOTOR CENTRAL.
    El add-in ejecuta; nunca decide formato ni limites por su cuenta."""
    import re as _re

    from modules.apa_rules import RULES

    def _floor(texts: List[str]) -> int:
        for i, t in enumerate(texts[:60]):
            s = (t or "").strip()
            if not s:
                continue
            low = s.lower().rstrip(":")
            if low in ("introduccion", "introducci?n", "resumen", "abstract") or _re.match(r"^\d+(\.\d+)*\.?\s+\S", s):
                return i
            if len(s) > 180 or _re.search(r"\([A-Z??????][^)]{2,40},\s*(19|20)\d{2}\)", s):
                return i
        return 0

    if req.full:
        from modules.plan_engine import classify
        from modules.plan_engine import findings as _findings
        plan = classify(req.texts)
        plan["findings"] = _findings(req.texts, plan["floor"])
        return plan
    return {"floor": _floor(req.texts), "rules": RULES}


@router.post("/api/addin/setup-catalog")
async def addin_setup_catalog() -> dict:
    from routers.addin_static import _purge_wef_cache_full, _setup_trusted_catalog
    cat = _setup_trusted_catalog()
    purged = _purge_wef_cache_full()
    return {"catalog": cat, "wef_purged": purged}

# ????????????????????????? fin bloque add-in bridge ?????????????????????????


# â”€â”€ Contrato add-in: rutas que core_server tambiÃ©n expone (TIER_BOTH) â”€â”€â”€â”€â”€â”€â”€â”€
# Estas vivÃ­an SOLO en core_server y el add-in recibÃ­a 404 cuando lo servÃ­a
# la app completa (clase de bug detectada por test_addin_contract_parity).

_BOOT_TS = time.time()


class AddinScoreReq(BaseModel):
    texts: List[str] = []
    tables: int = 0
    figures: int = 0
    visual: Optional[dict] = None


@router.post("/api/addin/apa-score")
async def addin_apa_score(req: AddinScoreReq) -> dict:
    """Score 'quÃ© tan APA estÃ¡' â€” misma implementaciÃ³n que core_server."""
    from modules.apa_score import compute
    return compute(req.texts, req.tables, req.figures, req.visual)


class OpenInWordReq(BaseModel):
    path: str


@router.post("/api/open-in-word")
async def open_in_word_endpoint(req: OpenInWordReq) -> dict:
    """Rescate: abre un .docx del almacenamiento con su app predeterminada (Word).

    Guard idÃ©ntico al core_server (config.validate_open_in_word_path): solo
    se permiten .docx dentro de STORAGE_DIR del proceso."""
    from config import validate_open_in_word_path
    try:
        target = validate_open_in_word_path(req.path)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    if not target.exists():
        raise HTTPException(400, "Archivo no encontrado")
    os.startfile(str(target))
    return {"ok": True}


@router.get("/api/addin/build-info")
async def addin_build_info() -> dict:
    """Anti-stale: el taskpane compara su build con este y avisa si difieren."""
    return {
        "mode": "app",
        "version": "1.0.0",
        "build_hash": _read_build_hash(),
        "started_at": _BOOT_TS,
    }


@router.get("/api/addin/ssl-status")
async def get_addin_ssl_status():
    """
    Informa si el backend esta corriendo con HTTPS (necesario para Word Add-ins).

    El frontend puede consultar este endpoint al iniciar para saber si el
    certificado SSL ya esta disponible. La generacion principal usa el modulo
    Python ``ssl_cert_gen`` (libreria cryptography); mkcert es solo un respaldo.
    """
    import shutil

    certs_dir = STORAGE_DIR / "ssl"
    cert_path = certs_dir / "localhost.pem"
    key_path = certs_dir / "localhost-key.pem"
    mkcert_available = shutil.which("mkcert") is not None

    # El generador Python (cryptography) es el metodo principal.
    try:
        import ssl_cert_gen  # noqa: F401
        python_ssl_available = True
    except Exception:
        python_ssl_available = False

    ssl_active = cert_path.exists() and key_path.exists()

    use_ssl_enabled = os.environ.get("WORDAPA7_USE_SSL", "").strip().lower() != "false" and not os.environ.get("WORDAPA7_ADDIN_PUBLIC_URL", "").strip()
    addin_public_url = os.environ.get("WORDAPA7_ADDIN_PUBLIC_URL", "").strip() or None

    if use_ssl_enabled:
        backend_url = "https://127.0.0.1:8742"
    else:
        backend_url = os.environ.get("WORDAPA7_BACKEND_URL", "").strip() or "http://127.0.0.1:8742"

    return {
        "ssl_active": ssl_active,
        "python_ssl_available": python_ssl_available,
        "mkcert_available": mkcert_available,
        "cert_path": str(cert_path) if cert_path.exists() else None,
        "install_url": "https://github.com/FiloSottile/mkcert#installation",
        "hint": (
            "SSL activo â€” el Add-in puede cargar en Word sin problemas"
            if ssl_active
            else "El certificado SSL se genera automaticamente con cryptography al iniciar el backend"
        ),
        "mode": "dev_https" if use_ssl_enabled else "production_http",
        "use_ssl_enabled": use_ssl_enabled,
        "backend_url": backend_url,
        "addin_public_url": addin_public_url,
    }


@router.get("/api/addin/config")
async def get_addin_config():
    """
    Devuelve la configuraciÃ³n de conexiÃ³n del backend para el Add-in.

    En MODO PRODUCCIÃ“N (por defecto):
      - El Add-in se carga desde una URL HTTPS pÃºblica (WORDAPA7_ADDIN_PUBLIC_URL)
      - El backend corre localmente en http://127.0.0.1:8742 (HTTP plano)
      - El frontend del Add-in usa esta URL para las llamadas a la API

    En MODO DESARROLLO HTTPS (WORDAPA7_USE_SSL=true):
      - El backend genera certificados SSL auto-firmados
      - El Add-in se sirve desde el propio backend en HTTPS
    """
    addin_public_url = os.environ.get("WORDAPA7_ADDIN_PUBLIC_URL", "").strip() or None
    use_ssl = os.environ.get("WORDAPA7_USE_SSL", "").strip().lower() != "false" and not addin_public_url

    # Determinar la URL del backend que el frontend debe usar
    if use_ssl:
        backend_url = "https://127.0.0.1:8742"
    else:
        backend_url = os.environ.get("WORDAPA7_BACKEND_URL", "").strip() or "http://127.0.0.1:8742"

    return {
        "mode": "dev_https" if use_ssl else "production_http",
        "use_ssl": use_ssl,
        "backend_url": backend_url,
        "addin_public_url": addin_public_url,
        "port": 8742,
        "hint": (
            "Add-in cargado desde URL HTTPS pÃºblica â†’ backend local HTTP"
            if not use_ssl and addin_public_url
            else "Modo desarrollo HTTPS local" if use_ssl
            else "Backend en HTTP plano â€” configura WORDAPA7_ADDIN_PUBLIC_URL para producciÃ³n"
        ),
    }

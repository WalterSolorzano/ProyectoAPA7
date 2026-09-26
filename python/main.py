"""
WordAPA7 — Servidor Principal FastAPI

Servidor Web unificado que expone los endpoints REST para la manipulacion de documentos
y sirve la interfaz estatica construida en React (dist/).
"""

import datetime
import hashlib
import json
import logging
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Optional

# Asegurar que el directorio de este script esté en sys.path
_current_dir = str(Path(__file__).resolve().parent)
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Restaurar claves de IA guardadas por el usuario (sobreviven a reinicios del backend)
try:
    from persistence.ai_keys import load_provider_keys_into_env
    _restored = load_provider_keys_into_env()
    if _restored:
        print(f"[AI] {_restored} claves de IA restauradas desde almacenamiento persistente")
except Exception as _e:
    print(f"[WARN] No se pudieron restaurar claves persistidas de IA: {_e}")

# Fallback: claves de IA embebidas (ofuscadas) que viajan en el instalador,
# para que funcione sin que el usuario configure nada. Prioridad menor a las
# anteriores (solo se usan las que ya no esten definidas en os.environ).
try:
    from embedded_secrets import load_embedded_into_env
    _emb = load_embedded_into_env()
    if _emb:
        print(f"[AI] {_emb} claves de IA cargadas desde paquete embebido (ofuscadas)")
except Exception as _e2:
    print(f"[WARN] No se pudieron cargar las claves embebidas de IA: {_e2}")

from fastapi import (
    FastAPI,
    HTTPException,
    Request,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

# Asegurar path de importacion
sys.path.insert(0, str(Path(__file__).resolve().parent))


# ── CONFIGURACION Y RUTAS DE ALMACENAMIENTO ──────────────────────────────────
import build_info
from build_info import _read_build_hash
from config import BASE_DIR, DIST_DIR, STORAGE_DIR, get_apa7_template_path
from create_template import ensure_apa7_template
from persistence.session_manager import (
    maybe_run_gc,
)

STORAGE_DIR.mkdir(exist_ok=True)


from contextlib import asynccontextmanager

from services.word_com_service import get_word_com_service


@asynccontextmanager
async def lifespan_app(app: FastAPI):
    # Limpieza inicial de sesiones expiradas al arrancar el servidor (P1.4).
    # maybe_run_gc está acelerado (GC_INTERVAL_SECONDS) y es seguro llamarlo aquí.
    try:
        maybe_run_gc(STORAGE_DIR)
    except Exception as e:
        print(f"[WARN] GC inicial de sesiones falló: {e}")

    # Generar/actualizar manifest.xml dinámico en STORAGE_DIR al arrancar (sideload local)
    try:
        from routers.addin_static import (
            _DEV_ADDIN_URL,
            _DEV_ADDIN_URLS,
            _get_addin_manifest_path,
            _resolve_addin_base_url,
        )
        manifest_src = _get_addin_manifest_path()
        if manifest_src and manifest_src.exists():
            dest_manifest = STORAGE_DIR / "manifest.xml"
            xml_content = manifest_src.read_text(encoding="utf-8")
            addin_base_url = _resolve_addin_base_url()
            xml_content = xml_content.replace(_DEV_ADDIN_URL, addin_base_url)
            for _old_url in _DEV_ADDIN_URLS:
                xml_content = xml_content.replace(_old_url, addin_base_url)
            dest_manifest.write_text(xml_content, encoding="utf-8")
            print(f"[INFO] [ADD-IN] Manifiesto generado en: {dest_manifest} -> apuntando a {addin_base_url}")
        else:
            print("[WARN] [ADD-IN] No se encontró el manifest.xml original de origen para copiar.")
    except Exception as e:
        print(f"[ERROR] [ADD-IN] Error al generar manifest.xml en almacenamiento: {e}")

    yield
    # Shutdown: liberar Word COM heredado del bridge del add-in (antes
    # @app.on_event("shutdown"), deprecated — migrado al lifespan).
    if _rwa:
        try:
            _rwa(force=False)
        except Exception as e:
            print(f"[WARN] release_word_app fallo en shutdown: {e}")
    print("[INFO] Deteniendo LibreOffice service...")
    get_libreoffice_service().stop()
    print("[INFO] Deteniendo Word COM service...")
    get_word_com_service().stop()

app = FastAPI(title="WordAPA7 API", version="1.0.0", lifespan=lifespan_app)

from services.lo_service import get_libreoffice_service

# CORS middleware para desarrollo con Vite.
#  Antes se usaba allow_origins=["*"] con allow_credentials=True, lo cual
# es inseguro y viola la especificación CORS. Ahora se restringe a orígenes
# explícitos configurables vía WORDAPA7_ALLOWED_ORIGINS (CSV), con defaults
# seguros para desarrollo local (Vite# Enable CORS for the local Vite dev server and the Electron packaged app
_DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8742",
    "http://127.0.0.1:8742",
    "app://-",
]

# Produccion: el add-in puede servirse desde URL publica (WORDAPA7_ADDIN_PUBLIC_URL)
# y llama al backend local en loopback => su origen debe entrar a la allowlist.
from urllib.parse import urlparse as _urlparse

_public_addin = os.environ.get("WORDAPA7_ADDIN_PUBLIC_URL", "").strip()
if _public_addin:
    _p = _urlparse(_public_addin if "//" in _public_addin else "https://" + _public_addin)
    if _p.netloc:
        _origin = f"{_p.scheme or 'https'}://{_p.netloc}"
        if _origin not in _DEFAULT_ALLOWED_ORIGINS:
            _DEFAULT_ALLOWED_ORIGINS.append(_origin)


_env_origins = os.environ.get("WORDAPA7_ALLOWED_ORIGINS", "").strip()
_allowed_origins = (
    [o.strip() for o in _env_origins.split(",") if o.strip()]
    if _env_origins
    else _DEFAULT_ALLOWED_ORIGINS
)
app.add_middleware(
    CORSMiddleware,
    # Allowlist explícita (el comentario histórico ya lo prometía). "*" con
    # credenciales es inválido y expone la API local a cualquier página web
    # abierta en el navegador del usuario (drive-by CSRF hacia 127.0.0.1).
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from security.auth import APIKeyAuthMiddleware

app.add_middleware(APIKeyAuthMiddleware)

from routers import admin

app.include_router(admin.router)

# ── WORD ADD-IN ROUTERS (Office.js) ──────────────────────────────────────────
# Endpoints del Task Pane que vive dentro de Microsoft Word + archivos estaticos.
from routers import addin

app.include_router(addin.router)

from routers import addin_static

app.include_router(addin_static.router)

# ── PROOFREAD BATCH ROUTER (revisor proactivo: ortografia/IA/pegado) ──────────
from routers import proofread

app.include_router(proofread.router)

from routers import pagination as pagination_router

app.include_router(pagination_router.router)
from routers import presets as presets_router

app.include_router(presets_router.router)
from routers import spec as spec_router

app.include_router(spec_router.router)
from routers import ws as ws_router

app.include_router(ws_router.router)
from routers import sessions as sessions_router

app.include_router(sessions_router.router)
from routers import addin_extras as addin_extras_router

app.include_router(addin_extras_router.router)
from routers import system as system_router

app.include_router(system_router.router)
from routers import ai as ai_router

app.include_router(ai_router.router)
from routers import generation as generation_router

app.include_router(generation_router.router)
from routers import references as references_router

app.include_router(references_router.router)
from routers import cover_templates as cover_templates_router

app.include_router(cover_templates_router.router)

# ????????????????????????? WordAPA7 add-in bridge & infra (2026-08) ?????????????????????????
try:
    from modules.word_com import release_word_app as _rwa
except Exception:
    _rwa = None

# ── ERROR HANDLERS ESTANDARIZADOS ─────────────────────────────────────────────

def api_error(status_code: int, detail: str, error_type: str = "validation_error") -> JSONResponse:
    """Standardized error response with request tracing info."""
    return JSONResponse(
        status_code=status_code,
        content={
            "error": True,
            "type": error_type,
            "detail": detail,
            "timestamp": __import__('datetime').datetime.utcnow().isoformat() + "Z",
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "type": "http_error",
            "detail": exc.detail,
            "request_id": getattr(request.state, 'request_id', None),
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": True,
            "type": "validation_error",
            "detail": str(exc.errors()),
            "request_id": getattr(request.state, 'request_id', None),
        }
    )


# ── PROVIDER STATUS ENDPOINT ──────────────────────────────────────────────────

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "ts": datetime.datetime.fromtimestamp(record.created).astimezone().isoformat(),
            "level": record.levelname.lower(),
            "module": record.name,
            "msg": record.getMessage()
        }
        if record.exc_info:
            log_record["msg"] += f" | Exception: {self.formatException(record.exc_info)}"
        return json.dumps(log_record)

# Determine the log file path based on APP_USERDATA env var or default STORAGE_DIR
user_data_dir = os.environ.get('APP_USERDATA', str(STORAGE_DIR))
log_file_path = os.path.join(user_data_dir, 'python-backend.log')

# Log rotativo (máx. 5 MB por archivo, 3 copias): el log NO debe crecer sin límite.
from logging.handlers import RotatingFileHandler

file_handler = RotatingFileHandler(
    log_file_path, maxBytes=5 * 1024 * 1024, backupCount=3, encoding='utf-8'
)
file_handler.setFormatter(JsonFormatter())

stream_handler = logging.StreamHandler()
stream_handler.setFormatter(JsonFormatter())

logging.basicConfig(
    level=logging.DEBUG,
    handlers=[file_handler, stream_handler]
)

logger = logging.getLogger('wordapa7')


@app.middleware("http")
async def debug_logging_middleware(request: Request, call_next):
    """Log ALL requests and responses for debugging (pre-production)."""
    request_id = uuid.uuid4().hex[:8]
    start = time.time()

    logger.info(f"[REQ {request_id}] {request.method} {request.url.path}")

    response = await call_next(request)

    duration_ms = (time.time() - start) * 1000
    logger.info(
        f"[RES {request_id}] {response.status_code} | "
        f"Duration: {duration_ms:.1f}ms"
    )

    response.headers["X-Request-ID"] = request_id
    return response





# ── SERVIR FRONTEND ESTATICO ──────────────────────────────────────────────────

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path

    # X-Build-Hash en todas las respuestas para debug
    build_hash = _read_build_hash()
    response.headers["X-Build-Hash"] = build_hash

    # Estrategia de caché por tipo de archivo
    if path == "/" or path.endswith("/index.html") or path.endswith("version.json"):
        # HTML raíz y manifest NUNCA se cachean
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    elif path.startswith("/assets/"):
        # Assets con hash de Vite (inmutables por build) → 24h
        if any(ext in path for ext in (".js", ".css", ".woff", ".woff2", ".ttf")):
            response.headers["Cache-Control"] = "public, max-age=86400, immutable"
        else:
            response.headers["Cache-Control"] = "public, max-age=3600, must-revalidate"
    elif any(path.endswith(ext) for ext in (".js", ".css", ".json", ".svg", ".png", ".jpg", ".ico", ".woff2")):
        # Otros archivos estáticos
        response.headers["Cache-Control"] = "public, max-age=3600, must-revalidate"

    return response


def _compute_src_content_hash(src_dir: Path) -> str:
    """Hash SHA-256 compuesto del contenido de src/ para detectar cambios reales."""
    if not src_dir.exists():
        return "no-src"
    h = hashlib.sha256()
    for fp in sorted(src_dir.rglob("*")):
        if fp.is_file() and "node_modules" not in fp.parts:
            rel = fp.relative_to(src_dir).as_posix()
            h.update(rel.encode())
            try:
                with open(fp, "rb") as f:
                    while chunk := f.read(65536):
                        h.update(chunk)
            except Exception:
                pass
    return h.hexdigest()[:12]


def check_and_auto_build_frontend() -> None:
    """
    Verifica si el frontend necesita recompilación comparando hash de contenido
    de src/ contra el build_hash guardado en dist/version.json.
    Si dist/ no existe, version.json no existe, o los hashes difieren, hace rebuild.
    """
    src_dir = BASE_DIR / "src"
    dist_index = BASE_DIR / "dist" / "index.html"
    version_file = BASE_DIR / "dist" / "version.json"

    if not src_dir.exists():
        return

    should_build = False
    reason = ""

    if not dist_index.exists():
        should_build = True
        reason = "dist/index.html no existe"
    elif not version_file.exists():
        should_build = True
        reason = "dist/version.json no existe (build manifest)"
    else:
        # Comparar hash de contenido de src/ contra el src_hash guardado por
        # build_manifest.py en el momento del build (mismo algoritmo, mismos archivos).
        src_hash = _compute_src_content_hash(src_dir)
        try:
            with open(version_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            stored_src_hash = data.get("src_hash", "")
        except Exception:
            stored_src_hash = ""

        if stored_src_hash == "":
            should_build = True
            reason = "version.json sin src_hash (manifest de build anterior)"
        elif src_hash != stored_src_hash:
            should_build = True
            reason = f"src_hash={src_hash} != src_hash={stored_src_hash} (cambios detectados en c\u00f3digo fuente)"

    if should_build:
        print(f"[AUTO-BUILD] {reason}. Recompilando con 'npm run build'...")
        try:
            cmd = ["npm.cmd", "run", "build"] if os.name == 'nt' else ["npm", "run", "build"]
            res = subprocess.run(cmd, cwd=str(BASE_DIR), capture_output=True, text=True)
            if res.returncode == 0:
                print("[AUTO-BUILD] [OK] Recompilacion exitosa del frontend!")
                # Invalidar caché de build_hash
                build_info._build_hash_cache = None
                build_info._build_hash_cache_time = 0.0
            else:
                print(f"[WARN] Error durante npm run build: {res.stderr[:200]}")
        except Exception as e:
            print(f"[WARN] No se pudo ejecutar npm run build automáticamente: {e}")


# Montar archivos estaticos del Word Add-in (Office.js) en /addin/.
# Debe ir ANTES del montaje catch-all del SPA para que las rutas /addin/*
# sean interceptadas correctamente por Starlette.
from routers.addin_static import init_addin_static

init_addin_static(app)

if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="static")
else:
    @app.get("/")
    async def serve_index():
        return JSONResponse({
            "message": (
                "Servidor backend de WordAPA7 listo. "
                "Construye la UI con 'npm run build' para servir la interfaz estatica aqui."
            ),
        })


# ── INICIO DEL SERVIDOR ────────────────────────────────────────────────────────

def _setup_ssl_for_addin() -> tuple[Optional[Path], Optional[Path]]:
    """
    Genera certificados SSL auto-firmados para el Word Add-in.

    Office Add-ins requieren HTTPS incluso en localhost. Esta funcion sigue
    una estrategia de respaldo en cascada:

    1. PRIMERO intenta generar los certs con el modulo Python ``ssl_cert_gen``
       (usa la libreria ``cryptography``, incluida en el instalador). NO
       depende de herramientas CLI externas, asi que funciona en cualquier
       maquina sin instalacion adicional.
    2. Si eso falla, recurre a ``mkcert`` (CLI externa) si esta en el PATH
       (instalada por setup.bat o manualmente).
    3. Si ambos fallan, retorna ``(None, None)`` y el backend corre en HTTP
       (Word puede rechazar el Add-in).

    Los certs persisten entre reinicios en ``STORAGE_DIR/ssl/`` (AppData del
    usuario en produccion) y no se regeneran si ya existen y son validos.

    Retorna: (cert_path, key_path) o (None, None).
    """
        # ── SSL es el COMPORTAMIENTO POR DEFECTO en Windows ─────────
    # Office Add-ins REQUIEREN HTTPS incluso en localhost. Sin SSL, Word
    # rechaza el Add-in (panel en blanco o no aparece). El módulo
    # ssl_cert_gen genera certificados auto-firmados y los instala
    # silenciosamente en el Trusted Root store de Windows via CryptoAPI.
    #
    # SSL se DESACTIVA solo si:
    #   1. WORDAPA7_USE_SSL=false (desactivación explícita)
    #   2. WORDAPA7_ADDIN_PUBLIC_URL está seteada (modo producción con URL pública HTTPS)
    public_url = os.environ.get("WORDAPA7_ADDIN_PUBLIC_URL", "").strip()
    ssl_disabled = os.environ.get("WORDAPA7_USE_SSL", "").strip().lower() == "false"

    if ssl_disabled or public_url:
        if public_url:
            print(f"[SSL] Desactivado — Add-in servido desde URL pública: {public_url}")
        else:
            print("[SSL] Desactivado explícitamente (WORDAPA7_USE_SSL=false)")
        return None, None

    import shutil
    import subprocess as _sp

    certs_dir = STORAGE_DIR / "ssl"
    cert_path = certs_dir / "localhost.pem"
    key_path = certs_dir / "localhost-key.pem"

    # ------------------------------------------------------------------
    # 1. Intento: generador Python puro (libreria cryptography).
    #    No requiere herramientas externas; funciona en el instalador
    #    empaquetado con PyInstaller. Maneja idempotencia internamente:
    #    si los certs ya existen y son validos (no expirados, clave
    #    coherente), los reutiliza sin regenerar.
    # ------------------------------------------------------------------
    try:
        from ssl_cert_gen import generate_self_signed_cert
    except Exception as _e:
        print(f"[SSL] No se pudo importar el modulo ssl_cert_gen: {_e}")
        generate_self_signed_cert = None

    if generate_self_signed_cert is not None:
        _cert, _key = generate_self_signed_cert(cert_path, key_path)
        if _cert is not None and _key is not None:
            return _cert, _key
        print("[SSL] El generador Python (cryptography) fallo — intentando mkcert como respaldo...")
    else:
        print("[SSL] ssl_cert_gen no disponible — intentando mkcert como respaldo...")

    # ------------------------------------------------------------------
    # 2. Respaldo: mkcert (CLI externa).
    #    Se conserva para compatibilidad con instalaciones donde mkcert ya
    #    estaba configurado y su CA raiz confia en el sistema.
    # ------------------------------------------------------------------

    # Reutilizar certs existentes si el generador Python no estuvo disponible.
    if cert_path.exists() and key_path.exists():
        print(f"[SSL] Reutilizando certificados Add-in existentes: {cert_path}")
        return cert_path, key_path

    mkcert_bin = shutil.which("mkcert")
    if not mkcert_bin:
        print(
            "[SSL] mkcert tampoco esta disponible — el Add-in correra en HTTP "
            "(Word puede rechazarlo). El generador Python (cryptography) deberia "
            "ser suficiente; revisa los logs de [SSL] arriba."
        )
        return None, None

    # Generar certificados con mkcert
    certs_dir.mkdir(parents=True, exist_ok=True)
    try:
        # Instalar CA local (si no esta ya instalada; mkcert -install es idempotente)
        _sp.run([mkcert_bin, "-install"], check=True, capture_output=True, timeout=30)
        # Generar cert para localhost / 127.0.0.1
        _sp.run(
            [mkcert_bin, "-key-file", str(key_path), "-cert-file", str(cert_path),
             "localhost", "127.0.0.1"],
            check=True,
            cwd=str(certs_dir),
            capture_output=True,
            timeout=30,
        )
        print(f"[SSL] Certificados Add-in generados con mkcert: {cert_path}")
        return cert_path, key_path
    except Exception as e:
        print(f"[SSL] Error al generar certificados con mkcert: {e}")
        return None, None

def _backend_already_running(port: int) -> bool:
    """Detecta si ya hay una instancia del backend respondiendo en 127.0.0.1:<port>.

    Prueba HTTPS primero (aceptando el certificado auto-firmado) y luego HTTP.
    Si /api/version responde 200, otra instancia vive (arrancada por el watcher,
    la app Electron o manualmente) y esta NO debe arrancar: pelear por el bind
    produce [Errno 10048], crash-loop del watchdog y churn de servicios
    (Word COM / LibreOffice) que desestabiliza todo el sistema.
    """
    import http.client

    try:
        import ssl as _ssl
        ctx = _ssl._create_unverified_context()
    except Exception:
        ctx = None

    for use_tls in (True, False):
        try:
            if use_tls and ctx is not None:
                conn = http.client.HTTPSConnection("127.0.0.1", port, context=ctx, timeout=2)
            else:
                conn = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
            conn.request("GET", "/api/version")
            resp = conn.getresponse()
            ok = resp.status == 200
            resp.read()
            conn.close()
            if ok:
                return True
        except Exception:
            continue
    return False




def _port_in_use(port: int) -> bool:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sk:
        sk.settimeout(0.4)
        return sk.connect_ex(("127.0.0.1", port)) == 0


if __name__ == "__main__":
    import argparse

    # En builds empaquetados (PyInstaller, console=False) los streams pueden ser
    # None y uvicorn crashea al configurar logging (sys.stderr.isatty()).
    import os

    import uvicorn
    if sys.stdout is None or sys.stderr is None:
        devnull = open(os.devnull, "w")
        if sys.stdout is None:
            sys.stdout = devnull
        if sys.stderr is None:
            sys.stderr = devnull

    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8742, help='Port to run the server on')
    parser.add_argument('--watcher', action='store_true',
                        help='Run as lightweight Word watcher (starts backend when Word opens, stops when closed)')
    args, unknown = parser.parse_known_args()

    # Modo Watcher: proceso ligero que detecta Word y arranca el backend.
    # Si se pasa --watcher, NO arrancamos uvicorn. En su lugar, ejecutamos
    # el bucle del watcher (word_watcher.py) que monitorea si Word esta
    # abierto y arranca/detiene el backend segun sea necesario.
    # Esto permite que el mismo ejecutable (python-backend.exe en produccion)
    # funcione tanto como servidor como como watcher.
    if args.watcher:
        from word_watcher import run_watcher
        run_watcher()
        sys.exit(0)

    # 0. Single-instance: si ya hay un backend sano en este puerto, salir
    # limpio en vez de pelear por el bind (evita [Errno 10048] + crash-loop).
    if _backend_already_running(args.port):
        print(f"[BACKEND] Instancia ya activa en el puerto {args.port} — saliendo (single-instance).")
        sys.exit(0)

    # 1. Verificar y recompilar frontend si hubo cambios en src/
    check_and_auto_build_frontend()

    # 2. Crear o verificar la plantilla inicial (una sola ruta de generacion)
    try:
        template_path: Path = ensure_apa7_template(get_apa7_template_path())
        print(f"[INFO] Plantilla APA 7 verificada en: {template_path}")
    except Exception as e:
        print(f"[WARN] No se pudo crear la plantilla APA 7: {e}")

    # 3. Configurar SSL para el Word Add-in (requiere mkcert instalado)
    ssl_certfile, ssl_keyfile = _setup_ssl_for_addin()

    print("=" * 60)
    protocol = "https" if ssl_certfile else "http"
    print(f" WordAPA7 — Servidor iniciado en {protocol}://localhost:{args.port}")
    if ssl_certfile:
        print(" Modo: DESARROLLO HTTPS (SSL activo)")
        print(" Add-in HTTPS: ACTIVO — sirve el panel en HTTPS local")
    else:
        addin_pub = os.environ.get("WORDAPA7_ADDIN_PUBLIC_URL", "").strip()
        if addin_pub:
            print(f" Modo: PRODUCCION (Add-in desde {addin_pub})")
            print(f" Backend API: http://127.0.0.1:{args.port} (HTTP plano)")
            print(" El Add-in se carga desde la URL publica y llama a este backend local.")
        else:
            print(" Modo: LOCAL HTTPS (SSL automatico)")
            print(f" Backend API: https://127.0.0.1:{args.port}")
            print(" Add-in: se sirve desde el backend en HTTPS. Word deberia cargarlo sin problemas.")
            print(" El complemento se registra automaticamente en Word al iniciar.")
    print(" Presiona Ctrl+C para detener")
    print("=" * 60)

    if ssl_certfile and ssl_keyfile:
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=args.port,
            ssl_certfile=str(ssl_certfile),
            ssl_keyfile=str(ssl_keyfile),
        )
    else:
        uvicorn.run(app, host="127.0.0.1", port=args.port)

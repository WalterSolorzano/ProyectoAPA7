"""
WordAPA7 — Watcher Ligero de Segundo Plano
==========================================

Proceso en segundo plano de BAJISIMO consumo que:

1. Se inicia automaticamente al iniciar sesion en Windows (registro Run).
2. Arranca el backend Python INMEDIATAMENTE al iniciar (pre-carga), sin
   esperar a que Word abra. Esto resuelve una race condition: Word intenta
   cargar el add-in desde https://localhost:8742/addin/taskpane.html y, si
   el backend no esta listo, el add-in falla al cargar.
3. Monitorea si Microsoft Word esta abierto (poll WINWORD.EXE cada 5s).
4. Si el backend se cayo y Word esta abierto, lo reinicia (recuperacion).
5. Llama a /api/addin/auto-setup para registrar el complemento en Word.
6. Cuando Word se cierra (y Electron tampoco esta), espera 60s y detiene
   el backend para ahorrar recursos.
7. Si Word se reabre dentro del periodo de gracia, cancela el apagado.

ESTRATEGIA DE PRE-CARGA:
El backend se inicia en cuanto el watcher arranca (login de Windows), NO
cuando se detecta Word. El proceso Python del backend es ligero (~30-50MB
RAM). Las partes pesadas (LibreOffice, Word COM) se inicializan bajo
demanda dentro del backend. Asi, cuando Word abre e intenta cargar el
add-in, el backend ya esta respondiendo en el puerto 8742.

Consumo: ~8-12 MB RAM, ~0% CPU (solo un tasklist cada 5 segundos).

Se ejecuta con pythonw.exe (sin ventana de consola) en desarrollo,
o como ``python.exe main.py --watcher`` en produccion (Python embebido).

Registro en inicio de Windows:
  HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\WordAPA7Watcher
  (sin permisos de administrador, instalacion por usuario)

Coordina con la app Electron:
  - Si Electron ya arranco el backend, el watcher lo detecta y no duplica.
  - Si el watcher arranco el backend y despues se abre Electron, Electron
    detecta el backend ya corriendo y no spawnea otro.
  - El backend solo se detiene si NI Word NI Electron estan abiertos.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import socket
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

# ── CONFIGURACION ────────────────────────────────────────────────────────────

BACKEND_PORT = 8742
POLL_INTERVAL = 5          # segundos entre chequeos de Word
SHUTDOWN_GRACE = 60        # segundos tras cerrar Word antes de detener backend
BACKEND_STARTUP_WAIT = 3   # segundos de espera inicial tras lanzar el backend
HEALTH_TIMEOUT = 2         # timeout para health check del backend
AUTO_SETUP_DELAY = 3       # delay antes de llamar auto-setup (dar tiempo al manifest)
AUTO_SETUP_RETRIES = 3     # reintentos de auto-setup
AUTO_SETUP_RETRY_DELAY = 3  # segundos entre reintentos


# ── DETECCION DE ENTORNO ─────────────────────────────────────────────────────


def _is_packaged() -> bool:
    """Detecta si estamos corriendo en el paquete Electron de produccion.

    Soporta DOS modos de empaquetado:
    1. PyInstaller (legacy): sys.frozen == True
    2. Python embebido (actual): python.exe oficial esta en
       resources/python-runtime/ y el codigo fuente en
       resources/python-runtime/python/main.py.
    """
    if getattr(sys, "frozen", False):
        return True
    # Python embebido: python.exe esta junto a python/main.py
    exe_dir = Path(sys.executable).parent
    return (exe_dir / "python" / "main.py").exists()


# ── RUTAS ─────────────────────────────────────────────────────────────────────


def _get_base_dir() -> Path:
    """Directorio base del proyecto (padre de python/)."""
    if _is_packaged():
        if getattr(sys, "frozen", False):
            # PyInstaller legacy: exe en resources/python-backend/python-backend/
            return Path(sys.executable).parent.parent.parent.parent
        # Python embebido: python.exe en resources/python-runtime/
        # El codigo fuente esta en resources/python-runtime/python/
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent.parent


def _get_python_dir() -> Path:
    """Directorio donde esta main.py y word_watcher.py."""
    if _is_packaged():
        if getattr(sys, "frozen", False):
            # PyInstaller legacy
            return Path(sys.executable).parent
        # Python embebido: codigo en python-runtime/python/
        return Path(sys.executable).parent / "python"
    return Path(__file__).resolve().parent


def _get_storage_dir() -> Path:
    """Directorio de almacenamiento del usuario (AppData)."""
    appdata = os.environ.get("APPDATA", str(Path.home() / "AppData" / "Roaming"))
    return Path(appdata) / "WordAPA7" / "storage"


def _get_log_file() -> Path:
    """Ruta del archivo de log del watcher."""
    appdata = os.environ.get("APPDATA", str(Path.home() / "AppData" / "Roaming"))
    log_dir = Path(appdata) / "WordAPA7"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir / "watcher.log"


# ── LOGGING ───────────────────────────────────────────────────────────────────

_log_setup_done = False


def _setup_logging() -> logging.Logger:
    global _log_setup_done
    logger = logging.getLogger("wordapa7_watcher")
    if _log_setup_done:
        return logger
    _log_setup_done = True

    from logging.handlers import RotatingFileHandler

    handler = RotatingFileHandler(
        str(_get_log_file()),
        maxBytes=2 * 1024 * 1024,  # 2 MB
        backupCount=2,
        encoding="utf-8",
    )
    handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S")
    )
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger


log = _setup_logging()


# ── DETECCION DE PROCESOS ─────────────────────────────────────────────────────


def _is_process_running(process_name: str) -> bool:
    """
    Verifica si un proceso esta corriendo usando ``tasklist`` (Windows).

    No requiere psutil ni ninguna libreria externa — tasklist viene con
    Windows. Es rapido (~10ms) y no eleva CPU.
    """
    try:
        result = subprocess.run(
            ["tasklist", "/FI", f"IMAGENAME eq {process_name}", "/NH", "/FO", "CSV"],
            capture_output=True,
            text=True,
            timeout=5,
            creationflags=0x08000000 if sys.platform == "win32" else 0,  # CREATE_NO_WINDOW
        )
        return process_name.lower() in result.stdout.lower()
    except Exception:
        return False


def is_word_running() -> bool:
    """Verifica si Microsoft Word (WINWORD.EXE) esta corriendo."""
    return _is_process_running("WINWORD.EXE")


def is_electron_running() -> bool:
    """
    Verifica si la app Electron (WordAPA7.exe) esta corriendo.

    Si Electron esta abierto, el backend ya esta siendo gestionado por
    python-manager.ts — el watcher no debe detenerlo.
    """
    return _is_process_running("WordAPA7.exe")


# ── HEALTH CHECK DEL BACKEND ──────────────────────────────────────────────────


def _ssl_context() -> ssl.SSLContext:
    """Contexto SSL que acepta certificados auto-firmados (localhost)."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def is_backend_running() -> bool:
    """
    Verifica si el backend ya responde en el puerto 8742.

    Prueba HTTPS primero (el backend usa SSL por defecto) y HTTP como fallback.
    Usa urllib (stdlib) — no requiere requests ni httpx.
    """
    _ctx = _ssl_context()
    for proto in ("https", "http"):
        try:
            req = urllib.request.urlopen(
                f"{proto}://127.0.0.1:{BACKEND_PORT}/api/version",
                timeout=HEALTH_TIMEOUT,
                context=_ctx if proto == "https" else None,
            )
            if req.status == 200:
                return True
        except Exception:
            continue
    return False


# ── GESTION DEL BACKEND ───────────────────────────────────────────────────────


def _find_backend_executable() -> Optional[str]:
    """
    Encuentra el ejecutable o script del backend segun el entorno.

    - Produccion (Python embebido): python.exe + main.py en resources/python-runtime/
    - Produccion (PyInstaller legacy): el propio exe con --port
    - Desarrollo: venv/Scripts/pythonw.exe o pythonw del PATH
    """
    if _is_packaged():
        if getattr(sys, "frozen", False):
            # PyInstaller legacy: el backend es el mismo exe
            return sys.executable
        # Python embebido: python.exe + main.py
        exe_dir = Path(sys.executable).parent
        python_exe = exe_dir / "python.exe"
        core = exe_dir / "python" / "core_server.py"
        main_script = core if core.exists() else exe_dir / "python" / "main.py"
        if python_exe.exists() and main_script.exists():
            return f'"{python_exe}" "{main_script}"'
        return None

    python_dir = _get_python_dir()
    main_script = python_dir / "main.py"

    # Preferir pythonw.exe del venv (sin ventana de consola)
    venv_pythonw = _get_base_dir() / "venv" / "Scripts" / "pythonw.exe"
    if venv_pythonw.exists():
        return f'"{venv_pythonw}" "{main_script}"'

    # Fallback: pythonw del PATH
    pythonw = shutil.which("pythonw")
    if pythonw:
        return f'"{pythonw}" "{main_script}"'

    # Ultimo recurso: python del PATH (con ventana de consola, no ideal)
    python = shutil.which("python")
    if python:
        return f'"{python}" "{main_script}"'

    return None


def start_backend() -> Optional[subprocess.Popen]:
    """
    Inicia el backend Python en segundo plano (sin ventana de consola).

    Retorna el proceso Popen si se inicio correctamente, o None si fallo.
    """
    if _is_packaged():
        if getattr(sys, "frozen", False):
            # PyInstaller legacy: python-backend.exe --port 8742
            exe = sys.executable
            try:
                proc = subprocess.Popen(
                    [exe, "--port", str(BACKEND_PORT)],
                    creationflags=0x08000000,  # CREATE_NO_WINDOW
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    cwd=str(Path(exe).parent),
                )
                log.info(f"Backend iniciado (PyInstaller): {exe} --port {BACKEND_PORT} PID={proc.pid}")
                return proc
            except Exception as e:
                log.error(f"Error al iniciar backend (PyInstaller): {e}")
                return None

        # ── Python embebido (actual) ──────────────────────────────────────
        # Usamos python.exe (firmado por Python Software Foundation) en lugar
        # de un exe custom de PyInstaller que Windows Defender flaggea.
        exe_dir = Path(sys.executable).parent
        python_exe = exe_dir / "python.exe"
        main_script = exe_dir / "python" / "main.py"
        python_dir = exe_dir / "python"

        try:
            proc = subprocess.Popen(
                [str(python_exe), str(main_script), "--port", str(BACKEND_PORT)],
                creationflags=0x08000000,  # CREATE_NO_WINDOW
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                cwd=str(python_dir),
                env={
                    **os.environ,
                    "APP_USERDATA": str(_get_storage_dir().parent),
                },
            )
            log.info(
                f"Backend iniciado (Python embebido): {python_exe} main.py --port {BACKEND_PORT} "
                f"PID={proc.pid}"
            )
            return proc
        except Exception as e:
            log.error(f"Error al iniciar backend (Python embebido): {e}")
            return None

    # Desarrollo: pythonw.exe main.py --port 8742
    cmd_str = _find_backend_executable()
    if not cmd_str:
        log.error("No se encontro un interprete Python para iniciar el backend")
        return None

    python_dir = _get_python_dir()
    base_dir = _get_base_dir()
    main_script = python_dir / "main.py"

    # Buscar pythonw del venv o del PATH
    venv_pythonw = base_dir / "venv" / "Scripts" / "pythonw.exe"
    if venv_pythonw.exists():
        exe = str(venv_pythonw)
    else:
        exe = shutil.which("pythonw") or shutil.which("python") or "python"

    try:
        proc = subprocess.Popen(
            [exe, str(main_script), "--port", str(BACKEND_PORT)],
            creationflags=0x08000000,  # CREATE_NO_WINDOW
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=str(python_dir),
            env={
                **os.environ,
                # Asegurar que el backend sepa donde guardar datos
                "APP_USERDATA": str(_get_storage_dir().parent),
            },
        )
        log.info(f"Backend iniciado (dev): {exe} main.py --port {BACKEND_PORT} PID={proc.pid}")
        return proc
    except Exception as e:
        log.error(f"Error al iniciar backend (dev): {e}")
        return None


def stop_backend(backend_proc: Optional[subprocess.Popen]) -> None:
    """
    Detiene el backend de forma graceful.

    Si tenemos el proceso Popen (lo iniciamos nosotros), lo terminamos.
    Si no (lo inicio Electron), no hacemos nada — Electron lo gestiona.
    """
    if backend_proc is None:
        return

    try:
        backend_proc.terminate()
        try:
            backend_proc.wait(timeout=10)
            log.info("Backend detenido gracefully")
        except subprocess.TimeoutExpired:
            backend_proc.kill()
            backend_proc.wait(timeout=5)
            log.info("Backend detenido (kill forzado)")
    except Exception as e:
        log.warning(f"Error al detener backend: {e}")


# ── AUTO-SETUP DEL ADD-IN ──────────────────────────────────────────────────────


def call_auto_setup() -> Optional[dict]:
    """
    Llama al endpoint /api/addin/auto-setup del backend.

    Este endpoint hace TODO en una sola llamada:
    1. Genera el manifiesto XML con URLs HTTPS correctas
    2. Lo registra en el registro de Windows (sideload de Word)
    3. Copia el manifiesto a un catalogo compartido (fallback)
    4. Verifica el certificado SSL

    Tiene reintentos porque el backend puede tardar unos segundos en
    tener el manifiesto listo despues de responder al health check.
    """
    _ctx = _ssl_context()
    for attempt in range(1, AUTO_SETUP_RETRIES + 1):
        for proto in ("https", "http"):
            try:
                req = urllib.request.urlopen(
                    f"{proto}://127.0.0.1:{BACKEND_PORT}/api/addin/auto-setup",
                    timeout=10,
                    context=_ctx if proto == "https" else None,
                )
                if req.status == 200:
                    data = json.loads(req.read())
                    log.info(
                        f"Auto-setup OK (intento {attempt}): "
                        f"status={data.get('status')} "
                        f"summary={data.get('summary')}"
                    )
                    return data
            except Exception:
                continue

        if attempt < AUTO_SETUP_RETRIES:
            log.info(f"Auto-setup intento {attempt} fallo, reintentando en {AUTO_SETUP_RETRY_DELAY}s...")
            time.sleep(AUTO_SETUP_RETRY_DELAY)

    log.warning("Auto-setup fallo tras todos los intentos")
    return None


# ── BUCLE PRINCIPAL ────────────────────────────────────────────────────────────


def run_watcher() -> None:
    """
    Bucle principal del watcher.

    Se ejecuta indefinidamente hasta que el proceso sea terminado.
    El consumo de recursos es minimo: un ``tasklist`` cada 5 segundos
    y un ``urlopen`` solo cuando cambia el estado de Word.

    ESTRATEGIA DE PRE-CARGA:
    El backend se inicia INMEDIATAMENTE al arrancar el watcher (en el
    login de Windows), sin esperar a que Word abra. Esto resuelve el
    problema de carrera (race condition): Word intenta cargar el add-in
    desde https://localhost:8742/addin/taskpane.html y, si el backend no
    esta listo, el add-in falla. Pre-cargando el backend, este ya esta
    respondiendo cuando Word abre.

    El backend Python es ligero (~30-50MB RAM). Las partes pesadas
    (LibreOffice, Word COM) se inicializan bajo demanda dentro del backend.
    """
    log.info("=" * 50)
    log.info("WordAPA7 Watcher iniciado")
    log.info(f"  Puerto backend: {BACKEND_PORT}")
    log.info(f"  Poll interval: {POLL_INTERVAL}s")
    log.info(f"  Shutdown grace: {SHUTDOWN_GRACE}s")
    log.info(f"  Packaged: {_is_packaged()}")
    log.info(f"  Frozen: {getattr(sys, 'frozen', False)}")
    log.info(f"  Base dir: {_get_base_dir()}")
    log.info(f"  Python dir: {_get_python_dir()}")
    log.info(f"  sys.executable: {sys.executable}")
    log.info("=" * 50)

    backend_proc: Optional[subprocess.Popen] = None
    shutdown_timer = 0.0
    auto_setup_done = False

    # ── PRE-CARGA: Iniciar el backend inmediatamente ────────────────────────
    # El backend se arranca en cuanto el watcher se inicia (en el login de
    # Windows), NO cuando se detecta Word abierto. Esto evita la race
    # condition donde Word intenta cargar el add-in antes de que el backend
    # este listo. El proceso Python del backend consume ~30-50MB; las partes
    # pesadas (LibreOffice, Word COM) se cargan on-demand dentro del backend.
    log.info("Iniciando backend inmediatamente (pre-carga para Word)...")
    backend_proc = start_backend()
    if backend_proc:
        time.sleep(BACKEND_STARTUP_WAIT)
        if is_backend_running():
            log.info("Backend pre-cargado y listo antes de que Word abra")
            time.sleep(AUTO_SETUP_DELAY)
            call_auto_setup()
            auto_setup_done = True
        else:
            log.warning("El backend no respondio tras el startup inicial")
            backend_proc = None
    else:
        log.error("No se pudo iniciar el backend en el arranque del watcher")

    # Supervisor del nucleo: si muere, lo revive (backoff 10/30/60s)
    import threading as _th
    _th.Thread(
        target=_core_supervisor,
        args=(lambda: backend_proc, lambda: start_backend()),
        daemon=True, name="WordAPA7-core-supervisor",
    ).start()

    while True:
        try:
            word_open = is_word_running()
            electron_open = is_electron_running()
            backend_up = is_backend_running()

            # ── CASO 1: Word abierto y backend no corriendo ──────────────
            # RUTA DE RECUPERACION: el backend debio haberse pre-cargado al
            # inicio del watcher, asi que si no esta corriendo cuando Word
            # abre, es porque se cayo (crash) o nunca pudo arrancar. Se
            # reintenta el arranque.
            if word_open and not backend_up:
                log.warning(
                    "Word detectado pero el backend no responde — "
                    "recuperacion (posible crash del backend)..."
                )
                backend_proc = start_backend()
                if backend_proc:
                    # Esperar a que arranque
                    time.sleep(BACKEND_STARTUP_WAIT)
                    # Verificar que realmente arranco
                    if is_backend_running():
                        log.info("Backend recuperado correctamente tras crash")
                        # Llamar auto-setup tras un delay
                        time.sleep(AUTO_SETUP_DELAY)
                        if not auto_setup_done:
                            call_auto_setup()
                            auto_setup_done = True
                    else:
                        log.warning("El backend no respondio tras el startup wait")
                        # Reintentar en el proximo ciclo
                        backend_proc = None
                else:
                    log.error("No se pudo recuperar el backend")
                shutdown_timer = 0
                continue

            # ── CASO 2: Word cerrado pero backend corriendo ──────────────
            if not word_open and backend_up:
                if electron_open:
                    # Electron esta abierto — no tocar el backend
                    if shutdown_timer > 0:
                        log.info("Electron detectado — cancelando shutdown del backend")
                        shutdown_timer = 0
                elif backend_proc is not None:
                    # El watcher inicio el backend (pre-carga o recuperacion) —
                    # cuenta regresiva para detenerlo y ahorrar memoria. Si el
                    # backend lo inicio Electron (backend_proc is None), Electron
                    # gestiona su ciclo de vida y el watcher no debe tocarlo.
                    if shutdown_timer == 0:
                        log.info(
                            f"Word y Electron cerrados — el backend se detendra "
                            f"en {SHUTDOWN_GRACE}s si no se reabren"
                        )
                    shutdown_timer += POLL_INTERVAL

                    if shutdown_timer >= SHUTDOWN_GRACE:
                        log.info("Grace period agotada — deteniendo backend...")
                        stop_backend(backend_proc)
                        backend_proc = None
                        auto_setup_done = False
                        shutdown_timer = 0
                # else: backend iniciado por Electron (backend_proc is None) —
                # Electron gestiona su ciclo de vida; el watcher no hace nada.

            # ── CASO 3: Word abierto y backend ya corriendo ───────────────
            if word_open and backend_up:
                # Todo en orden — resetear timer
                if shutdown_timer > 0:
                    log.info("Word reabierta — cancelando shutdown del backend")
                    shutdown_timer = 0

                # Asegurar que auto-setup se ejecuto al menos una vez.
                # Si el backend lo inicio Electron (backend_proc is None) y
                # auto-setup aun no se ha llamado, hacerlo ahora. Si ya se hizo
                # (pre-carga o ciclo anterior), se omite.
                if not auto_setup_done and backend_proc is None:
                    call_auto_setup()
                    auto_setup_done = True

            # ── CASO 4: Ni Word ni backend ────────────────────────────────
            # Nada que hacer — esperar al proximo ciclo

        except KeyboardInterrupt:
            log.info("Watcher detenido por el usuario (Ctrl+C)")
            break
        except Exception as e:
            log.error(f"Error en bucle del watcher: {e}")
            # No crashear — seguir intentando

        time.sleep(POLL_INTERVAL)

    # Limpieza al salir
    if backend_proc:
        stop_backend(backend_proc)
    log.info("Watcher terminado")


# ── PUNTO DE ENTRADA ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    run_watcher()


def _core_supervisor(get_proc, spawn_fn):
    """Revive el nucleo si muere. Backoff 10/30/60s."""
    import http.client as _hc
    delays = [10, 30, 60]
    attempt = 0
    while True:
        time.sleep(delays[min(attempt, len(delays)-1)])
        proc = get_proc()
        alive = False
        if proc is not None and proc.poll() is None:
            try:
                conn = _hc.HTTPSConnection("127.0.0.1", 8742, timeout=3, context=_ssl_ctx())
                conn.request("GET", "/api/version")
                alive = (conn.getresponse().status == 200)
            except Exception:
                alive = False
        if not alive:
            log.warning("[WATCHER] Nucleo muerto; reiniciando (intento %d)", attempt+1)
            try:
                if proc is not None and proc.poll() is None:
                    proc.terminate()
            except Exception:
                pass
            try:
                spawn_fn()
                attempt = 0
            except Exception as e:
                log.error("Reinicio fallo: %s", e)
                attempt += 1
        else:
            attempt = 0


def _ssl_ctx():
    import ssl as _ssl
    return _ssl._create_unverified_context()

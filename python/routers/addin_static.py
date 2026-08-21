"""
WordAPA7 — Router de archivos estáticos del Word Add-in (Office.js)

Sirve los archivos construidos del Add-in (taskpane.html, commands.html, JS,
CSS, iconos) bajo la ruta ``/addin/`` para que el panel de Word pueda cargarse
directamente desde el backend de Python, sin necesidad de un servidor de
desarrollo separado en HTTPS:3000.

Además, expone un endpoint dinámico ``GET /api/addin/manifest`` que lee la
plantilla ``manifest.xml``, reemplaza la URL de desarrollo
(``https://localhost:3000``) por la URL real del backend (derivada de la
petición) seguida de ``/addin``, y la devuelve como ``application/xml``.
Así Word siempre descarga un manifiesto que apunta al lugar correcto, sin
importar el puerto o la máquina donde corre el backend.

Endpoints:
  GET /api/addin/manifest        — manifiesto XML dinámico (URL del backend)
  GET /api/addin/manifest-info   — metadatos del manifiesto (URL de descarga)

Función:
  init_addin_static(app)         — monta los archivos estáticos en ``/addin/``
"""

import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from config import BASE_DIR

router = APIRouter(prefix="/api/addin", tags=["word-addin-static"])

# URL base del servidor de desarrollo del Add-in (lo que está en manifest.xml).
# Todas las URLs del manifiesto apuntan aquí; en producción se reemplazan.
_DEV_ADDIN_URL = "https://localhost:3000"


# ── RESOLUCIÓN DE RUTAS DE ARCHIVOS ──────────────────────────────────────────

def _get_addin_dist_dir() -> Optional[Path]:
    """
    Busca el directorio con los archivos construidos del Add-in.

    Orden de búsqueda:
      1. ``word-addin/dist/``  — entorno de desarrollo
      2. ``dist/addin/``       — build local (cuando se copia a dist/)
      3. ``../addin/``         — producción (extraResources de Electron)

    Retorna el primer directorio que contenga ``taskpane.html``, o ``None``
    si no se encuentra ninguno.
    """
    candidates: list[Path] = []

    if getattr(sys, "frozen", False):
        # Producción (PyInstaller): el exe está en resources/python-backend/,
        # el Add-in está en resources/addin/ (hermano del directorio del exe).
        exe_dir = Path(sys.executable).parent
        candidates.append(exe_dir.parent / "addin")
        candidates.append(exe_dir / "addin")
    else:
        # Desarrollo: word-addin/dist/ en la raíz del proyecto
        candidates.append(BASE_DIR / "word-addin" / "dist")
        candidates.append(BASE_DIR / "dist" / "addin")

    for path in candidates:
        if path.is_dir() and (path / "taskpane.html").exists():
            return path

    return None


def _get_addin_manifest_path() -> Optional[Path]:
    """
    Busca el archivo ``manifest.xml`` del Add-in.

    Orden de búsqueda:
      1. Dentro del directorio dist del Add-in (``manifest.xml`` copiado)
      2. ``word-addin/manifest.xml`` — desarrollo (fuente)
      3. ``../addin/manifest.xml``  — producción (extraResources)
    """
    # 1. Buscar dentro del directorio dist del Add-in (el build lo copia)
    dist_dir = _get_addin_dist_dir()
    if dist_dir:
        manifest_in_dist = dist_dir / "manifest.xml"
        if manifest_in_dist.exists():
            return manifest_in_dist

    # 2. Buscar en ubicaciones fuente / de producción
    candidates: list[Path] = []
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).parent
        candidates.append(exe_dir.parent / "addin" / "manifest.xml")
        candidates.append(exe_dir / "addin" / "manifest.xml")
    else:
        candidates.append(BASE_DIR / "word-addin" / "manifest.xml")

    for path in candidates:
        if path.exists():
            return path

    return None


# ── MONTAJE DE ARCHIVOS ESTÁTICOS ────────────────────────────────────────────

def init_addin_static(app) -> None:
    """
    Monta los archivos estáticos del Add-in en la ruta ``/addin/``.

    Debe llamarse **después** de registrar los routers de la API y **antes**
    de montar el SPA catch-all (``app.mount("/", StaticFiles(...))``), para
    que las rutas ``/addin/...`` tengan prioridad sobre la captura genérica.

    Si no se encuentran los archivos del Add-in, se registra un aviso pero no
    se lanza error: el resto del backend sigue funcionando con normalidad.
    """
    addin_dir = _get_addin_dist_dir()
    if addin_dir and addin_dir.is_dir():
        app.mount(
            "/addin",
            StaticFiles(directory=str(addin_dir), html=True),
            name="addin-static",
        )
        print(f"[ADD-IN] Archivos estáticos montados desde: {addin_dir}")
    else:
        print(
            "[ADD-IN] No se encontró el directorio del Add-in. "
            "Ejecuta 'npm run build:addin' para construirlo."
        )


# ── ENDPOINTS DE LA API ──────────────────────────────────────────────────────

@router.get("/manifest")
async def get_addin_manifest(request: Request):
    """
    Devuelve el manifiesto XML del Add-in con la URL del backend dinámica.

    Lee ``manifest.xml``, reemplaza ``https://localhost:3000`` por la URL
    real del backend (derivada de la petición) seguida de ``/addin``, y lo
    devuelve como ``application/xml``. Esto permite que Word cargue el panel
    desde el backend de Python sin configuración manual de URLs.

    Ejemplo de reemplazo:
      - ``https://localhost:3000/taskpane.html``
        → ``http://localhost:8742/addin/taskpane.html``
    """
    manifest_path = _get_addin_manifest_path()
    if not manifest_path or not manifest_path.exists():
        raise HTTPException(
            status_code=404,
            detail="No se encontró el archivo manifest.xml del Add-in. "
                   "Ejecuta 'npm run build:addin' para construirlo.",
        )

    # Construir la URL base del backend desde la petición.
    # request.base_url → "http://localhost:8742/"
    # Necesitamos: "http://localhost:8742/addin"
    base_url = str(request.base_url).rstrip("/")
    addin_base_url = f"{base_url}/addin"

    # Leer la plantilla del manifiesto y reemplazar la URL de desarrollo
    xml_content = manifest_path.read_text(encoding="utf-8")
    xml_content = xml_content.replace(_DEV_ADDIN_URL, addin_base_url)

    return Response(content=xml_content, media_type="application/xml")


@router.get("/manifest-info")
async def get_addin_manifest_info(request: Request) -> dict:
    """
    Devuelve metadatos sobre el manifiesto del Add-in.

    Permite que Electron (o el usuario) descubra la URL desde donde se puede
    descargar el manifiesto dinámico, así como el estado de disponibilidad
    de los archivos del Add-in.
    """
    base_url = str(request.base_url).rstrip("/")
    manifest_url = f"{base_url}/api/addin/manifest"
    addin_dir = _get_addin_dist_dir()
    manifest_path = _get_addin_manifest_path()

    return {
        "manifest_url": manifest_url,
        "taskpane_url": f"{base_url}/addin/taskpane.html" if addin_dir else None,
        "commands_url": f"{base_url}/addin/commands.html" if addin_dir else None,
        "available": addin_dir is not None,
        "manifest_available": manifest_path is not None,
        "addin_dist_path": str(addin_dir) if addin_dir else None,
    }


@router.get("/registry-sideload")
async def registry_sideload(request: Request) -> dict:
    """
    Registra el manifiesto del Add-in en el registro de Windows para
    que Word lo cargue automáticamente (sideload sin intervención manual).

    Escribe en:
      HKCU\\Software\\Microsoft\\Office\\16.0\\Wef\\Developer\\WordAPA7
      → (Default) = <URL del manifiesto dinámico>

    Este es el mecanismo oficial de Office para sideload de desarrolladores.
    No requiere permisos de administrador (usa HKCU).
    Es idempotente: llamarlo múltiples veces actualiza la URL sin duplicar.

    Retorna:
      {"status": "ok", "registry_key": "...", "manifest_url": "..."} en Windows
      {"status": "not_supported", "reason": "..."} en otros sistemas operativos
    """
    import sys

    if sys.platform != "win32":
        return {
            "status": "not_supported",
            "reason": "El registro de Windows solo está disponible en Windows",
        }

    try:
        import winreg

        base_url = str(request.base_url).rstrip("/")
        manifest_url = f"{base_url}/api/addin/manifest"

        # Clave oficial de sideload de desarrolladores de Office
        reg_path = r"Software\Microsoft\Office\16.0\Wef\Developer"
        key_name = "WordAPA7"

        # Crear / abrir la clave (CREATE_KEY es idempotente)
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, reg_path) as wef_key:
            winreg.SetValueEx(wef_key, key_name, 0, winreg.REG_SZ, manifest_url)

        full_key = f"HKCU\\{reg_path}\\{key_name}"
        return {
            "status": "ok",
            "registry_key": full_key,
            "manifest_url": manifest_url,
            "hint": (
                "Reinicia Word para que detecte el Add-in. "
                "Si no aparece, ve a Insertar → Mis complementos → Complementos de desarrollador."
            ),
        }

    except ImportError:
        return {
            "status": "error",
            "reason": "winreg no disponible en este entorno Python",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al escribir en el registro de Windows: {e}",
        )

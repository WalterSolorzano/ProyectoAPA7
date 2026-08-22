"""
WordAPA7 — Router de archivos estáticos del Word Add-in (Office.js)

Sirve los archivos construidos del Add-in (taskpane.html, commands.html, JS,
CSS, iconos) bajo la ruta ``/addin/`` para que el panel de Word pueda cargarse
directamente desde el backend de Python, sin necesidad de un servidor de
desarrollo separado en HTTPS:3000.

Además, expone un endpoint dinámico ``GET /api/addin/manifest`` que lee la
plantilla ``manifest.xml``, reemplaza la URL de desarrollo
(``https://localhost:3000``) por la URL real del Add-in y la devuelve como
``application/xml``.

MODO PRODUCCIÓN (por defecto):
  - El backend corre en ``http://127.0.0.1:8742`` (HTTP plano).
  - El Add-in se carga desde una URL HTTPS pública configurada con la
    variable de entorno ``WORDAPA7_ADDIN_PUBLIC_URL``.
  - El manifiesto apunta a la URL pública para los recursos del Add-in
    (HTML, JS, CSS, iconos).
  - El frontend del Add-in se comunica con el backend local en
    ``http://127.0.0.1:8742`` (ver ``backend.ts``).
  - NO se necesitan certificados locales ni mkcert.

MODO DESARROLLO HTTPS (avanzado):
  - Si ``WORDAPA7_USE_SSL=true``, el backend genera certificados SSL y
    sirve el Add-in en HTTPS local.
  - El manifiesto apunta a la URL del backend (derivada de la petición).

Endpoints:
  GET /api/addin/manifest        — manifiesto XML dinámico (URL del Add-in)
  GET /api/addin/manifest-info   — metadatos del manifiesto (URL de descarga)

Función:
  init_addin_static(app)         — monta los archivos estáticos en ``/addin/``
"""

import os
import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from config import BASE_DIR, STORAGE_DIR

router = APIRouter(prefix="/api/addin", tags=["word-addin-static"])

# URL base del servidor de desarrollo del Add-in (lo que está en manifest.xml).
# Esta URL debe ser exactamente lo que está en manifest.xml para poder reemplazarla.
_DEV_ADDIN_URL = "https://localhost:3000"


# ── RESOLUCIÓN DE LA URL DEL ADD-IN ──────────────────────────────────────────

def _resolve_addin_base_url(request: Optional[Request] = None) -> str:
    """
    Determina la URL base del Add-in para usar en el manifiesto dinámico.

    Orden de prioridad:
      1. ``WORDAPA7_ADDIN_PUBLIC_URL`` — URL HTTPS pública (modo producción).
         El Add-in se carga desde aquí y se comunica con el backend local.
      2. URL del backend derivada de la petición + ``/addin`` — desarrollo
         local (cuando el Add-in lo sirve el propio backend).

    En el caso 1, la URL pública ya incluye la ruta base del Add-in
    (ej. ``https://wordapa7.pages.dev``), por lo que no se le añade
    ``/addin``. En el caso 2, el backend sirve los archivos en ``/addin/``.
    """
    public_url = os.environ.get("WORDAPA7_ADDIN_PUBLIC_URL", "").strip()
    if public_url:
        # Quitar trailing slash para que las concatenaciones sean consistentes.
        return public_url.rstrip("/")

    # Fallback: usar la URL del backend (desarrollo local o SSL local).
    if request is not None:
        base_url = str(request.base_url).rstrip("/")
        return f"{base_url}/addin"

    # Último recurso: HTTP local sin petición.
    return "http://127.0.0.1:8742/addin"


def _get_backend_api_url() -> str:
    """
    URL del backend que el frontend del Add-in debe usar para llamadas a la API.

    En modo producción (sin SSL): ``http://127.0.0.1:8742`` (o el valor de
    ``WORDAPA7_BACKEND_URL`` si está seteado).
    En modo desarrollo HTTPS: ``https://127.0.0.1:8742``.
    """
    use_ssl = os.environ.get("WORDAPA7_USE_SSL", "").strip().lower() == "true"
    if use_ssl:
        return "https://127.0.0.1:8742"
    return os.environ.get("WORDAPA7_BACKEND_URL", "").strip() or "http://127.0.0.1:8742"


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
        candidates.append(exe_dir.parent.parent / "addin")
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
        candidates.append(exe_dir.parent.parent / "addin" / "manifest.xml")
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
    de montar el SPA catch-all (``app.mount(\"/\", StaticFiles(...))``), para
    que las rutas ``/addin/...`` tengan prioridad sobre la captura genérica.

    Si no se encuentran los archivos del Add-in, se registra un aviso pero no
    se lanza error: el resto del backend sigue funcionando con normalidad.

    En modo producción con ``WORDAPA7_ADDIN_PUBLIC_URL`` seteada, los
    archivos del Add-in se sirven desde la URL pública (no desde el backend).
    Sin embargo, el montaje local sigue siendo útil para desarrollo y como
    fallback.
    """
    public_url = os.environ.get("WORDAPA7_ADDIN_PUBLIC_URL", "").strip()
    if public_url:
        print(
            f"[ADD-IN] Modo PRODUCCIÓN: Add-in servido desde URL pública: {public_url}\n"
            f"         Backend API en: {_get_backend_api_url()}"
        )

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
    Devuelve el manifiesto XML del Add-in con la URL del Add-in dinámica.

    Lee ``manifest.xml`` y reemplaza ``https://localhost:3000`` por la URL
    real del Add-in:

    - **Producción**: si ``WORDAPA7_ADDIN_PUBLIC_URL`` está seteada, las URLs
      del manifiesto apuntan a la URL pública HTTPS (ej.
      ``https://wordapa7.pages.dev``). El Add-in se carga desde allí y se
      comunica con el backend local en ``http://127.0.0.1:8742``.
    - **Desarrollo/SSL local**: las URLs apuntan al backend
      (``http://localhost:8742/addin`` o ``https://localhost:8742/addin``).

    Ejemplo de reemplazo (producción):
      - ``https://localhost:3000/taskpane.html``
        → ``https://wordapa7.pages.dev/taskpane.html``

    Ejemplo de reemplazo (desarrollo local):
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

    # Resolver la URL base del Add-in (pública o local).
    addin_base_url = _resolve_addin_base_url(request)

    # Leer la plantilla del manifiesto y reemplazar la URL de desarrollo.
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

    En modo producción (``WORDAPA7_ADDIN_PUBLIC_URL``), ``taskpane_url`` y
    ``commands_url`` apuntan a la URL pública, mientras que ``manifest_url``
    apunta al backend local (que genera el manifiesto dinámico).
    """
    public_url = os.environ.get("WORDAPA7_ADDIN_PUBLIC_URL", "").strip().rstrip("/") or None
    addin_base_url = _resolve_addin_base_url(request)
    base_url = str(request.base_url).rstrip("/")
    manifest_url = f"{base_url}/api/addin/manifest"
    addin_dir = _get_addin_dist_dir()
    manifest_path = _get_addin_manifest_path()
    backend_api_url = _get_backend_api_url()

    return {
        "manifest_url": manifest_url,
        "taskpane_url": f"{addin_base_url}/taskpane.html" if addin_dir or public_url else None,
        "commands_url": f"{addin_base_url}/commands.html" if addin_dir or public_url else None,
        "available": addin_dir is not None,
        "manifest_available": manifest_path is not None,
        "addin_dist_path": str(addin_dir) if addin_dir else None,
        # Información del modo de operación.
        "mode": "production_http" if not public_url else "production_public",
        "public_addin_url": public_url,
        "backend_api_url": backend_api_url,
        "hint": (
            f"Add-in cargado desde URL pública ({public_url}) → backend en {backend_api_url}"
            if public_url
            else f"Add-in servido localmente desde {addin_base_url}"
        ),
    }


@router.get("/registry-sideload")
async def registry_sideload(request: Request) -> dict:
    """
    Registra el manifiesto del Add-in en el registro de Windows para
    que Word lo cargue automáticamente (sideload sin intervención manual).

    Escribe en:
      HKCU\\Software\\Microsoft\\Office\\16.0\\Wef\\Developer\\WordAPA7
      → (Default) = <Ruta del manifiesto XML local en STORAGE_DIR>

    Este es el mecanismo oficial de Office para sideload de desarrolladores.
    No requiere permisos de administrador (usa HKCU).
    Es idempotente: llamarlo múltiples veces actualiza la ruta sin duplicar.
    """
    import sys

    if sys.platform != "win32":
        return {
            "status": "not_supported",
            "reason": "El registro de Windows solo está disponible en Windows",
        }

    try:
        import winreg

        # Asegurar de escribir el archivo actualizado en STORAGE_DIR
        manifest_dest = STORAGE_DIR / "manifest.xml"
        manifest_path = _get_addin_manifest_path()
        if manifest_path and manifest_path.exists():
            xml_content = manifest_path.read_text(encoding="utf-8")
            addin_base_url = _resolve_addin_base_url(request)
            xml_content = xml_content.replace(_DEV_ADDIN_URL, addin_base_url)
            STORAGE_DIR.mkdir(parents=True, exist_ok=True)
            manifest_dest.write_text(xml_content, encoding="utf-8")
            print(f"[ADD-IN] Manifiesto guardado en local: {manifest_dest}")
        else:
            print("[WARN] [ADD-IN] No se encontró la plantilla de manifest.xml")

        # Clave oficial de sideload de desarrolladores de Office
        reg_path = r"Software\Microsoft\Office\16.0\Wef\Developer"
        key_name = "WordAPA7"

        # Crear / abrir la clave (CREATE_KEY es idempotente)
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, reg_path) as wef_key:
            winreg.SetValueEx(wef_key, key_name, 0, winreg.REG_SZ, str(manifest_dest))

        full_key = f"HKCU\\{reg_path}\\{key_name}"
        public_url = os.environ.get("WORDAPA7_ADDIN_PUBLIC_URL", "").strip() or None
        return {
            "status": "ok",
            "registry_key": full_key,
            "manifest_url": str(manifest_dest),
            "public_addin_url": public_url,
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

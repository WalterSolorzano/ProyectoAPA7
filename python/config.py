import os
import sys
from pathlib import Path

# ── CONFIGURACION Y RUTAS DE ALMACENAMIENTO ──────────────────────────────────
# BASE_DIR es la raiz del proyecto en desarrollo.
# En produccion, los archivos fuente estan empaquetados, pero los DATOS del
# usuario deben guardarse en AppData para que:
# 1. Persistan entre reinicios de la app
# 2. No se borren al actualizar la app
# 3. Funcionen correctamente para CUALQUIER usuario en cualquier computadora


def _is_packaged() -> bool:
    """Detecta si estamos corriendo en el paquete Electron instalado.

    Soporta dos modos de empaquetado:
    - PyInstaller (legacy): sys.frozen está definido
    - Embedded Python (actual): python.exe oficial está en resources/python-runtime/
      y el código fuente en resources/python-runtime/python/

    Con el embedded Python, sys.frozen NO está definido (no es PyInstaller),
    así que detectamos el modo empaquetado verificando que python.exe tenga
    un directorio 'python/' con 'main.py' al lado.
    """
    if getattr(sys, "frozen", False):
        return True
    # Embedded Python: python.exe está en resources/python-runtime/
    exe_dir = Path(sys.executable).parent
    return (exe_dir / "python" / "main.py").exists()


# WORDAPA7_STORAGE_DIR permite redirigir los datos del usuario a un disco
# persistente (ej. /data en Hugging Face Spaces) para que las sesiones,
# exports y la base SQLite sobrevivan reinicios del contenedor.
_override = os.environ.get('WORDAPA7_STORAGE_DIR')
if _override:
    BASE_DIR = Path(__file__).resolve().parent.parent
    STORAGE_DIR = Path(_override)
    DIST_DIR = BASE_DIR / 'dist'
elif _is_packaged():
    # Entorno empaquetado (embedded Python en Electron)
    # python.exe está en resources/python-runtime/
    # Los datos del usuario van a AppData/Roaming (estándar Windows)
    BASE_DIR = Path(sys.executable).parent
    _appdata = Path(os.environ.get('APPDATA', Path.home() / 'AppData' / 'Roaming'))
    STORAGE_DIR = _appdata / 'WordAPA7' / 'storage'
    DIST_DIR = BASE_DIR  # No aplica en producción empaquetada
else:
    # Entorno desarrollo
    BASE_DIR = Path(__file__).resolve().parent.parent
    STORAGE_DIR = BASE_DIR / 'storage'
    DIST_DIR = BASE_DIR / 'dist'

STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def get_apa7_template_path() -> Path:
    """Ruta del documento base APA 7 (apa7_template.docx).

    En desarrollo vive en la raíz del proyecto; en producción se regenera
    bajo AppData para evitar tocar el directorio de la app.
    """
    if _is_packaged():
        return STORAGE_DIR / 'apa7_template.docx'
    return BASE_DIR / 'apa7_template.docx'

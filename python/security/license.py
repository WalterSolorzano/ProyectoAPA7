import uuid
import hashlib
import platform
import os
import json
from pathlib import Path

LICENSE_FILE = Path(__file__).resolve().parent.parent.parent / "storage" / "license.json"

def get_hardware_id() -> str:
    """Obtiene un ID único de hardware de la PC."""
    node = uuid.getnode()
    system_info = f"{platform.node()}_{platform.machine()}_{node}"
    return hashlib.sha256(system_info.encode()).hexdigest()

def generate_pin_for_this_pc() -> str:
    """Genera un PIN de licencia para esta PC (solo para propósitos de prueba inicial)."""
    hw_id = get_hardware_id()
    # Para el ejemplo, el PIN será los primeros 8 caracteres del hash en mayúsculas
    return hw_id[:8].upper()

def is_license_valid(pin: str) -> bool:
    """Verifica si el PIN corresponde a esta PC."""
    expected_pin = generate_pin_for_this_pc()
    return pin == expected_pin

def load_saved_pin() -> str:
    if LICENSE_FILE.exists():
        try:
            with open(LICENSE_FILE, "r") as f:
                data = json.load(f)
                return data.get("pin", "")
        except:
            return ""
    return ""

def save_pin(pin: str):
    LICENSE_FILE.parent.mkdir(exist_ok=True)
    with open(LICENSE_FILE, "w") as f:
        json.dump({"pin": pin}, f)

def check_license_middleware(pin_provided: str) -> bool:
    """Valida la licencia. En el futuro esto será un middleware real de FastAPI."""
    saved_pin = load_saved_pin()
    if not saved_pin:
        # Si no hay pin guardado, validamos el proveido y lo guardamos
        if is_license_valid(pin_provided):
            save_pin(pin_provided)
            return True
        return False
    else:
        # Ya hay pin, validamos si es correcto para la PC
        return is_license_valid(saved_pin)

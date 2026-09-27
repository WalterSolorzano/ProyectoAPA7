"""El ruteo de especialidades tiene que tener providers que respondan.

El 2026-09-27 la sonda encontro que las tres especialidades caian: FAST apuntaba
a Groq (key invalida) y Cerebras (404 en todos los gratuitos), HEAVY a Gemini
(401), NVIDIA NIM (410, modelo muerto) y OpenRouter (402 sin credito). El unico
proveedor que respondia, ZenMux, no estaba en HEAVY ni en FAST, y su modelo
configurado estaba retirado del catalogo.

Este test no pega contra la red —eso no puede ser un test— sino que fija las dos
cosas que SÍ se pueden verificar sin red: que toda especialidad tenga al menos un
proveedor ordenado que hoy responde, y que el orden ponga a los vivos primero.
La sonda viva vive en `probe_providers.py`.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from modules.ai_client import PROVIDER_SPECIALTIES  # noqa: E402

# Estado verificado por sonda el 2026-09-27. Un proveedor sale de aca cuando deja
# de responder; entra cuando se le agrega una key. Actualizar esta lista y la
# tabla de arriba JUNTAS, que es el error que se produjo.
#
# Un proveedor no sale de esta lista por estar lento ni por dar 429 una vez: sale
# por responder con un error que no se arregla esperando. `mistral` devuelve
# `x-ratelimit-limit-req-minute: 0` — key valida, cuota CERO — asi que responde
# 429 para siempre, no "a ratos".
RESPONDEN = {"zenmux"}
# 410 = modelo retirado, 401 = key invalida, 402 = sin credito, 429 con cuota 0
# = sin cuota, DNS = endpoint muerto. Ninguno se arregla esperando.
MUERTOS = {"nvidia_nim", "groq", "openrouter", "gemini", "cerebras", "mistral",
           "opencodezen"}


def test_toda_especialidad_tiene_un_proveedor_que_responde():
    for esp, ids in PROVIDER_SPECIALTIES.items():
        vivos = [i for i in ids if i in RESPONDEN]
        assert vivos, (
            f"{esp} no tiene ningun proveedor vivo. "
            f"Orden actual: {ids}. Sonda: python tools/llm_probe.py"
        )


def test_el_primer_proveedor_de_cada_especialidad_responde():
    # El orden es el failover: el primero que se prueba es el que gana. Si el
    # primero esta muerto, cada request paga su error antes de llegar al bueno.
    for esp, ids in PROVIDER_SPECIALTIES.items():
        primero = next((i for i in ids if i in RESPONDEN or i not in MUERTOS), None)
        assert primero == ids[0], (
            f"{esp} empieza probando {ids[0]}, que no responde. "
            f"El primero vivo es {primero}."
        )


def test_los_muertos_no_lideran_ninguna_especialidad():
    for esp, ids in PROVIDER_SPECIALTIES.items():
        lider = ids[0]
        assert lider not in MUERTOS, f"{esp} empieza por {lider}, que esta muerto"


def test_toda_especialidad_conserva_su_respaldo():
    # Un unico proveedor vivo es un punto unico de falla: si se cae el throttling
    # o se vence la cuota, la especialidad entera cae.
    for esp, ids in PROVIDER_SPECIALTIES.items():
        assert len(ids) >= 3, f"{esp} tiene {len(ids)} proveedores: no aguanta una caida"


def test_el_proveedor_vivo_usa_un_modelo_free():
    """Un modelo de frontera en una key de free tier es un error de ruteo.

    La cuota de esta cuenta solo cubre unos pocos modelos del catalogo de
    ZenMux y todos los demas dan 402 sin credito. El default tiene que ser uno
    que responda SIN pagar: para corregir prosa y registrar conectores, un
    flash chico alcanza y uno caro se come el presupuesto de una vez.
    """
    from classification.llm_classifier import _get_active_providers

    zens = [p for p in _get_active_providers(None, None, False) if p["id"] == "zenmux"]
    assert zens, "zenmux no tiene key: la sonda y el catalogo estan desfasados"
    modelo = zens[0]["model"]
    assert "free" in modelo.lower() or "flash" in modelo.lower() or "mini" in modelo.lower(), (
        f"El modelo por defecto de zenmux es {modelo!r}. Si dejaste de usar el "
        f"free porque te quedaste sin cuota, cambia ZENMUX_MODEL y actualiza "
        f"esta lista; no subas a un modelo de frontera en una key gratuita."
    )

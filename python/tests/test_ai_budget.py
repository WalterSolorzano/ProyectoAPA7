"""Limites reales por proveedor y presupuesto diario.

El router no debe abusar de un proveedor: esta capa declara los limites del
plan gratuito vigente y raciona el consumo por usuario (fraccion del free tier).
"""
import modules.ai_budget as ai_budget


def test_limites_reales_cubren_los_proveedores_conocidos():
    for p in ["groq", "openrouter", "cerebras", "gemini", "cloudflare", "nvidia_nim"]:
        assert p in ai_budget.LIMITES_REALES, f"falta {p}"


def test_groq_tiene_rpd_del_free_tier():
    # Free tier ejemplo: 30 RPM, 1000 RPD, 8000 TPM, 200000 TPD.
    g = ai_budget.LIMITES_REALES["groq"]
    assert g["rpm"] == 30
    assert g["rpd"] == 1000
    assert g["tpm"] == 8000
    assert g["tpd"] == 200000


def test_proveedor_desconocido_es_conservador_y_sin_rpd():
    assert ai_budget.limite("proveedor_inexistente", "rpd") is None
    # Sin dato no se inventa un limite duro; el default es None (no bloquea por rpd).
    assert ai_budget.limite("proveedor_inexistente", "rpm", default=5) == 5


def test_presupuesto_raciona_al_45_por_ciento():
    p = ai_budget.PresupuestoDiario(fraccion_de_cupo=0.45)
    assert p.cupo("groq") == 450  # 1000 * 0.45
    for _ in range(450):
        assert p.puede("groq")
        p.registrar("groq")
    assert not p.puede("groq")
    assert p.restante("groq") == 0


def test_presupuesto_sin_rpd_no_bloquea():
    p = ai_budget.PresupuestoDiario()
    assert p.puede("mistral")  # rpd None -> no bloquea

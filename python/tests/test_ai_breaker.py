import time

import modules.ai_client as ai_client


def setup_function():
    ai_client._provider_breaker.clear()


def test_abre_tras_n_fallos_y_bloquea():
    for _ in range(ai_client._BREAKER_THRESHOLD):
        ai_client._breaker_record("zenmux", ok=False)
    assert ai_client._breaker_estado("zenmux")["state"] == "open"
    assert ai_client._breaker_allows("zenmux") is False


def test_pasa_a_half_open_tras_el_cooldown():
    for _ in range(ai_client._BREAKER_THRESHOLD):
        ai_client._breaker_record("zenmux", ok=False)
    ai_client._provider_breaker["zenmux"]["opened_at"] = (
        time.time() - ai_client._BREAKER_COOLDOWN_S - 1
    )
    assert ai_client._breaker_estado("zenmux")["state"] == "half_open"
    assert ai_client._breaker_allows("zenmux") is True


def test_exito_cierra_el_breaker():
    for _ in range(ai_client._BREAKER_THRESHOLD):
        ai_client._breaker_record("zenmux", ok=False)
    ai_client._breaker_record("zenmux", ok=True)
    assert ai_client._breaker_estado("zenmux")["state"] == "closed"
    assert ai_client._breaker_allows("zenmux") is True

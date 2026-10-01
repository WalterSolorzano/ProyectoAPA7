"""FASE 5 — Guard D-a en get_page_layout_provider.

Sin Word disponible, get_page_layout_provider retorna None (sin excepción).
Elimina fallback a LibreOffice y heurístico en la ruta de layout.
"""
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))


def test_com_disponible_retorna_com_provider(monkeypatch):
    """COM disponible → retorna COMPageLayoutProvider."""
    from parsing import page_layout_provider as plp
    from parsing.page_layout_provider import COMPageLayoutProvider

    monkeypatch.setattr(plp, "COMPageLayoutProvider", COMPageLayoutProvider)
    monkeypatch.setattr(plp, "_cached_provider", None)

    provider = plp.get_page_layout_provider()
    assert isinstance(provider, COMPageLayoutProvider)


def test_com_no_disponible_retorna_none(monkeypatch):
    """COM no disponible → retorna None (sin excepción)."""
    from parsing import page_layout_provider as plp

    class FakeCOMProvider:
        def is_available(self):
            return False

    monkeypatch.setattr(plp, "COMPageLayoutProvider", FakeCOMProvider)
    monkeypatch.setattr(plp, "_cached_provider", None)

    result = plp.get_page_layout_provider()
    assert result is None, f"Esperado None sin COM, llegó {result}"


def test_sin_com_con_lo_disponible_igual_none(monkeypatch):
    """Aunque LO esté disponible, sin COM → None (D-a: sin degradación)."""
    from parsing import page_layout_provider as plp

    class FakeCOMProvider:
        def is_available(self):
            return False

    class FakeLOProvider:
        def is_available(self):
            return True

    monkeypatch.setattr(plp, "COMPageLayoutProvider", FakeCOMProvider)
    monkeypatch.setattr(plp, "LibreOfficePageLayoutProvider", FakeLOProvider)
    monkeypatch.setattr(plp, "_cached_provider", None)

    result = plp.get_page_layout_provider()
    assert result is None, f"Esperado None (sin fallback LO), llegó {result}"

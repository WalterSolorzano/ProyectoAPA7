"""FASE 5 — Guard D-a en DocConverterService.get_active_engine.

Sin Word disponible, get_active_engine retorna 'NONE' (sin excepción).
Elimina fallback a LibreOffice y heurístico en la ruta de export.
"""
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))


def _make_converter(monkeypatch, *, com_available=False, lo_available=False):
    """Crea un DocConverterService con mocks de disponibilidad."""
    from services.doc_converter import DocConverterService
    from unittest.mock import MagicMock

    mock_com = MagicMock()
    mock_com.is_available.return_value = com_available
    mock_lo = MagicMock()
    mock_lo.is_available.return_value = lo_available

    # Parchear los singletons ANTES de crear el servicio
    monkeypatch.setattr("services.doc_converter.get_com_post_processor", lambda: mock_com)
    monkeypatch.setattr("services.doc_converter.get_libreoffice_service", lambda: mock_lo)

    svc = DocConverterService()
    svc._com_processor = mock_com
    svc._lo_service = mock_lo
    return svc


def test_com_disponible_retorna_com(monkeypatch):
    """COM disponible → retorna 'COM'."""
    svc = _make_converter(monkeypatch, com_available=True)
    assert svc.get_active_engine() == "COM"


def test_com_no_disponible_retorna_none(monkeypatch):
    """COM no disponible → retorna 'NONE' (sin excepción)."""
    svc = _make_converter(monkeypatch, com_available=False, lo_available=False)
    assert svc.get_active_engine() == "NONE"


def test_com_no_disponible_con_lo_disponible_igual_none(monkeypatch):
    """Aunque LO esté disponible, sin COM → 'NONE' (D-a: sin degradación)."""
    svc = _make_converter(monkeypatch, com_available=False, lo_available=True)
    assert svc.get_active_engine() == "NONE"


def test_force_engine_com_sin_word_retorna_none(monkeypatch):
    """FORCE_ENGINE=COM sin Word → 'NONE'."""
    monkeypatch.setenv("FORCE_ENGINE", "COM")
    svc = _make_converter(monkeypatch, com_available=False)
    assert svc.get_active_engine() == "NONE"


def test_force_engine_lo_retorna_none(monkeypatch):
    """FORCE_ENGINE=LO → 'NONE' (D-a: sin fallback LO)."""
    monkeypatch.setenv("FORCE_ENGINE", "LO")
    svc = _make_converter(monkeypatch, lo_available=True)
    assert svc.get_active_engine() == "NONE"

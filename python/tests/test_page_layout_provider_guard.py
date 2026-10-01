# python/tests/test_page_layout_provider_guard.py
"""Fase 5 — Guard D-a en page_layout_provider: sin COM → None, sin fallback LO/heurístico."""
import sys
import pathlib
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))


def test_get_page_layout_provider_no_com_returns_none():
    """Sin COM disponible, get_page_layout_provider() debe retornar None."""
    from parsing import page_layout_provider as plp

    # Reset cache
    plp._cached_provider = None

    mock_com = MagicMock()
    mock_com.is_available.return_value = False

    with patch.object(plp, "COMPageLayoutProvider", return_value=mock_com):
        result = plp.get_page_layout_provider()

    assert result is None, f"Esperado None sin COM, llegó {result}"


def test_get_page_layout_provider_com_available():
    """Con COM disponible, get_page_layout_provider() debe retornar COMPageLayoutProvider."""
    from parsing import page_layout_provider as plp

    # Reset cache
    plp._cached_provider = None

    mock_com = MagicMock()
    mock_com.is_available.return_value = True

    with patch.object(plp, "COMPageLayoutProvider", return_value=mock_com):
        result = plp.get_page_layout_provider()

    assert result is mock_com, f"Esperado COMPageLayoutProvider, llegó {result}"


def test_get_page_layout_provider_no_libreoffice_fallback():
    """Sin COM, NO debe retornar LibreOfficePageLayoutProvider."""
    from parsing import page_layout_provider as plp

    # Reset cache
    plp._cached_provider = None

    mock_com = MagicMock()
    mock_com.is_available.return_value = False
    mock_lo = MagicMock()
    mock_lo.is_available.return_value = True  # LO disponible pero no debe usarse

    with patch.object(plp, "COMPageLayoutProvider", return_value=mock_com), \
         patch.object(plp, "LibreOfficePageLayoutProvider", return_value=mock_lo):
        result = plp.get_page_layout_provider()

    assert result is None, f"Esperado None (sin fallback LO), llegó {result}"


def test_get_page_layout_provider_no_heuristic_fallback():
    """Sin COM, NO debe retornar HeuristicPageLayoutProvider."""
    from parsing import page_layout_provider as plp

    # Reset cache
    plp._cached_provider = None

    mock_com = MagicMock()
    mock_com.is_available.return_value = False
    mock_heuristic = MagicMock()
    mock_heuristic.is_available.return_value = True

    with patch.object(plp, "COMPageLayoutProvider", return_value=mock_com), \
         patch.object(plp, "HeuristicPageLayoutProvider", return_value=mock_heuristic):
        result = plp.get_page_layout_provider()

    assert result is None, f"Esperado None (sin fallback heurístico), llegó {result}"

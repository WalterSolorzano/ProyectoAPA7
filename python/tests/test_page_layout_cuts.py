"""FASE 2 — cortes de página y page_setup con un doc COM falso (sin Word)."""
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))


class FakeRange:
    def __init__(self, start, end):
        self.Start = start
        self.End = end

    def Information(self, code):
        # Página = posición // 100 + 1 (quiebres artificiales en 100 y 200).
        assert code == 3
        return self.Start // 100 + 1


class FakeDoc:
    def Range(self, a, b):
        return FakeRange(a, b)

    class PageSetup:
        PageWidth = 612.0
        PageHeight = 792.0
        TopMargin = 72.0
        BottomMargin = 72.0
        LeftMargin = 72.0
        RightMargin = 72.0

    PageSetup = PageSetup()


def test_cuts_binary_search_multi_pagina():
    from parsing.page_layout_provider import cuts_for_range
    cuts = cuts_for_range(FakeDoc(), FakeRange(0, 250))
    assert cuts == [{"offset": 100, "page": 2},
                    {"offset": 200, "page": 3}]


def test_cuts_parrafo_no_cruza_devuelve_vacio():
    from parsing.page_layout_provider import cuts_for_range
    assert cuts_for_range(FakeDoc(), FakeRange(0, 50)) == []
    assert cuts_for_range(FakeDoc(), FakeRange(10, 11)) == []


def test_cuts_fallo_com_devuelve_vacio():
    from parsing.page_layout_provider import cuts_for_range

    class Broken:
        Start = 0
        End = 500

        def Information(self, code):
            raise RuntimeError("colgado")

    class BrokenDoc:
        def Range(self, a, b):
            raise RuntimeError("colgado")

    assert cuts_for_range(BrokenDoc(), Broken()) == []


def test_page_setup_dict():
    from parsing.page_layout_provider import page_setup_dict
    assert page_setup_dict(FakeDoc()) == {
        "width_pt": 612.0, "height_pt": 792.0,
        "margin_top_pt": 72.0, "margin_bottom_pt": 72.0,
        "margin_left_pt": 72.0, "margin_right_pt": 72.0,
    }


def test_page_setup_fallo_devuelve_none():
    from parsing.page_layout_provider import page_setup_dict
    assert page_setup_dict(object()) is None

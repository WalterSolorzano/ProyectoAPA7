from generation.table_engine import borde_de_preset


def test_borde_de_preset():
    assert borde_de_preset("apa") == "apa"
    assert borde_de_preset("compact") == "apa"
    assert borde_de_preset("expanded") == "apa"
    assert borde_de_preset("grid") == "grid"
    assert borde_de_preset("zebra") == "grid"
    assert borde_de_preset(None) == "apa"

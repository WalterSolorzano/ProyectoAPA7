"""Contrato de ReferenciaModel para APA 7 (tipo + segmentos)."""
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from models import ApaSegment, ReferenciaModel


def test_apa_segment_defaults():
    s = ApaSegment(text="Hola")
    assert s.text == "Hola"
    assert s.italic is False


def test_referencia_defaults_tipo_otro_sin_segmentos():
    # Referencia totalmente vacía: ni el validador de Task 3 debe poblarla.
    r = ReferenciaModel(id="r1")
    assert r.tipo == "otro"
    assert r.apa_segments == []


def test_csl_type_mapea_libro():
    r = ReferenciaModel(id="r2", authors=["Hirano, H."], year="1995",
                        title="5 Pillars", tipo="libro")
    assert r.to_csl_json()["type"] == "book"


def test_csl_type_mapea_tesis():
    r = ReferenciaModel(id="r3", authors=["Taha, M."], year="2021",
                        title="Diseño", tipo="tesis")
    assert r.to_csl_json()["type"] == "thesis"

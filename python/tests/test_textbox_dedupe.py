"""Dedupe de integrantes en textboxes duplicados (bug portada 4x2)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from parsing.xml_deep_parser import extract_unique_textbox_pairs  # noqa: E402


def _lines():
    return [
        "Br. Alexa Marian Dona Hernandez",
        "Carnet: 2021-0251",
        "Br. Lance Andrew Sobalvarro Padilla",
        "Carnet: 2023-0366",
        "Br. Walter Noel Solorzano Gaitan",
        "Carnet: 2023-0432",
        "Br. Wilmary Eunice Diaz Escorcia",
        "Carnet: 2023-0802",
        # Duplicado (Choice+Fallback o shape repetida)
        "Br. Alexa Marian Dona Hernandez",
        "Carnet: 2021-0251",
        "Br. Lance Andrew Sobalvarro Padilla",
        "Carnet: 2023-0366",
        "Br. Walter Noel Solorzano Gaitan",
        "Carnet: 2023-0432",
        "Br. Wilmary Eunice Diaz Escorcia",
        "Carnet: 2023-0802",
    ]


def test_no_duplicate_members():
    members = extract_unique_textbox_pairs(_lines())
    ids = [m.get("id") for m in members if m.get("role") == "br." and m.get("id")]
    assert len(ids) == len(set(ids)), f"carnets duplicados: {ids}"
    assert len([m for m in members if m.get("role") == "br."]) == 4


def test_single_pass_unchanged():
    lines = _lines()[:8]
    members = extract_unique_textbox_pairs(lines)
    assert len([m for m in members if m.get("role") == "br."]) == 4

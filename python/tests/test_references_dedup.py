"""Test: Dedup semántico de referencias (autor+año+título, no texto crudo).

F1 — `parsing.references_extractor.extract_references` debe colapsar
entradas idénticas que solo difieren en el prefijo numeral de lista
('6. Hirano (1995) ...' / '7. Hirano (1995) ...') usando una clave
semántica (apellido + año + título normalizado).

F2 — `generation.inplace_editor.apply_inplace` debe eliminar del DOCX los
párrafos de bibliografía duplicados (mismo texto sin el prefijo numeral).
"""
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from parsing.references_extractor import extract_references
from models import ElementModel, ElementType


def _para(t):
    return ElementModel(
        id=f"e_{abs(hash(t)) % 10000}",
        type=ElementType.PARAGRAPH,
        text=t,
        heading_level=None,
    )


# ── F1: dedup semántico en la extracción ────────────────────────────────────

def test_number_prefixed_duplicates_collapsed():
    lines = [
        "Referencias",
        "6. Hirano, H. (1995). 5 Pillars of the Visual Workplace. Productivity Press",
        "7. Hirano, H. (1995). 5 Pillars of the Visual Workplace. Productivity Press",
        "8. Hirano, H. (1995). 5 Pillars of the Visual Workplace. Productivity Press",
        "9. Hirano, H. (1995). 5 Pillars of the Visual Workplace. Productivity Press",
        "10. Juran, J. M. (1999). Juran's Quality Handbook. McGraw-Hill",
    ]
    elems = [_para(l) for l in lines]
    refs = extract_references(elems)
    hirano = [
        r for r in refs
        if "hirano" in (r.raw_text or "").lower()
        or "hirano" in " ".join(r.authors or []).lower()
    ]
    assert len(hirano) == 1, f"Esperado 1 Hirano, got {len(hirano)}"
    assert len(refs) == 2, f"Esperado 2 refs total, got {len(refs)}"


def test_semantic_key_survives_minor_text_diff():
    """Dos entradas con el mismo autor+año+título pero distinta fuente
    (editorial / DOI extra) deben colapsar a una sola referencia."""
    lines = [
        "Referencias",
        "1. García, M. (2023). Inteligencia artificial en el aula. Editorial UNAM, México.",
        "2. García, M. (2023). Inteligencia artificial en el aula. Editorial UNAM.",
    ]
    elems = [_para(l) for l in lines]
    refs = extract_references(elems)
    assert len(refs) == 1, f"Esperado 1 ref (mismo autor+año+título), got {len(refs)}: {[r.raw_text for r in refs]}"


def test_distinct_authors_not_collapsed():
    lines = [
        "Referencias",
        "1. Hirano, H. (1995). 5 Pillars of the Visual Workplace. Productivity Press",
        "2. Juran, J. M. (1999). Juran's Quality Handbook. McGraw-Hill",
    ]
    elems = [_para(l) for l in lines]
    refs = extract_references(elems)
    assert len(refs) == 2, f"Esperado 2 refs distintas, got {len(refs)}"


# ── F2: dedup de bibliografía en export in-place ────────────────────────────

class _Rules:
    font_family = "Times New Roman"
    font_size = 12
    line_spacing = 2.0
    indent_first_line = True


class _Model:
    portada = {"body_start_paragraph_idx": 5}


def _build_dup_ref_doc(tmp_path):
    """DOCX con portada (5 párrafos), cuerpo con heading y bibliografía con
    dos párrafos de Hirano idénticos salvo el numeral de lista."""
    from docx import Document
    doc = Document()
    for ln in [
        "UNIVERSIDAD NACIONAL",
        "Facultad de Ingeniería",
        "Título del Trabajo",
        "Autor Ejemplo",
        "Managua, 2026",
    ]:
        doc.add_paragraph(ln)
    doc.add_heading("Introducción", level=1)
    doc.add_paragraph("Este es un párrafo del cuerpo que necesita formato APA. " * 3)
    doc.add_heading("Referencias", level=1)
    doc.add_paragraph("6. Hirano, H. (1995). 5 Pillars of the Visual Workplace. Productivity Press")
    doc.add_paragraph("7. Hirano, H. (1995). 5 Pillars of the Visual Workplace. Productivity Press")
    doc.add_paragraph("8. Juran, J. M. (1999). Juran's Quality Handbook. McGraw-Hill")
    src = tmp_path / "orig_refs.docx"
    doc.save(src)
    return src


def test_inplace_removes_duplicate_references(tmp_path):
    """F2: apply_inplace elimina el párrafo de bibliografía duplicado."""
    from docx import Document
    from generation.inplace_editor import apply_inplace

    src = _build_dup_ref_doc(tmp_path)
    out = tmp_path / "out_refs.docx"
    apply_inplace(src, out, _Model(), _Rules(), scopes={"bibliografia"})

    d = Document(str(out))
    ref_texts = [
        p.text for p in d.paragraphs
        if "(1995)" in p.text or "(1999)" in p.text
    ]
    hirano = [t for t in ref_texts if "hirano" in t.lower()]
    assert len(hirano) == 1, f"Esperado 1 Hirano, got {len(hirano)}: {ref_texts}"
    assert len(ref_texts) == 2, f"Esperado 2 refs, got {len(ref_texts)}: {ref_texts}"


def test_inplace_keeps_cover_intact_with_dedup(tmp_path):
    """El contrato duro (portada byte-idéntica) se respeta aunque se
    eliminen duplicados de bibliografía."""
    from docx import Document
    from generation.inplace_editor import apply_inplace

    src = _build_dup_ref_doc(tmp_path)
    cover_before = [p._element.xml for p in Document(str(src)).paragraphs[:5]]
    out = tmp_path / "out_refs2.docx"
    apply_inplace(src, out, _Model(), _Rules(), scopes={"bibliografia"})
    cover_after = [p._element.xml for p in Document(str(out)).paragraphs[:5]]
    assert cover_before == cover_after, "La portada mutó durante el dedup de bibliografía"

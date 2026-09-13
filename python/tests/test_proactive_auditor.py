"""Tests del revisor proactivo local (proactive_auditor)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models import ElementModel, ElementType  # noqa: E402
from modules.proactive_auditor import audit_elements, refine_with_llm  # noqa: E402


def _para(text: str, eid: str = "e1") -> ElementModel:
    return ElementModel(id=eid, type=ElementType.PARAGRAPH, text=text)


def _kinds(findings, kind):
    return [f for f in findings if f["kind"] == kind]


def test_first_person_positive():
    f = audit_elements([_para("Yo considero que el metodo funciona.")])
    fp = _kinds(f, "first_person")
    # Pronombre + frase de opinion en la misma clausula se fusionan en uno.
    assert len(fp) == 1
    assert "Yo" in fp[0]["excerpt"]
    assert fp[0]["start"] == 0


def test_first_person_me_not_flagged():
    f = audit_elements([_para("El libro que me recomendaron es bueno.")])
    assert _kinds(f, "first_person") == []


def test_first_person_que_guard():
    # 'que' antes no convierte el match; pero 'lo que nosotros' si es persona.
    f = audit_elements([_para("Esto muestra que la teoria aplica.")])
    assert _kinds(f, "first_person") == []


def test_first_person_in_quotes_ignored():
    f = audit_elements([_para('El autor escribio: "yo afirmo" en 1990.')])
    assert _kinds(f, "first_person") == []


def test_creemos_que_flagged():
    f = audit_elements([_para("Creo que los datos son suficientes.")])
    assert len(_kinds(f, "first_person")) == 1


def test_ai_phrase():
    f = audit_elements([_para("Cabe destacar que el resultado fue positivo.")])
    ai = _kinds(f, "ai_phrase")
    assert len(ai) == 1
    assert ai[0]["excerpt"].lower().startswith("cabe destacar")


def test_missing_space_after_punct():
    f = audit_elements([_para("Termino la frase.Así empieza otra.")])
    p = _kinds(f, "pegado")
    assert any(x["severity"] == "error" for x in p)


def test_duplicate_word():
    f = audit_elements([_para("El resultado final final fue claro.")])
    dup = [x for x in _kinds(f, "pegado") if "duplicada" in x["message"]]
    assert len(dup) == 1


def test_typo_deberia():
    f = audit_elements([_para("Esto deberia funcionar mejor.")])
    ort = _kinds(f, "ortografia")
    assert len(ort) == 1
    assert ort[0]["suggestion"] == "debería"


def test_no_findings_clean_text():
    f = audit_elements([_para("El análisis de datos confirma la hipótesis planteada por autores previos.")])
    assert f == []


def test_headings_excluded():
    h = ElementModel(id="h1", type=ElementType.HEADING, heading_level=1,
                     text="Nosotros analizamos")
    assert audit_elements([h]) == []


def test_llm_no_key_passthrough():
    findings = [{"element_id": "e", "start": 0, "end": 4, "excerpt": "x",
                 "kind": "ortografia", "severity": "error", "message": "m",
                 "source": "local"}]
    out, used = refine_with_llm(findings, [], "")
    assert out == findings and used is False


def test_bloom_audit_objective_valid_and_vague():
    from modules.proactive_auditor import audit_objective

    valid = audit_objective("Diseñar un sistema de inventario automatizado.")
    assert valid["is_measurable"] is True
    assert valid["verb_detected"] == "diseñar"
    assert valid["bloom_level"] == "crear"

    vague = audit_objective("Aprender y conocer sobre sistemas de información.")
    assert vague["is_measurable"] is False
    assert "conocer" in vague["vague_verbs_used"]


def test_bloom_objectives_hierarchy_violation():
    from modules.proactive_auditor import audit_objectives_hierarchy

    # General es nivel 4 (Analizar), pero un específico es nivel 6 (Diseñar) -> Incoherencia
    gen = "Analizar los procesos de producción de la empresa."
    specs = [
        "Identificar las etapas del proceso.",  # nivel 1 (Recordar)
        "Diseñar un nuevo modelo de optimización." # nivel 6 (Crear) -> violacion
    ]
    res = audit_objectives_hierarchy(gen, specs)
    assert res["is_coherent"] is False
    assert any("supera nivel del general" in f["title"] for f in res["findings"])


def test_burstiness_score_calculation():
    from modules.proactive_auditor import burstiness_score

    sentences = [
        "Esta es una oración corta.",
        "A continuación se presenta un análisis extremadamente detallado y profundo sobre los diversos factores cuantitativos.",
        "Se midió.",
        "Los resultados obtenidos durante las pruebas de campo en la universidad demostraron la factibilidad técnica del prototipo.",
        "Breve resumen."
    ]
    res = burstiness_score(sentences)
    assert res["burstiness_score"] >= 0.5
    assert "Sospecha IA" not in res["interpretation"]


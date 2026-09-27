"""Tests del vocabulario y la comparacion de titulos de fase.

Por que este archivo existe: antes, el alcance de una regla se decidia
buscando palabras en el texto del elemento, y "meta" esta dentro de
"metodologia". Aqui la comparacion solo puede ocurrir sobre el TITULO de un
H1, asi que estos tests fijan WHERE se puede comparar y WHAT cuenta como
mismo titulo.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models import ElementModel, ElementType  # noqa: E402
from modules.finding import mk  # noqa: E402
from modules.proactive_auditor import audit_elements  # noqa: E402
from modules.phase_scope import (  # noqa: E402
    NO_PHASE_KEY,
    phase_findings,
    PORTADA_KEY,
    build_phase_map,
    match_phase,
    normalize_title,
    phase_label,
)


# ── Normalizacion ───────────────────────────────────────────────────────────

def test_normalize_quita_acentos_numeracion_y_puntos():
    assert normalize_title("3. Objetivos") == "objetivos"
    assert normalize_title("IV. METODO:") == "metodo"
    assert normalize_title("  Discusion  ") == "discusion"
    assert normalize_title("Anexos") == "anexos"


def test_normalize_no_comer_una_palabra_que_empieza_como_numero_romano():
    # "Metodologia" y "Discusion" arrancan con letras que el patron de
    # numeracion romana tambien acepta (m, d). El `\s+` del final es lo que
    # evita que se traguen la primera letra: sin el, "metodologia" se
    # normalizaba a "etodologia" y ninguna fase del documento seellia.
    assert normalize_title("Metodologia") == "metodologia"
    assert normalize_title("Discusion") == "discusion"
    assert normalize_title("Marco teorico") == "marco teorico"
    assert normalize_title("Metodologia del analisis") == "metodologia del analisis"


# ── Comparacion ─────────────────────────────────────────────────────────────

def test_match_titulo_exacto():
    assert match_phase("Objetivos") == "objetivos"
    assert match_phase("METODOLOGIA") == "metodo"
    assert match_phase("Conclusiones") == "conclusiones"


def test_match_titulo_con_calificador():
    # El calificador no rompe el reconocimiento: el titulo sigue siendo la fase.
    assert match_phase("Resultados de la encuesta") == "resultados"
    assert match_phase("Discusion de los hallazgos") == "discusion"


def test_match_acepta_abstract():
    assert match_phase("Abstract") == "resumen"
    assert match_phase("Resumen") == "resumen"


def test_titulo_desconocido_no_abre_fase():
    assert match_phase("Agradecimientos") is None
    assert match_phase("Analisis de los datos") is None


def test_metodologia_es_nombre_de_fase_y_nunca_disparador_de_objetivos():
    # El bug, escrito al reves: "meta" ya no esta en ningun lado del
    # vocabulario de objetivos, y "Metodologia" solo abre la fase metodo
    # cuando es EL TITULO de un H1.
    assert match_phase("Metodologia") == "metodo"
    assert match_phase("Metafora del sucesso") is None


def test_titulo_vacio_no_abre_fase():
    assert match_phase("") is None
    assert normalize_title("   ") == ""


# ── El vocabulario esta completo ────────────────────────────────────────────

def test_toda_fase_del_vocabulario_es_alcanzable():
    for titulo in ("Resumen", "Introduccion", "Marco teorico", "Metodo",
                   "Resultados", "Discusion", "Conclusiones", "Referencias",
                   "Anexos"):
        key = match_phase(titulo)
        assert key is not None, f"{titulo} deberia abrir una fase"
        assert key != NO_PHASE_KEY


def test_portada_reconocida():
    assert match_phase("Titulo") == PORTADA_KEY
    assert match_phase("Portada") == PORTADA_KEY


# ── Mapa de ambitos ─────────────────────────────────────────────────────────

def _h(eid, text, level=1, cover=False):
    return ElementModel(id=eid, type=ElementType.HEADING, heading_level=level,
                        text=text, is_cover_section=cover)


def _p(eid, text):
    return ElementModel(id=eid, type=ElementType.PARAGRAPH, text=text)


# Review Focus: documento sin H1, y documento vacio.

def test_documento_vacio_no_crashea():
    phase_by_id, spans = build_phase_map([])
    assert phase_by_id == {}
    assert spans == []


def test_documento_sin_h1_todo_es_portada():
    # El contenido anterior al primer H1 pertenece a la portada: zona protegida.
    els = [_p("a", "Primer parrafo"), _p("b", "Segundo parrafo")]
    phase_by_id, spans = build_phase_map(els)
    assert phase_by_id["a"] == "portada"
    assert phase_by_id["b"] == "portada"
    assert [s.key for s in spans] == ["portada"]


def test_portada_por_is_cover_section_manda_sobre_el_titulo():
    els = [_h("h0", "Resumen", level=1, cover=True), _p("a", "texto")]
    phase_by_id, _ = build_phase_map(els)
    assert phase_by_id["a"] == "portada"


def test_h1_abre_ambito_y_el_cuerpo_lo_hereda():
    els = [_h("h1", "Objetivos"), _p("a", "Analizar el contexto"),
           _h("h2", "Metodo"), _p("b", "Se aplico una encuesta")]
    phase_by_id, _ = build_phase_map(els)
    assert phase_by_id["a"] == "objetivos"
    assert phase_by_id["b"] == "metodo"


def test_h2_hereda_y_no_abre_ambito_propio():
    # El H2 "Resultados de la encuesta" NO abre 'resultados': es un H2, y un
    # H2 hereda. Este es el caso que el editor de la Tarea 5 promotional a H1.
    els = [_h("h1", "Metodo"), _h("h2", "Resultados de la encuesta", level=2),
           _p("a", "Se obtuvo un 80%")]
    phase_by_id, _ = build_phase_map(els)
    assert phase_by_id["a"] == "metodo"


def test_h1_desconocido_abre_sin_fase():
    # Review Focus: un H1 fuera del vocabulario es una seccion cualquiera.
    els = [_h("h1", "Agradecimientos"), _p("a", "Gracias a mi familia")]
    phase_by_id, _ = build_phase_map(els)
    assert phase_by_id["a"] == "sin_fase"


def test_spans_cubren_el_documento_sin_solaparse():
    els = [_h("h1", "Resumen"), _p("a", "x"), _h("h2", "Introduccion"),
           _p("b", "y"), _h("h3", "Agradecimientos"), _p("c", "z")]
    _, spans = build_phase_map(els)
    assert [s.key for s in spans] == ["resumen", "introduccion", "sin_fase"]
    for i, s in enumerate(spans):
        fin = spans[i + 1].start_index if i + 1 < len(spans) else len(els)
        assert s.end_index == fin
    assert spans[0].start_index == 0


def test_phase_label_de_ambito_desconocido_no_crashea():
    assert phase_label("objetivos") == "Objetivos"
    assert phase_label("sin_fase") == "Seccion sin nombre"
    assert phase_label("clave_inventada") == "Seccion sin nombre"


# ── Criterios de fase: la portada se mide, no se escribe ─────────────────────

def _f(phase, text, eid="e1", is_cover=False):
    return phase_findings(phase, eid, text, mk=mk, is_cover=is_cover)


def _portada(text, eid="c1"):
    return _f("portada", text, eid, is_cover=True)


# Review Focus: un incumplimiento real de portada.

def test_titulo_largo_es_hallazgo_de_portada():
    out = _portada("Un titulo realmente largo " * 6)
    assert [f["kind"] for f in out] == ["portada_title_larga"]
    assert out[0]["phase"] == "portada"
    assert out[0]["read_only"] is True


def test_titulo_corto_no_es_hallazgo():
    assert _portada("Percepcion de la identidad en estudiantes universitarios") == []


def test_titulo_con_punto_final_es_hallazgo():
    out = _portada("Percepcion de la identidad.")
    assert [f["kind"] for f in out] == ["portada_punto_final"]
    assert out[0]["read_only"] is True


def test_los_criterios_de_titulo_exigen_el_elemento_de_portada():
    # Sin `is_cover`, el ambito portada tambien cubre "todo lo anterior al
    # primer H1", que en el modo `texts` es el documento entero. Sin esta
    # guarda, cada parrafo terminado en punto seria un titulo mal escrito.
    assert _f("portada", "Un parrafo normal que termina en punto.") == []
    assert _f("portada", "Y otro mas largo todavia " * 6 + "que sigue.") == []


def test_hallazgo_de_portada_nunca_propone_texto():
    # La invariante de AGENTS.md §1: `use_original_cover` no puede mutar la
    # portada original. Sin `suggestion` no hay nada que la aplicadora escriba.
    for text in ("Un titulo realmente largo " * 6, "Percepcion de la identidad."):
        for f in _portada(text):
            assert "suggestion" not in f, f


def test_sin_fase_no_dispara_ningun_criterio():
    assert _f("sin_fase", "Conocer las causas " * 10) == []


def test_ambito_desconocido_no_dispara_ningun_criterio():
    assert _f("clave_inventada", "Conocer las causas") == []


def test_objetivos_sigue_pudiendo_sugerir():
    # El contraste: solo la portada es de solo lectura.
    out = _f("objetivos", "Conocer las causas del fenomeno")
    assert [f["kind"] for f in out] == ["bloom_vague"]
    assert out[0].get("suggestion") == "determinar"
    assert out[0]["read_only"] is False


def test_portada_no_recibe_los_criterios_de_una_fase_de_prosa():
    # La portada no lleva reglas de prosa: es material, no argumento.
    kinds = {f["kind"] for f in _portada("Conocer las causas " * 8)}
    assert "bloom_vague" not in kinds


def test_un_titulo_de_portada_mal_escrito_llega_al_auditor():
    # Extremo a extremo: el elemento de portada tiene que salir en Revision.
    els = [ElementModel(id="c1", type=ElementType.PORTADA_BLOCK,
                        text="Percepcion de la identidad.", is_cover_section=True),
           _p("e1", "Un parrafo normal que termina en punto.")]
    f = audit_elements(els)
    portada = [x for x in f if x["phase"] == "portada"]
    assert [x["kind"] for x in portada] == ["portada_punto_final"]
    assert portada[0]["read_only"] is True
    assert "suggestion" not in portada[0]
    # Y el parrafo normal no arrastra ruido de portada.
    assert all(x["phase"] != "portada" or x["element_id"] == "c1" for x in f)

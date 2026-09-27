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

from modules.phase_scope import (  # noqa: E402
    NO_PHASE_KEY,
    PORTADA_KEY,
    match_phase,
    normalize_title,
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

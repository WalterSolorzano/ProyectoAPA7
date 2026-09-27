"""Ambitos de fase: los H1 abren un ambito y cada ambito tiene sus criterios.

Este modulo es la UNA fuente de verdad. Antes, el alcance de una regla se
deducia del TEXTO del elemento con `any(kw in low_t for kw in ...)`:
"meta" esta dentro de "metodologia", asi que cualquier parrafo sobre
metodologia disparaba la regla de verbos de objetivos.

Aqui la comparacion solo puede ocurrir sobre el TITULO de un H1 (ver
`match_phase`), nunca sobre el cuerpo de un parrafo. El riesgo no se mitiga
con una lista de palabras mas cuidadosa: se elimina de raiz, porque el punto
de comparacion dejo de ser el cuerpo del texto.

Y como el alcance de una regla es DATO y no un `if` disperso, `RULE_SCOPES`
lo declara explicitamente y `test_rule_scopes.py` falla si el auditor emite
un `kind` que nadie declaro. Sin ese test, el alcance vuelve a inferirse por
descuido la proxima vez que alguien agregue una regla.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

# ── Claves de ambito ────────────────────────────────────────────────────────

GLOBAL = "global"
PORTADA_KEY = "portada"
NO_PHASE_KEY = "sin_fase"


# ── Fase ────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class PhaseConfig:
    """Un ambito abierto por un H1, con los criterios que le son propios.

    `read_only` marca los ambitos donde NADIE escribe. La portada es el
    caso: se mide, y cada incumplimiento aparece en Revision, pero ningun
    hallazgo trae `suggestion`, porque no hay nada que la aplicadora pueda
    escribir sin mutar la portada original (AGENTS.md §1, use_original_cover).
    """

    key: str
    label: str
    titles: Tuple[str, ...]
    criteria: Tuple[str, ...] = ()
    read_only: bool = False
    paragraph_words: Optional[Tuple[int, int]] = None


PHASES: Tuple[PhaseConfig, ...] = (
    PhaseConfig("resumen", "Resumen", ("resumen", "abstract"),
                criteria=("paragraph_words", "verbo_pasado"),
                paragraph_words=(150, 250)),
    PhaseConfig(PORTADA_KEY, "Portada", ("titulo", "portada", "title"),
                criteria=("portada_title_larga", "portada_punto_final"),
                read_only=True),
    PhaseConfig("objetivos", "Objetivos",
                ("objetivos", "objetivo", "proposito", "propositos", "finalidad"),
                criteria=("bloom_verb",)),
    PhaseConfig("introduccion", "Introduccion", ("introduccion",),
                criteria=("paragraph_words",), paragraph_words=(80, 200)),
    PhaseConfig("marco_teorico", "Marco teorico",
                ("marco teorico", "marco referencial", "antecedentes",
                 "revision de literatura"),
                criteria=("paragraph_words", "parafraisis_vs_cita"),
                paragraph_words=(80, 200)),
    PhaseConfig("metodo", "Metodo",
                ("metodo", "metodologia", "materiales y metodos",
                 "diseno metodologico"),
                criteria=("bloom_verb", "paragraph_words"),
                paragraph_words=(80, 200)),
    PhaseConfig("resultados", "Resultados", ("resultados", "resultado"),
                criteria=("verbo_pasado",)),
    PhaseConfig("discusion", "Discusion", ("discusion",),
                criteria=("verbo_pasado",)),
    PhaseConfig("conclusiones", "Conclusiones",
                ("conclusiones", "conclusion", "consideraciones finales"),
                criteria=("verbo_pasado",)),
    PhaseConfig("referencias", "Referencias",
                ("referencias", "bibliografia", "works cited")),
    PhaseConfig("anexos", "Anexos",
                ("anexos", "apendice", "apendices")),
)

PHASE_BY_KEY: Dict[str, PhaseConfig] = {p.key: p for p in PHASES}


# ── Normalizacion y comparacion de titulos ───────────────────────────────────

# El `\s+` del final es lo que hace seguro este patron. `[ivxlcdm]+` acepta
# "m" y "d", asi que sin el, "Metodologia" perdia la primera letra y ninguna
# fase del documento seellia. Ver test_normalize_no_comer_una_palabra_...
_NUM_PREFIX = re.compile(r"^(?:[ivxlcdm]+|\d+(?:\.\d+)*)[.)]?\s+", re.IGNORECASE)
_NON_ALNUM = re.compile(r"[^a-z0-9\s]")
_WS = re.compile(r"\s+")

# "Resultados de la encuesta" -> cabeza "resultados". Se corta por la palabra
# calificador, NO por subcadena: "Analisis de los datos" da cabeza "analisis",
# que no esta en el vocabulario, asi que NO abre fase.
_QUALIFIER = re.compile(r"^(?P<head>[a-z0-9]+)\s+(?:de|del|la|el|los|las|para|sobre|y)\s+")


def normalize_title(raw: str) -> str:
    """Minusculas, sin acentos, sin numeracion inicial, sin puntuacion.

    "3. Objetivos" / "IV. METODO:" / "  Discusion  "
      -> "objetivos" / "metodo" / "discusion"
    """
    text = unicodedata.normalize("NFKD", raw or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower().strip()
    text = _NUM_PREFIX.sub("", text)
    text = _NON_ALNUM.sub(" ", text)
    return _WS.sub(" ", text).strip()


_BY_TITLE: Dict[str, str] = {}
for _cfg in PHASES:
    for _t in _cfg.titles:
        _BY_TITLE[normalize_title(_t)] = _cfg.key


def match_phase(title: str) -> Optional[str]:
    """Clave de fase que abre un H1 con este titulo, o `None`.

    Acepta el titulo exacto o su cabeza cuando el resto es un calificador.
    `None` es una respuesta correcta y frecuente: un H1 que no esta en el
    vocabulario es una seccion cualquiera y no hereda ningun criterio.
    """
    norm = normalize_title(title)
    if not norm:
        return None
    if norm in _BY_TITLE:
        return _BY_TITLE[norm]
    head = _QUALIFIER.match(norm)
    if head:
        return _BY_TITLE.get(head.group("head"))
    return None


# ── Ambitos declarados por regla ────────────────────────────────────────────

RULE_SCOPES: Dict[str, str] = {
    # Reglas generales: aplican a TODO el documento, esten donde esten. El
    # detector de IA es el ejemplo canonico: seis marcas de IA son un
    # problema en cualquier fase.
    "first_person": GLOBAL,
    "ai_phrase": GLOBAL,
    "muletilla": GLOBAL,
    "pegado": GLOBAL,
    "ortografia": GLOBAL,
    "repeticion": GLOBAL,
    "persona": GLOBAL,
    "incompleta": GLOBAL,
    "ambigua": GLOBAL,
    "passive_voice": GLOBAL,
    "long_sentence": GLOBAL,
    "ngram_repetition": GLOBAL,
    "bloom_low": GLOBAL,
    # Reglas de fase: solo dentro del ambito que las declara. "fase" significa
    # "el umbral depende de la fase", no una fase en concreto.
    "bloom_vague": "objetivos",
    "paragraph_words": "fase",
    "verbo_pasado": "fase",
    "parafraisis_vs_cita": "marco_teorico",
    "portada_title_larga": PORTADA_KEY,
    "portada_punto_final": PORTADA_KEY,
}

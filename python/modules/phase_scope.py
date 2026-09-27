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
from typing import Any, Dict, List, Optional, Sequence, Tuple

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


# ── Criterios de fase ───────────────────────────────────────────────────────

# Verbos imprecisos para un objetivo de investigacion: no dicen QUE se va a
# hacer ni COMO se va a medir. Esta lista es de aqui y no de
# `proactive_auditor`, que la importa: `audit_objective` (proactive_auditor)
# la usa tambien, y dos copias de la misma lista divergen solas.
#
# Ojo con las entradas de varias palabras: "tener idea de" se busca como
# subcadena, asi que "no tener idea de" tambien matchea. Es aceptable porque
# las dos son igual de imprecisas.
VAGUE_VERBS: Tuple[str, ...] = (
    "conocer", "entender", "aprender", "saber", "comprender", "estudiar",
    "familiarizarse", "tener idea de", "estar al tanto de", "darse cuenta de",
)

# Verbos que en una fase de resultados/discusion/conclusion deberian estar en
# pasado, porque en esas fases ya se reporto lo que se hizo.
_PAST_ONLY_VERBS: Tuple[str, ...] = (
    "proponer", "buscar", "describir", "analizar", "evaluar", "determinar",
    "medir", "desarrollar", "aplicar", "comparar",
)

_WORD_SPLIT = re.compile(r"\S+")


def _check_bloom_verb(eid: str, text: str, cfg: PhaseConfig, mk) -> List[Dict[str, Any]]:
    low = text.lower()
    for verb in VAGUE_VERBS:
        pos = low.find(verb)
        if pos >= 0:
            return [mk(eid, text, pos, pos + len(verb), "bloom_vague", "warn",
                       f'Verbo impreciso "{text[pos:pos + len(verb)]}" en la fase '
                       f"{cfg.label}; usa un verbo en infinitivo medible "
                       f"(determinar, medir, evaluar)",
                       suggestion="determinar", phase=cfg.key,
                       read_only=cfg.read_only)]
    return []


def _check_paragraph_words(eid: str, text: str, cfg: PhaseConfig, mk) -> List[Dict[str, Any]]:
    if not cfg.paragraph_words:
        return []
    lo, hi = cfg.paragraph_words
    n = len(_WORD_SPLIT.findall(text or ""))
    if lo <= n <= hi:
        return []
    return [mk(eid, text, 0, len(text or ""), "paragraph_words",
               "info" if n > hi else "warn",
               f"Este parrafo tiene {n} palabras y la fase {cfg.label} pide "
               f"entre {lo} y {hi}",
               phase=cfg.key, read_only=cfg.read_only)]


def _check_verbo_pasado(eid: str, text: str, cfg: PhaseConfig, mk) -> List[Dict[str, Any]]:
    low = text.lower()
    for verb in _PAST_ONLY_VERBS:
        pos = low.find(verb)
        if pos >= 0:
            return [mk(eid, text, pos, pos + len(verb), "verbo_pasado", "info",
                       f'"{text[pos:pos + len(verb)]}" esta en infinitivo; la fase '
                       f"{cfg.label} ya reporto lo que se hizo, asi que va en pasado",
                       phase=cfg.key, read_only=cfg.read_only)]
    return []


def _check_portada_title_larga(eid: str, text: str, cfg: PhaseConfig, mk) -> List[Dict[str, Any]]:
    n = len(_WORD_SPLIT.findall(text or ""))
    if n <= 20:
        return []
    return [mk(eid, text, 0, len(text or ""), "portada_title_larga", "warn",
               f"El titulo tiene {n} palabras; un titulo de portada no suele "
               f"pasar de 20", phase=cfg.key, read_only=True)]


def _check_portada_punto_final(eid: str, text: str, cfg: PhaseConfig, mk) -> List[Dict[str, Any]]:
    stripped = (text or "").strip()
    if not stripped.endswith("."):
        return []
    return [mk(eid, text, max(0, len(stripped) - 1), len(stripped),
               "portada_punto_final", "info",
               "El titulo de portada no lleva punto final",
               phase=cfg.key, read_only=True)]


# Criterios que solo tienen sentido sobre el ELEMENTO DE PORTADA, no sobre
# cualquier elemento que caiga en su ambito.
#
# El ambito `portada` tambien cubre "todo lo que hay antes del primer H1", que
# en el modo `texts` del endpoint es el documento entero. Aplicar "el titulo no
# lleva punto final" ahi hacia que CADA parrafo terminara en punto fuera
# senalado, y el test `test_no_findings_clean_text` lo cazo. Un criterio sobre
# el titulo necesita el titulo.
_PORTADA_ONLY = {"portada_title_larga", "portada_punto_final"}


_CHECKS = {
    "bloom_verb": _check_bloom_verb,
    "paragraph_words": _check_paragraph_words,
    "verbo_pasado": _check_verbo_pasado,
    "portada_title_larga": _check_portada_title_larga,
    "portada_punto_final": _check_portada_punto_final,
}


def phase_findings(phase: str, eid: str, text: str, *, mk,
                   is_cover: bool = False) -> List[Dict[str, Any]]:
    """Hallazgos de los criterios de la fase a la que pertenece este elemento.

    Un elemento en `sin_fase` no esta en ninguna fase del vocabulario y no
    dispara nada. Las reglas generales NO pasan por aca: ya corrieron, y lo
    hacen en todas las fases.

    `is_cover` habilita los criterios que son sobre el titulo de portada. Sin
    el, un documento sin H1 —que es TODO documento en el modo `texts` del
    endpoint—hacia que cada parrafo con punto final se reportara como un titulo mal escrito.
    """
    cfg = PHASE_BY_KEY.get(phase)
    if cfg is None or not cfg.criteria:
        return []
    out: List[Dict[str, Any]] = []
    for cid in cfg.criteria:
        if cid in _PORTADA_ONLY and not is_cover:
            continue
        check = _CHECKS.get(cid)
        if check is not None:
            out.extend(check(eid, text, cfg, mk))
    return out


# ── Mapa de ambitos ─────────────────────────────────────────────────────────

@dataclass(frozen=True)
class PhaseSpan:
    """Un ambito y el rango de elementos que cubre, para poder reportarlo."""

    key: str
    label: str
    heading_id: str
    start_index: int
    end_index: int


def phase_label(key: str) -> str:
    cfg = PHASE_BY_KEY.get(key)
    return cfg.label if cfg else "Seccion sin nombre"


def etype(e: Any) -> str:
    """Tipo del elemento como string, tolerante a enum y a string plano."""
    t = getattr(e, "type", "")
    return str(getattr(t, "value", t) or "")


def _level(e: Any) -> int:
    """Nivel del encabezado. `None` se trata como 1, que es el default real
    de `ElementModel.heading_level`."""
    raw = getattr(e, "heading_level", None)
    return 1 if raw is None else int(raw)


def _close(span: PhaseSpan, end_index: int) -> PhaseSpan:
    return PhaseSpan(key=span.key, label=span.label, heading_id=span.heading_id,
                     start_index=span.start_index, end_index=end_index)


def build_phase_map(elements: Sequence[Any]) -> Tuple[Dict[str, str], List[PhaseSpan]]:
    """Ambito de cada elemento, y los tramos que esos ambitos cubren.

    Precedencia, en este orden:
      1. Todo elemento con `is_cover_section` o tipo `portada_block` es portada.
      2. Un H1 reconocido cambia el ambito al que su titulo abra, o a
         `sin_fase` si el titulo no esta en el vocabulario.
      3. Un H2 o un H3 **hereda**: no cambian el ambito. Por eso el mapa se
         construye solo con H1 y no hay ambiguedad de anidamiento posible.
      4. Antes del primer H1, el ambito es `portada`.
    """
    phase_by_id: Dict[str, str] = {}
    spans: List[PhaseSpan] = []
    current = PORTADA_KEY
    # Un tramo solo se abre si el ambito tiene ALGO dentro. Un documento que
    # arranca con un H1 no tiene un tramo de portada vacio que reportar, y
    # uno con start_index == end_index la interfaz lo pintaria como una fase
    # mas. De ahi el `region_open`: `key != current` no basta para saber que
    # hay un tramo anterior que cerrar.
    region_open = False

    for i, e in enumerate(elements):
        kind = etype(e)
        if getattr(e, "is_cover_section", False) or kind == "portada_block":
            key = PORTADA_KEY
        elif kind == "heading" and _level(e) == 1:
            key = match_phase(getattr(e, "text", "") or "") or NO_PHASE_KEY
        else:
            key = current

        if region_open and key != current:
            spans[-1] = _close(spans[-1], i)
        if not region_open or key != current:
            spans.append(PhaseSpan(key=key, label=phase_label(key),
                                   heading_id=str(getattr(e, "id", "") or ""),
                                   start_index=i, end_index=len(elements)))
            region_open = True

        current = key
        phase_by_id[str(getattr(e, "id", "") or "")] = current

    if spans:
        spans[-1] = _close(spans[-1], len(elements))
    return phase_by_id, spans

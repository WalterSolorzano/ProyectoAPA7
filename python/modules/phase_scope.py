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
from typing import Any, Dict, List, NamedTuple, Optional, Sequence, Tuple

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
                ("objetivos", "objetivo", "proposito", "propositos", "finalidad",
                 "objetivo general", "objetivos generales", "objetivo especifico",
                 "objetivos especificos", "objetivos especificos de la investigacion",
                 "objetivos especificos de la investigacion"),
                criteria=("bloom_verb",)),
    PhaseConfig("introduccion", "Introduccion",
                ("introduccion", "introduccion al problema", "planteamiento del problema"),
                criteria=("paragraph_words",), paragraph_words=(80, 200)),
    PhaseConfig("marco_teorico", "Marco teorico",
                ("marco teorico", "marco referencial", "marco de referencia",
                 "antecedentes", "revision de la literatura", "revision teorica",
                 "fundamentacion teorica", "bases teoricas"),
                criteria=("paragraph_words", "parafraisis_vs_cita"),
                paragraph_words=(80, 200)),
    PhaseConfig("metodo", "Metodo",
                ("metodo", "metodologia", "materiales y metodos",
                 "diseno metodologico", "metodologia de la investigacion",
                 "enfoque metodologico"),
                criteria=("bloom_verb", "paragraph_words"),
                paragraph_words=(80, 200)),
    PhaseConfig("resultados", "Resultados", ("resultados", "resultado"),
                criteria=("verbo_pasado",)),
    PhaseConfig("discusion", "Discusion", ("discusion", "analisis de resultados"),
                criteria=("verbo_pasado",)),
    PhaseConfig("conclusiones", "Conclusiones",
                ("conclusiones", "conclusion", "consideraciones finales",
                 "consideraciones finales y recomendaciones"),
                criteria=("verbo_pasado",)),
    PhaseConfig("referencias", "Referencias",
                ("referencias", "referencias bibliograficas", "bibliografia",
                 "bibliografia consultada", "works cited")),
    PhaseConfig("anexos", "Anexos",
                ("anexos", "anexo", "apendice", "apendices")),
)

PHASE_BY_KEY: Dict[str, PhaseConfig] = {p.key: p for p in PHASES}


# ── Normalizacion y comparacion de titulos ───────────────────────────────────

# "Capitulo III. Metodologia" -> "Metodologia". Sin esto, ningun titulo de
# tesis con ese prefijo abria fase, y es la forma mas comun en un capitulo.
_CHAPTER_PREFIX = re.compile(
    r"^\s*(?:capitulo|capitulo|parte|seccion|unit)\s+[ivxlcdm]+[.)]?\s+",
    re.IGNORECASE,
)

# El prefijo de numeración se quita SOLO si lo que sigue arranca en mayúscula.
#
# `[ivxlcdm]` acepta m, i, l, d, c, v, x: sin el filtro de mayúscula, "Mi
# metodología" perdía "Mi" y "Mil y una noches" se volvía "y una noches". Con
# el filtro, "3. Objetivos" y "IV. METODO" se siguen limpiando, que es lo
# único que el patrón es para. El comentario anterior afirmaba que el `\s+`
# final bastaba; no bastaba, y este es el arreglo.
_NUM_PREFIX = re.compile(r"^(?:[ivxlcdmIVXLCDM]+|\d+(?:\.\d+)*)[.)]?\s+")
_NON_ALNUM = re.compile(r"[^a-z0-9\s]")
_WS = re.compile(r"\s+")

# "Resultados de la encuesta" -> cabeza "resultados". Se corta por la palabra
# calificador, NO por subcadena: "Analisis de los datos" da cabeza "analisis",
# que no esta en el vocabulario, asi que NO abre fase.
#
# Se toleran hasta DOS palabras modificadoras antes del calificador porque los
# títulos de tesis las traen: "Objetivos específicos de la investigación" tiene
# "específicos" en el medio y sin él la fase se quedaba muda.
_QUALIFIER = re.compile(
    r"^(?P<head>[a-z0-9]+)(?:\s+[a-z0-9]+){0,2}?\s+"
    r"(?:de|del|la|el|los|las|para|sobre|y)\s+"
)


def normalize_title(raw: str) -> str:
    """Minusculas, sin acentos, sin numeracion inicial, sin puntuacion.

    "3. Objetivos" / "IV. METODO:" / "Capitulo III. Metodologia" / "  Discusion  "
      -> "objetivos" / "metodo" / "metodologia" / "discusion"
    """
    text = unicodedata.normalize("NFKD", raw or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.strip()
    text = _CHAPTER_PREFIX.sub(" ", text)
    num = _NUM_PREFIX.match(text)
    if num and text[num.end():num.end() + 1].isupper():
        text = text[num.end():]
    text = text.lower()
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


def match_phase_exact(title: str) -> Optional[str]:
    """Como `match_phase`, pero SOLO si el titulo ES el nombre de la fase.

    La diferencia es la que separa un error de una decision del autor. Un H2
    que dice "Resultados" a secas es una fase mal nivelada y conviene
    promoverla. Un H2 que dice "Resultados de la encuesta" bajo "Metodo" es
    una subseccion que el autor puso ahi a proposito: el calificador es la
    senal de que quiere decir algo concreto, no la fase genérica.

    Por eso el editor usa ESTA y el auditor usa la otra. El auditor quiere
    medir el cuerpo de la fase, y "Resultados de la encuesta" pertenece a la
    fase Resultados. El editor quiere corregir niveles, y ahi el calificador
    significa lo contrario.
    """
    norm = normalize_title(title)
    if not norm:
        return None
    return _BY_TITLE.get(norm)


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
    # Las ocho universales baratas del spec §12 NO se declaran todas aca: cada
    # una se declara en la misma linea donde se implementa, en `GLOBAL_CHECKS`.
    # Declararlas todas aqui y programarlas mas adelante deja un commit con
    # reglas muertas declaradas, que es justo lo que el guard de
    # `test_toda_regla_global_declarada_tiene_implementacion` prohibe.
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


# Una cita APA en el cuerpo: (Perez, 2020) o Perez (2020). Su ausencia es lo
# que hace que una atribucion sea sospechosa.
_CITE_RE = re.compile(r"\([^()]{2,60},\s*(?:19|20)\d{2}[a-z]?\)")
_WORD_RE = re.compile(r"\S+")
# Nombres propios que NO son autores citados: propios de la propia institucion,
# paises y el nombre de la disciplina.
_NOT_A_CITED_AUTHOR = {
    "managua", "nicaragua", "universidad", "republica", "ministerio", "instituto",
    "escuela", "facultad", "departamento", "america", "latinoamerica", "espana",
    "estados", "datos", "tabla", "figura", "grafico", "anexo", "capitulo",
}


def _check_parafraisis_vs_cita(eid: str, text: str, cfg: PhaseConfig, mk) -> List[Dict[str, Any]]:
    """Atribucion con forma de autor y sin cita.

    Version minima y honesta: mira un token con forma de apellido (mayuscula
    inicial, no al inicio de oracion, no en la lista de palabras que no son
    autores) y avisa si el parrafo no trae ninguna cita APA. NO decide si la
    parafrasis esta bien: eso es juicio, y lo hace la capa semantica. Esto
    solo dice "mencionaste a alguien y no lo citaste", que es determinista.
    """
    if _CITE_RE.search(text or ""):
        return []
    for m in re.finditer(r"(?<!^)(?<![.!?:;]\s)(?<!¿)([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{3,})", text or ""):
        apellido = m.group(1).lower()
        if apellido in _NOT_A_CITED_AUTHOR:
            continue
        return [mk(eid, text, m.start(1), m.end(1), "parafraisis_vs_cita", "info",
                   f'Mencionas "{m.group(1)}" sin una cita (Autor, año) en el '
                   f"párrafo. En marco teórico, lo que se atribuye a un autor "
                   f"lleva cita o se parafrasea explícito.",
                   phase=cfg.key, read_only=cfg.read_only)]
    return []


# Criterios que solo tienen sentido sobre el TITULO de la portada, no sobre
# cualquier elemento de ella.
#
# El elemento de portada no es el titulo: `pre_classifier` convierte CADA
# parrafo anterior al limite de portada en `portada_block`, o sea el autor, el
# docente, la fecha y el lugar tambien lo son. Aplicar "el titulo no lleva
# punto final" a todos ellos hacia que cada linea puntuada de la portada fuera
# un hallazgo, y como son de solo lectura el usuario solo los descarta de a
# uno. El flag que decide se llama `is_cover_title` y lo calcula el llamador;
# su nombre viejo (`is_cover`) es exactamente lo que confundo.
_PORTADA_ONLY = {"portada_title_larga", "portada_punto_final"}


_CHECKS = {
    "parafraisis_vs_cita": _check_parafraisis_vs_cita,
    "bloom_verb": _check_bloom_verb,
    "paragraph_words": _check_paragraph_words,
    "verbo_pasado": _check_verbo_pasado,
    "portada_title_larga": _check_portada_title_larga,
    "portada_punto_final": _check_portada_punto_final,
    # `parafraisis_vs_cita` se vivio DOS TAREAS declarado en `marco_teorico`
    # y en RULE_SCOPES sin entrada aca, y `phase_findings` lo ignoraba en
    # silencio: la fase marco teorico tenia 1 criterio vivo de 2 y nadie lo
    # notaba. `test_criterios_declarados_estan_implementados` es el guard que
    # faltaba; ver la nota de R12 en el ledger.
}


def phase_findings(phase: str, eid: str, text: str, *, mk,
                   is_cover_title: bool = False) -> List[Dict[str, Any]]:
    """Hallazgos de los criterios de la fase a la que pertenece este elemento.

    Un elemento en `sin_fase` no esta en ninguna fase del vocabulario y no
    dispara nada. Las reglas generales NO pasan por aca: ya corrieron, y lo
    hacen en todas las fases.

    `is_cover_title` habilita los criterios que son sobre el titulo de portada.
    Lo que cuenta es ser EL TITULO (la primera linea con texto de la portada),
    no estar en la portada: sin esa distincion, cada linea puntuada de la
    portada —el autor, el docente, la fecha— salia reportada como un titulo
    mal escrito.
    """
    cfg = PHASE_BY_KEY.get(phase)
    if cfg is None or not cfg.criteria:
        return []
    out: List[Dict[str, Any]] = []
    for cid in cfg.criteria:
        if cid in _PORTADA_ONLY and not is_cover_title:
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

# ── Capa 2: reglas globales ─────────────────────────────────────────────────
#
# Las reglas GLOBALES corren en todo el documento, sin importar la fase. No
# pueden recibir el ambito: si lo reciben, son de fase. Viven aca y no sueltas
# dentro de `audit_elements` por la misma razon que las de fase viven en
# `phase_findings`: para que "esta regla existe" sea una fila de un diccionario
# y no un `if` que hay que encontrar en 500 lineas.
#
# Estas SI necesitan estado de documento —una sigla se define una vez, una
# unidad se compara contra todo el texto, los conectores se cuentan por
# frecuencia—, asi que reciben un contexto que se calcula UNA vez antes del
# bucle, igual que hoy hace `repeat_muletilla`.


class GlobalContext(NamedTuple):
    """Estado de documento que las reglas globales necesitan.

    `doc_words` es el largo REAL en palabras, porque las frecuencias de R-G63
    se normalizan por mil palabras: tres "sin embargo" en un documento de 300
    palabras es un problema y en uno de 12.000 no.
    """
    doc_words: int
    seen_acronyms: frozenset
    connector_counts: dict


def build_global_context(elements: Sequence[Any]) -> GlobalContext:
    textos = [(getattr(e, "text", "") or "") for e in elements]
    return GlobalContext(
        doc_words=sum(len(_WORD_SPLIT.findall(t)) for t in textos),
        seen_acronyms=frozenset(),
        connector_counts={},
    )


def global_findings(eid: str, text: str, ctx: GlobalContext, *, mk) -> List[Dict[str, Any]]:
    """Hallazgos de las reglas globales sobre un parrafo.

    Nunca recibe el ambito, y eso no es una omision: una regla que lo recibiera
    seria de fase, y confundir las dos capas es exactamente el defecto que este
    modulo vino a eliminar.
    """
    out: List[Dict[str, Any]] = []
    for check in GLOBAL_CHECKS.values():
        out.extend(check(eid, text, ctx, mk))
    return out


# Los ids son los del catalogo (spec §12) y el `kind` que viaja al frontend es
# el mismo id: asi la fila de `PROOFREAD_SPECS` y el mapa de transparencia
# hablan del mismo nombre.
GLOBAL_CHECKS: Dict[str, Any] = {}


def _in_quoted(text: str, pos: int) -> bool:
    """True si la posicion cae dentro de un tramo entre comillas.

    Citar un texto con exclamaciones o coloquialismos es legitimo. Es la misma
    guarda que usa el corrector para la primera persona, y por el mismo motivo:
    lo que se audita es la prosa de quien escribe, no lo que cita.
    """
    antes = text[:pos]
    if antes.count('"') % 2 == 1:
        return True
    return antes.count("“") > antes.count("”")


def _sentences(text: str) -> List[str]:
    return [s for s in re.split(r"(?<=[.!?])\s+", (text or "").strip()) if s]


# ── R-G51 y R-G52: registro y tono ──────────────────────────────────────────

# R-G52: sin exclamaciones de entusiasmo en prosa argumentativa. "Menor" en el
# catalogo, asi que `info`: se informa y no se aplica.
_EXCLAMATION_RE = re.compile(r"!")

# R-G51: registro coloquial. "Critica" en el catalogo, asi que `error`.
# La lista es CERRADA a proposito, y el match exige limites de palabra: un
# detector de coloquialismo por subcadena a pelo es el mismo patron que nos
# mordio con "meta" dentro de "metodologia", y "bueno" no puede ser "buenotrabajo".
_COLOQUIAL = (
    "o sea", "pues", "bueno", "vale", "a ver", "chido", "neta", "ta de",
    "mas o menos", "en el fondo", "se me hace que", "nada que ver",
    "dar en el clavo", "echar la culpa",
)


def _check_g51_registro_coloquial(eid, text, ctx, mk):
    low = (text or "").lower()
    out = []
    for frase in _COLOQUIAL:
        patron = r"(?<![a-záéíóúñ])" + re.escape(frase) + r"(?![a-záéíóúñ])"
        for m in re.finditer(patron, low):
            if _in_quoted(text, m.start()):
                continue
            out.append(mk(eid, text, m.start(), m.end(), "g51_registro_coloquial",
                          "error", f'Registro coloquial: "{frase}". La prosa '
                          f"argumental va en registro formal", phase="global"))
            break
    return out


def _check_g52_exclamacion(eid, text, ctx, mk):
    out = []
    for m in _EXCLAMATION_RE.finditer(text or ""):
        if _in_quoted(text, m.start()):
            continue
        out.append(mk(eid, text, m.start(), m.end(), "g52_exclamacion", "info",
                      "Una exclamacion en prosa argumental: APA 7 no las usa",
                      phase="global"))
    return out


# Declaradas y programadas en la MISMA linea: ver la nota en RULE_SCOPES sobre
# por que las ocho del catalogo no se declaran todas juntas.
RULE_SCOPES.update({
    "g51_registro_coloquial": GLOBAL,
    "g52_exclamacion": GLOBAL,
})

GLOBAL_CHECKS.update({
    "g51_registro_coloquial": _check_g51_registro_coloquial,
    "g52_exclamacion": _check_g52_exclamacion,
})


# ── R-G53 y R-G11: persona y ritmo ───────────────────────────────────────────

# R-G53: segunda persona al lector. "Mayor" en el catalogo.
_READER_RE = re.compile(
    r"(?<![a-záéíóúñ])(?:como veras|como puedes ver|como veas|imagina que|"
    r"fijate|note que|te lo repito|te lo explico)(?![a-záéíóúñ])"
)

# R-G11: variacion en la longitud de oracion. "Menor" en el catalogo.
#
# El piso de 4 oraciones es lo que separa esta regla de un generador de
# falsos positivos: la desviacion de dos numeros no describe un ritmo, y con el
# umbral del catalogo (sigma < 3) un parrafo corto bien escrito —"Se hizo. Se
# vio. Se dijo."— saldria marcado. Es la Review Focus 1 del plan.
_MIN_SENTENCES = 4
_SIGMA_FLOOR = 3.0


def _check_g53_segunda_persona(eid, text, ctx, mk):
    out = []
    # Se busca en la version en minusculas, como con el coloquialismo: buscar
    # con mayusculas initial en el patron hacia que "Como veras" al inicio de
    # oracion — la forma mas comun — no matcheara nunca.
    low = (text or "").lower()
    for m in _READER_RE.finditer(low):
        if _in_quoted(text, m.start()):
            continue
        out.append(mk(eid, text, m.start(), m.end(), "g53_segunda_persona", "medium",
                      f'"{m.group(0)}": segunda persona al lector. La prosa '
                      f"argumental se dirige al tercero", phase="global"))
    return out


def _check_g11_variacion_oracion(eid, text, ctx, mk):
    sents = _sentences(text)
    if len(sents) < _MIN_SENTENCES:
        return []
    largos = [len(_WORD_SPLIT.findall(s)) for s in sents]
    media = sum(largos) / len(largos)
    sigma = (sum((n - media) ** 2 for n in largos) / len(largos)) ** 0.5
    if sigma >= _SIGMA_FLOOR:
        return []
    return [mk(eid, text, 0, len(text or ""), "g11_variaacion_oracion", "info",
              f"Las {len(sents)} oraciones del parrafo miden casi lo mismo "
              f"(desviacion {sigma:.1f} palabras). Una redaccion mecanica tiene "
              f"latidos iguales; alternar la longitud las hace mas leibles",
              phase="global")]


RULE_SCOPES.update({
    "g53_segunda_persona": GLOBAL,
    "g11_variaacion_oracion": GLOBAL,
})

GLOBAL_CHECKS.update({
    "g53_segunda_persona": _check_g53_segunda_persona,
    "g11_variaacion_oracion": _check_g11_variacion_oracion,
})

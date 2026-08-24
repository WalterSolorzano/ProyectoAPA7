"""Revisor proactivo de escritura (capa local, siempre disponible).

Detecta sin red y sin API key:
- primera persona con posición exacta (nunca 'me'/'mi' sueltos)
- muletillas / frases típicas de IA
- texto mal pegado (falta espacio tras puntuación, dobles espacios/puntos,
  palabra duplicada consecutiva)
- ortografía frecuente unívoca ES (diccionario cerrado)

Cada hallazgo trae start/end sobre el texto del elemento para que la UI
pueda citar el fragmento exacto en vez de marcar el párrafo entero.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List
from collections import Counter

_WORD = re.compile(r"[a-záéíóúñü]+", re.IGNORECASE)
_STOPWORDS = set("""el la los las un una unos unas de del al a en por para con sin sobre
entre y o u que como su sus mi tu se lo le nos me te es son fue fueron ha han haya sido
era eran muy más pero cuando donde quien cual""".split())

# ---------------------------------------------------------------- primera persona
# Solo pronombres claros + frases completas de opinión. 'me'/'mi' solos
# generaban falsos positivos ("el libro que me recomendaron").
_FIRST_PERSON = re.compile(
    r"\b(?:yo|nosotros|nosotras|nuestro|nuestra|m[ií])\b"
    r"|(?:creo|pienso|considero|opino)\s+que",
    re.IGNORECASE,
)

_QUOTES = re.compile(r"[«\"“”'‘’]")

# ---------------------------------------------------------------- frases IA
_AI_PHRASES = [
    "en conclusión", "en resumen", "cabe destacar", "cabe mencionar",
    "es importante mencionar", "si quieres más", "como modelo de lenguaje",
    "no puedo ayudar", "hasta luego", "sin duda alguna",
    "juega un papel crucial", "desempeña un papel fundamental",
    "en el mundo actual", "en la sociedad actual",
    "desde tiempos inmemoriales", "es importante recalcar",
]

_MULETILLA_START = re.compile(r"^(?:además|asimismo|por otro lado|en primer lugar)\b[,:]?",
                              re.IGNORECASE)

# ---------------------------------------------------------------- B1 repetición
_SENT_START_DUP = re.compile(r"^(?:el|la|los|las|un|una|es|se|su|en|al|de)\b", re.IGNORECASE)


def _audit_repeticion(eid: str, text: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    ws = [w.lower() for w in _WORD.findall(text)]
    content = [w for w in ws if w not in _STOPWORDS and len(w) > 4]
    if len(content) >= 8:
        counts = Counter(content)
        para_topic = max(counts.values()) if counts else 0
        for w, c in counts.items():
            # Umbral adaptativo: tolera la palabra-tema del párrafo.
            if c >= 3 and c < max(3, para_topic):
                i = text.lower().find(w)
                if i >= 0:
                    out.append(_mk(eid, text, i, i + len(w), "repeticion", "info",
                                   f'"{w}" se repite {c} veces en el párrafo'))
                break
    # Inicios de oración idénticos
    sents = [s.strip() for s in re.split(r"[.!?]+\s", text) if s.strip()]
    if len(sents) >= 3:
        starts: Dict[str, int] = {}
        for s in sents:
            first = " ".join(s.split()[:1]).lower()
            starts[first] = starts.get(first, 0) + 1
        for first, c in starts.items():
            if c >= 3:
                out.append(_mk(eid, text, 0, min(len(first), 30), "repeticion", "info",
                               f'{c} oraciones empiezan con "{first}" — varía la apertura'))
                break
    return out


# ---------------------------------------------------------------- B2 idea incompleta
_DANGLING_END = re.compile(
    r"\b(?:pero|aunque|sin embargo|no obstante|porque|pues|ya que|dado que|más|menos|etc|etcétera)\s*\.?\s*$",
    re.IGNORECASE,
)


def _audit_incompleta(eid: str, text: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    offset = 0
    for s in sents:
        core = s.rstrip(".!? ")
        if _DANGLING_END.search(core):
            start = text.find(core[-25:], max(0, offset))
            if start >= 0:
                out.append(_mk(eid, text, max(0, len(s) - 18) + offset,
                               min(len(text), len(s) + offset),
                               "incompleta", "warn",
                               "La oración queda colgando tras un conector"))
        if s.count("¿") != s.count("?"):
            out.append(_mk(eid, text, offset, offset + len(s), "incompleta", "error",
                           "Pregunta sin cerrar (falta ?)"))
        if s.count("(") != s.count(")"):
            out.append(_mk(eid, text, offset, offset + len(s), "incompleta", "error",
                           "Paréntesis sin cerrar"))
        offset += len(s) + 1
    return out


# ---------------------------------------------------------------- B4 cambio de persona
_PERSON_MARKS = {
    "1s": re.compile(r"\b(?:yo|mí|conmigo|mío|mis?|estoy|tengo|pienso|creo)\b", re.IGNORECASE),
    "1p": re.compile(r"\b(?:nosotros|nosotras|nuestro|nuestra|nuestros|nuestras)\b", re.IGNORECASE),
    "2": re.compile(r"\b(?:tú|usted|ustedes|te|les|contigo|tu[s]?|estás|piensas)\b", re.IGNORECASE),
}


def _audit_persona(eid: str, text: str) -> List[Dict[str, Any]]:
    found = [k for k, rx in _PERSON_MARKS.items() if rx.search(text)]
    if len(found) >= 2:
        i = 0
        for k in found:
            m = _PERSON_MARKS[k].search(text[i:] or "")
            if m:
                break
        return [_mk(eid, text, 0, min(40, len(text)), "persona", "warn",
                    f"Mezcla de personas gramaticales ({', '.join(found)}) en un mismo párrafo")]
    return []


# ---------------------------------------------------------------- B5 ambigüedad
_AMBIG_PRON = re.compile(r"\b(?:esto|eso|aquello|el cual|la cual|los cuales)\b", re.IGNORECASE)


def _audit_ambigua(eid: str, text: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for m in _AMBIG_PRON.finditer(text):
        prev_words = _words(text[max(0, m.start() - 120):m.start()])
        nouns_before = [w for w in prev_words if len(w) > 4][-6:]
        if len(nouns_before) >= 2:
            out.append(_mk(eid, text, m.start(), m.end(), "ambigua", "info",
                           f'"{m.group(0)}" puede referirse a varios antecedentes cercanos'))
    return out


# ---------------------------------------------------------------- B3 contraste hueco
_CONTRAST = re.compile(r"^\s*(?:pero|sin embargo|no obstante|por el contrario)\b", re.IGNORECASE)
_OPPOSITION = re.compile(
    r"\b(no|nunca|nadie|ningún|ninguna|menos|aunque|problema|falla|limitación|"
    "crisis|pérdida|rechazo|impedimento|dificultad)\\b",
    re.IGNORECASE,
)


def _audit_contrast_hueco(eid: str, text: str) -> List[Dict[str, Any]]:
    """Conector de contraste al inicio SIN señal de oposición en la oración anterior."""
    out: List[Dict[str, Any]] = []
    if _CONTRAST.match(text):
        # Solo marcable por la capa LLM/ventana (necesita oración previa).
        return out
    return out

# ---------------------------------------------------------------- pegado
_MISSING_SPACE = re.compile(r"([a-záéíóúñü])([.:;,])([A-ZÁÉÍÓÚÑ])")
_DOUBLE_SPACE = re.compile(r"\S(  +)\S")
_DOUBLE_PUNCT = re.compile(r"([^\s.!?])[.]{2,}(?![.])")
_DUP_WORD = re.compile(r"\b(\w+) \1\b", re.IGNORECASE)

# ---------------------------------------------------------------- ortografía
_TYPOS: Dict[str, str] = {
    "deberia": "debería", "tambien": "también", "asi": "así",
    "aqui": "aquí", "ademas": "además", "despues": "después",
    "quiza": "quizá", "solucion": "solución", "atencion": "atención",
    "informacion": "información", "investigacion": "investigación",
    "educacion": "educación", "poblacion": "población",
    "sociedad ": None,  # placeholder ignorado
    "analisis": "análisis", "proposito": "propósito",
    "periodo": "período", "practica": "práctica",
    "politica": "política", "tecnologia": "tecnología",
    "economia": "economía", "historia ": None,  # válido, ignorar
    "q": "que", "xq": "porque", "pq": "porque", "xbj": "objeto",
    "atravez": "a través", "asin": "así", "ce": "se", "valla": "valle",
    "hasta": None, "haora": "ahora", "agarrar ": None,
}
_TYPOS = {k: v for k, v in _TYPOS.items() if v}  # limpia placeholders
_TYPO_RE = re.compile(
    r"\b(" + "|".join(sorted(re.escape(k) for k in _TYPOS)) + r")\b",
    re.IGNORECASE,
)


def _in_quotes(text: str, pos: int) -> bool:
    """True si pos cae dentro de un tramo entre comillas."""
    count = 0
    for i, ch in enumerate(text):
        if i >= pos:
            break
        if _QUOTES.match(ch):
            count += 1
    return count % 2 == 1


def _words(text: str) -> List[str]:
    return _WORD.findall(text or "")


def _mk(element_id: str, text: str, start: int, end: int, kind: str,
        severity: str, message: str, suggestion: str | None = None) -> Dict[str, Any]:
    lo = max(0, start - 25)
    hi = min(len(text), end + 25)
    prefix = ("…" if lo > 0 else "") + text[lo:start]
    core = text[start:end]
    suffix = text[end:hi] + ("…" if hi < len(text) else "")
    f: Dict[str, Any] = {
        "element_id": element_id,
        "start": start,
        "end": end,
        "excerpt": f"{prefix}{core}{suffix}".strip(),
        "kind": kind,
        "severity": severity,
        "message": message,
        "source": "local",
    }
    if suggestion:
        f["suggestion"] = suggestion
    return f


def audit_elements(elements: List[Any]) -> List[Dict[str, Any]]:
    findings: List[Dict[str, Any]] = []
    muletilla_count = 0
    muletilla_hits: List[tuple[str, int, int]] = []

    # Pasada 1: muletillas iniciales para detectar repetición global.
    for e in elements:
        etype = getattr(getattr(e, "type", None), "value", getattr(e, "type", ""))
        if str(etype) not in ("paragraph", "para"):
            continue
        text = (getattr(e, "text", "") or "").strip()
        m = _MULETILLA_START.match(text)
        if m:
            muletilla_count += 1
            muletilla_hits.append((str(getattr(e, "id", "")), m.start(), m.end()))

    repeat_muletilla = muletilla_count > 3

    for e in elements:
        etype = getattr(getattr(e, "type", None), "value", getattr(e, "type", ""))
        if str(etype) not in ("paragraph", "para"):
            continue
        eid = str(getattr(e, "id", ""))
        text = getattr(e, "text", "") or ""

        # -- primera persona
        for m in _FIRST_PERSON.finditer(text):
            if _in_quotes(text, m.start()):
                continue
            frag = text[max(0, m.start() - 18):m.end()].lower()
            # tras "que " suele ser conjunción, no pronombre de opinión
            if re.search(r"\bque\s+$", frag) and not re.search(r"(creo|pienso)\s+que\s*$", frag):
                continue
            findings.append(_mk(eid, text, m.start(), m.end(), "first_person", "warn",
                                "Primera persona en texto académico; usa redacción impersonal"))

        # -- frases IA
        low = text.lower()
        for phrase in _AI_PHRASES:
            idx = 0
            while True:
                i = low.find(phrase, idx)
                if i < 0:
                    break
                findings.append(_mk(eid, text, i, i + len(phrase), "ai_phrase", "warn",
                                    "Frase típica de IA o cliché; reformula con tus palabras"))
                idx = i + len(phrase)

        # -- muletillas repetidas
        if repeat_muletilla:
            m = _MULETILLA_START.match(text.strip())
            if m:
                off = len(text) - len(text.lstrip())
                findings.append(_mk(eid, text, off + m.start(), off + m.end(), "muletilla", "info",
                                    "Conector repetido en varios párrafos; varía la transición"))

        # -- texto pegado
        for m in _MISSING_SPACE.finditer(text):
            findings.append(_mk(eid, text, m.start(2), m.end(2), "pegado", "error",
                                "Falta un espacio después del signo",
                                suggestion=" "))
        for m in _DOUBLE_PUNCT.finditer(text):
            findings.append(_mk(eid, text, m.start(), m.end(), "pegado", "warn",
                                "Puntuación duplicada"))
        for m in _DUP_WORD.finditer(text):
            if m.group(1).lower() in {"had", "that"}:  # falsos amigos EN
                continue
            findings.append(_mk(eid, text, m.start(), m.end(), "pegado", "warn",
                                f'Palabra duplicada: "{m.group(1)}"'))
        for m in _DOUBLE_SPACE.finditer(text):
            findings.append(_mk(eid, text, m.start(1), m.end(1), "pegado", "info",
                                "Doble espacio"))

        # -- ortografía cerrada
        for m in _TYPO_RE.finditer(text):
            correct = _TYPOS[m.group(1).lower()]
            findings.append(_mk(eid, text, m.start(), m.end(), "ortografia", "error",
                                f'Ortografía: "{m.group(0)}" → "{correct}"',
                                suggestion=correct))

        # -- B1 repetición / B2 incompleta / B4 persona / B5 ambigüedad
        findings.extend(_audit_repeticion(eid, text))
        findings.extend(_audit_incompleta(eid, text))
        findings.extend(_audit_persona(eid, text))
        findings.extend(_audit_ambigua(eid, text))

    # Deduplicar solapamientos de primera persona ("Yo considero que..."
    # matchea pronombre y frase completa de la MISMA cláusula): fusiona
    # hallazgos separados por <=24 chars en uno solo.
    fp_sorted = sorted((f for f in findings if f["kind"] == "first_person"),
                       key=lambda f: f["start"])
    merged_fp: list[Dict[str, Any]] = []
    for f in fp_sorted:
        if merged_fp and f["start"] - merged_fp[-1]["end"] <= 24:
            prev = merged_fp[-1]
            prev["excerpt"] = (prev["excerpt"].split("…")[0] + "…" ) if False else prev["excerpt"]
            prev["end"] = max(prev["end"], f["end"])
            continue
        merged_fp.append(dict(f))
    others = [f for f in findings if f["kind"] != "first_person"]
    return sorted(merged_fp + others, key=lambda f: (f["start"], f["end"]))


# ---------------------------------------------------------------- capa LLM
_LLM_REVIEW_KINDS = {"ortografia", "muletilla"}


def refine_with_llm(findings: List[Dict[str, Any]], elements: List[Any],
                    api_key: str, timeout: float = 12.0) -> tuple[List[Dict[str, Any]], bool]:
    """Filtra falsos positivos de ortografía/muletillas con el LLM.

    Nunca lanza: ante cualquier error devuelve (findings intactos, False).
    Solo revisa hallazgos dudosos; first_person/ai_phrase/pegado pasan tal cual.
    """
    if not api_key:
        return findings, False
    try:
        import json as _json

        import requests  # type: ignore

        text_by_id = {str(getattr(e, "id", "")): (getattr(e, "text", "") or "")
                      for e in elements}
        dubious = [f for f in findings if f.get("kind") in _LLM_REVIEW_KINDS]
        if not dubious:
            return findings, False

        payload_items = []
        for i, f in enumerate(dubious[:60]):  # tope duro de coste
            payload_items.append({
                "i": i,
                "kind": f["kind"],
                "match": text_by_id.get(f["element_id"], "")[f["start"]:f["end"]],
                "context": f["excerpt"][:160],
            })
        prompt = (
            "Eres corrector experto de español académico. Para cada item decide "
            "si es un error REAL que conviene corregir en un trabajo universitario "
            "formal. Responde SOLO JSON: [{\"i\":int,\"keep\":bool,"
            "\"suggestion\":str|null}]. Items: " + _json.dumps(payload_items, ensure_ascii=False)
        )
        resp = requests.post(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}",
                     "Content-Type": "application/json"},
            json={
                "model": "meta/llama-3.1-70b-instruct",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 1500,
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        m = re.search(r"\[.*\]", content, re.DOTALL)
        if not m:
            return findings, True
        verdicts = {v.get("i"): v for v in _json.loads(m.group(0)) if isinstance(v, dict)}

        kept_local = [f for f in findings if f.get("kind") not in _LLM_REVIEW_KINDS]
        for i, f in enumerate(dubious):
            v = verdicts.get(i)
            if not v or v.get("keep", True):
                kept_local.append(f)
            elif v.get("suggestion"):
                g = dict(f)
                g["suggestion"] = str(v["suggestion"])
                g["source"] = "llm"
                kept_local.append(g)
        return kept_local, True
    except Exception:
        return findings, False

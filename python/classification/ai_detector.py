"""
WordAPA7 — Detector de patrones de texto generado por IA

Analiza párrafos del documento buscando:
1. Muletillas y frases recurrentes comunes en texto generado por LLM (40+ patrones)
2. Estructura repetitiva de oraciones (longitud homogénea)
3. Abuso de punto y coma en un solo párrafo
4. Párrafos de conclusión genérica ("En conclusión, ... se puede afirmar que ...")

Retorna un puntaje de riesgo (0-1) y lista de hallazgos categorizados.
"""

import re
from typing import List, Dict, Any, Tuple

# ── PATRONES DE FRASES COMUNES EN TEXTO GENERADO POR IA ──────────────────────

AI_PATTERNS: List[Tuple[str, str, str]] = [
    # Patrones existentes (mantenidos con severidad MEDIUM)
    (r"\ben conclusi[oó]n\b", "Muletilla común de IA: 'En conclusión'", "MEDIUM"),
    (r"\ben resumen\b", "Muletilla común de IA: 'En resumen'", "LOW"),
    (r"\ben s[ií]ntesis\b", "Muletilla común de IA: 'En síntesis'", "LOW"),
    (r"\bes importante destacar\b", "Frase recurrente de IA: 'Es importante destacar'", "MEDIUM"),
    (r"\bes fundamental mencionar\b", "Frase recurrente de IA: 'Es fundamental mencionar'", "MEDIUM"),
    (r"\ben primer lugar\b", "Conector frecuente de IA: 'En primer lugar'", "LOW"),
    (r"\bpor otro lado\b", "Conector frecuente de IA: 'Por otro lado'", "LOW"),
    (r"\bpor lo tanto\b", "Conector frecuente de IA: 'Por lo tanto'", "LOW"),
    (r"\ben el contexto actual\b", "Frase genérica de IA: 'En el contexto actual'", "MEDIUM"),
    (r"\ba medida que el mundo\b", "Frase introductoria típica de IA", "MEDIUM"),

    # Nuevos patrones (30+)
    (r"\bcabe mencionar\b", "Muletilla de IA: 'Cabe mencionar'", "MEDIUM"),
    (r"\bno obstante\b", "Conector frecuente en IA: 'No obstante'", "LOW"),
    (r"\bsin embargo\b", "Conector frecuente en IA: 'Sin embargo'", "LOW"),
    (r"\bes menester\b", "Frase arcaica favorecida por IA: 'Es menester'", "HIGH"),
    (r"\ba prop[oó]sito\b", "Transición típica de IA: 'A propósito'", "MEDIUM"),
    (r"\bcabe resaltar\b", "Muletilla de IA: 'Cabe resaltar'", "MEDIUM"),
    (r"\ben este sentido\b", "Conector frecuente de IA: 'En este sentido'", "LOW"),
    (r"\ben otras palabras\b", "Muletilla de IA: 'En otras palabras'", "LOW"),
    (r"\bvale la pena\b", "Frase recurrente de IA: 'Vale la pena'", "MEDIUM"),
    (r"\ben particular\b", "Conector frecuente de IA: 'En particular'", "LOW"),
    (r"\basimismo\b", "Conector frecuente de IA: 'Asimismo'", "LOW"),
    (r"\bno cabe duda\b", "Frase enfática de IA: 'No cabe duda'", "MEDIUM"),
    (r"\bresulta evidente\b", "Frase enfática de IA: 'Resulta evidente'", "MEDIUM"),
    (r"\bde acuerdo con\b", "Fórmula de cita frecuente en IA", "LOW"),
    (r"\ben relaci[oó]n a\b", "Conector frecuente de IA", "LOW"),
    (r"\bcon respecto a\b", "Conector frecuente de IA", "LOW"),
    (r"\bpor consiguiente\b", "Conector formal favorecido por IA", "MEDIUM"),
    (r"\ben consecuencia\b", "Conector formal frecuente en IA", "LOW"),
    (r"\bde tal manera\b", "Fórmula explicativa de IA", "MEDIUM"),
    (r"\bpues bien\b", "Muletilla de transición de IA", "MEDIUM"),
    (r"\bahora bien\b", "Conector contrastivo de IA", "LOW"),
    (r"\ba continuaci[oó]n\b", "Transición de IA", "LOW"),
    (r"\ben definitiva\b", "Cierre favorecido por IA", "MEDIUM"),
    (r"\ben u[´']ltima instancia\b", "Frase enfática de IA", "HIGH"),
    (r"\ben t[eé]rminos generales\b", "Generalización de IA", "MEDIUM"),
    (r"\bdesde esta perspectiva\b", "Transición analítica de IA", "MEDIUM"),
    (r"\ben el marco de\b", "Fórmula contextual favorecida por IA", "MEDIUM"),
    (r"\btal como se ha señalado\b", "Remisión textual típica de IA", "HIGH"),
    (r"\bes preciso señalar\b", "Muletilla formal de IA: 'Es preciso señalar'", "HIGH"),
    (r"\bconviene subrayar\b", "Muletilla formal de IA: 'Conviene subrayar'", "HIGH"),
    (r"\bes necesario resaltar\b", "Muletilla formal de IA: 'Es necesario resaltar'", "HIGH"),
    (r"\bcabe destacar\b", "Muletilla formal de IA: 'Cabe destacar'", "MEDIUM"),
    (r"\bhuelga decir\b", "Frase arcaica favorecida por IA", "HIGH"),
    (r"\bresulta interesante\b", "Valoración subjetiva típica de IA", "MEDIUM"),
    (r"\ben el presente trabajo\b", "Fórmula académica genérica de IA", "MEDIUM"),
    (r"\bel presente estudio\b", "Fórmula académica genérica de IA", "MEDIUM"),
    (r"\bse puede observar\b", "Frase descriptiva pasiva de IA", "LOW"),
    (r"\bes relevante mencionar\b", "Muletilla formal de IA", "MEDIUM"),
    (r"\bresulta crucial\b", "Énfasis favorecido por IA", "MEDIUM"),
    (r"\bes ampliamente conocido\b", "Generalización de IA", "MEDIUM"),
    (r"\bno es sorprendente\b", "Valoración subjetiva de IA", "MEDIUM"),
    (r"\bcomo se mencion[oó] anteriormente\b", "Remisión textual de IA", "MEDIUM"),
    (r"\ben la misma l[ií]nea\b", "Transición cohesiva de IA", "LOW"),
]


def _analyze_sentence_structure(text: str) -> Tuple[float, int]:
    """
    Analiza la estructura de oraciones buscando longitud homogénea.
    La IA tiende a generar oraciones de longitud similar (~20-30 palabras).

    Retorna: (score 0-1, count de oraciones con longitud sospechosa)
    """
    if not text or len(text.strip()) < 40:
        return 0.0, 0

    # Dividir en oraciones por punto
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    if len(sentences) < 3:
        return 0.0, 0

    word_counts = [len(s.split()) for s in sentences if len(s.split()) > 5]

    if len(word_counts) < 3:
        return 0.0, 0

    # Calcular cuántas oraciones están en el rango 18-32 palabras
    medium_count = sum(1 for wc in word_counts if 18 <= wc <= 32)
    ratio = medium_count / len(word_counts)

    # Calcular desviación estándar relativa (baja desviación = sospechosa)
    mean = sum(word_counts) / len(word_counts)
    variance = sum((wc - mean) ** 2 for wc in word_counts) / len(word_counts)
    std_dev = variance ** 0.5
    rel_std = std_dev / mean if mean > 0 else 1.0

    # Alta densidad de oraciones medianas + baja variación = sospechoso
    score = 0.0
    if ratio > 0.7:
        score += 0.3
    if ratio > 0.85:
        score += 0.2

    if rel_std < 0.35 and len(word_counts) >= 4:
        score += 0.3
    if rel_std < 0.25 and len(word_counts) >= 5:
        score += 0.2

    return min(score, 1.0), medium_count


def _detect_semicolon_overuse(text: str) -> Tuple[float, int]:
    """
    Detecta uso excesivo de punto y coma en un solo párrafo.
    La IA tiende a abusar del punto y coma para conectar oraciones largas.

    Retorna: (score 0-1, count de punto y coma)
    """
    if not text:
        return 0.0, 0

    semicolon_count = text.count(";") + text.count("；")

    if semicolon_count == 0:
        return 0.0, 0

    word_count = len(text.split())
    if word_count == 0:
        return 0.0, 0

    # Densidad: punto y coma cada 15 palabras o menos = sospechoso
    density = semicolon_count / word_count

    if density > 0.08:
        return 0.8, semicolon_count
    elif density > 0.05:
        return 0.5, semicolon_count
    elif density > 0.03:
        return 0.3, semicolon_count

    return 0.0, semicolon_count


def _detect_generic_conclusion(text: str) -> Tuple[float, List[str]]:
    """
    Detecta párrafos de conclusión genérica típicos de IA.

    Patrones:
    - "En conclusión, ... se puede afirmar que ... es fundamental para ..."
    - "En resumen, ... estos hallazgos demuestran ..."
    - Estructura: marcador de cierre + verbo modal + afirmación genérica

    Retorna: (score 0-1, lista de fragmentos sospechosos)
    """
    if not text or len(text.strip()) < 50:
        return 0.0, []

    text_lower = text.lower()
    findings = []

    # Patrones de conclusión genérica
    conclusion_triggers = [
        r"en conclusi[oó]n\b",
        r"en [uú]ltima instancia\b",
        r"en definitiva\b",
        r"para concluir\b",
        r"finalmente\b",
    ]

    generic_followups = [
        r"se puede afirmar",
        r"se puede decir",
        r"se puede concluir",
        r"es fundamental",
        r"es esencial",
        r"es importante",
        r"resulta evidente",
        r"no cabe duda",
        r"queda demostrado",
        r"se ha demostrado",
        r"los hallazgos sugieren",
        r"los resultados indican",
        r"en [uú]ltimo t[eé]rmino",
    ]

    score = 0.0
    for trigger in conclusion_triggers:
        if re.search(trigger, text_lower):
            score += 0.3
            findings.append(f"Inicia con marcador de cierre: '{trigger}'")
            # Buscar follow-up genérico después del marcador
            for followup in generic_followups:
                if re.search(followup, text_lower):
                    score += 0.2
                    findings.append(f"Seguido de afirmación genérica: '{followup}'")
                    break
            break

    return min(score, 1.0), findings


def detect_ai_generated_patterns(text: str) -> List[Dict[str, Any]]:
    """
    Escanea un texto en busca de expresiones típicas de modelos de lenguaje.
    Retorna una lista de coincidencias con la frase y la advertencia.
    Mantenido para compatibilidad hacia atrás.
    """
    matches = []
    if not text or len(text.strip()) < 15:
        return matches

    text_lower = text.lower()
    for pattern, warning_msg, _severity in AI_PATTERNS:
        match = re.search(pattern, text_lower)
        if match:
            matches.append({
                "phrase": match.group(0),
                "warning": warning_msg,
            })

    return matches


def analyze_ai_risk(text: str) -> Dict[str, Any]:
    """
    Análisis completo de riesgo de texto generado por IA.

    Retorna:
    {
        "score": float (0.0 a 1.0),
        "findings": [
            {"pattern": str, "severity": str, "detail": str, "count": int},
            ...
        ],
        "category": "LOW" | "MEDIUM" | "HIGH"
    }
    """
    result: Dict[str, Any] = {
        "score": 0.0,
        "findings": [],
        "category": "LOW",
    }

    if not text or len(text.strip()) < 15:
        return result

    text_lower = text.lower()
    total_score = 0.0
    signal_count = 0

    # 1. Patrones de frases
    phrase_findings: Dict[str, Any] = {}
    for pattern, warning_msg, severity in AI_PATTERNS:
        matches = list(re.finditer(pattern, text_lower))
        if matches:
            key = pattern
            if key not in phrase_findings:
                sev_score = {"LOW": 0.1, "MEDIUM": 0.2, "HIGH": 0.35}
                phrase_findings[key] = {
                    "pattern": "phrase",
                    "severity": severity,
                    "detail": warning_msg,
                    "count": len(matches),
                    "score": sev_score.get(severity, 0.15) * min(len(matches), 3),
                }

    for finding in phrase_findings.values():
        result["findings"].append({
            "pattern": finding["pattern"],
            "severity": finding["severity"],
            "detail": finding["detail"],
            "count": finding["count"],
        })
        total_score += finding["score"]
        signal_count += 1

    # 2. Estructura de oraciones repetitiva
    struct_score, medium_sentences = _analyze_sentence_structure(text)
    if struct_score > 0.2:
        result["findings"].append({
            "pattern": "sentence_structure",
            "severity": "MEDIUM" if struct_score > 0.5 else "LOW",
            "detail": f"Estructura de oraciones homogénea ({medium_sentences} oraciones de longitud similar, 18-32 palabras cada una)",
            "count": medium_sentences,
        })
        total_score += struct_score * 0.8
        signal_count += 1

    # 3. Abuso de punto y coma
    semi_score, semi_count = _detect_semicolon_overuse(text)
    if semi_score > 0.2:
        result["findings"].append({
            "pattern": "semicolon_overuse",
            "severity": "HIGH" if semi_score > 0.6 else "MEDIUM",
            "detail": f"Uso excesivo de punto y coma ({semi_count} ocurrencias en el párrafo)",
            "count": semi_count,
        })
        total_score += semi_score * 0.5
        signal_count += 1

    # 4. Conclusión genérica
    conc_score, conc_findings = _detect_generic_conclusion(text)
    if conc_score > 0.2:
        detail_str = "; ".join(conc_findings[:2])
        result["findings"].append({
            "pattern": "generic_conclusion",
            "severity": "HIGH" if conc_score > 0.6 else "MEDIUM",
            "detail": f"Estructura de conclusión genérica: {detail_str}",
            "count": len(conc_findings),
        })
        total_score += conc_score * 0.6
        signal_count += 1

    # Calcular puntaje final (promedio ponderado)
    if signal_count > 0:
        final_score = total_score / min(signal_count, 4)
    else:
        final_score = 0.0

    # Categorizar
    if final_score >= 0.5:
        category = "HIGH"
    elif final_score >= 0.2:
        category = "MEDIUM"
    else:
        category = "LOW"

    # Limitar a 10 hallazgos
    result["findings"] = result["findings"][:10]
    result["score"] = round(min(final_score, 1.0), 2)
    result["category"] = category

    return result

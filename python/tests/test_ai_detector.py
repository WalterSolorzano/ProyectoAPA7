import pytest
from classification.ai_detector import detect_ai_generated_patterns, analyze_ai_risk


def test_ai_detector_finds_patterns():
    text = "En conclusión, es importante destacar que los datos demuestran el avance del sistema."
    matches = detect_ai_generated_patterns(text)
    assert len(matches) >= 2
    phrases = [m["phrase"] for m in matches]
    assert any("conclusión" in p or "conclusion" in p for p in phrases)
    assert any("importante destacar" in p for p in phrases)


def test_ai_detector_clean_text():
    text = "El análisis estadístico mostró una diferencia significativa entre ambos grupos de prueba."
    matches = detect_ai_generated_patterns(text)
    assert len(matches) == 0


def test_analyze_ai_risk_detects_patterns():
    text = "En conclusión, es importante destacar que los datos demuestran el avance del sistema."
    result = analyze_ai_risk(text)
    assert "score" in result
    assert "findings" in result
    assert "category" in result
    assert result["score"] > 0
    assert len(result["findings"]) > 0


def test_analyze_ai_risk_clean_text():
    text = "El análisis estadístico mostró una diferencia significativa entre ambos grupos de prueba."
    result = analyze_ai_risk(text)
    assert result["score"] == 0
    assert len(result["findings"]) == 0


def test_analyze_ai_risk_sentence_structure():
    """Oraciones de longitud muy similar deben detectarse como sospechosas."""
    text = (
        "Los resultados del estudio demostraron una mejora significativa. "
        "La intervención produjo cambios notables en los participantes. "
        "El análisis estadístico confirmó las hipótesis planteadas. "
        "Estos hallazgos respaldan la teoría subyacente del modelo."
    )
    result = analyze_ai_risk(text)
    sentence_findings = [f for f in result["findings"] if f["pattern"] == "sentence_structure"]
    assert len(sentence_findings) > 0


def test_analyze_ai_risk_semicolon_overuse():
    """Uso excesivo de punto y coma debe detectarse."""
    text = (
        "El estudio abarcó diversas variables independientes; la edad fue un factor determinante; "
        "el género mostró diferencias significativas; el nivel socioeconómico moderó los efectos; "
        "y la ubicación geográfica influyó en los resultados obtenidos durante la investigación."
    )
    result = analyze_ai_risk(text)
    semi_findings = [f for f in result["findings"] if f["pattern"] == "semicolon_overuse"]
    assert len(semi_findings) > 0


def test_analyze_ai_risk_generic_conclusion():
    """Estructura de conclusión genérica debe detectarse."""
    text = (
        "En conclusión, se puede afirmar que los resultados de este estudio son fundamentales "
        "para comprender la dinámica del fenómeno investigado y sus implicaciones prácticas."
    )
    result = analyze_ai_risk(text)
    conc_findings = [f for f in result["findings"] if f["pattern"] == "generic_conclusion"]
    assert len(conc_findings) > 0


def test_analyze_ai_risk_new_patterns():
    """Nuevos patrones como 'cabe mencionar' y 'no obstante' deben detectarse."""
    text = "Cabe mencionar que los resultados no obstante presentan limitaciones metodológicas."
    result = analyze_ai_risk(text)
    phrase_findings = [f for f in result["findings"] if f["pattern"] == "phrase"]
    assert len(phrase_findings) >= 2


def test_analyze_ai_risk_short_text():
    """Texto muy corto no debe generar falsos positivos."""
    result = analyze_ai_risk("Hola mundo")
    assert result["score"] == 0
    assert len(result["findings"]) == 0


def test_analyze_ai_risk_empty_text():
    """Texto vacío no debe generar falsos positivos."""
    result = analyze_ai_risk("")
    assert result["score"] == 0
    assert len(result["findings"]) == 0

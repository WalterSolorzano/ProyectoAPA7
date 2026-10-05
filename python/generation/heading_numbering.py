"""WordAPA7 — Numeración de títulos: decisiones compartidas.

Acá vive la resolución del estilo de numeración de un heading, porque los dos
generadores (`generator.py` y `layered_generator.py`) tienen que coincidir. Antes
la detección automática de romano vivía solo en `generator.py`, así que el mismo
documento podía salir numerado distinto según el camino de generación. Con una
sola función compartida eso ya no puede pasar.
"""

import re

ROMAN_PREFIX = re.compile(r'^(?:X{0,3})(?:I[XV]|V?I{1,3})\.$')


def _detect_heading_numbering_style(heading_text: str) -> str:
    """Detecta si el texto del heading usa numeración romana (I., II., III.)
    o decimal (1., 2., 3.) basado en el prefijo original.

    Retorna 'roman' o 'decimal'."""
    text_stripped = (heading_text or "").strip()
    first_word = text_stripped.split()[0] if text_stripped else ""
    if ROMAN_PREFIX.match(first_word):
        return 'roman'
    return 'decimal'


def _extract_numbering_style_marker(text: str) -> str:
    """Lee un marcador explícito ``[ROMAN]``/``[DECIMAL]`` del texto.

    Devuelve 'roman' ante ``[ROMAN]``, 'decimal' ante ``[DECIMAL]``, y cadena
    vacía cuando NO hay marcador. Que la ausencia devuelva "" (y no 'decimal')
    es deliberado: el bug que esta revisión corrige era que un texto sin
    marcador forzaba 'decimal' y descartaba la notación que el usuario había
    elegido."""
    if not text:
        return ""
    upper = text.upper()
    if '[ROMAN]' in upper:
        return 'roman'
    if '[DECIMAL]' in upper:
        return 'decimal'
    return ""


def _resolver_estilo_de_nivel(nivel: int, estilo_configurado: str, texto_original: str) -> str:
    """Resuelve el estilo de numeración de un heading nivel 1 combinando la
    elección del usuario con el marcador explícito de estilo en el texto.

    Reglas:
    - Un marcador explícito ``[ROMAN]``/``[DECIMAL]`` SIEMPRE gana.
    - La detección automática por el prefijo del texto original
      ("IV. Metodología" ⇒ romano) **ya no pisa** una notación elegida a mano;
      aplica solo al nivel 1 y solo cuando la configuración de ese nivel sigue
      en el valor ambiguo por defecto ('decimal'/'none'/vacío).
    - Los niveles 2+ no hacen detección: devuelven la configuración tal cual.
    """
    if nivel != 1:
        return estilo_configurado

    marcador = _extract_numbering_style_marker(texto_original)
    if marcador:
        return marcador

    if estilo_configurado not in ('decimal', 'none', ''):
        return estilo_configurado
    if _detect_heading_numbering_style(texto_original) == 'roman':
        return 'roman'
    return estilo_configurado

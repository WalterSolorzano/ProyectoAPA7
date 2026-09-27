"""Toda regla que el auditor emite tiene que DECLARAR su ambito.

Sin este test, el ambito de una regla nueva se infiere del texto otra vez, que
es exactamente el defecto que `phase_scope` vino a eliminar. El fallo imprime
los kinds desconocidos para que declararlos sea un paso mecanico y no una
decision: el proposito del test es que agregar una regla sin ambito sea
imposible de commitear, no que alguien lo note tarde.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models import ElementModel, ElementType  # noqa: E402
from modules.phase_scope import RULE_SCOPES  # noqa: E402
from modules.proactive_auditor import audit_elements  # noqa: E402


def _doc():
    return [
        ElementModel(id="h1", type=ElementType.HEADING, heading_level=1,
                     text="Objetivos"),
        ElementModel(id="e1", type=ElementType.PARAGRAPH,
                     text="Conocer las causas. Yo creo que si. Ademas el procesO "
                          "fue evidente y la metodologIa se aplico en el centro."),
        ElementModel(id="h2", type=ElementType.HEADING, heading_level=1,
                     text="Metodologia"),
        ElementModel(id="e2", type=ElementType.PARAGRAPH,
                     text="La metodologIa se aplico en el centro. El objetivO fue "
                          "vago y el autor escribio que el evidente proceso."),
    ]


def test_todo_kind_emitido_declara_su_ambito():
    emitidos = {f["kind"] for f in audit_elements(_doc())}
    desconocidos = sorted(emitidos - set(RULE_SCOPES))
    assert not desconocidos, (
        f"kinds sin ambito declarado: {desconocidos}. "
        f"Agregalos a RULE_SCOPES en modules/phase_scope.py con su ambito real."
    )


def test_reglas_de_objetivos_no_son_generales():
    # La regla de verbos imprecisos pertenece a la fase de objetivos. Si esto
    # pasa a "global", la regresion es exactamente el bug que se arrastro.
    assert RULE_SCOPES["bloom_vague"] == "objetivos"


def test_los_criterios_de_la_portada_no_son_generales():
    assert RULE_SCOPES["portada_title_larga"] == "portada"
    assert RULE_SCOPES["portada_punto_final"] == "portada"

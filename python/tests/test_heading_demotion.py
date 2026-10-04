from models import ElementType

from parsing.clustering_classifier import _demasiado_largo_para_heading
from parsing.pre_classifier import pre_classify_elements


def test_heading_largo_por_heuristica_se_degrada_aunque_tenga_estilo(make_element):
    texto = (
        "Se describe el proceso productivo completo de la empresa y sus "
        "etapas principales dentro de la planta de producción actual."
    ) * 2
    elem = make_element(
        elem_id="1", text=texto, elem_type=ElementType.HEADING, heading_level=4,
        style_name="Normal", is_bold=False,
    )
    result = pre_classify_elements([elem])
    assert result[0].type == ElementType.PARAGRAPH


def test_guard_clustering_largo():
    assert _demasiado_largo_para_heading("palabra " * 25) is True
    assert _demasiado_largo_para_heading("Diseño de investigación aplicada") is False


def test_guard_clustering_multi_oracion():
    assert _demasiado_largo_para_heading("Se observó el proceso. Además reduce costos.") is True

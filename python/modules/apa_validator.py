"""
WordAPA7 — Validador Estructural APA 7

Compara las citas parentéticas/narrativas del texto principal con la lista
de Referencias bibliográficas para asegurar coherencia bidireccional:
1. Alerta si un autor está citado en el texto pero no aparece en las Referencias.
2. Alerta si una referencia bibliográfica no fue citada en el cuerpo del texto.
"""

from typing import List
from models import DocumentModel, CitationModel, ReferenciaModel, ValidationIssueModel, ValidationStatus
from modules.citation_engine import extract_citations_from_text


def validate_apa_integrity(doc: DocumentModel, references: List[ReferenciaModel]) -> List[ValidationIssueModel]:
    """
    Ejecuta la validación cruzada entre citas del documento y lista de referencias.
    """
    issues: List[ValidationIssueModel] = []

    # 1. Extraer todas las citas en el documento
    all_citations: List[CitationModel] = []
    for elem in doc.elements:
        if elem.text:
            cits = extract_citations_from_text(elem.text, elem.id)
            all_citations.extend(cits)

    # 2. Normalizar autores y años citados
    cited_keys = set()
    for c in all_citations:
        for author in c.authors:
            # Limpiar apellido
            surname = author.split()[0].replace(',', '').strip().lower()
            year = c.year or ""
            cited_keys.add((surname, year))

    # 3. Normalizar referencias bibliográficas
    ref_keys = set()
    for r in references:
        author = r.authors[0] if r.authors else ""
        surname = author.split()[0].replace(',', '').strip().lower() if author else ""
        year = r.year or ""
        if surname:
            ref_keys.add((surname, year))

    # 4. Chequeo 1: Cita en texto sin Referencia correspondiente
    for (surname, year) in cited_keys:
        if surname and not any(r_sur == surname for (r_sur, r_yr) in ref_keys):
            issues.append(ValidationIssueModel(
                rule_id="missing_reference",
                severity=ValidationStatus.WARNING,
                message=f"La cita '{surname.capitalize()} ({year})' está en el texto pero no aparece en la lista de Referencias.",
                suggestion="Agregue la referencia completa al final del documento."
            ))

    # 5. Chequeo 2: Referencia sin Cita en el cuerpo del texto
    for (surname, year) in ref_keys:
        if surname and not any(c_sur == surname for (c_sur, c_yr) in cited_keys):
            issues.append(ValidationIssueModel(
                rule_id="uncited_reference",
                severity=ValidationStatus.WARNING,
                message=f"La referencia '{surname.capitalize()} ({year})' no ha sido citada en ninguna parte del texto.",
                suggestion="Cite esta fuente en el texto o elimínela de la lista de Referencias."
            ))

    if not issues:
        issues.append(ValidationIssueModel(
            rule_id="all_clear",
            severity=ValidationStatus.OK,
            message="Coherencia perfecta: todas las citas coinciden con las referencias bibliográficas.",
            suggestion=""
        ))

    return issues

"""
WordAPA7 — Validador Estructural APA 7

Compara las citas parentéticas/narrativas del texto principal con la lista
de Referencias bibliográficas para asegurar coherencia bidireccional:
1. Alerta si un autor está citado en el texto pero no aparece en las Referencias.
2. Alerta si una referencia bibliográfica no fue citada en el cuerpo del texto.
3. Opcional: verificación LLM para matches inciertos (requiere API key).
"""

import json
import os
import asyncio
from typing import List, Optional

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


# ── Optional LLM-Powered Citation Validation ────────────────────────────────

async def validate_citations_with_llm(
    doc: DocumentModel,
    references: List[ReferenciaModel],
    api_key: Optional[str] = None,
    nim_url: Optional[str] = None,
    use_local: bool = False,
) -> List[ValidationIssueModel]:
    """
    Optional LLM-powered citation validation. Takes uncertain citation matches
    and asks the LLM to verify if a citation really matches a reference.
    Only runs if the user provides an API key and explicit consent.
    Ahora utiliza ai_client y chunking adaptativo.
    """
    issues: List[ValidationIssueModel] = []
    
    # Collect all citations from the document
    all_citations: List[CitationModel] = []
    for elem in doc.elements:
        if elem.text:
            cits = extract_citations_from_text(elem.text, elem.id)
            all_citations.extend(cits)

    if not all_citations or not references:
        return issues

    ref_summaries = []
    for r in references:
        ref_summaries.append({
            "id": r.id,
            "authors": r.authors,
            "year": r.year,
            "title": r.title[:80] if r.title else "",
        })
        
    ref_json = json.dumps(ref_summaries, ensure_ascii=False, indent=2)

    system_prompt = (
        "Eres un asistente experto en normas APA 7ma edicion. "
        "Verifica la coherencia entre las citas en el texto y las referencias bibliograficas proporcionadas.\n"
        "Para cada cita, indica si tiene una referencia correspondiente y senala cualquier problema.\n\n"
        "RESPONDE unicamente con JSON valido:\n"
        '[{"citation_text": "(Garcia, 2023)", "has_match": true, "matched_ref_id": "ref_001", "issues": [], "confidence": 0.95}]'
    )

    from modules.ai_client import execute_with_fallback
    
    CHUNK_SIZE = 20
    batches = [all_citations[i:i + CHUNK_SIZE] for i in range(0, len(all_citations), CHUNK_SIZE)]
    
    for i, batch in enumerate(batches):
        citation_summaries = []
        for c in batch:
            citation_summaries.append({
                "text": c.raw_text,
                "authors": c.authors,
                "year": c.year,
                "type": c.citation_type.value if hasattr(c.citation_type, 'value') else str(c.citation_type),
            })

        user_prompt = (
            "Citas encontradas en el texto:\n"
            f"{json.dumps(citation_summaries, ensure_ascii=False, indent=2)}\n\n"
            "Referencias bibliograficas disponibles:\n"
            f"{ref_json}"
        )

        try:
            content = await execute_with_specialty(
                prompt=user_prompt,
                system_prompt=system_prompt,
                specialty="HEAVY",
                api_key=api_key,
                nim_url=nim_url,
                use_local=use_local,
                temperature=0.1,
                max_tokens=2000,
                use_cache=True
            )

            if content.startswith("```json"):
                content = content[7:-3]
            elif content.startswith("```"):
                content = content[3:-3]

            results = json.loads(content.strip())
            for item in results:
                if not item.get("has_match", True):
                    issues.append(ValidationIssueModel(
                        rule_id="llm_unmatched_citation",
                        severity=ValidationStatus.WARNING,
                        message=(
                            f"Verificacion IA: la cita '{item.get('citation_text', '')}' "
                            f"no tiene una referencia que coincida. {item.get('issues', '')}"
                        ),
                        suggestion="Revise la ortografia del autor o agrege la referencia correspondiente."
                    ))
                    
        except Exception as err:
            print(f"[WARN] Error en validacion LLM de citas (Batch {i+1}): {err}")
            
        # Delay to prevent rate limiting
        if i < len(batches) - 1:
            await asyncio.sleep(1.5)

    return issues

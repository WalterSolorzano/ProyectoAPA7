"""
WordAPA7 — Auditor Estructural via LLM (Engine V2, P2)

Envía la estructura del documento al LLM para validación global con
salida JSON estructurada (Pydantic). Reporta problemas de jerarquía de
headings, secciones faltantes, citas sin referencia, y da sugerencias APA.

Uso:
    from modules.doc_auditor import audit_document_structure
    result = await audit_document_structure(doc_model, api_key)
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class DocAuditResult(BaseModel):
    """Resultado estructurado de la auditoría global del documento."""

    heading_issues: List[str] = Field(default_factory=list)
    missing_sections: List[str] = Field(default_factory=list)
    reference_issues: List[str] = Field(default_factory=list)
    format_suggestions: List[str] = Field(default_factory=list)
    overall_assessment: str = "needs_review"
    summary: str = ""

    @property
    def is_clean(self) -> bool:
        return self.overall_assessment == "good" and not any(
            [self.heading_issues, self.missing_sections, self.reference_issues]
        )


def _build_structure_prompt(doc_model: Any) -> str:
    """Construye un resumen textual de la estructura del documento para el LLM."""
    from models import ElementType

    lines: List[str] = []

    # Element stats
    heading_count = 0
    heading_hierarchy: List[str] = []
    level_counts: Dict[int, int] = {}
    para_count = 0
    table_count = 0
    image_count = 0

    for elem in doc_model.elements:
        t = elem.type.value if hasattr(elem.type, 'value') else str(elem.type)
        t = str(t).lower()

        if t == 'heading' or t == 'head':
            lvl = elem.heading_level or 1
            level_counts[lvl] = level_counts.get(lvl, 0) + 1
            heading_count += 1
            text = (elem.text or "").strip()[:80]
            heading_hierarchy.append(f"  H{lvl}: {text}")
        elif t == 'table':
            table_count += 1
        elif t in ('image', 'figure', 'img'):
            image_count += 1
        elif t in ('paragraph', 'bullet', 'numbered', 'block_quote'):
            para_count += 1

    lines.append(f"Headings: {heading_count} total")
    for lvl in sorted(level_counts):
        lines.append(f"  H{lvl}: {level_counts[lvl]}")
    lines.append("Heading hierarchy (top-down):")
    lines.extend(heading_hierarchy[:60])  # limit to first 60

    lines.append(f"\nParagraphs: {para_count}")
    lines.append(f"Tables: {table_count}")
    lines.append(f"Figures/Images: {image_count}")

    # References and citations
    refs = getattr(doc_model, 'referencias', None) or []
    ref_count = len(refs) if isinstance(refs, list) else 0
    lines.append(f"\nReferences in bibliography: {ref_count}")
    if ref_count > 0 and isinstance(refs, list):
        for r in refs[:5]:
            authors = (r.get('authors') if isinstance(r, dict) else getattr(r, 'authors', [])) or []
            year = (r.get('year') if isinstance(r, dict) else getattr(r, 'year', '')) or ''
            title = (r.get('title') if isinstance(r, dict) else getattr(r, 'title', '')) or ''
            a_str = ", ".join(authors[:2])
            lines.append(f"  - {a_str} ({year}). {str(title)[:60]}")

    # Ghost / orphan counts (if available in the model's citation audit bits)
    citas = getattr(doc_model, 'citas_intext', None) or []
    if isinstance(citas, list) and citas:
        lines.append(f"\nIn-text citations found: {len(citas)}")

    # Cover info
    portada = getattr(doc_model, 'portada', None) or {}
    if portada:
        fields_found = []
        for f in ['title', 'author', 'institution', 'course', 'instructor']:
            if portada.get(f, ''):
                fields_found.append(f)
        lines.append(f"\nCover detected: {bool(portada.get('cover_com_detected') or portada.get('detected') or portada.get('body_start_paragraph_idx'))}")
        if fields_found:
            lines.append(f"Cover fields: {', '.join(fields_found)}")

    # Format profile
    rules = getattr(doc_model, 'apa_rules', None)
    if not rules:
        rules = getattr(doc_model, 'rules', None)
    if rules:
        lines.append(f"\nFormat: {getattr(rules, 'font_family', '?')} {getattr(rules, 'font_size_pt', '?')}pt, "
                      f"margins {getattr(rules, 'margins_cm', '?')}cm, "
                      f"spacing {getattr(rules, 'line_spacing', '?')}")

    return "\n".join(lines)


_AUDIT_SYSTEM_PROMPT = (
    "You are an APA 7th edition expert auditor. You analyze document STRUCTURE, not content. "
    "Return ONLY a valid JSON object (no markdown fences, no explanation) with these fields:\n"
    '{\n'
    '  "heading_issues": ["list of APA heading hierarchy problems"],\n'
    '  "missing_sections": ["list of required sections that seem missing"],\n'
    '  "reference_issues": ["citation/reference inconsistencies or warnings"],\n'
    '  "format_suggestions": ["concrete formatting suggestions for APA 7"],\n'
    '  "overall_assessment": "good" | "needs_review" | "critical",\n'
    '  "summary": "one-paragraph summary in Spanish for the student"\n'
    '}\n'
    "Rules for APA 7:\n"
    "- Headings: Level 1 (centered bold) → Level 2 (left bold) → Level 3 (left bold italic). "
    "No level should be skipped without content between them.\n"
    "- Required sections: Title page, Abstract (optional for students), Body, References.\n"
    "- Every in-text citation MUST have a corresponding reference in the bibliography.\n"
    "- Every reference in the bibliography must be cited in the text.\n"
    "- Titles should be descriptive and under 12 words (APA recommendation).\n"
    "- Abstract should be 150-250 words.\n"
    "Return ONLY the JSON object, nothing else."
)


async def audit_document_structure(
    doc_model: Any,
    api_key: str,
    provider_config: Optional[Dict[str, Any]] = None,
) -> DocAuditResult:
    """
    Llama al LLM para auditar la estructura global del documento.

    Args:
        doc_model: DocumentModel (Pydantic) con elementos, referencias y portada.
        api_key: API key del proveedor de IA.
        provider_config: dict opcional con {nim_url, use_local, provider_id}.

    Returns:
        DocAuditResult con los hallazgos estructurados.
    """
    if not api_key:
        return DocAuditResult(
            overall_assessment="needs_review",
            summary="No hay clave de IA configurada para la auditoría automática.",
        )

    structure_text = _build_structure_prompt(doc_model)

    try:
        from modules.ai_client import execute_with_specialty

        response = await execute_with_specialty(
            prompt=structure_text,
            system_prompt=_AUDIT_SYSTEM_PROMPT,
            specialty="HEAVY",
            api_key=api_key,
            nim_url=(provider_config or {}).get("nim_url", ""),
            use_local=(provider_config or {}).get("use_local", False),
            temperature=0.2,
            max_tokens=1000,
            use_cache=True,
        )

        # Parse the JSON from LLM response
        json_text = str(response).strip()
        # Remove markdown fences if LLM included them anyway
        json_text = re.sub(r"^```(?:json)?\s*", "", json_text)
        json_text = re.sub(r"\s*```$", "", json_text)
        data = json.loads(json_text)

        return DocAuditResult(**data)

    except Exception as e:
        logger.warning(f"[DocAuditor] LLM audit failed: {e}")
        return DocAuditResult(
            overall_assessment="needs_review",
            summary=f"La auditoría automática no pudo completarse. Revisá manualmente.",
        )

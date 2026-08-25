"""Endpoint /api/proofread-batch que conecta el proactive_auditor con el frontend.

El frontend (store/useDocStore -> runProofreadBatch) envía ``{ session_id }`` y
espera ``{ findings, used_llm, ai_indices }`` (ProofreadBatchResponse en
``src/api/backend.ts``).  Para tests y para el add-in también se acepta
``{ texts, element_ids }`` para auditar textos sueltos sin necesidad de una
sesión persistida.

Los hallazgos que devuelve ``audit_elements`` ya tienen el shape exacto que
espera el frontend (``ProofreadFinding`` en ``src/types/index.ts``):
``element_id``, ``start``, ``end``, ``excerpt``, ``kind``, ``severity``,
``message``, ``source`` y opcionalmente ``suggestion``.
"""
from __future__ import annotations

import os
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from modules.proactive_auditor import audit_elements, refine_with_llm

router = APIRouter()


class ProofreadRequest(BaseModel):
    session_id: Optional[str] = None
    texts: List[str] = []
    element_ids: List[str] = []


class _ProofElement:
    """Minimal element object compatible with ``proactive_auditor.audit_elements``.

    ``audit_elements`` lee ``.id``, ``.type`` (con ``.value`` si es enum) y
    ``.text``.  Usamos ``type = "paragraph"`` (string plano) para que el
    filtro ``str(etype) in ("paragraph", "para")`` del auditor lo procese.
    """

    def __init__(self, idx: int, text: str, eid: str):
        self.id = eid
        self.type = "paragraph"
        self.text = text
        self.heading_level = None


def _build_elements_from_texts(
    texts: List[str], element_ids: Optional[List[str]]
) -> List[_ProofElement]:
    """Construye ``_ProofElement`` a partir de textos sueltos (modo test/add-in)."""
    ids = element_ids or [str(i) for i in range(len(texts))]
    elements: List[_ProofElement] = []
    for i, t in enumerate(texts):
        if t and t.strip():
            eid = ids[i] if i < len(ids) else str(i)
            elements.append(_ProofElement(i, t, eid))
    return elements


def _compute_ai_indices(para_texts: List[str], findings: list) -> Optional[dict]:
    """Calcula los 6 índices de comportamiento IA (opcional, informativo).

    Devuelve ``None`` si el cálculo falla para no romper el endpoint.
    """
    try:
        from modules.ai_indices import compute_ai_indices

        imperfection = sum(
            1 for f in findings if f.get("kind") in ("ortografia", "pegado")
        )
        return compute_ai_indices(para_texts, imperfection_signals=imperfection)
    except Exception:
        return None


@router.post("/api/proofread-batch")
async def proofread_batch(req: ProofreadRequest) -> dict:
    """Revisor por lotes: ortografía, frases IA, texto pegado (local + LLM opcional).

    Dos modos de entrada:
      - ``{ texts, element_ids }``: audita textos sueltos (tests, add-in).
      - ``{ session_id }``: carga la sesión y audita sus párrafos (frontend).

    Devuelve ``{ findings, used_llm, ai_indices }`` — el shape que espera el
    frontend (``ProofreadBatchResponse`` en ``backend.ts``).
    """
    # 1) Construir la lista de elementos a auditar
    if req.texts:
        elements = _build_elements_from_texts(req.texts, req.element_ids)
        para_texts = [e.text for e in elements]
    elif req.session_id:
        from config import STORAGE_DIR
        from persistence.session_manager import load_session_state

        doc = load_session_state(req.session_id, STORAGE_DIR)
        if not doc:
            raise HTTPException(status_code=404, detail="Sesion no encontrada.")
        # audit_elements filtra internamente a type "paragraph"/"para".
        elements = list(doc.elements)
        para_texts = [
            (e.text or "").strip()
            for e in doc.elements
            if (e.text or "").strip() and len((e.text or "").strip()) > 15
        ]
    else:
        return {"findings": [], "used_llm": False, "ai_indices": None}

    if not elements:
        return {"findings": [], "used_llm": False, "ai_indices": None}

    # 2) Auditoría local (siempre disponible, sin red ni API key)
    findings = audit_elements(elements)

    # 3) Refinamiento LLM opcional (solo si hay API key configurada).
    #    refine_with_llm nunca lanza: ante cualquier error devuelve (findings, False).
    used_llm = False
    api_key = os.getenv("NVIDIA_API_KEY", "")
    if api_key and findings:
        try:
            findings, used_llm = refine_with_llm(findings, elements, api_key)
        except Exception:
            used_llm = False

    # 4) Índices de IA (opcional, informativo para el panel del frontend)
    ai_indices = _compute_ai_indices(para_texts, findings)

    return {"findings": findings, "used_llm": used_llm, "ai_indices": ai_indices}

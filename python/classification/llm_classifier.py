"""
WordAPA7 — Clasificador de LLM (NVIDIA NIM Integration)

Utiliza el API de NVIDIA NIM para refinar elementos con baja confianza (< 0.85).
Si no se provee API Key o si ocurre un error, hace un fallback gracil a la clasificacion heuristica.
"""

import json
import os
from typing import List, Optional

import httpx

from models import DocumentModel, ElementModel, ElementType


NVIDIA_NIM_URL: str = "https://integrate.api.nvidia.com/v1/chat/completions"
DEFAULT_MODEL: str = "meta/llama-3.1-70b-instruct"

CLASSIFICATION_SYSTEM_PROMPT: str = (
    "Eres un experto en estructura de documentos academicos APA 7ma edicion. "
    "Analiza el mapa jerarquico del documento ANTES de clasificar elementos individuales.\n\n"
    "IMPORTANTE:\n"
    "- Los niveles de heading son RELATIVOS: el Heading 1 de un doc es el titulo mas grande/importante.\n"
    "- Infiere jerarquia desde: numeracion explicita (1., 1.1.), tamano relativo de fuente, contexto del documento.\n"
    "- Para bullet y numbered_list: nivel 1, 2 o 3 basado en indentacion.\n"
    "- Solo clasifica lo que realmente no puedes determinar con certeza.\n\n"
    "RESPONDE con JSON valido unicamente:\n"
    '{"classifications": [{"id": "elem_042", "type": "heading", "heading_level": 2, "confidence": 0.88, "reasoning": "razon breve"}]}'
)


async def classify_document_with_llm(
    doc: DocumentModel,
    api_key: Optional[str] = None,
) -> DocumentModel:
    """
    Refina todos los elementos con confianza < 0.85 llamando a NVIDIA NIM en lotes de 25.
    Envia el mapa completo de titulos del documento para contexto de jerarquia.
    """
    key: str = (api_key or os.getenv("NVIDIA_API_KEY", "")).strip()

    if not key:
        print("[INFO] No NVIDIA_API_KEY found. Keeping rule-based classification.")
        return doc

    # Seleccionar elementos dudosos
    uncertain_elements: List[ElementModel] = []
    for e in doc.elements:
        if hasattr(e, 'needs_review') and e.needs_review:
            uncertain_elements.append(e)
        elif hasattr(e, 'confidence') and e.confidence < 0.85:
            if e.type not in (ElementType.EMPTY, ElementType.IMAGE, ElementType.TABLE,
                              ElementType.PAGE_BREAK, ElementType.SECTION_BREAK):
                uncertain_elements.append(e)

    if not uncertain_elements:
        return doc

    # Construir mapa completo de titulos del documento como contexto general
    heading_map: List[dict] = []
    for e in doc.elements:
        if e.type == ElementType.HEADING:
            heading_map.append({
                "id": e.id,
                "text": (e.text or "")[:80],
                "level": e.heading_level or 1,
                "font_size": e.font_size,
                "is_bold": e.is_bold
            })

    # Procesar en lotes de 25 elementos secuenciales
    batch_size = 25
    for i in range(0, len(uncertain_elements), batch_size):
        batch = uncertain_elements[i:i + batch_size]

        payload_items: List[dict] = []
        for e in batch:
            payload_items.append({
                "id": e.id,
                "text": (e.text or "")[:200],
                "current_type": e.type.value if isinstance(e.type, ElementType) else str(e.type),
                "heading_level": e.heading_level,
                "is_bold": e.is_bold,
                "is_italic": e.is_italic,
                "font_size": e.font_size,
                "alignment": e.alignment,
                "left_indent_cm": e.left_indent_cm,
                "style_name": e.style_name,
            })

        user_prompt = (
            "Mapa jerarquico de titulos del documento (para contexto de estructura):\n"
            f"{json.dumps(heading_map[:30], ensure_ascii=False, indent=2)}\n\n"
            "Elementos a clasificar en este lote:\n"
            f"{json.dumps(payload_items, ensure_ascii=False, indent=2)}"
        )

        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

        body = {
            "model": DEFAULT_MODEL,
            "messages": [
                {"role": "system", "content": CLASSIFICATION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 2000,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(NVIDIA_NIM_URL, json=body, headers=headers)

                if resp.status_code == 200:
                    content = resp.json()["choices"][0]["message"]["content"]
                    json_start = content.find("[")
                    json_end = content.rfind("]") + 1

                    if json_start != -1 and json_end > json_start:
                        try:
                            results = json.loads(content[json_start:json_end])
                            res_map: dict[str, dict] = {r["id"]: r for r in results if "id" in r}

                            for elem in doc.elements:
                                if elem.id in res_map:
                                    res = res_map[elem.id]
                                    new_type_str: str = res.get("type", "")
                                    if new_type_str:
                                        try:
                                            elem.type = ElementType(new_type_str)
                                        except ValueError:
                                            pass

                                    if elem.type == ElementType.HEADING:
                                        new_level = res.get("heading_level")
                                        if new_level is not None:
                                            elem.heading_level = min(max(int(new_level), 1), 5)

                                    llm_confidence = float(res.get("confidence", 0.90))
                                    elem.confidence = max(elem.confidence, llm_confidence)

                                    reasoning = res.get("reasoning", "")
                                    if reasoning:
                                        elem.llm_reasoning = reasoning

                                    if elem.confidence >= 0.85:
                                        elem.needs_review = False
                        except json.JSONDecodeError:
                            print("[WARN] NVIDIA NIM devolvio JSON invalido.")
                else:
                    print(f"[WARN] NVIDIA NIM status {resp.status_code}: {resp.text[:200]}")
        except Exception as err:
            print(f"[WARN] Error calling NVIDIA NIM: {err}")

    return doc

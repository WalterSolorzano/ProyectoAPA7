"""
WordAPA7 — Clasificador de LLM (NVIDIA NIM Integration)

Utiliza el API gratuito/de prueba de NVIDIA NIM para refinar elementos
con baja confianza (< 0.85). Si no se provee API Key o si ocurre un error,
hace un fallback gracil a la clasificacion heuristica.
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
    "Analiza el documento completo para entender la jerarquia ANTES de clasificar elementos individuales.\n\n"
    "IMPORTANTE:\n"
    "- Los niveles de heading son RELATIVOS: el Heading 1 de un doc es el titulo mas grande/importante.\n"
    "- Infiere jerarquia desde: numeracion explicita (1., 1.1.), tamano relativo de fuente, contexto del documento.\n"
    "- Para heading nivel 4 y 5: el texto comienza en la misma linea (parrafo inline), termina en punto.\n"
    "- Para bullet y numbered_list: nivel 1, 2 o 3 basado en indentacion.\n"
    "- Solo clasifica lo que realmente no puedes determinar con certeza.\n\n"
    "RESPONDE con JSON valido unicamente:\n"
    '{{"classifications": [{{"id": "elem_042", "type": "heading", "heading_level": 2, "confidence": 0.88, "reasoning": "razon breve"}}]}}'
)


DEFAULT_NVIDIA_API_KEY: str = ""


async def classify_document_with_llm(
    doc: DocumentModel,
    api_key: Optional[str] = None,
) -> DocumentModel:
    """
    Refina los elementos con confianza < 0.85 llamando a NVIDIA NIM.
    Envia contexto completo del documento para inferir jerarquia.
    Solo procesa elementos marcados como needs_review (confidence < 0.85).
    """
    key: str = (api_key or os.getenv("NVIDIA_API_KEY", "")).strip()

    if not key:
        print("[INFO] No NVIDIA_API_KEY found. Keeping rule-based classification.")
        return doc

    # Seleccionar elementos dudosos (que realmente necesitan LLM)
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

    # Limitar a maximo 30 elementos por llamada para cuidar tokens
    batch = uncertain_elements[:30]

    # Construir payload con contexto util para el LLM
    payload_items: List[dict] = []
    for e in batch:
        item: dict = {
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
        }
        payload_items.append(item)

    # Construir contexto del documento (elementos vecinos para jerarquia)
    context_ids = set()
    for e in batch:
        # Encontrar el indice del elemento en el documento
        for idx, de in enumerate(doc.elements):
            if de.id == e.id:
                # Agregar IDs de elementos vecinos como contexto
                for offset in range(-3, 4):
                    if 0 <= idx + offset < len(doc.elements):
                        context_ids.add(doc.elements[idx + offset].id)
                break

    # Simplificar: enviar primeros 15 elementos como contexto de documento
    doc_context_items: List[dict] = []
    for e in doc.elements[:15]:
        doc_context_items.append({
            "id": e.id,
            "type": e.type.value if isinstance(e.type, ElementType) else str(e.type),
            "text_preview": (e.text or "")[:80],
            "heading_level": e.heading_level,
            "is_bold": e.is_bold,
            "font_size": e.font_size,
        })

    user_prompt = (
        "Contexto del documento (primeros elementos para entender estructura):\n"
        f"{json.dumps(doc_context_items, ensure_ascii=False, indent=2)}\n\n"
        "Elementos a clasificar:\n"
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

                # Extraer bloque JSON de la respuesta
                json_start = content.find("[")
                json_end = content.rfind("]") + 1

                if json_start != -1 and json_end > json_start:
                    try:
                        results = json.loads(content[json_start:json_end])
                        res_map: dict[str, dict] = {}
                        for r in results:
                            if "id" in r:
                                res_map[r["id"]] = r

                        for elem in doc.elements:
                            if elem.id in res_map:
                                res = res_map[elem.id]
                                new_type_str: str = res.get("type", "")
                                if new_type_str:
                                    try:
                                        elem.type = ElementType(new_type_str)
                                    except ValueError:
                                        pass  # Mantener tipo actual si no es valido

                                # Actualizar heading_level si es heading
                                if elem.type == ElementType.HEADING:
                                    new_level = res.get("heading_level")
                                    if new_level is not None:
                                        elem.heading_level = min(max(int(new_level), 1), 5)

                                # Actualizar confianza
                                llm_confidence = float(res.get("confidence", 0.90))
                                elem.confidence = max(elem.confidence, llm_confidence)

                                # Guardar razonamiento
                                reasoning = res.get("reasoning", "")
                                if reasoning:
                                    elem.llm_reasoning = reasoning

                                # Si el LLM tiene alta confianza, ya no necesita revision
                                if elem.confidence >= 0.85:
                                    elem.needs_review = False
                    except json.JSONDecodeError:
                        print("[WARN] NVIDIA NIM devolvio JSON invalido. Manteniendo clasificacion heuristica.")
            else:
                print(f"[WARN] NVIDIA NIM error status {resp.status_code}: {resp.text[:200]}")

    except httpx.TimeoutException:
        print("[WARN] Timeout llamando a NVIDIA NIM. Manteniendo clasificacion heuristica.")
    except Exception as err:
        print(f"[WARN] Error calling NVIDIA NIM LLM: {err}")

    return doc

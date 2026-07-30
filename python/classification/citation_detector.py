"""
WordAPA7 — Detector Inteligente de Citas APA 7 (In-Text Citation Detector)
Usa IA / modelos multi-proveedor para identificar citas parentéticas, narrativas y secundarias
en párrafos del cuerpo del trabajo, sugiriendo correcciones según la norma APA 7ma edición.
"""

import os
import json
import asyncio
from typing import List, Optional
import httpx
from pydantic import BaseModel


class DetectedCitation(BaseModel):
    element_id: str
    citation_type: str  # parentetica, narrativa, multiple, secundaria, pagina, et_al
    authors: List[str]
    year: str
    page: Optional[str] = None
    char_start: int
    char_end: int
    original_text: str
    error: str = ""
    suggestion: str = ""


CITATION_SYSTEM_PROMPT = """
Eres un asistente experto en normas APA 7ma edición.
Analiza el siguiente texto académico e identifica TODAS las citas bibliográficas in-text.
Para cada cita encontrada, responde en formato JSON como una lista de objetos:
[
  {
    "type": "parentetica" | "narrativa" | "multiple" | "secundaria" | "pagina" | "et_al",
    "authors": ["Pérez", "Gómez"],
    "year": "2023",
    "page": "p. 45" | null,
    "char_start": 12,
    "char_end": 35,
    "original_text": "(Pérez & Gómez, 2023, p. 45)",
    "error": "Error si aplica (ej. falta año o uso de & en cita narrativa)",
    "suggestion": "Formato corregido APA 7"
  }
]
Si no hay citas, responde con [].
Responde ÚNICAMENTE con el bloque JSON.
"""


async def detect_citations_in_text(
    text: str,
    element_id: str,
    api_key: Optional[str] = None
) -> List[DetectedCitation]:
    """Detecta citas bibliográficas en un párrafo usando la API de IA."""
    if not text or len(text.strip()) < 15:
        return []

    key = (api_key or os.getenv("NVIDIA_API_KEY", "")).strip()
    if not key:
        return []

    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": "meta/llama-3.1-70b-instruct",
        "temperature": 0.1,
        "max_tokens": 1500,
        "messages": [
            {"role": "system", "content": CITATION_SYSTEM_PROMPT},
            {"role": "user", "content": f"Texto a analizar:\n\"{text}\""},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=body, headers=headers)
            if resp.status_code == 200:
                content = resp.json()["choices"][0]["message"]["content"]
                json_start = content.find("[")
                json_end = content.rfind("]") + 1
                if json_start != -1 and json_end > json_start:
                    raw_list = json.loads(content[json_start:json_end])
                    results = []
                    for item in raw_list:
                        results.append(
                            DetectedCitation(
                                element_id=element_id,
                                citation_type=item.get("type", "parentetica"),
                                authors=item.get("authors", []),
                                year=str(item.get("year", "")),
                                page=item.get("page"),
                                char_start=int(item.get("char_start", 0)),
                                char_end=int(item.get("char_end", len(text))),
                                original_text=item.get("original_text", ""),
                                error=item.get("error", ""),
                                suggestion=item.get("suggestion", ""),
                            )
                        )
                    return results
    except Exception as err:
        print(f"[WARN] Error en detector de citas LLM: {err}")

    return []

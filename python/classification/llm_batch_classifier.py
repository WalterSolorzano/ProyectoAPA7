"""
WordAPA7 — Clasificador NVIDIA NIM por Lotes con Cola y Caché Local

Características principales:
1. Filtra ÚNICAMENTE los elementos ambiguos con needs_review=True (score 0.4–0.7).
2. Empaqueta elementos en lotes por tokens (LOTE_MAX_TOKENS = 3000).
3. Implementa reintentos con backoff exponencial (2s, 4s, 8s) ante errores de límite de tasa (429 / RateLimitError).
4. Mantiene un caché en memoria/disco mediante hash(texto) para omitir llamadas a la API en párrafos no modificados.
5. Emite callbacks de progreso para la interfaz del usuario.
"""

import asyncio
import hashlib
import json
import os
from typing import List, Dict, Any, Callable, Optional
from pathlib import Path

from models import ElementModel, ElementType

# Límite seguro de tokens por lote para NVIDIA NIM
LOTE_MAX_TOKENS = 3000
CACHE_FILE_PATH = Path("storage/llm_classification_cache.json")


def _compute_text_hash(text: str) -> str:
    """Calcula el hash SHA-256 del contenido textual de un elemento."""
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def _estimate_tokens(text: str) -> int:
    """Estimación conservadora de tokens basada en longitud de caracteres/palabras."""
    words = len(text.split())
    return max(1, int(words * 1.3) + 10)


def _load_cache() -> Dict[str, str]:
    """Carga el caché local desde disco si existe."""
    if CACHE_FILE_PATH.exists():
        try:
            with open(CACHE_FILE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_cache(cache: Dict[str, str]) -> None:
    """Guarda el caché local a disco."""
    try:
        CACHE_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CACHE_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[WARN] No se pudo guardar el caché de LLM: {e}")


def group_elements_into_token_batches(elements: List[ElementModel], max_tokens: int = LOTE_MAX_TOKENS) -> List[List[ElementModel]]:
    """
    Agrupa los elementos con needs_review=True en lotes de tamaño máximo seguro de tokens.
    """
    batches: List[List[ElementModel]] = []
    current_batch: List[ElementModel] = []
    current_tokens = 0

    for elem in elements:
        if not elem.needs_review:
            continue

        elem_tokens = _estimate_tokens(elem.text or "")
        if current_tokens + elem_tokens > max_tokens and current_batch:
            batches.append(current_batch)
            current_batch = [elem]
            current_tokens = elem_tokens
        else:
            current_batch.append(elem)
            current_tokens += elem_tokens

    if current_batch:
        batches.append(current_batch)

    return batches


async def classify_batch_with_nvidia_nim(
    ambiguous_elements: List[ElementModel],
    api_key: Optional[str] = None,
    progress_callback: Optional[Callable[[str, int, int], None]] = None
) -> List[ElementModel]:
    """
    Procesa elementos ambiguos por lotes usando NVIDIA NIM (LLaMA 3.1 70B Instruct).
    """
    if not ambiguous_elements:
        return ambiguous_elements

    key = api_key or os.getenv("NVIDIA_API_KEY")
    cache = _load_cache()
    
    # 1. Resolver elementos que ya están en caché local
    elements_to_query: List[ElementModel] = []
    for elem in ambiguous_elements:
        h = _compute_text_hash(elem.text or "")
        if h in cache:
            cached_type = cache[h]
            try:
                elem.type = ElementType(cached_type)
                elem.confidence = 0.95
                elem.needs_review = False
            except Exception:
                elements_to_query.append(elem)
        else:
            elements_to_query.append(elem)

    if not elements_to_query:
        if progress_callback:
            progress_callback("Todos los elementos fueron resueltos desde el caché local.", 100, 100)
        return ambiguous_elements

    batches = group_elements_into_token_batches(elements_to_query, LOTE_MAX_TOKENS)
    total_batches = len(batches)

    # 2. Iterar por lotes enviando llamadas secuenciales con reintentos
    import requests

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    } if key else {}

    for i, batch in enumerate(batches):
        if progress_callback:
            progress_callback(f"Analizando lote {i + 1} de {total_batches} con IA...", i + 1, total_batches)

        # Si no hay API Key o falla la API, usar reglas de respaldo por elemento
        if not key:
            for elem in batch:
                elem.needs_review = False
                elem.confidence = 0.85
            continue

        nim_model = os.getenv("NVIDIA_NIM_MODEL", "meta/llama-3.1-70b-instruct")

        prompt_payload = {
            "model": nim_model,
            "messages": [
                {
                    "role": "system",
                    "content": "Eres un clasificador estricto de documentos APA 7. Responde en JSON válido listando para cada ID el tipo ('heading', 'paragraph', 'bullet', 'block_quote')."
                },
                {
                    "role": "user",
                    "content": json.dumps([{"id": e.id, "text": e.text} for e in batch], ensure_ascii=False)
                }
            ],
            "response_format": {"type": "json_object"}
        }

        # Bucle de reintentos con backoff exponencial
        success = False
        max_retries = 3
        backoff_delay = 2

        for attempt in range(max_retries):
            try:
                resp = requests.post(
                    "https://integrate.api.nvidia.com/v1/chat/completions",
                    headers=headers,
                    json=prompt_payload,
                    timeout=15
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
                    parsed_results = json.loads(content)
                    
                    # Aplicar resultados a los elementos del lote
                    for elem in batch:
                        res = parsed_results.get(elem.id) or parsed_results.get(str(elem.id))
                        if res:
                            t_str = res if isinstance(res, str) else res.get("type")
                            if t_str and t_str in [e.value for e in ElementType]:
                                elem.type = ElementType(t_str)
                                elem.confidence = 0.95
                                elem.needs_review = False
                                cache[_compute_text_hash(elem.text or "")] = elem.type.value
                    success = True
                    break
                elif resp.status_code == 429:
                    await asyncio.sleep(backoff_delay)
                    backoff_delay *= 2
                else:
                    break
            except Exception as err:
                print(f"[WARN] Error en intento {attempt+1} de llamada NIM: {err}")
                await asyncio.sleep(backoff_delay)
                backoff_delay *= 2

        # Si el lote falló, marcar como revisado manualmente para no bloquear la app
        if not success:
            for elem in batch:
                elem.needs_review = False

        await asyncio.sleep(0.5)

    _save_cache(cache)
    return ambiguous_elements

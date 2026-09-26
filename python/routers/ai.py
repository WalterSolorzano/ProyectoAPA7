"""IA: proveedores, modelos y endpoints de asistencia - extraido de main.py (mejora #4 / E-02)."""
from __future__ import annotations

import logging
import os
from typing import List, Optional

from config import STORAGE_DIR
from fastapi import APIRouter, HTTPException, Request
from models import ElementType
from persistence.session_manager import load_session_state
from pydantic import BaseModel

router = APIRouter(tags=["ai"])
logger = logging.getLogger('wordapa7')


@router.get("/api/provider-status")
async def provider_status_endpoint() -> dict:
    """Returns the status of all configured AI providers."""
    import os

    from classification.llm_classifier import PROVIDER_CAPACITY, _get_active_providers

    all_providers = [
        {"id": "nvidia_nim", "name": "NVIDIA NIM", "env_var": "NVIDIA_API_KEY"},
        {"id": "groq", "name": "Groq", "env_var": "GROQ_API_KEY"},
        {"id": "openrouter", "name": "OpenRouter", "env_var": "OPENROUTER_API_KEY"},
        {"id": "cerebras", "name": "Cerebras", "env_var": "CEREBRAS_API_KEY"},
        {"id": "mistral", "name": "Mistral AI", "env_var": "MISTRAL_API_KEY"},
        {"id": "opencodezen", "name": "OpenCodeZen", "env_var": "OPENCODEZEN_API_KEY"},
        {"id": "zenmux", "name": "ZenMux", "env_var": "ZENMUX_API_KEY"},
        {"id": "gemini", "name": "Gemini", "env_var": "GEMINI_API_KEY"},
        {"id": "cloudflare", "name": "Cloudflare Workers AI", "env_var": "CLOUDFLARE_API_TOKEN"},
        {"id": "aion", "name": "Aion Labs", "env_var": "AION_API_KEY"},
        {"id": "kilocode", "name": "Kilo Code", "env_var": "KILOCODE_API_KEY"},
        {"id": "ollama_cloud", "name": "Ollama Cloud", "env_var": "OLLAMA_API_KEY"},
    ]

    active_providers = _get_active_providers()
    active_ids = {p["id"] for p in active_providers}

    providers_status = []
    for p in all_providers:
        cap = PROVIDER_CAPACITY.get(p["id"], {})
        providers_status.append({
            "id": p["id"],
            "name": p["name"],
            "active": p["id"] in active_ids,
            "capacity": {
                "timeout_s": cap.get("timeout", 25),
                "typical_latency_s": cap.get("typical_latency_s", 10),
                "max_tokens": cap.get("max_tokens_per_request", 2000),
            } if p["id"] in active_ids else None,
        })

    configured_env_vars = [
        "NVIDIA_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "CEREBRAS_API_KEY",
        "MISTRAL_API_KEY", "OPENCODEZEN_API_KEY", "ZENMUX_API_KEY", "GEMINI_API_KEY",
        "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
        "AION_API_KEY", "KILOCODE_API_KEY", "OLLAMA_API_KEY",
    ]
    total_configured = sum(1 for v in configured_env_vars if os.getenv(v, "").strip())

    return {
        "providers": providers_status,
        "total_active": len(active_providers),
        "total_configured": total_configured,
        "classification_available": len(active_providers) > 0,
    }


@router.get("/api/ai/health")
async def ai_health_endpoint() -> dict:
    """
    Estado de salud de los proveedores de IA por especialidad (FAST / HEAVY / REASONING).

    Formato consumido por src/components/AIBatteryIndicator.tsx:
      { [specialty]: { provider: str, percentage: int, status: 'good'|'warning'|'critical' } }
    """
    from modules.ai_client import get_ai_system_health
    return get_ai_system_health()


class SuggestCaptionRequest(BaseModel):
    session_id: str
    element_id: str
    context_text: str
    api_key: Optional[str] = None


class ExplainElementRequest(BaseModel):
    element_type: str = ""
    text: str = ""
    rules_applied: str = ""
    confidence: float = 0.0
    api_key: Optional[str] = None
    # C3: campos de compatibilidad enviados por el frontend
    session_id: Optional[str] = None
    element_id: Optional[str] = None
    question: str = ""


class RewriteTextRequest(BaseModel):
    session_id: str
    element_id: str
    text: str
    instruction: str
    api_key: Optional[str] = None


class RewriteVariationsRequest(BaseModel):
    """Genera N variaciones de reescritura de un párrafo (Fase F/propuesta 2)."""
    session_id: str
    element_id: str
    text: str
    instruction: str = "Reescribe el párrafo en tono académico formal sin muletillas de IA."
    n: int = 3
    api_key: Optional[str] = None


class LiveChatRequest(BaseModel):
    session_id: str
    user_instruction: str
    selected_element_id: Optional[str] = None
    history: Optional[List[dict]] = None
    api_key: Optional[str] = None


class ProactiveCaptionsRequest(BaseModel):
    session_id: str
    api_key: Optional[str] = None


class ProactiveDiagnoseRequest(BaseModel):
    session_id: str
    element_id: str
    api_key: Optional[str] = None


class ChatCommentRequest(BaseModel):
    """Genera un comentario humorístico estilo WhatsApp sobre un elemento."""
    session_id: str
    element_id: str
    kind: str            # emoji | ghost_citation | validation_* | shouting | spanglish | ...
    element_text: str    # el texto del elemento (contexto)
    examples: list = []  # ejemplos del tono buscado
    api_key: Optional[str] = None
    nim_url: Optional[str] = None
    use_local: bool = False
    provider_id: Optional[str] = None


class LoadingTipRequest(BaseModel):
    """Genera un tip de carga (pantalla de progreso) con IA."""
    category: Optional[str] = None  # process | jokes | apa | honest
    phase: Optional[str] = None     # upload | classify | export
    api_key: Optional[str] = None
    nim_url: Optional[str] = None
    use_local: bool = False
    provider_id: Optional[str] = None


class CitationFixRequest(BaseModel):
    """Sugiere la corrección APA de una cita (propuesta 6)."""
    session_id: str
    citation_text: str
    reference_id: Optional[str] = None
    problem: str = ""
    api_key: Optional[str] = None


# ── ENDPOINTS DE LA API REST ──────────────────────────────────────────────────


@router.post("/api/ai/suggest-caption")
async def api_suggest_caption(req: SuggestCaptionRequest) -> dict:
    from modules.ai_assistant import generate_caption_suggestion
    try:
        suggestion = await generate_caption_suggestion(req.context_text, req.api_key)
        return {"suggestion": suggestion}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/ai/explain-element")
async def api_explain_element(req: ExplainElementRequest) -> dict:
    from modules.ai_assistant import explain_element
    try:
        explanation = await explain_element(req.element_type, req.text, req.rules_applied, req.confidence, req.api_key)
        return {"explanation": explanation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/ai/rewrite")
async def api_rewrite_text(req: RewriteTextRequest) -> dict:
    from modules.ai_assistant import rewrite_text_suggestion
    try:
        rewritten = await rewrite_text_suggestion(req.text, req.instruction, req.api_key)
        return {"rewritten": rewritten}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/ai/rewrite-variations")
async def api_rewrite_variations(req: RewriteVariationsRequest) -> dict:
    """
    Genera N (1-3) variaciones de reescritura de un párrafo usando LLM.
    Cada variación conserva el significado y cita las mismas fuentes, pero
    reduce las señales de IA detectadas. Devuelve proveedor usad para logs.
    """
    from modules.ai_client import execute_with_specialty
    n = max(1, min(3, req.n))
    system_prompt = (
        "Eres un editor académico experto en APA 7ma edición. "
        "Reescribes párrafos en español universitario natural, eliminando "
        "muletillas de IA (en conclusión, es importante destacar, no obstante, "
        "vale la pena, resulta fundamental) y variando la estructura de las "
        "oraciones. Devuelves EXCLUSIVAMENTE un JSON válido: un array de "
        "strings, cada uno es una versión reescrita. Sin comillas extra."
    )
    user_prompt = (
        f"Instrucción: {req.instruction}\n"
        f"Texto original:\n{req.text}\n\n"
        f"Genera {n} versiones distintas. Devuelve JSON (array de strings)."
    )
    try:
        content = await execute_with_specialty(
            prompt=user_prompt,
            system_prompt=system_prompt,
            specialty="FAST",
            api_key=req.api_key,
            temperature=0.6,
            max_tokens=1400,
            use_cache=False,
            return_provider_info=True,
        )
        if isinstance(content, tuple) and len(content) == 3:
            raw, provider_name, provider_id = content
        else:
            raw, provider_name, provider_id = content, "unknown", "unknown"
        text = raw.strip()
        if text.startswith("```json"):
            text = text[7:-3]
        elif text.startswith("```"):
            text = text[3:-3]
        import json as _json
        try:
            variations = _json.loads(text.strip())
            if not isinstance(variations, list):
                variations = [str(variations)]
        except Exception:
            variations = [text]
        variations = [v for v in variations if isinstance(v, str) and v.strip()]
        variations = variations[:n]
        return {
            "variations": variations,
            "provider": provider_name,
            "provider_id": provider_id,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/ai/live-chat")
async def api_live_chat(req: LiveChatRequest) -> dict:
    """
    Asistente conversacional en vivo: interpreta instrucciones en lenguaje natural
    y devuelve una respuesta explicativa junto con acciones estructuradas (DSL)
    para editar el DocumentModel de forma atómica y segura.
    """
    doc = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    from modules.ai_document_editor import process_live_document_chat
    try:
        result = await process_live_document_chat(
            document=doc,
            user_instruction=req.user_instruction,
            selected_element_id=req.selected_element_id,
            history=req.history,
            api_key=req.api_key,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/ai/proactive-captions")
async def api_proactive_captions(req: ProactiveCaptionsRequest) -> dict:
    """
    Analiza en segundo plano las figuras y tablas del documento y sugiere
    automáticamente títulos descriptivos en cursiva y notas APA 7.
    """
    doc = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    from modules.ai_proactive_captioner import analyze_document_proactive_captions
    try:
        suggestions = await analyze_document_proactive_captions(
            document=doc,
            api_key=req.api_key,
        )
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/ai/proactive-diagnose")
async def api_proactive_diagnose(req: ProactiveDiagnoseRequest) -> dict:
    """
    Diagnostica de forma proactiva un elemento del documento y formula una
    propuesta de corrección académica lista para aplicar con 1 clic.
    """
    doc = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    elem = next((e for e in doc.elements if e.id == req.element_id), None)
    if not elem:
        raise HTTPException(status_code=404, detail="Elemento no encontrado")

    from modules.ai_proactive_reviewer import diagnose_element_with_ai
    try:
        diagnosis = await diagnose_element_with_ai(
            elem=elem,
            api_key=req.api_key,
        )
        return {"proposal": diagnosis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/ai/chat-comment")
async def api_chat_comment(req: ChatCommentRequest) -> dict:
    """
    Genera un comentario humorístico estilo WhatsApp sobre un elemento del
    documento (emojis, citas fantasma, muletillas IA, formato APA...).

    Se usa el LLM con contexto + ejemplos para que el tono sea el del "bro"
    que comenta el trabajo. Es un toque de personalidad; si falla o no hay
    API key, el frontend cae al comentario de la biblioteca (plantillas).
    """
    from modules.ai_client import execute_with_specialty

    # Guarda de seguridad: recortar el texto para no saturar tokens
    element_text = (req.element_text or "")[:800]

    system_prompt = (
        "Sos un amigo universitario que comenta el trabajo de un compañero por "
        "WhatsApp: con humor, jerga argentina/universitaria, frases CORTAS "
        "(máximo 18 palabras) y sin ser pesado. El texto va dentro de una burbuja "
        "de chat. Usás emojis. Nunca corregís el contenido de verdad: solo "
        "comentás con onda. Respondés EXCLUSIVAMENTE con el comentario, sin "
        "comillas, sin explicaciones ni intro."
    )

    # Mapear la categoría a una instrucción clara para el LLM
    kind_hint = {
        "ghost_citation": "una cita que aparece en el texto pero NO está en la bibliografía",
        "orphan_references": "referencias que están en la bibliografía pero nunca se citaron",
        "shouting": "un párrafo escrito TODO en MAYÚSCULAS",
        "spanglish": "una frase que mezcla inglés y español",
        "duplicate": "una palabra repetida seguida (error de tipeo/pegado)",
        "long_paragraph": "un párrafo larguísimo de una sola tirada",
        "first_person": "uso de primera persona (yo/nosotros) en un trabajo académico",
        "acronym": "una sigla o abreviatura sin definir",
        "excess_punctuation": "signos de exclamación/interrogación exagerados (!!/??)",
        "validation_figuras": "un problema con el formato APA de una figura",
        "validation_tablas": "un problema con el formato APA de una tabla",
        "validation_headings": "un problema con la jerarquía o formato de un título",
        "validation_formato": "un problema general de formato APA",
        "validation_citas": "un problema con una cita",
        "validation_referencias": "un problema con la bibliografía",
        "validation_consistencia": "una inconsistencia detectada en el documento",
        "conclusion": "una muletilla típica de IA ('en conclusión', 'en resumen')",
        "ai": "una muletilla típica de IA",
        "emoji": "un emoji o símbolo de checklist que se coló en el texto",
        "table_emoji": "una tabla con emojis de checklist pegados de un chat",
        "image_no_caption": "una imagen sin leyenda",
    }.get(req.kind, "algo sospechoso en el trabajo académico")

    examples = req.examples or [
        "¿por qué gritás? ",
        "¿spanglish? ",
        "esta cita es de pablito? ",
        "bro, los emojis quedaron pegados del chat ",
        "respirá, bro, es un párrafo larguísimo ‍",
        "ese cierre lo escribió el robot, se nota ",
    ]

    examples_str = "\n".join(f"- {ex}" for ex in examples[:6])
    user_prompt = (
        f"Comentá esto: {kind_hint}.\n\n"
        f"Texto del elemento:\n\"{element_text}\"\n\n"
        f"Ejemplos del tono que quiero:\n{examples_str}\n\n"
        "Escribí SOLO el comentario (una frase corta con emoji)."
    )

    try:
        content = await execute_with_specialty(
            prompt=user_prompt,
            system_prompt=system_prompt,
            specialty="FAST",
            api_key=req.api_key,
            nim_url=req.nim_url,
            use_local=req.use_local,
            temperature=0.85,
            max_tokens=90,
            use_cache=False,
        )
        comment = (content or "").strip()
        # Limpiar comillas/backticks que el LLM pueda meter
        comment = comment.strip('"\'`')
        if not comment:
            raise ValueError("Respuesta vacía")
        return {"comment": comment[:140]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/ai/loading-tip")
async def api_loading_tip(req: LoadingTipRequest) -> dict:
    """
    Genera un tip de carga (pantalla de progreso) con el LLM: verbos de
    proceso, chistes internos o curiosidades APA. El frontend rota por
    categoría; si esto falla o no hay API key, usa la biblioteca local.
    """
    from modules.ai_client import execute_with_specialty

    category = req.category or "process"
    phase = req.phase or ""

    phase_hint = {
        "upload": "subiendo un documento",
        "classify": "clasificando elementos con IA",
        "export": "generando el archivo formateado",
    }.get(phase, "procesando un documento")

    category_hint = {
        "process": "un verbo de proceso humorístico (lo que está haciendo la app)",
        "jokes": "un chiste interno sobre la app o el proceso",
        "apa": "una curiosidad o error común de APA 7",
        "honest": "un mensaje honesto y tranquilo porque el proceso tarda",
    }.get(category, "un verbo de proceso humorístico")

    examples = {
        "process": [
            "domesticando tablas…",
            "poniéndole orden a las comas…",
            "negociando con las sangrías…",
            "midiendo márgenes con precisión quirúrgica…",
            "reconciliando a Times New Roman con el resto del mundo…",
            "convirtiendo tus 'Enter, Enter, Enter' en sangría de verdad…",
            "desenredando el nudo de las notas al pie…",
        ],
        "jokes": [
            "leyendo tu bibliografía… ojalá no sea todo Wikipedia.",
            "ese título en mayúsculas sostenidas no engaña a nadie.",
            "alguien tradujo esto con IA y se nota el 'asimismo'.",
            "ese gráfico de Excel pegado se ve como se ve.",
            "la conclusión que dice lo mismo que la introducción, otra vez.",
            "si esto tarda, no es la app, es que tu profe pidió demasiadas fuentes.",
        ],
        "apa": [
            "el error más común en trabajos de estudiante: olvidar el DOI. ¿vos lo tenés?",
            "las tablas no llevan líneas verticales en APA 7.",
            "si son 3 o más autores, va 'et al.' desde la primera cita.",
            "las citas de más de 40 palabras van en bloque, sin comillas.",
            "el DOI empieza con 'https://doi.org/', no con el número pelado.",
        ],
        "honest": [
            "esto está tardando más de lo normal — tu doc es grande, tranquilo, seguimos.",
            "no se colgó, solo está siendo minucioso.",
            "último tramo, ya casi.",
        ],
    }.get(category, [])

    examples_str = "\n".join(f"- {ex}" for ex in examples[:5])

    system_prompt = (
        "Sos el 'bro' de una app que formatea trabajos académicos a APA 7. "
        "Escribís tips cortos para la pantalla de carga: con humor, jerga "
        "universitaria, máximo 60 caracteres, SIN emojis (debe verse sobrio, "
        "no como texto de IA). Respondés SOLO el tip, sin comillas ni intro."
    )
    user_prompt = (
        f"Generá un tip de carga de categoría: {category_hint}.\n"
        f"Contexto: la app está {phase_hint}.\n\n"
        f"Ejemplos del tono:\n{examples_str}\n\nEscribí SOLO el tip."
    )

    try:
        content = await execute_with_specialty(
            prompt=user_prompt,
            system_prompt=system_prompt,
            specialty="FAST",
            api_key=req.api_key,
            nim_url=req.nim_url,
            use_local=req.use_local,
            temperature=0.9,
            max_tokens=70,
            use_cache=True,
        )
        text = (content or "").strip().strip('"\'`')
        if not text:
            raise ValueError("Respuesta vacía")
        return {"category": category, "text": text[:110]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/ai/citation-fix")
async def api_citation_fix(req: CitationFixRequest) -> dict:
    """
    Sugiere la corrección APA 7 de una cita problemática (propuesta 6).
    Devuelve la forma corregida, el motivo y la acción sugerida.
    """
    from modules.ai_client import execute_with_specialty
    from persistence.session_manager import load_session_state
    doc = load_session_state(req.session_id, STORAGE_DIR)
    ref_hint = ""
    if doc and req.reference_id:
        for r in doc.referencias or []:
            if r.id == req.reference_id:
                ref_hint = f"\nReferencia encontrada: {r.formatted_apa or r.raw_text or r.title}"
                break
    system_prompt = (
        "Eres un experto en normas APA 7ma edición. Para una cita problemática, "
        "propones la forma corregida exacta. Devuelves SOLO un JSON válido: "
        '{"corrected": "(Apellido, 2023, p. 45)", "reason": "Falta el número de página", "action": "reemplazar"}.'
    )
    user_prompt = (
        f"Cita actual: {req.citation_text}\n"
        f"Problema: {req.problem or 'formato APA 7 incorrecto'}"
        f"{ref_hint}\n\n"
        "Propón la corrección exacta."
    )
    try:
        content = await execute_with_specialty(
            prompt=user_prompt,
            system_prompt=system_prompt,
            specialty="FAST",
            api_key=req.api_key,
            temperature=0.2,
            max_tokens=300,
            use_cache=True,
        )
        text = content.strip()
        if text.startswith("```json"):
            text = text[7:-3]
        elif text.startswith("```"):
            text = text[3:-3]
        import json as _json
        try:
            data = _json.loads(text.strip())
        except Exception:
            data = {"corrected": "", "reason": content, "action": "reviewar"}
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/sync-provider-keys")
async def sync_provider_keys_endpoint(request: Request) -> dict:
    """
    Recibe las claves de API guardadas por el usuario en la UI (localStorage)
    y las inyecta en os.environ para que _get_active_providers() las use
    sin necesidad de reiniciar el backend ni editar .env.
    Solo inyecta si el valor no está vacío; nunca sobrescribe una existente
    salvo que se envíe un valor nuevo.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}
    keys = body.get("keys", {}) or {}
    if not isinstance(keys, dict):
        keys = {}

    # Mapa de variable de entorno -> clave del cuerpo
    allowed = {
        "NVIDIA_API_KEY": "NVIDIA_API_KEY",
        "GROQ_API_KEY": "GROQ_API_KEY",
        "OPENROUTER_API_KEY": "OPENROUTER_API_KEY",
        "CEREBRAS_API_KEY": "CEREBRAS_API_KEY",
        "MISTRAL_API_KEY": "MISTRAL_API_KEY",
        "OPENCODEZEN_API_KEY": "OPENCODEZEN_API_KEY",
        "ZENMUX_API_KEY": "ZENMUX_API_KEY",
        "GEMINI_API_KEY": "GEMINI_API_KEY",
        "CLOUDFLARE_API_TOKEN": "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_ACCOUNT_ID": "CLOUDFLARE_ACCOUNT_ID",
        "AION_API_KEY": "AION_API_KEY",
        "KILOCODE_API_KEY": "KILOCODE_API_KEY",
        "OLLAMA_API_KEY": "OLLAMA_API_KEY",
    }

    applied = []
    for env_var, key_name in allowed.items():
        val = str(keys.get(key_name, "") or "").strip()
        if val:
            os.environ[env_var] = val
            applied.append(env_var)

    # Persistir en disco para que las claves sobrevivan a un reinicio del backend
    try:
        from persistence.ai_keys import save_provider_keys
        save_provider_keys(keys)
    except Exception as e:
        print(f"[WARN] No se pudo persistir claves de IA: {e}")

    return {"applied": applied, "count": len(applied)}


@router.post("/api/ai-review/{session_id}")
async def ai_review_endpoint(session_id: str, request: Request) -> dict:
    """
    Revisor unificado: por cada párrafo devuelve
      - índice de IA (% 0-100), categoría (LOW/MEDIUM/HIGH) y hallazgos
        con la frase exacta que lo disparó + el motivo.
      - errores ortográficos mapeados al párrafo (con sugerencias) usando
        Word COM (Windows) vía el validador existente.

    Es la etapa opcional "Revisor IA + Ortografía" (Fase F).
    """
    import re as _re

    from classification.ai_detector import analyze_ai_risk, analyze_table_cells
    from modules.spelling_validator import validate_spelling_and_grammar

    doc_model = load_session_state(session_id, STORAGE_DIR)
    if not doc_model:
        raise HTTPException(status_code=404, detail="Sesion no encontrada")

    text_types = {
        ElementType.HEADING, ElementType.PARAGRAPH, ElementType.BULLET,
        ElementType.NUMBERED_LIST, ElementType.BLOCK_QUOTE, ElementType.EQUATION,
    }

    paragraphs: list[dict] = []
    flagged = 0
    score_sum = 0
    score_n = 0

    # 1) Análisis de IA por párrafo
    for idx, e in enumerate(doc_model.elements):
        if e.type not in text_types:
            continue
        text = (e.text or e.original_text or "").strip()
        if not text or len(text) < 15:
            continue
        risk = analyze_ai_risk(text)
        ai_score = int(round(risk.get("score", 0.0) * 100))
        category = risk.get("category", "LOW")
        findings = []
        for f in risk.get("findings", []):
            pattern = f.get("pattern", "")
            detail = f.get("detail", "")
            # Localizar la frase exacta en el texto (búsqueda insensible)
            phrase = f.get("phrase", "") or ""
            # Lista de frases para resaltado inline (sentence_structure ahora la provee)
            phrases = f.get("phrases") or []
            # Limpiar artefactos: nunca mostrar corchetes regex ni backslashes
            phrase = _re.sub(r'[\[\]\\]', '', phrase).strip()
            phrases = [_re.sub(r'[\[\]\\]', '', p).strip() for p in phrases if p and p.strip()]
            if not phrase:
                if pattern == "phrase":
                    # Extraer la primera palabra clave del detail entre comillas
                    m = _re.search(r"'([^']+)'", detail)
                    phrase = m.group(1) if m else ""
                    phrase = _re.sub(r'[\[\]\\]', '', phrase).strip()
                elif pattern == "sentence_structure":
                    phrase = phrases[0] if phrases else "(oraciones homogéneas)"
                elif pattern == "semicolon_overuse":
                    phrase = ";"
                elif pattern == "generic_conclusion":
                    phrase = "(cierre genérico)"
            findings.append({
                "phrase": phrase,
                "phrases": phrases,
                "detail": _re.sub(r'[\[\]\\]', '', detail),
                "severity": f.get("severity", "LOW"),
            })
        paragraphs.append({
            "element_id": e.id,
            "index": idx,
            "type": e.type.value if hasattr(e.type, "value") else str(e.type),
            "text": text,
            "ai_score": ai_score,
            "ai_category": category,
            "findings": findings,
            "spelling": [],
        })
        if ai_score >= 40:
            flagged += 1
        score_sum += ai_score
        score_n += 1

    # 1b) Auditor proactivo: palabras duplicadas, texto pegado, primera
    #     persona, muletillas, ortografia local.  Fusiona hallazgos locales
    #     (sin red ni API key) en los parrafos ya analizados por la IA.
    _unmatched_findings: list[dict] = []
    try:
        from modules.proactive_auditor import audit_elements as _audit_elements
        _pa_findings = _audit_elements(doc_model.elements)
        _para_by_id = {p["element_id"]: p for p in paragraphs}
        _SEV_MAP = {"info": "LOW", "warn": "MEDIUM", "error": "HIGH"}
        for _f in _pa_findings:
            _p = _para_by_id.get(_f.get("element_id"))
            if _p is None:
                # El párrafo ya no existe (editado/borrado durante la sesión):
                # conservar el hallazgo en vez de perderlo silenciosamente.
                _unmatched_findings.append({
                    "element_id": _f.get("element_id"),
                    "phrase": _f.get("excerpt", ""),
                    "phrases": [],
                    "detail": _f.get("message", ""),
                    "severity": _SEV_MAP.get(_f.get("severity", "info"), "LOW"),
                })
                continue
            _p["findings"].append({
                "phrase": _f.get("excerpt", ""),
                "phrases": [],
                "detail": _f.get("message", ""),
                "severity": _SEV_MAP.get(_f.get("severity", "info"), "LOW"),
            })
    except Exception as _ex:
        logger.warning(f"Error fusionando hallazgos del auditor proactivo: {_ex}")

    # 2) Ortografía sobre el .docx original (Word COM)
    spelling_status = "not_run"
    spelling_count = 0
    try:
        session_dir = STORAGE_DIR / "sessions" / session_id
        docx_path = session_dir / "original.docx"
        if docx_path.exists():
            spell = await validate_spelling_and_grammar(str(docx_path))
            spelling_status = spell.get("status", "error")
            if spelling_status == "ok":
                raw_errors = spell.get("spelling_errors", [])
                spelling_count = len(raw_errors)
                # Mapear cada error al párrafo que contiene la palabra
                for err in raw_errors:
                    w = (err.get("word") or "").strip()
                    if not w:
                        continue
                    sugs = err.get("suggestions", [])
                    pattern_w = r"\b" + _re.escape(w.lower()) + r"\b"
                    for p in paragraphs:
                        if _re.search(pattern_w, p["text"].lower()):
                            p["spelling"].append({"word": w, "suggestions": sugs})
        else:
            spelling_status = "no_original"
    except Exception:
        spelling_status = "error"

    ai_avg = round(score_sum / score_n, 1) if score_n > 0 else 0.0

    # 3) Señales a nivel documento: celdas de tabla + metadatos forenses
    table_signals: list[dict] = []
    try:
        for e in doc_model.elements:
            if e.table_info and (e.table_info.headers or e.table_info.rows):
                t_score, t_findings = analyze_table_cells(e.table_info.headers, e.table_info.rows)
                for tf in t_findings:
                    table_signals.append({
                        "element_id": e.id,
                        "type": "table",
                        "pattern": tf.get("pattern", ""),
                        "detail": tf.get("detail", ""),
                        "severity": tf.get("severity", "LOW"),
                        "count": tf.get("count", 0),
                        "phrase": tf.get("phrase", ""),
                    })
    except Exception as ex:
        logger.warning(f"Error analizando tablas en ai-review: {ex}")

    doc_signals: list[str] = []
    try:
        from classification.ai_detector import _metadata_document_signals
        meta_boost, meta_sigs = _metadata_document_signals(
            doc_model.meta.forensic_metadata if doc_model.meta else None
        )
        doc_signals = meta_sigs
    except Exception:
        pass

    return {
        "session_id": session_id,
        "total_paragraphs": len(paragraphs),
        "ai_avg_score": ai_avg,
        "flagged_count": flagged,
        "spelling_count": spelling_count,
        "spelling_status": spelling_status,
        "paragraphs": paragraphs,
        "unmatched_findings": _unmatched_findings,
        "table_signals": table_signals,
        "document_signals": doc_signals,
    }


# ── MONTAJE DEL FRONTEND (SPA) ───────────────────────────────────────────────

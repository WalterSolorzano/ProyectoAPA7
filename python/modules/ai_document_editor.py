"""
WordAPA7 — AI Live Document Editor Engine (Action DSL)
Traduce instrucciones conversacionales en lenguaje natural a mutaciones estructuradas
deterministas sobre el DocumentModel, optimizado para modelos livianos y gratuitos.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional
from models import DocumentModel, ElementModel, ElementType
from modules.ai_client import execute_with_specialty

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Eres el Copiloto Editorial experto en Normas APA 7ma edición de WordAPA7.
Tu misión es asistir al usuario editando y mejorando su documento académico en vivo.

REGLAS DE SALIDA:
Debes responder SIEMPRE en formato JSON válido estricto, sin texto antes ni después del bloque JSON.

ESTRUCTURA DEL JSON:
{
  "reply": "Explicación breve y amigable en español de lo que hiciste o tu respuesta a la consulta.",
  "actions": [
    {
      "type": "update_text",
      "element_id": "elem_id_aqui",
      "text": "Nuevo texto corregido o reescrito"
    },
    {
      "type": "set_type",
      "element_id": "elem_id_aqui",
      "element_type": "paragraph" | "heading" | "block_quote" | "bullet" | "numbered_list",
      "level": 1
    },
    {
      "type": "insert_citation",
      "element_id": "elem_id_aqui",
      "citation": "(González, 2021)"
    },
    {
      "type": "add_reference",
      "reference": "González, P. (2021). Entornos virtuales de aprendizaje. Fondo Editorial."
    },
    {
      "type": "set_caption",
      "element_id": "elem_id_aqui",
      "caption": "Título breve en cursiva"
    },
    {
      "type": "set_note",
      "element_id": "elem_id_aqui",
      "note": "Nota. Elaboración propia a partir de los datos."
    }
  ]
}

Si el usuario solo hace una pregunta teórica de APA 7 o no solicita cambios en el texto, el array "actions" debe estar vacío [].
Cuando modifiques un texto, conserva rigurosamente las citas existentes a menos que el usuario pida explícitamente cambiarlas.
"""

def extract_json_payload(raw: str) -> Dict[str, Any]:
    """Extrae y parsea el payload JSON incluso si el modelo incluye delimitadores markdown."""
    text = raw.strip()
    # Intentar parseo directo
    try:
        return json.loads(text)
    except Exception:
        pass

    # Buscar bloque de código ```json ... ```
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass

    # Buscar llaves balanceadas
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            pass

    return {
        "reply": text.replace("```json", "").replace("```", "").strip(),
        "actions": []
    }

async def process_live_document_chat(
    document: DocumentModel,
    user_instruction: str,
    selected_element_id: Optional[str] = None,
    history: Optional[List[Dict[str, str]]] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Procesa una petición conversacional del usuario y retorna la respuesta con las acciones sugeridas."""
    # Construir resumen del contexto del documento
    context_lines = []
    selected_elem_obj = None

    for elem in document.elements:
        if elem.type in ("page_break", "empty"):
            continue
        is_selected = (elem.id == selected_element_id)
        prefix = "-> [SELECCIONADO] " if is_selected else ""
        text_preview = (elem.text or "").strip()
        if len(text_preview) > 140:
            text_preview = text_preview[:137] + "..."
        context_lines.append(f"{prefix}[ID:{elem.id}] [{elem.type}] {text_preview}")
        if is_selected:
            selected_elem_obj = elem

    context_str = "\n".join(context_lines[:60]) # Primeros elementos relevantes

    selected_detail = ""
    if selected_elem_obj:
        selected_detail = (
            f"\nELEMENTO ACTUALMENTE SELECCIONADO POR EL USUARIO:\n"
            f"ID: {selected_elem_obj.id}\n"
            f"Tipo: {selected_elem_obj.type}\n"
            f"Texto completo:\n{selected_elem_obj.text}\n"
        )

    history_str = ""
    if history:
        for turn in history[-4:]:
            role = "Usuario" if turn.get("role") == "user" else "Copiloto"
            history_str += f"{role}: {turn.get('content', '')}\n"

    prompt = (
        f"ESTRUCTURA DEL DOCUMENTO:\n{context_str}\n"
        f"{selected_detail}\n"
        f"HISTORIAL RECIENTE:\n{history_str}\n"
        f"INSTRUCCIÓN DEL USUARIO:\n{user_instruction}\n\n"
        f"Responde con el JSON estricto requerido."
    )

    try:
        raw_response = await execute_with_specialty(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            specialty="REASONING",
            api_key=api_key,
            temperature=0.2,
            max_tokens=1500,
            use_cache=False,
        )
        parsed = extract_json_payload(raw_response)

        # Enriquecimiento Ghostwriter con Crossref: si se insertó una cita y no hay add_reference
        from modules.referencias_module import search_crossref_by_author_year
        actions = parsed.get("actions", [])
        has_add_ref = any(a.get("type") == "add_reference" for a in actions)

        if not has_add_ref:
            for act in actions:
                if act.get("type") == "insert_citation" and act.get("citation"):
                    cit = act["citation"]
                    # Extraer autor y año: ej "(Hernández et al., 2018)" o "(Kahneman, 2011)"
                    match = re.search(r"\(?([A-Za-zÁÉÍÓÚáéíóúñÑ\-]+)(?:\s+et\s+al\.?)?,?\s*(\d{4})\)?", cit)
                    if match:
                        author_q = match.group(1)
                        year_q = match.group(2)
                        try:
                            cross_res = await search_crossref_by_author_year([author_q], year_q)
                            if cross_res and cross_res.get("formatted_apa"):
                                actions.append({
                                    "type": "add_reference",
                                    "reference": cross_res["formatted_apa"]
                                })
                        except Exception:
                            pass

        return parsed
    except Exception as e:
        logger.error(f"Error procesando live document chat: {e}")
        return {
            "reply": f"Ocurrió un error al procesar la instrucción con la IA: {str(e)}",
            "actions": []
        }

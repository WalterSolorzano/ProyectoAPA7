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
        logger.warning(f"[LiveChat] Motor LLM externo no disponible ({e}). Activando fallback editorial determinista.")
        return _deterministic_chat_fallback(document, user_instruction, selected_element_id)


def _deterministic_chat_fallback(
    document: DocumentModel,
    user_instruction: str,
    selected_element_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Fallback editorial determinista para cuando no hay conexión a internet,
    los proveedores de LLM no tienen clave configurada o hay errores de timeout/red.
    Ejecuta transformaciones APA 7 confiables basadas en reglas locales.
    """
    instruction_lower = user_instruction.lower()
    actions: List[Dict[str, Any]] = []

    # 1. Rotulación de tablas / figuras
    if any(w in instruction_lower for w in ["rotular", "caption", "tabla", "figura"]):
        t_count = 1
        f_count = 1
        for elem in document.elements:
            if elem.type == ElementType.TABLE and elem.table_info:
                if not elem.table_info.caption:
                    actions.append({
                        "type": "set_caption",
                        "element_id": elem.id,
                        "caption": f"Resumen y datos analizados de la tabla {t_count}"
                    })
                    if not elem.table_info.note:
                        actions.append({
                            "type": "set_note",
                            "element_id": elem.id,
                            "note": "Nota. Elaboración propia a partir de los datos recopilados."
                        })
                t_count += 1
            elif elem.type == ElementType.IMAGE and elem.image_info and not elem.is_cover_section:
                if not elem.image_info.caption:
                    actions.append({
                        "type": "set_caption",
                        "element_id": elem.id,
                        "caption": f"Diagrama e ilustración visual de la figura {f_count}"
                    })
                    if not elem.image_info.note:
                        actions.append({
                            "type": "set_note",
                            "element_id": elem.id,
                            "note": "Nota. Adaptado para fines ilustrativos según normas APA 7."
                        })
                f_count += 1
        return {
            "reply": f"He generado leyendas y notas académicas formales para los elementos del documento según los estándares APA 7ma edición.",
            "actions": actions
        }

    # 2. Pulir redacción académica / pronombres ambiguos / primera persona
    if any(w in instruction_lower for w in ["pulir", "redacción", "redaccion", "estilo", "informal", "ambiguo", "primera persona"]):
        from modules.proactive_auditor import audit_text_proactive
        modified = 0
        for elem in document.elements:
            if elem.type in (ElementType.PARAGRAPH, ElementType.BLOCK_QUOTE) and elem.text:
                findings = audit_text_proactive(elem.text, elem.id)
                new_text = elem.text
                for f in findings:
                    if f.suggestion and f.pattern in new_text:
                        new_text = new_text.replace(f.pattern, f.suggestion)
                if new_text != elem.text:
                    actions.append({
                        "type": "update_text",
                        "element_id": elem.id,
                        "text": new_text
                    })
                    modified += 1
                if modified >= 5:
                    break
        if actions:
            return {
                "reply": f"Se aplicaron mejoras de estilo formal y desambiguación en {len(actions)} párrafos del documento siguiendo criterios de redacción APA 7.",
                "actions": actions
            }
        else:
            return {
                "reply": "No encontré expresiones informales o errores críticos pendientes de pulir en los párrafos actuales.",
                "actions": []
            }

    # 3. Revisar jerarquía de títulos
    if any(w in instruction_lower for w in ["jerarquía", "jerarquia", "título", "titulo", "h1", "h2", "h3"]):
        for elem in document.elements:
            if elem.type == ElementType.HEADING and not elem.is_cover_section:
                text = (elem.text or "").strip().lower()
                if any(sec in text for sec in ["resumen", "abstract", "introducción", "introduccion", "método", "metodologia", "resultados", "discusión", "discusion", "conclusiones", "referencias"]):
                    if elem.heading_level != 1:
                        actions.append({"type": "set_type", "element_id": elem.id, "element_type": "heading", "level": 1})
        return {
            "reply": f"Se verificó la jerarquía de títulos del documento y se ajustaron {len(actions)} encabezados principales al Nivel 1 centrado según APA 7.",
            "actions": actions
        }

    # 4. Respuesta general instructiva APA 7
    return {
        "reply": (
            "El motor de reglas editoriales APA 7 procesó tu consulta. "
            "Para explicaciones conversacionales avanzadas con modelos generativos (NVIDIA NIM, Groq, Cerebras, OpenRouter), "
            "puedes vincular una clave de API gratuita en la sección de Configuraciones."
        ),
        "actions": []
    }


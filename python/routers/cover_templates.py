"""Plantillas de portada y templates de documento - extraido de main.py (mejora #4 / E-02)."""
from __future__ import annotations

import uuid
from pathlib import Path
from typing import Optional

from config import STORAGE_DIR
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from models import APAFormat, DocumentModel, ElementModel, ElementType, ReferenciaModel
from persistence.session_manager import load_session_state, save_session_state
from profiles import get_profile
from pydantic import BaseModel

router = APIRouter(tags=["cover"])


@router.get("/api/templates")
async def list_templates_endpoint() -> dict:
    """
    Lista las plantillas de estructura de documento disponibles.
    """
    from generation.templates import AVAILABLE_TEMPLATES

    result = []
    for t in AVAILABLE_TEMPLATES:
        result.append({
            "name": t.name,
            "description": t.description,
            "has_cover_page": t.has_cover_page,
            "has_toc": t.has_toc,
            "has_references": t.has_references,
            "section_count": len(t.sections),
        })
    return {"templates": result}


class ApplyTemplateRequest(BaseModel):
    session_id: str
    template_name: str
    numbering_style: str = "decimal"  # "decimal" | "roman"


class CreateFromTemplateRequest(BaseModel):
    template_id: str
    profile_id: str = "apa7"


def _get_section_guide_text(heading_text: str) -> str:
    h = heading_text.lower().strip()
    if "índice" in h or "tabla de contenido" in h:
        return "La tabla de contenidos se genera de forma automática a partir de los títulos y subtítulos del documento."
    if "introducción" in h:
        return "Esta sección presenta el planteamiento general del trabajo, los antecedentes teóricos más relevantes, la justificación de la investigación y los objetivos específicos que guían el estudio."
    if "antecedente" in h:
        return "Se revisan las investigaciones previas nacionales e internacionales directamente relacionadas con el objeto de estudio, destacando sus aportes y vacíos de conocimiento."
    if "problema" in h:
        return "Describe con claridad la situación problemática observada, su delimitación contextual y la formulación formal de la pregunta principal de investigación."
    if "objetivo" in h:
        return "Establece el objetivo general y los objetivos específicos que delimitan el alcance analítico y metodológico del proyecto."
    if "justificación" in h:
        return "Expone la relevancia teórica, metodológica y práctica del estudio, argumentando el valor añadido de sus resultados para la comunidad académica."
    if "marco teórico" in h or "marco conceptual" in h:
        return "Desarrolla las teorías, modelos y conceptos fundamentales que sustentan el análisis. Las citas en el texto deben seguir el formato APA 7 (Apellido, Año)."
    if "metodología" in h or "método" in h:
        return "Describe detalladamente el enfoque de investigación, el diseño metodológico, la población, muestra y las técnicas e instrumentos de recolección de datos."
    if "tipo de investigación" in h:
        return "Especifica el paradigma, nivel (descriptivo, correlacional, explicativo) y diseño (experimental o no experimental) adoptado en el estudio."
    if "población" in h or "muestra" in h:
        return "Define las características de la unidad de análisis, los criterios de inclusión/exclusión y el método de muestreo probabilístico o no probabilístico."
    if "instrumento" in h:
        return "Describe las herramientas de medición o recolección de datos empleadas, detallando sus propiedades de validez y confiabilidad."
    if "resultado" in h:
        return "Presenta de manera objetiva los hallazgos empíricos obtenidos. Incluya tablas y figuras numeradas secuencialmente conforme a las directrices APA 7ma Edición."
    if "discusión" in h:
        return "Interpreta y contrasta los resultados alcanzados con las hipótesis planteadas y los hallazgos de investigaciones previas citadas en el marco teórico."
    if "conclusión" in h or "conclusiones" in h:
        return "Sintetiza las principales conclusiones derivadas del estudio, responde a los objetivos planteados y propone recomendaciones para futuras líneas de investigación."
    if "referencia" in h:
        return "Lista alfabética de todas las fuentes citadas en el texto, con sangría francesa de 1.27 cm (0.5 in) e interlineado doble según Normas APA 7."
    if "resumen" in h:
        return "Párrafo único sin sangría de entre 150 y 250 palabras que sintetiza el objetivo, metodología, resultados principales y conclusiones del trabajo."
    return f"Desarrollo académico correspondiente a la sección de {heading_text}, estructurado con interlineado doble, sangría de primera línea de 1.27 cm y tipografía uniforme APA 7."


@router.post("/api/create-from-template")
async def create_from_template_endpoint(req: CreateFromTemplateRequest) -> DocumentModel:
    """
    Crea una NUEVA sesión de trabajo a partir de una plantilla de estructura:
    genera el DocumentModel con los títulos de la plantilla y párrafos guía,
    lo persiste como sesión y lo devuelve con el mismo shape que /api/upload.
    """
    from routers.sessions import _TEMPLATE_ID_MAP

    profile = get_profile(req.profile_id)
    template = _TEMPLATE_ID_MAP.get(req.template_id)
    if template is None:
        raise HTTPException(
            status_code=400,
            detail=f"Plantilla desconocida: {req.template_id}.",
        )

    elements: list[ElementModel] = []

    def _add_sections(sections) -> None:
        for section in sections:
            # 1. Título estructurado
            elements.append(
                ElementModel(
                    id=f"tpl-{req.template_id}-{len(elements)}",
                    type=ElementType.HEADING,
                    heading_level=section.heading_level,
                    text=section.suggested_text,
                    original_text=section.suggested_text,
                    confidence=1.0,
                    is_cover_section=False,
                    needs_review=False,
                )
            )
            # 2. Párrafo guía explicativo de la sección
            guide_text = _get_section_guide_text(section.suggested_text)
            elements.append(
                ElementModel(
                    id=f"tpl-{req.template_id}-{len(elements)}",
                    type=ElementType.PARAGRAPH,
                    text=guide_text,
                    original_text=guide_text,
                    confidence=1.0,
                    is_cover_section=False,
                    needs_review=False,
                )
            )
            _add_sections(section.sub_sections)

    _add_sections(template.sections)

    fmt = profile.cover_apa_format
    apa_format = APAFormat.PROFESSIONAL if fmt == "professional" else APAFormat.STUDENT

    sample_refs = [
        ReferenciaModel(
            id="ref-tpl-1",
            raw_text="Hernández-Sampieri, R., & Mendoza, C. P. (2018). Metodología de la investigación: Las rutas cuantitativa, cualitativa y mixta. McGraw-Hill Education.",
            authors=["Hernández-Sampieri, R.", "Mendoza, C. P."],
            year="2018",
            title="Metodología de la investigación: Las rutas cuantitativa, cualitativa y mixta",
            source="McGraw-Hill Education",
        ),
        ReferenciaModel(
            id="ref-tpl-2",
            raw_text="American Psychological Association. (2020). Publication manual of the American Psychological Association (7th ed.). https://doi.org/10.1037/0000165-000",
            authors=["American Psychological Association"],
            year="2020",
            title="Publication manual of the American Psychological Association",
            source="American Psychological Association",
            doi_or_url="10.1037/0000165-000",
        ),
    ]

    doc = DocumentModel(
        session_id=f"sess-{uuid.uuid4().hex[:12]}",
        file_name=f"{template.name.split('(')[0].strip()}.docx",
        apa_format=apa_format,
        profile_id=profile.profile_id,
        elements=elements,
        referencias=sample_refs,
        apa_rules=profile.rules.model_copy(deep=True),
    )

    save_session_state(doc, STORAGE_DIR)
    return doc


@router.post("/api/apply-template")
async def apply_template_endpoint(req: ApplyTemplateRequest) -> dict:
    """
    Aplica una plantilla de estructura al documento:
    - Inserta secciones faltantes según la plantilla elegida
    - Reordena headings existentes
    - Retorna el resumen de cambios realizados
    """
    from generation.templates import TemplateSection, get_template

    doc: Optional[DocumentModel] = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesion no encontrada.")

    template = get_template(req.template_name)
    if not template:
        raise HTTPException(status_code=404, detail=f"Plantilla '{req.template_name}' no encontrada.")

    # Analizar qué headings ya existen en el documento
    existing_headings: dict[str, ElementModel] = {}
    existing_heading_texts_lower: set[str] = set()
    for elem in doc.elements:
        if elem.type == ElementType.HEADING and elem.text and elem.text.strip():
            lower = elem.text.strip().lower()
            existing_headings[lower] = elem
            existing_heading_texts_lower.add(lower)

    changes_made: list[dict] = []
    sections_created: int = 0

    # Función recursiva para procesar secciones de la plantilla
    def _process_section(section: TemplateSection, parent_idx: int = -1) -> None:
        nonlocal sections_created
        text_lower = section.suggested_text.strip().lower()

        if text_lower not in existing_heading_texts_lower:
            # Crear nuevo elemento de heading faltante
            new_elem = ElementModel(
                id=f"template_elem_{len(doc.elements) + sections_created + 1}",
                type=ElementType.HEADING,
                heading_level=section.heading_level,
                text=section.suggested_text,
                original_text=section.suggested_text,
                confidence=1.0,
                is_user_modified=False,
                needs_review=False,
                auto_applied=True,
                pre_classifier_rule="template",
            )
            # Insertar al final de los elementos (antes de referencias si existen)
            insert_idx = len(doc.elements)
            for ei, existing in enumerate(doc.elements):
                if existing.type == ElementType.HEADING and existing.text:
                    et_lower = existing.text.strip().lower()
                    if any(kw in et_lower for kw in ["referencia", "bibliograf"]):
                        insert_idx = ei
                        break
            doc.elements.insert(insert_idx, new_elem)
            existing_heading_texts_lower.add(text_lower)
            sections_created += 1
            changes_made.append({
                "action": "created",
                "text": section.suggested_text,
                "level": section.heading_level,
            })
        else:
            # Ya existe: marcar como modificado por plantilla
            existing = existing_headings.get(text_lower)
            if existing:
                changes_made.append({
                    "action": "preserved",
                    "text": section.suggested_text,
                    "level": existing.heading_level,
                })

        # Procesar sub-secciones
        for sub in section.sub_sections:
            _process_section(sub)

    for section in template.sections:
        _process_section(section)

    save_session_state(doc, STORAGE_DIR)

    return {
        "status": "ok",
        "session_id": req.session_id,
        "template_applied": req.template_name,
        "sections_created": sections_created,
        "changes_made": changes_made,
    }


# ── COVER DESIGNER ENDPOINTS ─────────────────────────────────────────────────


@router.get("/api/cover-templates")
async def list_cover_templates_endpoint() -> dict:
    """
    Lista todas las plantillas de portada disponibles (integradas + del usuario).
    """
    from modules.cover_designer import list_cover_templates
    templates = list_cover_templates(STORAGE_DIR)
    return {
        "templates": [
            {
                "name": t.name,
                "description": t.description,
                "source_type": t.source_type,
                "source_path": t.source_path if not t.is_builtin else "",
                "preview_path": t.preview_path if not t.is_builtin else "",
                "is_builtin": t.is_builtin,
                "created_at": t.created_at,
            }
            for t in templates
        ]
    }


class UploadCoverImageRequest(BaseModel):
    name: str
    description: str = ""


@router.post("/api/cover-templates/upload-image")
async def upload_cover_image_endpoint(
    file: UploadFile = File(...),
    name: str = Form("Mi Portada"),
    description: str = Form(""),
) -> dict:
    """
    Sube una imagen como portada y la guarda como plantilla reutilizable.
    """
    from modules.cover_designer import create_cover_from_image

    if not file.filename:
        raise HTTPException(status_code=400, detail="Archivo no valido.")

    # Guardar imagen temporalmente
    temp_dir = STORAGE_DIR / "temp_covers"
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_path = temp_dir / file.filename
    content = await file.read()

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="El archivo esta vacio.")

    temp_path.write_bytes(content)

    try:
        template = create_cover_from_image(
            temp_path, name, description, STORAGE_DIR
        )
        return {
            "status": "ok",
            "template": {
                "name": template.name,
                "description": template.description,
                "source_type": template.source_type,
                "source_path": template.source_path,
                "preview_path": template.preview_path,
                "is_builtin": template.is_builtin,
            },
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creando plantilla de portada: {str(e)}",
        )
    finally:
        # Limpiar archivo temporal
        if temp_path.exists():
            temp_path.unlink()


@router.post("/api/cover-templates/upload-docx")
async def upload_cover_docx_endpoint(
    file: UploadFile = File(...),
    name: str = Form("Mi Portada Word"),
    description: str = Form(""),
) -> dict:
    """
    Sube un documento Word como portada y lo guarda como plantilla reutilizable.
    """
    from modules.cover_designer import create_cover_from_docx

    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=400,
            detail="Solo se admiten archivos .docx.",
        )

    temp_dir = STORAGE_DIR / "temp_covers"
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_path = temp_dir / file.filename
    content = await file.read()

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="El archivo esta vacio.")

    temp_path.write_bytes(content)

    try:
        template = create_cover_from_docx(
            temp_path, name, description, STORAGE_DIR
        )
        return {
            "status": "ok",
            "template": {
                "name": template.name,
                "description": template.description,
                "source_type": template.source_type,
                "source_path": template.source_path,
                "preview_path": template.preview_path,
                "is_builtin": template.is_builtin,
            },
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creando plantilla de portada: {str(e)}",
        )
    finally:
        if temp_path.exists():
            temp_path.unlink()


@router.delete("/api/cover-templates/{name:path}")
async def delete_cover_template_endpoint(name: str) -> dict:
    """
    Elimina una plantilla de portada creada por el usuario.
    Las plantillas integradas no se pueden eliminar.
    """
    from modules.cover_designer import delete_cover_template

    success = delete_cover_template(name, STORAGE_DIR)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Plantilla no encontrada o no se pudo eliminar. Las plantillas integradas no se pueden eliminar.",
        )
    return {"status": "ok", "message": f"Plantilla '{name}' eliminada correctamente."}


class ApplyCoverRequest(BaseModel):
    session_id: str
    cover_template_name: str
    title: str = ""
    author: str = ""
    institution: str = ""
    course: str = ""
    instructor: str = ""
    date: str = ""


@router.post("/api/apply-cover")
async def apply_cover_endpoint(req: ApplyCoverRequest) -> dict:
    """
    Aplica una plantilla de portada al documento generado.
    La portada se antepone al inicio del documento sin ser modificada por APA 7.
    """
    from modules.cover_designer import CoverTemplate, list_cover_templates

    doc: Optional[DocumentModel] = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404, detail="Sesion no encontrada.")

    # Snapshot antes de modificar portada
    from persistence.session_manager import save_session_snapshot
    save_session_snapshot(doc, STORAGE_DIR)

    # Buscar la plantilla por nombre
    templates = list_cover_templates(STORAGE_DIR)
    template: Optional[CoverTemplate] = None
    for t in templates:
        if t.name == req.cover_template_name:
            template = t
            break

    if not template:
        raise HTTPException(
            status_code=404,
            detail=f"Plantilla '{req.cover_template_name}' no encontrada.",
        )

    # Guardar la seleccion de portada en la sesion para que generator.py la use
    doc.portada = doc.portada or {}
    if isinstance(doc.portada, dict):
        doc.portada["cover_template_id"] = req.cover_template_name
        doc.portada["use_original_cover"] = False
        doc.portada["force_skip_cover"] = True
    save_session_state(doc, STORAGE_DIR)

    # Reload to return updated doc state
    updated_doc = load_session_state(req.session_id, STORAGE_DIR)

    response: dict = {
        "status": "ok",
        "message": f"Portada '{req.cover_template_name}' aplicada correctamente.",
        "cover_template_name": req.cover_template_name,
    }

    if updated_doc:
        response["document"] = updated_doc.model_dump()

    return response


class ServeCoverPreviewRequest(BaseModel):
    name: str


@router.get("/api/cover-templates/preview/{name:path}")
async def serve_cover_preview(name: str) -> FileResponse:
    """
    Sirve la imagen de preview de una plantilla de portada.
    """
    from modules.cover_designer import list_cover_templates

    templates = list_cover_templates(STORAGE_DIR)
    for t in templates:
        if t.name == name and t.preview_path:
            preview_file = Path(t.preview_path)
            if preview_file.exists():
                return FileResponse(preview_file, media_type="image/png")

    # Fallback: retornar placeholder
    raise HTTPException(status_code=404, detail="Preview no disponible para esta plantilla.")

/* WordAPA7 — Backend API Client */

import {
  DocumentModel,
  ElementType,
  APARuleSet,
  PortadaData,
  ReferenciaModel,
  ValidationIssue,
  WizardAnswers,
  SessionRecovery,
  IdempotencyResult,
  GenerateResponse,
  PreviewResponse,
  LLMProgressState,
  ImageModel,
} from '../types';
import { useDocStore } from '../store/useDocStore';

const getApiBase = () => {
  if (!(window as any).electronAPI) return '/api';
  const port = (window as any).electronAPI.getBackendPort();
  return `http://127.0.0.1:${port}/api`;
};

/** Wrapper that extracts X-Request-ID into the store for debug tracing. */
async function fetchWithTrace(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  const rid = res.headers.get('X-Request-ID');
  if (rid) useDocStore.getState().setLastRequestId(rid);
  return res;
}

export async function uploadDocxFile(file: File): Promise<DocumentModel> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetchWithTrace(`${getApiBase()}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al subir el archivo');
  }

  return res.json();
}

export async function startBlankDocument(): Promise<DocumentModel> {
  const res = await fetchWithTrace(`${getApiBase()}/start-blank`, {
    method: 'POST'
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al iniciar documento en blanco');
  }

  return res.json();
}

export async function uploadDocxWithWizard(
  file: File,
  wizard: WizardAnswers
): Promise<DocumentModel> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('apa_format', wizard.apa_format);
  formData.append('work_mode', wizard.work_mode);
  formData.append('cover_page', wizard.cover_page);

  const res = await fetchWithTrace(`${getApiBase()}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al subir el archivo');
  }

  return res.json();
}

export async function bulkAcceptElements(
  sessionId: string,
  elementIds: string[]
): Promise<DocumentModel> {
  const res = await fetchWithTrace(`${getApiBase()}/bulk-accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, element_ids: elementIds }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al aprobar elementos');
  }

  return res.json();
}

export async function classifyWithLLM(
  sessionId: string,
  apiKey?: string,
  aiProviderConfig?: { nimUrl: string; useLocal: boolean; providerId: string }
): Promise<DocumentModel> {
  const formData = new FormData();
  if (apiKey) formData.append('api_key', apiKey);
  if (aiProviderConfig) {
    formData.append('nim_url', aiProviderConfig.nimUrl);
    formData.append('use_local', aiProviderConfig.useLocal ? 'true' : 'false');
    formData.append('provider_id', aiProviderConfig.providerId);
  }

  const res = await fetchWithTrace(`${getApiBase()}/classify/${sessionId}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Error al clasificar con LLM');
  }

  return res.json();
}

export async function updateElement(
  sessionId: string,
  elementId: string,
  type: ElementType,
  headingLevel?: number,
  text?: string
): Promise<DocumentModel> {
  const res = await fetchWithTrace(`${getApiBase()}/update-element`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      element_id: elementId,
      type,
      heading_level: headingLevel ?? 1,
      text,
    }),
  });

  if (!res.ok) throw new Error('Error al actualizar el elemento');
  return res.json();
}

export async function updateElementImage(
  sessionId: string,
  elementId: string,
  imageInfo: Partial<ImageModel>
): Promise<DocumentModel> {
  const res = await fetchWithTrace(`${getApiBase()}/update-element`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      element_id: elementId,
      type: 'image' as ElementType,
      heading_level: 1,
      image_info: imageInfo,
    }),
  });

  if (!res.ok) throw new Error('Error al actualizar imagen');
  return res.json();
}

export async function reorderElements(
  sessionId: string,
  elementIds: string[]
): Promise<DocumentModel> {
  const res = await fetchWithTrace(`${getApiBase()}/reorder-elements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      element_ids: elementIds,
    }),
  });

  if (!res.ok) throw new Error('Error al reordenar los elementos');
  return res.json();
}

export async function validateDocument(
  sessionId: string,
  references: ReferenciaModel[]
): Promise<ValidationIssue[]> {
  const res = await fetchWithTrace(`${getApiBase()}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      references,
    }),
  });

  if (!res.ok) throw new Error('Error al validar el documento');
  const data = await res.json();
  return data.issues;
}

export async function validateCitations(
  sessionId: string
): Promise<{ ghost_citations: any[]; orphan_references: any[] }> {
  const res = await fetchWithTrace(`${getApiBase()}/validate-citations/${sessionId}`, {
    method: 'POST',
  });

  if (!res.ok) throw new Error('Error al validar citas');
  return res.json();
}

export async function generateDocx(
  sessionId: string,
  rules: APARuleSet,
  portada: PortadaData,
  references: ReferenciaModel[]
): Promise<GenerateResponse> {
  const res = await fetchWithTrace(`${getApiBase()}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      rules,
      portada,
      references,
    }),
  });

  if (!res.ok) throw new Error('Error al generar el archivo .docx');
  return res.json();
}

export async function generatePreview(
  sessionId: string,
  rules: APARuleSet,
  portada: PortadaData,
  references: ReferenciaModel[]
): Promise<PreviewResponse> {
  const res = await fetchWithTrace(`${getApiBase()}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      rules,
      portada,
      references,
    }),
  });

  if (!res.ok) throw new Error('Error al generar vista previa');
  return res.json();
}

export async function generatePdf(
  sessionId: string,
  rules: APARuleSet,
  portada: PortadaData,
  references: ReferenciaModel[]
): Promise<any> {
  const res = await fetchWithTrace(`${getApiBase()}/generate-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      rules,
      portada,
      references,
    }),
  });

  if (!res.ok) throw new Error('Error al generar PDF');
  return res.json();
}

export async function generatePreviewPdf(
  sessionId: string,
  rules: APARuleSet,
  portada: PortadaData,
  references: ReferenciaModel[]
): Promise<any> {
  const res = await fetchWithTrace(`${getApiBase()}/preview-pages/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      rules,
      portada,
      references
    }),
  });
  const data = await res.json();
  if (data.status === 'pdf') {
     return {
         status: 'ok',
         download_url: data.pdf_url
     };
  }
  return data;
}

export async function checkIdempotency(
  file: File
): Promise<IdempotencyResult> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetchWithTrace(`${getApiBase()}/check-idempotency`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al verificar idempotencia');
  }

  return res.json();
}

export async function suggestCaption(
  sessionId: string,
  elementId: string,
  contextText: string,
  apiKey?: string
): Promise<string> {
  const res = await fetchWithTrace(`${getApiBase()}/ai/suggest-caption`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      element_id: elementId,
      context_text: contextText,
      api_key: apiKey
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al sugerir leyenda');
  }
  const data = await res.json();
  return data.suggestion;
}

export async function rewriteText(
  sessionId: string,
  elementId: string,
  text: string,
  instruction: string,
  apiKey?: string
): Promise<string> {
  const res = await fetchWithTrace(`${getApiBase()}/ai/rewrite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      element_id: elementId,
      text: text,
      instruction: instruction,
      api_key: apiKey
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al reescribir texto');
  }
  const data = await res.json();
  return data.rewritten;
}

export async function listSessions(): Promise<SessionRecovery[]> {
  const res = await fetchWithTrace(`${getApiBase()}/sessions`);

  if (!res.ok) {
    throw new Error('Error al listar sesiones');
  }

  const data = await res.json();
  return data.sessions;
}

export async function recoverSession(sessionId: string): Promise<DocumentModel> {
  const res = await fetchWithTrace(`${getApiBase()}/session/${sessionId}`);

  if (!res.ok) {
    throw new Error('Error al recuperar sesión');
  }

  return res.json();
}

export async function resolveDoi(doi: string): Promise<string | null> {
  const res = await fetchWithTrace(`${getApiBase()}/resolve-doi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doi }),
  });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  return data.formatted || null;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetchWithTrace(`${getApiBase()}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetchWithTrace(`${getApiBase()}/session/${sessionId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error('Error al eliminar sesión');
  }
}

export async function getClassifyProgress(sessionId: string): Promise<LLMProgressState> {
  const res = await fetchWithTrace(`${getApiBase()}/classify/progress/${sessionId}`);
  if (!res.ok) throw new Error('Error al obtener progreso de clasificación');
  return res.json();
}

export async function validateCitationsWithAI(
  sessionId: string,
  references: ReferenciaModel[],
  apiKey?: string,
  aiProviderConfig?: { nimUrl: string; useLocal: boolean; providerId: string }
): Promise<ValidationIssue[]> {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('references', JSON.stringify(references));
  if (apiKey) formData.append('api_key', apiKey);
  if (aiProviderConfig) {
    formData.append('nim_url', aiProviderConfig.nimUrl);
    formData.append('use_local', aiProviderConfig.useLocal ? 'true' : 'false');
    formData.append('provider_id', aiProviderConfig.providerId);
  }

  const res = await fetchWithTrace(`${getApiBase()}/validate/ai`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) throw new Error('Error al validar citas con IA');
  const data = await res.json();
  return data.issues;
}

// ── TEMPLATES API ───────────────────────────────────────────────────────────

export interface TemplateInfo {
  name: string;
  description: string;
  has_cover_page: boolean;
  has_toc: boolean;
  has_references: boolean;
  section_count: number;
}

export async function fetchTemplates(): Promise<TemplateInfo[]> {
  const res = await fetchWithTrace(`${getApiBase()}/templates`);
  if (!res.ok) throw new Error('Error al obtener plantillas');
  const data = await res.json();
  return data.templates || [];
}

export async function applyTemplate(
  sessionId: string,
  templateName: string,
  numberingStyle: string = 'decimal'
): Promise<any> {
  const res = await fetchWithTrace(`${getApiBase()}/apply-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      template_name: templateName,
      numbering_style: numberingStyle,
    }),
  });
  if (!res.ok) throw new Error('Error al aplicar plantilla');
  return res.json();
}

// ── VERSION CHECK ────────────────────────────────────────────────────────────

export interface VersionInfo {
  version: string;
  build_hash: string;
  build_time: string | null;
  stale: boolean;
}

export async function fetchVersion(): Promise<VersionInfo> {
  const res = await fetchWithTrace(`${getApiBase()}/version`, {
    method: 'GET',
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error('Error al obtener versión');
  return res.json();
}

// ── COVER DESIGNER API ──────────────────────────────────────────────────────

export interface CoverTemplateInfo {
  name: string;
  description: string;
  source_type: 'image' | 'docx' | 'builtin';
  source_path: string;
  preview_path: string;
  is_builtin: boolean;
  created_at: string;
}

export interface ApplyCoverRequest {
  session_id: string;
  cover_template_name: string;
  title: string;
  author: string;
  institution: string;
  course: string;
  instructor: string;
  date: string;
}

export async function fetchCoverTemplates(): Promise<CoverTemplateInfo[]> {
  const res = await fetchWithTrace(`${getApiBase()}/cover-templates`);
  if (!res.ok) throw new Error('Error al obtener plantillas de portada');
  const data = await res.json();
  return data.templates || [];
}

export async function uploadCoverImage(
  file: File,
  name: string,
  description: string = ''
): Promise<{ template: CoverTemplateInfo }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  formData.append('description', description);

  const res = await fetchWithTrace(`${getApiBase()}/cover-templates/upload-image`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al subir imagen de portada');
  }
  return res.json();
}

export async function uploadCoverDocx(
  file: File,
  name: string,
  description: string = ''
): Promise<{ template: CoverTemplateInfo }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  formData.append('description', description);

  const res = await fetchWithTrace(`${getApiBase()}/cover-templates/upload-docx`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al subir documento de portada');
  }
  return res.json();
}

export async function deleteCoverTemplate(name: string): Promise<void> {
  const res = await fetchWithTrace(`${getApiBase()}/cover-templates/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al eliminar plantilla');
  }
}

export async function applyCover(req: ApplyCoverRequest): Promise<{ status: string; message: string; cover_template_name: string; document?: any }> {
  const res = await fetchWithTrace(`${getApiBase()}/apply-cover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: req.session_id,
      cover_template_name: req.cover_template_name,
      title: req.title,
      author: req.author,
      institution: req.institution,
      course: req.course,
      instructor: req.instructor,
      date: req.date,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al aplicar portada');
  }
  return res.json();
}

export function getCoverPreviewUrl(name: string): string {
  return `${getApiBase()}/cover-templates/preview/${encodeURIComponent(name)}`;
}

/* WordAPA7 — Backend API Client */

import {
  DocumentModel,
  ElementType,
  APARuleSet,
  PortadaData,
  ReferenciaModel,
  ValidationIssue,
  SessionRecovery,
  PreviewResponse,
  LLMProgressState,
  ImageModel,
} from '../types';
import { getApiBase, fetchWithTrace } from './http';

export { getApiBase, resolveAssetUrl } from './http';

export async function uploadDocxFile(
  file: File,
  opts?: { profileId?: string; mode?: 'quick' | 'review' }
): Promise<DocumentModel> {
  const formData = new FormData();
  formData.append('file', file);
  if (opts?.profileId) formData.append('profile_id', opts.profileId);
  if (opts?.mode) formData.append('work_mode', opts.mode);

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

export async function listProfiles(): Promise<{
  profiles: import('../types').FormatProfile[];
}> {
  const res = await fetchWithTrace(`${getApiBase()}/profiles`, { method: 'GET' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al listar perfiles');
  }
  return res.json();
}

export async function setSessionProfile(
  sessionId: string,
  profileId: string
): Promise<DocumentModel> {
  const res = await fetchWithTrace(`${getApiBase()}/profile/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile_id: profileId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al aplicar perfil');
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

export function downloadTemplate(
  profileId: string,
  templateId: string
): void {
  // Descarga directa vía navegación: el backend responde FileResponse (attachment)
  window.location.href = `${getApiBase()}/template-docx?profile_id=${encodeURIComponent(profileId)}&template_id=${encodeURIComponent(templateId)}`;
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
  text?: string,
  equation?: Record<string, any>
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
      ...(equation ? { equation } : {}),
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

export async function replaceImageFile(
  sessionId: string,
  elementId: string,
  file: File
): Promise<DocumentModel> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetchWithTrace(`${getApiBase()}/replace-image/${sessionId}/${elementId}`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || 'Error al reemplazar la imagen');
  }
  return res.json();
}

export interface SpellingFinding {
  word: string;
  suggestions: string[];
  ai_is_error?: boolean;
}

const PROVIDER_KEY_ENV_MAP: Record<string, string> = {
  'NVIDIA_API_KEY': 'NVIDIA_API_KEY',
  'GROQ_API_KEY': 'GROQ_API_KEY',
  'OPENROUTER_API_KEY': 'OPENROUTER_API_KEY',
  'CEREBRAS_API_KEY': 'CEREBRAS_API_KEY',
  'MISTRAL_API_KEY': 'MISTRAL_API_KEY',
  'OPENCODEZEN_API_KEY': 'OPENCODEZEN_API_KEY',
  'ZENMUX_API_KEY': 'ZENMUX_API_KEY',
  'GEMINI_API_KEY': 'GEMINI_API_KEY',
  'CLOUDFLARE_API_TOKEN': 'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID': 'CLOUDFLARE_ACCOUNT_ID',
};

/** Sincroniza las claves guardadas en localStorage con el backend (os.environ). */
export async function syncAllProviderKeys(): Promise<{ ok: boolean; applied: string[]; error?: string }> {
  const keys: Record<string, string> = {};
  try {
    for (const envVar of Object.keys(PROVIDER_KEY_ENV_MAP)) {
      const stored = localStorage.getItem(`wordapa7-provider-key:${envVar}`) || '';
      if (stored.trim()) keys[envVar] = stored.trim();
    }
  } catch { /* noop */ }
  if (Object.keys(keys).length === 0) return { ok: true, applied: [] };
  try {
    const res = await fetchWithTrace(`${getApiBase()}/sync-provider-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      return { ok: false, applied: [], error: err?.detail || `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, applied: data?.applied || Object.keys(keys) };
  } catch (e: any) {
    return { ok: false, applied: [], error: e?.message || String(e) };
  }
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

export interface RewriteVariationsResult {
  variations: string[];
  provider: string;
  provider_id: string;
}

export async function rewriteVariations(
  sessionId: string,
  elementId: string,
  text: string,
  instruction: string,
  n = 3,
  apiKey?: string
): Promise<RewriteVariationsResult> {
  const res = await fetchWithTrace(`${getApiBase()}/ai/rewrite-variations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId, element_id: elementId, text,
      instruction, n, api_key: apiKey,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al generar variaciones');
  }
  return res.json();
}

export interface AIProviderConfigShape {
  nimUrl?: string;
  useLocal?: boolean;
  providerId?: string;
}

/** Genera un comentario humorístico estilo WhatsApp con el LLM (opcional). */
export async function generateChatComment(
  sessionId: string,
  elementId: string,
  kind: string,
  elementText: string,
  apiKey?: string,
  aiProviderConfig?: AIProviderConfigShape
): Promise<string> {
  const res = await fetchWithTrace(`${getApiBase()}/ai/chat-comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      element_id: elementId,
      kind,
      element_text: elementText,
      api_key: apiKey,
      nim_url: aiProviderConfig?.nimUrl,
      use_local: aiProviderConfig?.useLocal,
      provider_id: aiProviderConfig?.providerId,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al generar comentario');
  }
  const data = await res.json();
  return data.comment;
}

/** Genera un tip de carga (pantalla de progreso) con el LLM (opcional). */
export async function generateLoadingTip(
  category: 'process' | 'jokes' | 'apa' | 'honest',
  phase: string,
  apiKey?: string,
  aiProviderConfig?: AIProviderConfigShape
): Promise<{ category: string; text: string }> {
  const res = await fetchWithTrace(`${getApiBase()}/ai/loading-tip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category,
      phase,
      api_key: apiKey,
      nim_url: aiProviderConfig?.nimUrl,
      use_local: aiProviderConfig?.useLocal,
      provider_id: aiProviderConfig?.providerId,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al generar tip');
  }
  return res.json();
}

export interface CitationFixResult {
  corrected: string;
  reason: string;
  action: string;
}

export async function citationFix(
  sessionId: string,
  citationText: string,
  referenceId?: string,
  problem?: string,
  apiKey?: string
): Promise<CitationFixResult> {
  const res = await fetchWithTrace(`${getApiBase()}/ai/citation-fix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId, citation_text: citationText,
      reference_id: referenceId, problem: problem, api_key: apiKey,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al sugerir corrección de cita');
  }
  return res.json();
}

export interface ProviderStatus {
  id: string;
  name: string;
  active: boolean;
  capacity: { timeout_s: number; typical_latency_s: number; max_tokens: number } | null;
}
export interface ProviderStatusResult {
  providers: ProviderStatus[];
  total_active: number;
  total_configured: number;
  classification_available: boolean;
}

export async function getProviderStatus(): Promise<ProviderStatusResult> {
  const res = await fetchWithTrace(`${getApiBase()}/provider-status`);
  if (!res.ok) throw new Error('Error al obtener estado de proveedores IA');
  return res.json();
}

export async function exportLatex(sessionId: string): Promise<string> {
  const res = await fetchWithTrace(`${getApiBase()}/export-latex/${sessionId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Error al exportar a LaTeX');
  const data = await res.json();
  return data.latex;
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

export async function saveSessionSnapshot(sessionId: string): Promise<void> {
  const res = await fetchWithTrace(`${getApiBase()}/sessions/${sessionId}/snapshot`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error('Error al guardar el progreso');
  }
}

export interface AIReviewFinding {
  phrase: string;
  detail: string;
  severity: string;
}
export interface AIReviewParagraph {
  element_id: string;
  index: number;
  type: string;
  text: string;
  ai_score: number;
  ai_category: 'LOW' | 'MEDIUM' | 'HIGH';
  findings: AIReviewFinding[];
  spelling: { word: string; suggestions: string[] }[];
}
export interface AIReviewTableSignal {
  element_id: string;
  type: string;
  pattern: string;
  detail: string;
  severity: string;
  count: number;
  phrase: string;
}
export interface AIReviewResult {
  session_id: string;
  total_paragraphs: number;
  ai_avg_score: number;
  flagged_count: number;
  spelling_count: number;
  spelling_status: string;
  paragraphs: AIReviewParagraph[];
  table_signals: AIReviewTableSignal[];
  document_signals: string[];
}

export async function runAIReview(sessionId: string): Promise<AIReviewResult> {
  const res = await fetchWithTrace(`${getApiBase()}/ai-review/${sessionId}`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error('Error al ejecutar el revisor IA');
  }
  return res.json();
}

export async function detectSimilarHeadings(
  sessionId: string,
  elementId: string,
  newType: string,
): Promise<{ similar_ids: string[]; count: number }> {
  const res = await fetch(`${getApiBase()}/detect-similar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, element_id: elementId, new_type: newType }),
  });
  return await res.json();
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

export async function resolveReferencesBatch(
  references: any[],
): Promise<{ resolved?: any[]; results?: any[] }> {
  const res = await fetchWithTrace(`${getApiBase()}/references/resolve-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ references }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || 'Error al resolver referencias en lote');
  }
  return res.json();
}

export async function resolveGhostCitation(
  authors: string[],
  year: string,
): Promise<{ found: boolean; candidates?: { authors: string[]; year: string; title: string; source: string; doi?: string; formatted_apa: string; relevance: string }[]; total_results?: number }> {
  const res = await fetchWithTrace(`${getApiBase()}/resolve-ghost-citation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authors, year }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || 'Error al buscar referencia fantasma');
  }
  return res.json();
}

export async function explainElement(
  elementId: string,
  question: string,
): Promise<{ explanation?: string }> {
  const res = await fetchWithTrace(`${getApiBase()}/ai/explain-element`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: elementId, question }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || 'Error al solicitar explicación IA');
  }
  return res.json();
}

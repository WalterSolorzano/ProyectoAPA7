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
  ResolveDoiResponse,
} from '../types';

const API_BASE = '/api';

export async function uploadDocxFile(file: File): Promise<DocumentModel> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al subir el archivo');
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

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al subir el archivo');
  }

  return res.json();
}

export async function classifyWithLLM(
  sessionId: string,
  apiKey?: string
): Promise<DocumentModel> {
  const formData = new FormData();
  if (apiKey) formData.append('api_key', apiKey);

  const res = await fetch(`${API_BASE}/classify/${sessionId}`, {
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
  const res = await fetch(`${API_BASE}/update-element`, {
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

export async function reorderElements(
  sessionId: string,
  elementIds: string[]
): Promise<DocumentModel> {
  const res = await fetch(`${API_BASE}/reorder-elements`, {
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
  const res = await fetch(`${API_BASE}/validate`, {
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

export async function generateDocx(
  sessionId: string,
  rules: APARuleSet,
  portada: PortadaData,
  references: ReferenciaModel[]
): Promise<GenerateResponse> {
  const res = await fetch(`${API_BASE}/generate`, {
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
  const res = await fetch(`${API_BASE}/preview`, {
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

export async function checkIdempotency(
  file: File
): Promise<IdempotencyResult> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/check-idempotency`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al verificar idempotencia');
  }

  return res.json();
}

export async function listSessions(): Promise<SessionRecovery[]> {
  const res = await fetch(`${API_BASE}/sessions`);

  if (!res.ok) {
    throw new Error('Error al listar sesiones');
  }

  const data = await res.json();
  return data.sessions;
}

export async function recoverSession(sessionId: string): Promise<DocumentModel> {
  const res = await fetch(`${API_BASE}/session/${sessionId}`);

  if (!res.ok) {
    throw new Error('Error al recuperar sesión');
  }

  return res.json();
}

export async function resolveDoi(doi: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/resolve-doi`, {
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
    const res = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/session/${sessionId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error('Error al eliminar sesión');
  }
}

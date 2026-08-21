/**
 * WordAPA7 Add-in — Cliente HTTP del backend de Python
 * =====================================================
 *
 * Se conecta al servidor FastAPI local (127.0.0.1:PUERTO) que corre dentro
 * de la app Electron (empaquetada por el instalador). El Add-in descubre el
 * puerto vía IPC (Electron) o usa el puerto por defecto 8742.
 *
 * El asistente en vivo funciona también SIN backend: la detección de citas y
 * el formato APA se hacen localmente (citationDetector + wordHelper). El
 * backend enriquece: guarda en la base de referencias persistente, construye
 * la bibliografía y resuelve citas fantasma vía Crossref.
 *
 * IMPORTANTE: los endpoints de Python devuelven respuestas PLANA (no anidadas),
 * y los tipos de acá reflejan exactamente esa forma. No hay que desenvolver
 * nada: lo que llega del backend ya coincide con el tipo declarado.
 */

const DEFAULT_PORT = 8742

/** Descubre el puerto del backend. */
function getBackendUrl(): string {
  const electronPort = (window as any)?.electronAPI?.getBackendPort?.()
  if (electronPort && typeof electronPort === 'number') {
    return `http://127.0.0.1:${electronPort}`
  }
  return `http://127.0.0.1:${DEFAULT_PORT}`
}

const BASE_URL = getBackendUrl()

// == TIPOS COMPARTIDOS ========================================================

export interface APAIssue {
  category: string
  severity: 'info' | 'warning' | 'error'
  message: string
  suggestion: string
}

export interface AnalysisResult {
  issues: APAIssue[]
  score: number
  suggestion: string | null
}

export interface CaptionSuggestion {
  label: string
  caption: string
  note: string
}

export interface ValidationResult {
  status: 'ok' | 'warning' | 'error'
  issues: APAIssue[]
  summary: string
}

export interface NextNumberResult {
  next_number: number
  existing_labels: string[]
}

// == Tipos del Asistente en Vivo ==============================================
//
// Estos tipos reflejan EXACTAMENTE la forma plana que devuelve el router
// `python/routers/addin.py`. Si cambiás el backend, actualizá acá también.

export interface ExtractedCitation {
  id: string
  raw_text: string
  authors: string[]
  year: string | null
  page?: string | null
  citation_type: string
  is_new: boolean
  occurrences?: number
}

/** POST /api/addin/extract-citations → { citations, new_count, total_in_store, drafts } */
export interface ExtractCitationsResult {
  citations: ExtractedCitation[]
  new_count: number
  total_in_store: number
  drafts: number
}

export interface ReferenceItem {
  id: string
  key?: string
  authors: string[]
  year: string | null
  title: string
  source: string
  doi_or_url: string | null
  raw_text: string
  formatted_apa: string | null
  is_draft?: boolean
  created_at?: string
}

/** Alias para compatibilidad con componentes que usan ReferenceDTO. */
export type ReferenceDTO = ReferenceItem

/**
 * GET /api/addin/references       → { total, drafts, complete, references }
 * POST /api/addin/build-bibliography → { bibliography_text, total, drafts, complete, references }
 * (bibliography_text solo viene en build-bibliography; en references es opcional).
 */
export interface BibliographyResult {
  bibliography_text?: string
  total: number
  drafts: number
  complete: number
  references: ReferenceItem[]
}

/** POST /api/addin/suggest-cover → { title, author, institution, course, date } */
export interface CoverSuggestion {
  title: string
  author: string
  institution: string
  course: string
  date: string
}

export interface HeadingSuggestion {
  index: number
  text: string
  suggested_level: number
  confidence?: number
  reason: string
}

/** POST /api/addin/detect-headings → { suggestions, total } */
export interface DetectHeadingsResult {
  suggestions: HeadingSuggestion[]
  total: number
}

export interface SaveReferenceInput {
  id?: string
  authors: string[]
  year: string | null
  title: string
  source: string
  doi_or_url: string | null
  raw_text: string
}

// == Tipos de Detección de IA ================================================
//
// Estos tipos reflejan los nuevos endpoints de detección de texto generado por
// IA del router `python/routers/addin.py`. El backend analiza patrones
// (muletillas, estructura, redundancia, etc.) y devuelve un score de riesgo.

/** Hallazgo individual de un patrón de IA detectado. */
export interface AIFinding {
  pattern: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  detail: string
  count: number
  phrase?: string
}

/** Resultado del análisis de IA de un fragmento de texto. */
export interface AIAnalysisResult {
  /** Score de riesgo 0.0 a 1.0 (0 = humano, 1 = IA total) */
  score: number
  category: 'LOW' | 'MEDIUM' | 'HIGH'
  findings: AIFinding[]
}

/** Resultado del análisis de IA de un documento completo (por párrafos). */
export interface AIDocumentResult {
  results: Array<{
    score: number
    category: string
    findings: AIFinding[]
    matches: string[]
  }>
  total_paragraphs: number
  high_risk_count: number
  medium_risk_count: number
  low_risk_count: number
  overall_score: number
  overall_category: string
}

/** Resultado de la reescritura de un texto con IA para humanizarlo. */
export interface AIRewriteResult {
  original: string
  rewritten: string
  provider: string
}

/** Estado de los proveedores de IA disponibles en el backend. */
export interface AIHealthResult {
  providers_active: number
  providers: string[]
  specialties: Record<string, { provider: string; percentage: number; status: string }>
}

// == HTTP HELPERS =============================================================

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Backend ${res.status}: ${err}`)
  }
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`Backend ${res.status}`)
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Backend ${res.status}`)
  return res.json()
}

// == API =======================================================================

export const backend = {
  // -- Endpoints básicos -------------------------------------------------------

  health: () => get<{ status: string; version: string }>(`/api/addin/health`),

  analyzeSelection: (text: string, context?: string) =>
    post<AnalysisResult>(`/api/addin/analyze-selection`, { text, context }),

  suggestCaption: (type: 'figure' | 'table', context_text: string) =>
    post<CaptionSuggestion>(`/api/addin/suggest-caption`, { type, context_text }),

  validateFragment: (text: string, element_type?: string) =>
    post<ValidationResult>(`/api/addin/validate-fragment`, { text, element_type }),

  nextFigureNumber: (document_text: string) =>
    post<NextNumberResult>(`/api/addin/next-figure-number`, { document_text }),

  nextTableNumber: (document_text: string) =>
    post<NextNumberResult>(`/api/addin/next-table-number`, { document_text }),

  // -- Asistente en Vivo ------------------------------------------------------

  /**
   * Detecta citas APA 7 en el documento y las guarda en el store local.
   * El backend espera el campo `text` (no `document_text`).
   */
  extractCitations: (document_text: string) =>
    post<ExtractCitationsResult>(`/api/addin/extract-citations`, { text: document_text }),

  /** Lista las referencias guardadas (store local). */
  references: () => get<BibliographyResult>(`/api/addin/references`),

  /** Alias de references() — usado por algunos componentes. */
  listReferences: () => get<BibliographyResult>(`/api/addin/references`),

  /** Crea o actualiza una referencia. */
  saveReference: (ref: SaveReferenceInput) =>
    post<{ status: string; reference: ReferenceItem }>(`/api/addin/save-reference`, ref),

  /** Elimina una referencia. */
  deleteReference: (id: string) =>
    del<{ status: string }>(`/api/addin/reference/${id}`),

  /** Vacía el store de referencias. */
  clearReferences: () => del<{ status: string }>(`/api/addin/clear-references`),

  /**
   * Construye la bibliografía APA 7 (texto + resumen).
   *
   * Si se pasa `document_text`, el backend re-extrae las citas del texto antes
   * de armar la bibliografía (mantiene el store al día). Si no se pasa,
   * arma la bibliografía con lo que ya hay en el store.
   *
   * Devuelve forma plana: { bibliography_text, total, drafts, complete, references }.
   */
  buildBibliography: (document_text?: string) =>
    post<BibliographyResult>(`/api/addin/build-bibliography`, { document_text: document_text || null }),

  /**
   * Sugiere los campos de portada APA 7 a partir del documento.
   * Devuelve forma plana: { title, author, institution, course, date }.
   */
  suggestCover: (document_text: string) =>
    post<CoverSuggestion>(`/api/addin/suggest-cover`, { document_text }),

  /**
   * Sugiere niveles de heading APA 7 por estructura del texto.
   * Devuelve forma plana: { suggestions, total }.
   */
  detectHeadings: (paragraphs: string[]) =>
    post<DetectHeadingsResult>(`/api/addin/detect-headings`, { paragraphs }),

  // -- Detección de IA --------------------------------------------------------
  //
  // Estos endpoints analizan el texto en busca de patrones típicos de
  // contenido generado por IA (muletillas, estructura repetitiva,
  // transiciones artificiales, etc.) y devuelven un score de riesgo.

  /** POST /api/addin/analyze-ai → analiza un fragmento de texto. */
  analyzeAI: (text: string) =>
    post<AIAnalysisResult>(`/api/addin/analyze-ai`, { text }),

  /** POST /api/addin/analyze-ai-document → analiza un documento por párrafos. */
  analyzeAIDocument: (paragraphs: string[]) =>
    post<AIDocumentResult>(`/api/addin/analyze-ai-document`, { paragraphs }),

  /** POST /api/addin/ai-rewrite → reescribe texto para humanizarlo. */
  aiRewrite: (text: string) =>
    post<AIRewriteResult>(`/api/addin/ai-rewrite`, { text }),

  /** GET /api/addin/ai-health → estado de los proveedores de IA. */
  aiHealth: () =>
    get<AIHealthResult>(`/api/addin/ai-health`),

  /** POST /api/addin/ai-analyze-table → analiza los datos de una tabla. */
  analyzeAITable: (headers: string[], rows: string[][]) =>
    post<AIAnalysisResult>(`/api/addin/ai-analyze-table`, { headers, rows }),
}

/* WordAPA7 — TypeScript Definitions */

export type ElementType =
  | 'heading'
  | 'paragraph'
  | 'bullet'
  | 'numbered_list'
  | 'image'
  | 'table'
  | 'block_quote'
  | 'page_break'
  | 'section_break'
  | 'empty'
  | 'portada_block'
  | 'equation'
  | 'toc'
  | 'caption'
  | 'unknown';

export type APAFormat = 'student' | 'professional';

export type WorkMode = 'quick' | 'review';

export type BulletStyle = 'disc' | 'circle' | 'square' | 'dash';

export type NumberStyle = 'decimal' | 'lowerLetter' | 'upperLetter' | 'lowerRoman' | 'upperRoman' | 'none';

export type CitationType =
  | 'parentetica'
  | 'narrativa'
  | 'multiple'
  | 'secundaria'
  | 'pagina'
  | 'et_al';

export type WizardCoverPage = 'use_existing' | 'import_saved' | 'none';

export type ValidationStatus = 'ok' | 'warning' | 'error';

export interface WizardAnswers {
  apa_format: APAFormat;
  cover_page: WizardCoverPage;
  work_mode: WorkMode;
}

// ── IMAGE / TABLE MODELS ─────────────────────────────────────────────────────

export type DesignStyle = 'standard' | 'sidebar' | 'scientific' | 'corner' | 'full_width' | 'multipanel';

export interface SubfigureItem {
  id: string;
  label: string; // ej. '(a)'
  title: string; // ej. 'Vista general'
  relative_url: string;
  file_path?: string;
  filename?: string;
}

export interface ImageModel {
  element_id: string;
  file_path: string;
  filename: string;
  relative_url: string;
  render_error?: string | null;
  width_cm: number;
  height_cm: number;
  caption: string;
  note?: string;
  figure_number: number;
  // Subfiguras multipanel APA 7 (a, b, c...)
  subfigures?: SubfigureItem[];
  // Nuevos campos configurables para control total de imagen
  width_inches?: number | null;
  height_inches?: number | null;
  alignment: 'left' | 'center' | 'right';
  wrap_style: 'inline' | 'square' | 'tight' | 'top_and_bottom';
  caption_position: 'above' | 'below';
  constrain_proportions: boolean;
  design_style: DesignStyle;
  rotation?: number;
  alt_text?: string;
  // Floating (anchor) attributes
  is_anchor?: boolean;
  anchor_pos_h?: string | null;
  anchor_pos_v?: string | null;
}

export interface TableModel {
  element_id: string;
  headers: string[];
  rows: string[][];
  caption: string;
  note?: string;
  table_number: number;
}

// ── ELEMENT MODEL ─────────────────────────────────────────────────────────────

export interface OriginalMetadata {
  style_name: string;
  alignment?: string;
  bold?: boolean;
  italic?: boolean;
  font_size?: number;
  font_name?: string;
  left_indent?: number;
  first_line_indent?: number;
  num_id?: number;
  ilvl?: number;
  is_empty: boolean;
  section_index: number;
}

export interface AIFinding {
  pattern: string;
  severity: string;
  detail: string;
  count: number;
}

export interface ElementModel {
  id: string;
  type: ElementType;
  heading_level?: number;
  list_level?: number;
  is_cover_section?: boolean;
  text: string;
  original_text?: string;
  style_name: string;
  alignment: string;
  font_name: string;
  font_size: number;
  is_bold: boolean;
  is_italic: boolean;
  is_bullet: boolean;
  left_indent_cm: number;
  confidence: number;
  is_user_modified: boolean;
  image_info?: ImageModel;
  table_info?: TableModel;
  page_number?: number;
  /**
   * Fragmento de párrafo partido entre hojas (applyPageFlow/flowPagination).
   * 0 = primer fragmento; >0 = continuación. undefined = elemento completo.
   */
  split_chunk?: number;

  // Classification
  needs_review: boolean;
  auto_applied: boolean;
  llm_reasoning?: string;
  pre_classifier_rule?: string;

  // Bullet / list
  bullet_source?: string;
  bullet_style?: BulletStyle;
  number_style?: NumberStyle;
  number_start?: number;
  original_char?: string;

  // Citations
  cita_ids: string[];

  // Post-apply state
  applied_style?: string;
  applied_at?: string;

  // AI detection
  ai_score?: number;
  ai_findings?: AIFinding[];
  has_shading_residue?: boolean;
  has_web_shading_residue?: boolean;

  // Math preservation
  has_math?: boolean;
  has_fields?: boolean;

  // Equation presentation config
  equation?: EquationConfig;

  // Extra fields echoed from Python ElementModel
  ai_matches?: string[] | null;
  footnote_ids?: number[];
  hyperlinks?: Array<Record<string, string>>;
  bookmarks?: Array<Record<string, string>>;
}

export interface EquationConfig {
  show_number: boolean;
  number_format: string;   // "(1)" | "[1]" | "1." | "(1.1)" | "Ecuación 1"
  number?: string;
  alignment: string;       // "left" | "center" | "right"
  font_name: string;
  font_size_pt: number;
}

// ── APA RULES ─────────────────────────────────────────────────────────────────

export interface HeadingLevelConfig {
  bold: boolean;
  italic: boolean;
  alignment: 'left' | 'center' | 'right';
  indent_cm: number;
  inline_text: boolean;
}

/** Tamaño de hoja. "carta" es 8.5" x 11" y "a4" es 210 x 297 mm.
 *  Es un valor cerrado y no texto libre: `pageGeometry.ts` (el lienzo) y
 *  `APARuleSet.page_size` (el `.docx`) tienen que decidir lo mismo, y un
 *  `string` cualquiera haría que uno de los dos caiga a su valor por omisión en
 *  silencio. El default es Carta porque es lo que dice `DESIGN.md:75`. */
export type PageSize = 'carta' | 'a4';

export interface APARuleSet {
  profile_name: string;
  is_default?: boolean;

  // Page
  page_size?: PageSize;
  margins_cm: number;

  // Font
  font_family: string;
  font_size_pt: number;

  // Paragraphs
  line_spacing: number;
  paragraph_indent_cm: number;
  alignment: 'left' | 'justify';
  space_before_pt: number;
  space_after_pt: number;

  // Lists (per-level)
  bullet_style_level1: BulletStyle;
  bullet_style_level2: BulletStyle;
  bullet_style_level3: BulletStyle;
  number_style_level1: NumberStyle;
  number_style_level2: NumberStyle;
  number_style_level3: NumberStyle;

  // Headings
  heading_levels: Record<number, HeadingLevelConfig>;
  heading_numbering_style_lvl1: 'decimal' | 'roman' | 'none';
  heading_numbering_style_lvl2: 'decimal' | 'roman' | 'none';
  heading_numbering_style_lvl3: 'decimal' | 'roman' | 'none';

  // References
  reference_hanging_indent_cm: number;
  doi_as_hyperlink: boolean;

  // Figures and tables
  figure_label_prefix: string;
  table_label_prefix: string;
  table_border_style?: 'apa' | 'grid';

  // Visual preview studio (optional, defaults applied in UI)
  image_alignment?: 'left' | 'center' | 'right';
  image_style?: 'plain' | 'journal';
  toc_style?: 'apa' | 'dotted' | 'plain';
}

// ── PERFILES DE FORMATO (config swappable, no código por perfil) ──────────────

export interface FormatProfile {
  profile_id: string;
  display_name: string;
  description: string;
  rules: APARuleSet;
  /** Campos de portada que el Health Check exige completos antes de descargar */
  cover_required_fields: string[];
  latex_documentclass: string;
  latex_options: string;
  /** "student" | "professional" — formato de portada por defecto del perfil */
  cover_apa_format: string;
}

// ── PORTADA ───────────────────────────────────────────────────────────────────

export interface PortadaData {
  apa_format: APAFormat;
  use_original_cover?: boolean;
  force_skip_cover?: boolean;
  cover_template_id?: string;
  cover_mode?: string;
  title: string;
  author: string;
  institution: string;
  course?: string;
  grupo?: string;
  instructor?: string;
  date?: string;
  running_head?: string;
  author_note?: string;
  /** Área de Conocimiento / Departamento (portada UNI) — editable por el usuario. */
  departamento?: string;
  logo_url?: string;
  /** Idioma en que está escrito el documento. Decide el `w:lang` del `.docx`,
   *  que es lo que hace que la revisión de ortografía no subraye un texto en
   *  español con el corrector en inglés. Etiquetas CLDR, cerradas: el backend
   *  las valida. `PortadaData` es donde viven y no `DocumentMeta` por una razón
   *  escrita en `python/models.py`: es el único de los dos que viaja al
   *  generador en cada exportación. */
  language?: PortadaLanguage;
}

/** Etiquetas de idioma que el backend acepta. La lista está escrita acá y en
 *  `PortadaData.language` de `python/models.py`, y son las dos que tienen que
 *  coincidir: si el cliente manda uno que el modelo no declara, la exportación
 *  falla con un error de validación en vez de aplicar el idioma.
 *  `documentoTab.test.tsx` contrasta las dos listas, archivo contra archivo. */
export type PortadaLanguage =
  | 'es-ES' | 'es-MX' | 'es-AR' | 'es-CO' | 'es-PE' | 'es-CL'
  | 'en-US' | 'en-GB'
  | 'pt-BR' | 'fr-FR' | 'de-DE' | 'it-IT';

export const PORTADA_IDIOMAS: { valor: PortadaLanguage; etiqueta: string }[] = [
  { valor: 'es-ES', etiqueta: 'Español (España)' },
  { valor: 'es-MX', etiqueta: 'Español (México)' },
  { valor: 'es-AR', etiqueta: 'Español (Argentina)' },
  { valor: 'es-CO', etiqueta: 'Español (Colombia)' },
  { valor: 'es-PE', etiqueta: 'Español (Perú)' },
  { valor: 'es-CL', etiqueta: 'Español (Chile)' },
  { valor: 'en-US', etiqueta: 'English (United States)' },
  { valor: 'en-GB', etiqueta: 'English (United Kingdom)' },
  { valor: 'pt-BR', etiqueta: 'Português (Brasil)' },
  { valor: 'fr-FR', etiqueta: 'Français (France)' },
  { valor: 'de-DE', etiqueta: 'Deutsch (Deutschland)' },
  { valor: 'it-IT', etiqueta: 'Italiano (Italia)' },
];

export interface PortadaProfile {
  profile_name: string;
  created_at: string;
  data?: PortadaData;
  field_map?: Record<string, any>;
}

// ── REFERENCES ────────────────────────────────────────────────────────────────

export interface ReferenciaModel {
  id: string;
  authors: string[];
  year?: string;
  title: string;
  source: string;
  doi_or_url?: string;
  raw_text: string;
  formatted_apa?: string;
  cited_count?: number;
  never_cited?: boolean;
  /** ¿Alguien la contrastó contra una fuente? Por defecto NO: una bibliografía
   *  que ya venía en el .docx no fue verificada contra nada. Sólo un resolutor
   *  real (DOI contra CrossRef, o una búsqueda que devolvió la obra) lo pone en
   *  `true`; agregarla a mano no la verifica. El panel muestra una etiqueta con
   *  esto, porque sin ella una lista bien formateada y una lista inventada por
   *  el sistema se ven igual. */
  verificada?: boolean;
  /** De dónde salió la verificación: "doi", "cruzada", "isbn". */
  fuente_verificacion?: string;
}

// ── CITATIONS ─────────────────────────────────────────────────────────────────

export interface CitationModel {
  raw_text: string;
  authors: string[];
  year?: string;
  page?: string;
  citation_type: CitationType;
  element_id: string;
  start_offset: number;
  end_offset: number;
}

// ── VALIDATION ────────────────────────────────────────────────────────────────

export interface ValidationIssue {
  rule_id: string;
  severity: ValidationStatus;
  message: string;
  suggestion: string;
}

// Python ValidationItem — shape que llega en el JSON de sesión (doc.apa_validation)
export interface ValidationItem {
  category: string;
  status: ValidationStatus;
  message: string;
  element_id?: string | null;
  auto_fixable?: boolean;
}

export interface APAValidationResult {
  score: number;
  generated_at: string;
  items: (ValidationIssue | ValidationItem)[];
}

// ── DOCUMENT METADATA ─────────────────────────────────────────────────────────

export interface SectionInfo {
  section_index: number;
  orientation: string;
  margins_original: Record<string, number>;
  preserve_margins: boolean;
  columns?: number | null;
  columns_space?: number | null;
}

export interface DocumentMeta {
  source_file: string;
  source_hash: string;
  wordapa7_version: string;
  previously_processed: boolean;
  parsed_at: string;
  autosave_at?: string;
  page_count: number;
  word_count: number;
  has_images: boolean;
  has_tables: boolean;
  has_equations: boolean;
  has_ole_objects: boolean;
  portada_detected: boolean;
  apa_format: APAFormat;
  work_mode: WorkMode;
  content_source: string;
  content_warning?: string;
  sections: SectionInfo[];
  page_count_exact?: boolean;
  paragraph_pages?: number[];
  page_layout_provider?: string;
  page_layout_confidence?: number;
  // Bookmarks / hyperlinks
  has_bookmarks?: boolean;
  has_hyperlinks?: boolean;
  hyperlink_count?: number;
  // Preventive truncation (WORDAPA7_MAX_ELEMENTS)
  elements_truncated?: boolean;
  elements_truncated_at?: number;
  forensic_metadata?: Record<string, any>;
  // Footnotes / endnotes (lista de {id, text, is_endnote})
  footnotes?: Array<Record<string, any>>;
  // Word comments (lista de {id, author, text})
  comments?: Array<Record<string, any>>;
  comment_count?: number;
  // Track changes / multicolumn / smartart / charts
  has_track_changes?: boolean;
  has_multicolumn?: boolean;
  has_smartart?: boolean;
  has_charts?: boolean;
}

// ── DOCUMENT MODEL (root) ─────────────────────────────────────────────────────

export interface DocumentPortada {
  detected: boolean;
  element_ids: string[];
  fields: Record<string, string>;
  profile_name?: string;
  textbox_texts?: string[];
  body_start_paragraph_idx?: number;
  body_start_source?: string;
}

export interface DocumentModel {
  session_id: string;
  file_name: string;
  apa_format: APAFormat;
  profile_id?: string;
  elements: ElementModel[];
  has_landscape_sections: boolean;
  meta: DocumentMeta;
  apa_rules: APARuleSet;
  portada: DocumentPortada;
  referencias: ReferenciaModel[];
  citas_intext: CitationModel[];
  apa_validation?: APAValidationResult;
  schema_version?: number;
}

// ── SESSIONS ──────────────────────────────────────────────────────────────────

export interface SessionInfo {
  session_id: string;
  file_name: string;
  element_count: number;
  pending_count: number;
  apa_format: APAFormat;
  parsed_at: string;
  autosave_at?: string;
  last_saved: string;
  validation_score?: number;
}

export interface SessionRecovery {
  session: SessionInfo;
  available: boolean;
}

// ── IDEMPOTENCY ───────────────────────────────────────────────────────────────

export interface IdempotencyResult {
  already_processed: boolean;
  source_hash: string;
  previous_session_id?: string;
  processed_at?: string;
  apa_score?: number;
  has_marker: boolean;
  recommendation: string;
  message: string;
}

// ── API REQUEST / RESPONSE TYPES ──────────────────────────────────────────────

export interface GenerateResponse {
  download_url: string;
  filename: string;
}

export interface PreviewResponse {
  status?: string;
  session_id?: string;
  download_url?: string;
  output_file?: string;
  saved_path?: string;
  html?: string;
}


export interface ProofreadFinding {
  element_id: string;
  start: number;
  end: number;
  excerpt: string;
  kind: 'first_person' | 'ortografia' | 'ai_phrase' | 'pegado' | 'muletilla' | 'ngram_repetition' | 'bloom_vague' | 'bloom_low' | 'repeticion' | 'persona' | 'incompleta' | 'ambigua' | 'passive_voice' | 'long_sentence' | string;
  severity: 'info' | 'warn' | 'error';
  message: string;
  suggestion?: string;
  source: 'local' | 'llm';
  /**
   * Ámbito de fase (clave de `PHASES` en `python/modules/phase_scope.py`).
   * `'global'` o ausente = regla general, que no pertenece a ninguna fase.
   */
  phase?: string;
  /**
   * true = solo lectura: el hallazgo se informa pero no se puede aplicar.
   * Es el caso de la portada, que `AGENTS.md` §1 protege de escritura.
   */
  read_only?: boolean;
}

export interface LLMProgressState {
  status: 'idle' | 'processing' | 'complete' | 'error';
  total_batches: number;
  completed_batches: number;
  current_provider: string;
  current_provider_id: string;
  elements_processed: number;
  elements_total: number;
  estimated_time_remaining_seconds: number;
  current_sample: string;
  provider_fallbacks: Array<{ from: string; to: string }>;
  last_error: string | null;
}

export interface LLMUsageStats {
  total_tokens: number;
  providers_used: string[];
  estimated_cost_usd: number;
  cache_hits: number;
  api_calls: number;
}

export interface ProviderInfo {
  id: string;
  name: string;
  logo?: string;
  description: string;
  isAvailable: boolean;
  priority: number;
}

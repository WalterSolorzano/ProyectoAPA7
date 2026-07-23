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

export interface ImageModel {
  element_id: string;
  file_path: string;
  filename: string;
  relative_url: string;
  width_cm: number;
  height_cm: number;
  caption: string;
  note?: string;
  figure_number: number;
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

export interface ElementModel {
  id: string;
  type: ElementType;
  heading_level?: number;
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
}

// ── APA RULES ─────────────────────────────────────────────────────────────────

export interface HeadingLevelConfig {
  bold: boolean;
  italic: boolean;
  alignment: 'left' | 'center' | 'right';
  indent_cm: number;
  inline_text: boolean;
}

export interface APARuleSet {
  profile_name: string;
  is_default?: boolean;

  // Page
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

  // References
  reference_hanging_indent_cm: number;
  doi_as_hyperlink: boolean;

  // Figures and tables
  figure_label_prefix: string;
  table_label_prefix: string;
}

// ── PORTADA ───────────────────────────────────────────────────────────────────

export interface PortadaData {
  apa_format: APAFormat;
  use_original_cover?: boolean;
  title: string;
  author: string;
  institution: string;
  course?: string;
  instructor?: string;
  date?: string;
  running_head?: string;
  author_note?: string;
}

export interface PortadaProfile {
  profile_name: string;
  created_at: string;
  data: PortadaData;
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

export interface APAValidationResult {
  score: number;
  generated_at: string;
  items: ValidationIssue[];
}

// ── DOCUMENT METADATA ─────────────────────────────────────────────────────────

export interface SectionInfo {
  section_index: number;
  orientation: string;
  margins_original: Record<string, number>;
  preserve_margins: boolean;
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
}

// ── DOCUMENT MODEL (root) ─────────────────────────────────────────────────────

export interface DocumentPortada {
  detected: boolean;
  element_ids: string[];
  fields: Record<string, string>;
  profile_name?: string;
}

export interface DocumentModel {
  session_id: string;
  file_name: string;
  apa_format: APAFormat;
  elements: ElementModel[];
  has_landscape_sections: boolean;
  meta: DocumentMeta;
  apa_rules: APARuleSet;
  portada: DocumentPortada;
  referencias: ReferenciaModel[];
  citas_intext: CitationModel[];
  apa_validation?: APAValidationResult;
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
  html: string;
}

export interface ResolveDoiResponse {
  doi: string;
  formatted?: string;
  error?: string;
}

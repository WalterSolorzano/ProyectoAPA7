import * as api from '../api/backend';
import { DocumentModel, ElementModel, ElementType, APARuleSet, FormatProfile, PortadaData, PortadaProfile, ReferenciaModel, ValidationIssue, LLMProgressState, ImageModel, ProofreadFinding } from '../types';
import type { AIReviewResult, ProviderStatusResult, RewriteVariationsResult, CitationFixResult, StructureAuditResult, AIIndicesSummary } from '../api/backend';

/** Un evento del feed de actividad del panel derecho unificado (Layer 4). */
export interface ActivityEvent {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  title: string;
  detail?: string;
  time: number;
}

export interface DocState {
  doc: DocumentModel | null;
  apiKey: string;
  /** Consentimiento explícito del usuario para enviar contenido a un LLM en la nube */
  llmCloudConsent: boolean;
  setLlmCloudConsent: (v: boolean) => void;
  /** Si hay una acción LLM pendiente que requiere consentimiento (modal propio) */
  llmConsentPending: boolean;
  setLlmConsentPending: (v: boolean) => void;
  isLoading: boolean;
  /** Timestamp del último export con éxito (para la micro-animación de cierre) */
  exportSuccessAt: number | null;
  isBackendReady: boolean;  // true cuando el motor Python ha confirmado que está listo
  /** Reintenta la conexión al backend (incrementa un nonce que App escucha). */
  retryBackend: () => void;
  backendCheckNonce: number;
  error: string | null;
  selectedElementId: string | null;
  /** Referencia seleccionada en el Editor Unificado (sección Referencias). */
  selectedReferenceId: string | null;
  zoomLevel: number;
  leftSidebarWidth: number;
  setLeftSidebarWidth: (w: number) => void;
  /** Estilo de tabla APA por elemento (solo preview; no afecta la generación del .docx) */
  tableStyles: Record<string, 'standard' | 'compact' | 'expanded'>;
  setTableStyle: (elementId: string, style: 'standard' | 'compact' | 'expanded') => void;
  nimLogs: any[];
  isNIMDiagnosticsOpen: boolean;

  // Toast notifications
  toastMessage: string | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', action?: { label: string; onClick: () => void }) => void;
  toasts: { id: string; message: string; type: 'success' | 'error' | 'info' | 'warning'; action?: { label: string; onClick: () => void } }[];
  removeToast: (id: string) => void;

  // Panel derecho unificado (Layer 4): pestañas Actividad | Inspector
  rightPanelTab: 'activity' | 'inspector';
  setRightPanelTab: (tab: 'activity' | 'inspector') => void;
  /** Cantidad de eventos de actividad aún no vistos (badge en la barra de estado) */
  activityUnseen: number;
  /** Feed de actividad (notificaciones, clasificación, validación, revisiones) */
  activityEvents: ActivityEvent[];
  pushActivityEvent: (kind: ActivityEvent['kind'], title: string, detail?: string) => void;

  // Debug request tracing
  lastRequestId: string | null;
  setLastRequestId: (id: string | null) => void;

  // LLM Progress tracking
  llmProgress: LLMProgressState;
  aiProviderConfig: {
    nimUrl: string;
    useLocal: boolean;
    providerId: string;
  };

  citationAuditResult: {
    ghost_citations: any[];
    orphan_references: any[];
  } | null;

  /** Engine V2 (P2): resultado de la auditoría estructural global via LLM. */
  structureAuditResult: import('../api/backend').StructureAuditResult | null;

  // Template system
  showTemplateDialog: boolean;
  availableTemplates: Array<{
    name: string;
    description: string;
    has_cover_page: boolean;
    has_toc: boolean;
    has_references: boolean;
    section_count: number;
  }>;

  llmUsageStats: {
    total_tokens: number;
    providers_used: string[];
    estimated_cost_usd: number;
    cache_hits: number;
    api_calls: number;
  };

  setIsNIMDiagnosticsOpen: (open: boolean) => void;

  wizardStep: number;
  showFileMenu: boolean;
  settingsStudioOpen: boolean;
  settingsStudioTab: 'format' | 'ai' | 'privacy' | 'about' | 'addin';
  setSettingsStudioOpen: (open: boolean, tab?: 'format' | 'ai' | 'privacy' | 'about' | 'addin') => void;
  isDownloadModalOpen: boolean;
  setDownloadModalOpen: (open: boolean) => void;
  /** True si el modal de descarga se abrió desde Modo Rápido (bloqueadores duros deshabilitan Descargar) */
  pendingQuickExport: boolean;
  clearQuickExport: () => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  hasSeenTour: boolean;
  coverSetupDone: boolean;
  setCoverSetupDone: (done: boolean) => void;
  viewMode: 'edit' | 'result' | 'native-pdf' | 'split' | 'export';
  forceRightPanelOpen: boolean;
  setForceRightPanelOpen: (open: boolean) => void;

  // Mascota IA (rate-limited, máx. 1 línea). Se usa en hitos importantes:
  // abrir el túnel de exportación, validar un paso o terminar una acción IA.
  mascotMessage: { text: string; tone: 'info' | 'success' | 'warning' } | null;
  sayMascot: (text: string, tone?: 'info' | 'success' | 'warning') => void;

  /** Elemento al que PaperCanvas debe hacer scroll SIN abrir el inspector. */
  scrollTargetId: string | null;
  setScrollTargetId: (id: string | null) => void;

  /** Overlay no bloqueante del Validador (drawer) — el canvas nunca se oculta. */
  validatorOpen: boolean;
  setValidatorOpen: (open: boolean) => void;

  /** Abre el Túnel de Exportación (viewMode='export') reemplazando el modal. */
  openExportTunnel: () => void;

  /** Comentarios inline descartados por el usuario (persisten en la sesión). */
  dismissedCommentIds: string[];
  dismissComment: (id: string) => void;
  restoreComment: (id: string) => void;
  imagePanelOpen: boolean;
  setImagePanelOpen: (open: boolean) => void;
  tabs: { session_id: string; file_name: string }[];
  activeTabIndex: number;
  tabDocs: Record<string, DocumentModel>;
  pdfPreviewCache: { hash: string; url: string } | null;

  // Home / multi-doc (Fase E)
  atHome: boolean;
  goHome: () => void;
  openSession: (sessionId: string) => Promise<void>;
  saveSnapshot: () => Promise<void>;

  // Revisor IA + Ortografía (Fase F)
  reviewResult: AIReviewResult | null;
  isReviewOpen: boolean;
  isReviewLoading: boolean;
  setReviewOpen: (open: boolean) => void;
  runAIReview: () => Promise<void>;

  // Revisión de contenido (Bloom + secciones) — separada del formato
  isContentReviewOpen: boolean;
  setContentReviewOpen: (open: boolean) => void;

  // IA Studio unificado + preflight (propuestas 1 y 3)
  aiStudioOpen: boolean;
  setAiStudioOpen: (open: boolean) => void;
  liveChatOpen: boolean;
  setLiveChatOpen: (open: boolean) => void;
  stressTestModalOpen: boolean;
  setStressTestModalOpen: (open: boolean) => void;
  runProactiveAutoCaptioning: () => Promise<void>;
  auditorMode: boolean;
  setAuditorMode: (open: boolean) => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  providerStatus: ProviderStatusResult | null;
  fetchProviderStatus: () => Promise<void>;
  applyRewriteVariation: (elementId: string, text: string, asTracked: boolean) => Promise<void>;
  preflightReport: {
    headings: number;
    figures: number;
    tables: number;
    paragraphs: number;
    flaggedHigh: number;
    flaggedMedium: number;
    reviewed: number;
  } | null;
  setPreflightReport: (r: any) => void;

  // Citas IA consejero (propuesta 6)
  suggestCitationFix: (citationText: string, referenceId: string | undefined, problem: string) => Promise<CitationFixResult | null>;

  // Export LaTeX (funcionalidad x)
  exportLatex: () => Promise<void>;

  // Undo/Redo
  history: DocumentModel[];
  historyIndex: number;

  // Modo Foco & Toasts de Acción
  focusMode: boolean;
  setFocusMode: (f: boolean) => void;
  actionToast: { message: string; timestamp: number } | null;
  triggerActionToast: (message: string) => void;
  clearActionToast: () => void;

  rules: APARuleSet;
  ruleProfiles: APARuleSet[];
  /** Perfiles de formato disponibles (config servido por /api/profiles) */
  profiles: FormatProfile[];
  activeProfileId: string;
  fetchProfiles: () => Promise<void>;
  setActiveProfile: (profileId: string) => Promise<void>;
  portada: PortadaData;
  portadaProfiles: PortadaProfile[];
  references: ReferenciaModel[];
  validationIssues: ValidationIssue[];

  setApiKey: (key: string) => void;
  setAiProviderConfig: (config: Partial<{ nimUrl: string, useLocal: boolean, providerId: string }>) => void;
  setWizardStep: (step: number) => void;
  /** Sub-pestaña del paso 2 (Estructura): Títulos | Cuerpo. Global para que
      acciones del store (p.ej. goToCitation del validador) puedan navegar al cuerpo. */
  structureTab: 'headings' | 'body';
  setStructureTab: (tab: 'headings' | 'body') => void;
  setSelectedElementId: (id: string | null) => void;
  setSelectedReferenceId: (id: string | null) => void;
  setShowTemplateDialog: (show: boolean) => void;
  fetchTemplates: () => Promise<void>;
  applyTemplate: (templateName: string) => Promise<void>;
  renumberHeadings: (style: 'roman' | 'decimal') => void;
  setZoomLevel: (zoom: number) => void;
  setShowFileMenu: (show: boolean) => void;
  setHasSeenTour: (seen: boolean) => void;
  setViewMode: (mode: 'edit' | 'result' | 'native-pdf' | 'split' | 'export') => void;
  setPdfPreviewCache: (cache: { hash: string; url: string } | null) => void;

  switchToTab: (index: number) => void;
  removeTab: (index: number) => void;

  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (val: boolean) => void;

  // Acciones Principales
  sugerenciasProactivas: boolean;
  setSugerenciasProactivas: (v: boolean) => void;
  runProactiveAudits: () => Promise<void>;
  // Marcas de transparencia (H21): etiquetas junto a cada cambio aplicado.
  marcasVisibles: boolean;
  setMarcasVisibles: (v: boolean) => void;
  // Alcances elegidos en el filtro de importación ([] = formato completo).
  sessionScopes: string[];
  setSessionScopes: (s: string[]) => void;
  // Revisor por lotes (F): hallazgos ortografia/IA/texto pegado.
  proofreadFindings: ProofreadFinding[];
  aiIndices: api.AIIndicesSummary | null;
  runProofreadBatch: () => Promise<void>;
  clearProofreadFindings: () => void;
  autoResolveGhosts: () => Promise<void>;
  uploadFile: (file: File, opts?: { profileId?: string; mode?: 'quick' | 'review' }) => Promise<void>;
  startBlankDocument: () => Promise<void>;
  createFromTemplate: (templateId: string) => Promise<void>;
  runLLMClassify: () => Promise<void>;
  updateElementType: (elementId: string, type: ElementType, headingLevel?: number, text?: string) => Promise<void>;
  updateElementText: (elementId: string, text: string) => Promise<void>;
  updateElementImage: (elementId: string, imageInfo: Partial<ImageModel>) => Promise<void>;
  updateElementTable: (elementId: string, tableInfo: Partial<import('../types').TableModel>) => Promise<void>;
  replaceImage: (elementId: string, file: File) => Promise<void>;
  reorderElements: (elementIds: string[]) => Promise<void>;
  acceptHighConfidenceElements: () => Promise<void>;
  approveAllHeadings: () => Promise<void>;
  autoNormalizeHeadings: () => Promise<void>;
  /** "Arreglámelo": aplica el 90% del formato automáticamente (acepta
   *  clasificaciones seguras, valida y audita citas). Solo el usuario decide
   *  lo que de verdad necesita su criterio. */
  runQuickFix: () => Promise<void>;
  insertTocElement: () => void;
  removeTocElement: () => void;
  /** C6: Sugiere leyendas IA para todas las figuras y tablas sin caption. */
  autoCaptionAll: () => Promise<void>;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  pushHistory: (doc: DocumentModel) => void;

  setRules: (rules: Partial<APARuleSet>) => void;
  saveRuleProfile: (name: string) => void;
  resetRulesToDefault: () => void;

  setPortada: (portada: Partial<PortadaData>) => void;
  updateCoverField: (field: keyof PortadaData, value: any) => void;
  savePortadaProfile: (name: string) => void;

  updateReferences: (refs: ReferenciaModel[]) => void;
  addReference: (ref: ReferenciaModel) => void;
  addReferencia: (ref: ReferenciaModel) => void;

  removeReference: (id: string) => void;
  resolveDoiReference: (doi: string) => Promise<void>;
  resolveGhostCitation: (authors: string[], year: string) => Promise<{
    id: string; authors: string[]; year: string; title: string;
    source: string; doi_or_url: string; raw_text: string; formatted_apa: string;
    candidates?: { authors: string[]; year: string; title: string; source: string; doi?: string; formatted_apa: string; relevance: string }[];
  } | null>;

  /** Engine V2 (P2): auditoría estructural global via LLM. */
  runStructureAudit: () => Promise<void>;

  runValidation: () => Promise<void>;
  runCitationAudit: () => Promise<void>;
  exportDocx: (tracked?: boolean) => Promise<void>;
  exportPdf: () => Promise<void>;
}

export type UISlice = Partial<DocState>;
export type CoverSlice = Partial<DocState>;
export type AuditSlice = Partial<DocState>;
export type DocumentSlice = Partial<DocState>;

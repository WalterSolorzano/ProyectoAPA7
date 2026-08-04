/* WordAPA7 — Complete Unified State Management (Zustand) */

import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { DocumentModel, ElementType, APARuleSet, PortadaData, PortadaProfile, ReferenciaModel, ValidationIssue, LLMProgressState, ImageModel } from '../types';
import * as api from '../api/backend';
import type { AIReviewResult, ProviderStatusResult, RewriteVariationsResult, CitationFixResult } from '../api/backend';
import { setRequestIdListener } from '../api/http';

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export function toRoman(num: number): string {
  if (num <= 0) return '';
  const lookup: { [key: string]: number } = {
    M: 1000, CM: 900, D: 500, CD: 400,
    C: 100, XC: 90, L: 50, XL: 40,
    X: 10, IX: 9, V: 5, IV: 4, I: 1
  };
  let roman = '';
  let n = num;
  for (const i in lookup) {
    while (n >= lookup[i]) {
      roman += i;
      n -= lookup[i];
    }
  }
  return roman;
}

export function cleanHeadingPrefix(text: string): string {
  if (!text) return '';
  let clean = text.trim();
  clean = clean.replace(/^\[(ROMAN|DECIMAL)\]\s*/i, '');
  clean = clean.replace(/^(?:[IVXLCDM]+\.|\d+\.)\s*/i, '');
  clean = clean.replace(/^\[(ROMAN|DECIMAL)\]\s*/i, '');
  clean = clean.replace(/^(?:[IVXLCDM]+\.|\d+\.)\s*/i, '');
  clean = clean.replace(/^(?:[IVXLCDM]+\.|\d+\.)\s*/i, '');
  return clean.trim();
}

export function migrateDocument(doc: any): DocumentModel {
  if (!doc) return doc;
  
  // Migration to schema_version 2: Split heading_numbering_style to lvl1, lvl2, lvl3
  if (doc.schema_version !== 2) {
    const defaultNumStyle = doc.apa_rules?.heading_numbering_style ?? 'decimal';
    if (doc.apa_rules) {
      doc.apa_rules.heading_numbering_style_lvl1 = doc.apa_rules.heading_numbering_style_lvl1 ?? defaultNumStyle;
      doc.apa_rules.heading_numbering_style_lvl2 = doc.apa_rules.heading_numbering_style_lvl2 ?? defaultNumStyle;
      doc.apa_rules.heading_numbering_style_lvl3 = doc.apa_rules.heading_numbering_style_lvl3 ?? defaultNumStyle;
      delete doc.apa_rules.heading_numbering_style;
    }
    doc.schema_version = 2;
  }
  
  return doc as DocumentModel;
}

interface DocState {
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
  error: string | null;
  selectedElementId: string | null;
  zoomLevel: number;
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
  setSettingsStudioOpen: (open: boolean) => void;
  isDownloadModalOpen: boolean;
  setDownloadModalOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  hasSeenTour: boolean;
  coverSetupDone: boolean;
  setCoverSetupDone: (done: boolean) => void;
  viewMode: 'edit' | 'result' | 'native-pdf' | 'split';
  forceRightPanelOpen: boolean;
  setForceRightPanelOpen: (open: boolean) => void;
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

  rules: APARuleSet;
  ruleProfiles: APARuleSet[];
  portada: PortadaData;
  portadaProfiles: PortadaProfile[];
  references: ReferenciaModel[];
  validationIssues: ValidationIssue[];

  setApiKey: (key: string) => void;
  setAiProviderConfig: (config: Partial<{ nimUrl: string, useLocal: boolean, providerId: string }>) => void;
  setWizardStep: (step: number) => void;
  setSelectedElementId: (id: string | null) => void;
  setShowTemplateDialog: (show: boolean) => void;
  fetchTemplates: () => Promise<void>;
  applyTemplate: (templateName: string) => Promise<void>;
  renumberHeadings: (style: 'roman' | 'decimal') => void;
  setZoomLevel: (zoom: number) => void;
  setShowFileMenu: (show: boolean) => void;
  setHasSeenTour: (seen: boolean) => void;
  setViewMode: (mode: 'edit' | 'result' | 'native-pdf' | 'split') => void;
  setPdfPreviewCache: (cache: { hash: string; url: string } | null) => void;

  switchToTab: (index: number) => void;
  removeTab: (index: number) => void;

  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (val: boolean) => void;

  // Acciones Principales
  uploadFile: (file: File) => Promise<void>;
  startBlankDocument: () => Promise<void>;
  runLLMClassify: () => Promise<void>;
  updateElementType: (elementId: string, type: ElementType, headingLevel?: number, text?: string) => Promise<void>;
  updateElementImage: (elementId: string, imageInfo: Partial<ImageModel>) => Promise<void>;
  replaceImage: (elementId: string, file: File) => Promise<void>;
  reorderElements: (elementIds: string[]) => Promise<void>;
  acceptHighConfidenceElements: () => Promise<void>;
  insertTocElement: () => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  pushHistory: (doc: DocumentModel) => void;

  setRules: (rules: Partial<APARuleSet>) => void;
  saveRuleProfile: (name: string) => void;
  resetRulesToDefault: () => void;

  setPortada: (portada: Partial<PortadaData>) => void;
  savePortadaProfile: (name: string) => void;

  updateReferences: (refs: ReferenciaModel[]) => void;
  addReference: (ref: ReferenciaModel) => void;
  removeReference: (id: string) => void;
  resolveDoiReference: (doi: string) => Promise<void>;

  runValidation: () => Promise<void>;
  runCitationAudit: () => Promise<void>;
  exportDocx: (tracked?: boolean) => Promise<void>;
  exportPdf: () => Promise<void>;
}

const defaultRules: APARuleSet = {
  profile_name: 'APA 7 Estándar',
  margins_cm: 2.54,
  font_family: 'Times New Roman',
  font_size_pt: 12,
  line_spacing: 2.0,
  paragraph_indent_cm: 1.27,
  alignment: 'left',
  space_before_pt: 0,
  space_after_pt: 0,
  bullet_style_level1: 'disc',
  bullet_style_level2: 'circle',
  bullet_style_level3: 'square',
  number_style_level1: 'decimal',
  number_style_level2: 'lowerLetter',
  number_style_level3: 'lowerRoman',
  heading_levels: {},
  heading_numbering_style_lvl1: 'decimal',
  heading_numbering_style_lvl2: 'decimal',
  heading_numbering_style_lvl3: 'decimal',
  reference_hanging_indent_cm: 1.27,
  doi_as_hyperlink: true,
  figure_label_prefix: 'Figura',
  table_label_prefix: 'Tabla',
  image_alignment: 'center',
  image_style: 'plain',
  toc_style: 'apa',
};

const defaultPortada: PortadaData = {
  apa_format: 'student',
  use_original_cover: true,
  title: '',
  author: '',
  institution: '',
  course: '',
  grupo: '',
  instructor: '',
  date: '',
  running_head: '',
  author_note: '',
};

const defaultLLMProgress: LLMProgressState = {
  status: 'idle',
  total_batches: 0,
  completed_batches: 0,
  current_provider: '',
  current_provider_id: '',
  elements_processed: 0,
  elements_total: 0,
  estimated_time_remaining_seconds: 0,
  provider_fallbacks: [],
  last_error: null,
};

// Helper function to build correct API URL for both Electron and web
// (delegado a backend.ts para no duplicar la lógica del puerto).
const getApiBase = () => api.getApiBase();

export const useDocStore = create<DocState>()(
  persist(
    (set, get) => ({
  doc: null,
  apiKey: (() => {
    try { return localStorage.getItem('wordapa7-provider-key:NVIDIA_API_KEY') || ''; } catch { return ''; }
  })(),
  // Consentimiento explícito para enviar contenido a un LLM en la nube.
  llmCloudConsent: false,
  llmConsentPending: false,
  setLlmConsentPending: (v) => set({ llmConsentPending: v }),
  isLoading: false,
  exportSuccessAt: null,
  isBackendReady: false,
  error: null,
  selectedElementId: null,
  zoomLevel: 100,
  tableStyles: {},
  llmProgress: defaultLLMProgress,
  showTemplateDialog: false,
  availableTemplates: [],
  llmUsageStats: {
    total_tokens: 0,
    providers_used: [],
    estimated_cost_usd: 0,
    cache_hits: 0,
    api_calls: 0,
  },

  toastMessage: null,
  toasts: [],
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  lastRequestId: null,

  aiProviderConfig: {
    nimUrl: 'http://localhost:8000/v1/chat/completions',
    useLocal: false,
    providerId: 'nvidia_nim',
  },
  citationAuditResult: null,

  wizardStep: 2,
  showFileMenu: false,
  settingsStudioOpen: false,
  setSettingsStudioOpen: (open: boolean) => set({ settingsStudioOpen: open }),
  isDownloadModalOpen: false,
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setDownloadModalOpen: (open: boolean) => set({ isDownloadModalOpen: open }),
  hasSeenTour: false,
  coverSetupDone: false,
  viewMode: 'edit',
  forceRightPanelOpen: false,
  setForceRightPanelOpen: (open: boolean) => set({ forceRightPanelOpen: open }),
  imagePanelOpen: false,
  setImagePanelOpen: (open: boolean) => set({ imagePanelOpen: open }),
  tabs: [],
  activeTabIndex: 0,
  tabDocs: {},
  pdfPreviewCache: null,
  nimLogs: [],
  isNIMDiagnosticsOpen: false,

  atHome: false,
  reviewResult: null,
  isReviewOpen: false,
  isReviewLoading: false,
  setReviewOpen: (open) => set({ isReviewOpen: open }),

  isContentReviewOpen: false,
  setContentReviewOpen: (open) => set({ isContentReviewOpen: open }),

  aiStudioOpen: false,
  setAiStudioOpen: (open) => set({ aiStudioOpen: open }),
  auditorMode: false,
  setAuditorMode: (open) => set({ auditorMode: open }),
  theme: 'light',
  setTheme: (t) => {
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem('wordapa7-theme', t);
    } catch { /* noop */ }
    const ew = window as any;
    if (ew.electronAPI?.setTheme) {
      try { ew.electronAPI.setTheme(t); } catch { /* noop */ }
    }
    set({ theme: t });
  },
  providerStatus: null,
  preflightReport: null,
  setPreflightReport: (r) => set({ preflightReport: r }),

  setIsNIMDiagnosticsOpen: (open) => set({ isNIMDiagnosticsOpen: open }),

  history: [],
  historyIndex: -1,

  rules: defaultRules,
  ruleProfiles: [defaultRules],
  portada: defaultPortada,
  portadaProfiles: [{ profile_name: 'Portada Estándar', created_at: new Date().toISOString(), data: defaultPortada }],
  references: [],
  validationIssues: [],

  hasUnsavedChanges: false,
  setHasUnsavedChanges: (val) => set({ hasUnsavedChanges: val }),

  setApiKey: (key) => {
    try { localStorage.setItem('wordapa7-provider-key:NVIDIA_API_KEY', key); } catch { /* noop */ }
    set({ apiKey: key });
  },
  setLlmCloudConsent: (v) => set({ llmCloudConsent: v }),
  setAiProviderConfig: (config) => set((state) => ({ 
    aiProviderConfig: { ...state.aiProviderConfig, ...config } 
  })),
  showToast: (message, type = 'info', action) => {
    const DURATIONS: Record<string, number> = { info: 4000, success: 5000, warning: 6000, error: 8000 };
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    set((state) => ({
      toastMessage: message,
      toasts: [...state.toasts.slice(-2), { id, message, type, action }],
    }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      set((state) => ({ toastMessage: state.toasts.length > 0 ? state.toasts[state.toasts.length - 1].message : null }));
    }, DURATIONS[type]);
  },
  setLastRequestId: (id) => set({ lastRequestId: id }),
  setWizardStep: (step) => set({ wizardStep: step }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setZoomLevel: (zoom) => set({ zoomLevel: Math.min(300, Math.max(50, zoom)) }),
  setTableStyle: (elementId, style) => set((state) => ({ tableStyles: { ...state.tableStyles, [elementId]: style } })),
  setShowFileMenu: (show) => set({ showFileMenu: show }),
  setHasSeenTour: (seen) => set({ hasSeenTour: seen }),
  setCoverSetupDone: (done) => set({ coverSetupDone: done }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setPdfPreviewCache: (cache) => set({ pdfPreviewCache: cache }),

  setShowTemplateDialog: (show) => set({ showTemplateDialog: show }),

  fetchTemplates: async () => {
    try {
      const res = await fetch(`${getApiBase()}/templates`);
      if (res.ok) {
        const data = await res.json();
        set({ availableTemplates: data.templates || [] });
      }
    } catch (err) {
      console.warn('Error fetching templates:', err);
    }
  },

  applyTemplate: async (templateName) => {
    const { doc, pushHistory } = get();
    if (!doc) return;
    set({ isLoading: true });
    try {
      const res = await fetch(`${getApiBase()}/apply-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: doc.session_id,
          template_name: templateName,
          numbering_style: 'decimal',
        }),
      });
      if (!res.ok) throw new Error('Error al aplicar plantilla');
      const result = await res.json();
      // Reload document to get updated elements
      const updatedRes = await fetch(`${getApiBase()}/session/${doc.session_id}`);
      if (updatedRes.ok) {
        const updatedDoc = await updatedRes.json();
        pushHistory(updatedDoc);
        set({ doc: updatedDoc, isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message || 'Error al aplicar plantilla', isLoading: false });
    }
  },

  renumberHeadings: (style) => {
    const { doc, pushHistory } = get();
    if (!doc) return;
    let count = 0;
    const updatedElements = doc.elements.map((e) => {
      if (e.type === 'heading' && (e.heading_level || 1) === 1) {
        count += 1;
        const rawText = e.text || e.original_text || '';
        const baseText = cleanHeadingPrefix(rawText);
        const prefix = style === 'roman' ? `${toRoman(count)}.` : `${count}.`;
        return {
          ...e,
          original_text: baseText,
          text: `${prefix} ${baseText}`,
        };
      }
      return e;
    });
    const updatedDoc = { ...doc, elements: updatedElements };
    pushHistory(updatedDoc);
    set({ doc: updatedDoc });
  },

  switchToTab: (index) => set((state) => {
    if (index < 0 || index >= state.tabs.length) return {};
    const tab = state.tabs[index];
    const tabDoc = state.tabDocs[tab.session_id];
    if (tabDoc) {
      return { activeTabIndex: index, doc: tabDoc, atHome: false };
    }
    return { activeTabIndex: index, atHome: false };
  }),
  removeTab: (index) => set((state) => {
    const tab = state.tabs[index];
    if (!tab) return {};
    const newTabs = state.tabs.filter((_, i) => i !== index);
    const newTabDocs = { ...state.tabDocs };
    delete newTabDocs[tab.session_id];
    const newIndex = Math.min(state.activeTabIndex, newTabs.length - 1);
    const newDoc = newTabs.length > 0 && newTabs[newIndex]
      ? newTabDocs[newTabs[newIndex].session_id] || null
      : null;
    return {
      tabs: newTabs,
      tabDocs: newTabDocs,
      activeTabIndex: Math.max(0, newIndex),
      doc: newDoc,
      atHome: newDoc ? false : state.atHome,
    };
  }),

  goHome: () => set({ atHome: true }),

  openSession: async (sessionId) => {
    set({ isLoading: true, error: null });
    try {
      let recovered = await api.recoverSession(sessionId);
      recovered = migrateDocument(recovered);
      set((state) => {
        const existing = state.tabs.findIndex((t) => t.session_id === sessionId);
        if (existing >= 0) {
          const newTabDocs = { ...state.tabDocs, [sessionId]: recovered };
          return {
            doc: recovered,
            tabDocs: newTabDocs,
            activeTabIndex: existing,
            atHome: false,
            isLoading: false,
            wizardStep: state.wizardStep === 0 ? 1 : state.wizardStep,
          };
        }
        const newTab = { session_id: recovered.session_id, file_name: recovered.file_name };
        const newTabs = [...state.tabs, newTab];
        const newTabDocs = { ...state.tabDocs, [recovered.session_id]: recovered };
        return {
          doc: recovered,
          tabs: newTabs,
          activeTabIndex: newTabs.length - 1,
          tabDocs: newTabDocs,
          atHome: false,
          isLoading: false,
          history: [recovered],
          historyIndex: 0,
          wizardStep: 1,
        };
      });
    } catch (err: any) {
      set({ error: err.message || 'Error al abrir la sesión', isLoading: false });
      get().showToast(err.message || 'Error al abrir la sesión', 'error');
    }
  },

  saveSnapshot: async () => {
    const { doc } = get();
    if (!doc) return;
    try {
      await api.saveSessionSnapshot(doc.session_id);
      set({ hasUnsavedChanges: false });
      get().showToast('Progreso guardado', 'success');
    } catch (err: any) {
      get().showToast(err.message || 'Error al guardar', 'error');
    }
  },

  runAIReview: async () => {
    const { doc } = get();
    if (!doc) return;
    set({ isReviewLoading: true, isReviewOpen: true });
    try {
      const result = await api.runAIReview(doc.session_id);
      set({ reviewResult: result, isReviewLoading: false });
      // Preflight report derivado del review (propuesta 3)
      const high = result.paragraphs.filter(p => p.ai_category === 'HIGH').length;
      const medium = result.paragraphs.filter(p => p.ai_category === 'MEDIUM').length;
      set({
        preflightReport: {
          headings: doc.elements.filter(e => e.type === 'heading').length,
          figures: doc.elements.filter(e => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0).length,
          tables: doc.elements.filter(e => e.type === 'table' && e.table_info).length,
          paragraphs: result.total_paragraphs,
          flaggedHigh: high,
          flaggedMedium: medium,
          reviewed: doc.elements.filter(e => !e.needs_review).length,
        },
      });
    } catch (err: any) {
      set({ isReviewLoading: false, isReviewOpen: false });
      get().showToast(err.message || 'Error en el revisor IA', 'error');
    }
  },

  fetchProviderStatus: async () => {
    try {
      // Asegura que las claves guardadas en localStorage lleguen al backend
      // (os.environ) antes de consultar el estado de proveedores. Sin esto,
      // tras un reinicio del watchdog las claves se pierden y la IA "no trabaja".
      await api.syncAllProviderKeys();
      const status = await api.getProviderStatus();
      set({ providerStatus: status });
    } catch (err: any) {
      // silencioso
    }
  },

  applyRewriteVariation: async (elementId, text, asTracked) => {
    const { doc, pushHistory } = get();
    if (!doc) return;
    try {
      // Conservar tipo/heading_level para updateElementType
      const elem = doc.elements.find(e => e.id === elementId);
      if (!elem) return;
      // Si es tracked, el backend generará Track Changes vs el texto original
      if (asTracked) {
        // Generamos docx con Track Changes marcando el cambio IA (propuesta track changes IA)
        const base = getApiBase();
        await fetch(`${base}/update-element`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: doc.session_id,
            element_id: elementId,
            type: elem.type,
            heading_level: elem.heading_level,
            text,
            author: 'IA WordAPA7',
          }),
        });
      } else {
        const updated = await api.updateElement(doc.session_id, elementId, elem.type, elem.heading_level, text);
        pushHistory(updated);
        set({ doc: updated });
      }
      get().showToast(asTracked ? 'Reescritura aplicada como cambio IA (Track Changes)' : 'Párrafo reescrito por IA', 'success');
    } catch (err: any) {
      get().showToast(err.message || 'Error al aplicar reescritura', 'error');
    }
  },

  suggestCitationFix: async (citationText, referenceId, problem) => {
    const { doc, apiKey } = get();
    if (!doc) return null;
    try {
      const result = await api.citationFix(doc.session_id, citationText, referenceId, problem, apiKey);
      return result;
    } catch (err: any) {
      get().showToast(err.message || 'Error al sugerir corrección', 'error');
      return null;
    }
  },

  exportLatex: async () => {
    const { doc } = get();
    if (!doc) return;
    set({ isLoading: true });
    try {
      const latex = await api.exportLatex(doc.session_id);
      // Descargar como .tex
      const blob = new Blob([latex], { type: 'application/x-tex' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (doc.file_name || 'documento').replace(/\.[^.]+$/, '') + '.tex';
      a.click();
      URL.revokeObjectURL(url);
      get().showToast('LaTeX exportado', 'success');
    } catch (err: any) {
      get().showToast(err.message || 'Error al exportar LaTeX', 'error');
    } finally {
      set({ isLoading: false });
    }
  },

  uploadFile: async (file) => {
    // Chistes contextuales: nombre de archivo tipo "final_v3" y reincidencia
    try {
      const { getFilenameComment, getRepeatComment } = await import('../lib/studentJokes');
      const joke = getFilenameComment(file.name) || getRepeatComment();
      if (joke) useDocStore.getState().showToast(joke, 'info');
    } catch { /* no crítico */ }

    set({ isLoading: true, error: null });
    try {
      let doc = await api.uploadDocxFile(file);
      doc = migrateDocument(doc);
      set((state) => {
        const newTab = { session_id: doc.session_id, file_name: doc.file_name };
        const newTabs = [...state.tabs, newTab];
        const newTabDocs = { ...state.tabDocs, [doc.session_id]: doc };

        let updatedPortada = { ...state.portada };
        if (doc.portada?.fields && Object.keys(doc.portada.fields).length > 0) {
          const f = doc.portada.fields;
          updatedPortada = {
            ...updatedPortada,
            title: f.title || updatedPortada.title,
            author: f.author || updatedPortada.author,
            institution: f.institution || updatedPortada.institution,
            course: f.course || updatedPortada.course || '',
            instructor: f.instructor || updatedPortada.instructor || '',
            date: f.date || updatedPortada.date || '',
          };
        }

        return {
          doc,
          portada: updatedPortada,
          isLoading: true, // mantener loading hasta que clasificación termine
          tabs: newTabs,
          activeTabIndex: newTabs.length - 1,
          tabDocs: newTabDocs,
          history: [doc],
          historyIndex: 0,
          coverSetupDone: false,
          atHome: false,
          wizardStep: 0,
        };
      });
      // Auto-disparar clasificación LLM en background
      const uncertainCount = doc.elements.filter(
        (e: any) => e.needs_review || (e.confidence < 0.85 && e.type !== 'empty' && e.type !== 'image' && e.type !== 'table')
      ).length;
      if (uncertainCount > 0) {
        get().runLLMClassify().catch(() => {});
      } else {
        // Sin elementos inciertos: loading termina acá
        set({ isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message || 'Error al procesar archivo', isLoading: false });
    }
  },

  startBlankDocument: async () => {
    set({ isLoading: true, error: null });
    try {
      const doc = await api.startBlankDocument();
      set((state) => {
        const newTab = { session_id: doc.session_id, file_name: doc.file_name };
        const newTabs = [...state.tabs, newTab];
        const newTabDocs = { ...state.tabDocs, [doc.session_id]: doc };

        return {
          doc,
          isLoading: false,
          tabs: newTabs,
          activeTabIndex: newTabs.length - 1,
          tabDocs: newTabDocs,
          history: [doc],
          historyIndex: 0,
          coverSetupDone: false,
          atHome: false,
          wizardStep: 0,
        };
      });
    } catch (err: any) {
      set({ error: err.message || 'Error al iniciar documento', isLoading: false });
    }
  },

  // Undo/Redo
  pushHistory: (doc) => set((state) => {
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(structuredClone(doc));
    if (newHistory.length > 50) newHistory.shift();
    return { history: newHistory, historyIndex: newHistory.length - 1, hasUnsavedChanges: true };
  }),

  undo: () => set((state) => {
    if (state.historyIndex <= 0 || !state.doc) return {};
    const newIndex = state.historyIndex - 1;
    const prevDoc = state.history[newIndex];
    const newTabDocs = { ...state.tabDocs, [prevDoc.session_id]: prevDoc };
    return { doc: prevDoc, historyIndex: newIndex, tabDocs: newTabDocs };
  }),

  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1 || !state.doc) return {};
    const newIndex = state.historyIndex + 1;
    const nextDoc = state.history[newIndex];
    const newTabDocs = { ...state.tabDocs, [nextDoc.session_id]: nextDoc };
    return { doc: nextDoc, historyIndex: newIndex, tabDocs: newTabDocs };
  }),

  runLLMClassify: async () => {
    const { doc, apiKey, aiProviderConfig, llmCloudConsent } = get();
    if (!doc) return;

    // Consentimiento informado: si hay API key de un proveedor en la nube,
    // el contenido del documento sale de la computadora. Se pide una sola vez
    // mediante un modal propio (App.tsx renderiza el diálogo cuando
    // llmConsentPending === true).
    if (apiKey && !llmCloudConsent && !aiProviderConfig.useLocal) {
      set({ llmConsentPending: true });
      return;
    }
    set({ llmConsentPending: false });

    set({ isLoading: true, error: null, llmProgress: { ...defaultLLMProgress, status: 'processing' } });

    const startTime = Date.now();
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    // Start polling progress
    pollInterval = setInterval(async () => {
      try {
        const progress = await api.getClassifyProgress(doc.session_id);
        const state = get();
        if (state.llmProgress.status !== progress.status) {
          set({ llmProgress: progress });
        } else {
          set({ llmProgress: progress });
        }
      } catch {
        // Silently fail on poll errors
      }
    }, 1000);

    try {
      const updated = await api.classifyWithLLM(doc.session_id, apiKey, aiProviderConfig);
      const durationMs = Date.now() - startTime;

      // Clear polling
      if (pollInterval) clearInterval(pollInterval);

      // Get final progress
      let finalProgress = defaultLLMProgress;
      try {
        finalProgress = await api.getClassifyProgress(doc.session_id);
      } catch {
        finalProgress = { ...defaultLLMProgress, status: 'complete' };
      }

      const tokensUsed = Math.min(5000, doc.elements.length * 25);
      const logItem = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        endpoint: '/api/classify-batch',
        statusCode: 200,
        tokensUsed,
        durationMs,
        status: 'success' as const,
        message: apiKey
          ? `Clasificación multi-proveedor completada. Proveedor final: ${finalProgress.current_provider || 'NVIDIA NIM'}`
          : 'Completado con clasificación heurística local (Sin API Key configurada).'
      };

      set((state) => ({
        doc: updated,
        isLoading: false,
        llmProgress: finalProgress,
        nimLogs: [logItem, ...(state.nimLogs || [])],
        llmUsageStats: {
          total_tokens: (state.llmUsageStats.total_tokens || 0) + tokensUsed,
          providers_used: finalProgress.provider_fallbacks?.length
            ? [...new Set([
                ...finalProgress.provider_fallbacks.map((f: any) => f.from),
                ...finalProgress.provider_fallbacks.map((f: any) => f.to),
                finalProgress.current_provider_id,
              ])]
            : [finalProgress.current_provider_id || 'nvidia_nim'],
          estimated_cost_usd: 0,
          cache_hits: 0,
          api_calls: finalProgress.total_batches || 1,
        },
      }));

      // Preflight accionable tras clasificar (propuesta 3)
      const d = useDocStore.getState().doc || updated;
      const heads = d.elements.filter((e: any) => e.type === 'heading').length;
      const figs = d.elements.filter((e: any) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0).length;
      const tabs = d.elements.filter((e: any) => e.type === 'table' && e.table_info).length;
      set({
        preflightReport: {
          headings: heads,
          figures: figs,
          tables: tabs,
          paragraphs: d.elements.filter((e: any) => e.type === 'paragraph').length,
          flaggedHigh: 0,
          flaggedMedium: 0,
          reviewed: d.elements.filter((e: any) => !e.needs_review).length,
        },
      });
      useDocStore.getState().showToast(
        `Clasificación completada: ${heads} títulos, ${figs} figuras, ${tabs} tablas. Abrir Revisor IA →`,
        'success',
        { label: 'Abrir Revisor', onClick: () => useDocStore.getState().runAIReview() }
      );
    } catch (err: any) {
      if (pollInterval) clearInterval(pollInterval);
      const durationMs = Date.now() - startTime;
      const logItem = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        endpoint: '/api/classify-batch',
        statusCode: 500,
        tokensUsed: 0,
        durationMs,
        status: 'error' as const,
        message: err.message || 'Error en comunicación con proveedor LLM'
      };
      set((state) => ({
        error: err.message || 'Error en clasificación LLM',
        isLoading: false,
        llmProgress: { ...defaultLLMProgress, status: 'error', last_error: err.message },
        nimLogs: [logItem, ...(state.nimLogs || [])],
      }));
      get().showToast(err.message || 'Error en clasificación LLM', 'error');
    }
  },

  updateElementType: async (elementId, type, headingLevel, text) => {
    const { doc, pushHistory } = get();
    if (!doc) return;
    try {
      const localElem = doc.elements.find((e) => e.id === elementId);
      const equation = localElem?.type === 'equation' ? localElem.equation : undefined;
      const updated = await api.updateElement(doc.session_id, elementId, type, headingLevel, text, equation);
      pushHistory(updated);
      set({ doc: updated });
    } catch (err: any) {
      console.error('Error updating element:', err);
    }
  },

  updateElementImage: async (elementId, imageInfo) => {
    const { doc, pushHistory } = get();
    if (!doc) return;
    try {
      const updated = await api.updateElementImage(doc.session_id, elementId, imageInfo);
      pushHistory(updated);
      set({ doc: updated });
    } catch (err: any) {
      console.error('Error updating image:', err);
    }
  },

  replaceImage: async (elementId, file) => {
    const { doc, pushHistory } = get();
    if (!doc) return;
    const updated = await api.replaceImageFile(doc.session_id, elementId, file);
    pushHistory(updated);
    set({ doc: updated });
  },

  reorderElements: async (elementIds) => {
    const { doc, pushHistory } = get();
    if (!doc) return;
    try {
      const updated = await api.reorderElements(doc.session_id, elementIds);
      pushHistory(updated);
      set({ doc: updated });
    } catch (err: any) {
      console.error('Error reordering elements:', err);
    }
  },

  acceptHighConfidenceElements: async () => {
    const { doc } = get();
    if (!doc) return;
    const highConf = doc.elements.filter((e) => e.confidence >= 0.85 && !e.is_user_modified && e.type !== 'empty');
    if (highConf.length === 0) return;
    set({ isLoading: true });
    try {
      const updated = await api.bulkAcceptElements(doc.session_id, highConf.map(e => e.id));
      set({ doc: updated, isLoading: false });
    } catch (e: any) {
      set({ error: e.message || 'Error al aprobar elementos', isLoading: false });
    }
  },

  insertTocElement: () => {
    const { doc } = get();
    if (!doc) return;
    // No duplicar si ya hay un TOC
    if (doc.elements.some((e) => e.type === 'toc')) {
      get().showToast('Ya existe un índice en el documento.', 'warning');
      return;
    }
    const tocElem: any = {
      id: `toc_${Date.now()}`,
      type: 'toc',
      heading_level: 1,
      text: 'Índice / Tabla de Contenidos',
      style_name: 'Normal',
      alignment: 'left',
      font_name: doc.elements[0]?.font_name || 'Times New Roman',
      font_size: doc.elements[0]?.font_size || 12,
      is_bold: false,
      is_italic: false,
      is_bullet: false,
      left_indent_cm: 0,
      confidence: 1.0,
      is_user_modified: true,
      needs_review: false,
      auto_applied: false,
      cita_ids: [],
      toc_style: 'dotted',
    };
    // Insertar después de la portada (tras los elementos de portada / portada_block)
    let insertIdx = 0;
    for (let i = 0; i < doc.elements.length; i++) {
      const e = doc.elements[i];
      if (e.is_cover_section || e.type === 'portada_block' || e.type === 'page_break') insertIdx = i + 1;
    }
    const next = [...doc.elements];
    next.splice(insertIdx, 0, tocElem);
    get().pushHistory(doc);
    set({ doc: { ...doc, elements: next } });
    get().showToast('Índice insertado tras la portada. Se generará como Tabla de Contenidos de Word.', 'success');
  },

  setRules: (newRules) => set((state) => ({ rules: { ...state.rules, ...newRules } })),

  saveRuleProfile: (name) => set((state) => {
    const profile = { ...state.rules, profile_name: name, is_default: false };
    return { ruleProfiles: [...state.ruleProfiles, profile] };
  }),

  resetRulesToDefault: () => set({ rules: defaultRules }),

  setPortada: (newPortada) => set((state) => ({ portada: { ...state.portada, ...newPortada } })),

  savePortadaProfile: (name) => set((state) => {
    const profile = { profile_name: name, created_at: new Date().toISOString(), data: state.portada };
    return { portadaProfiles: [...state.portadaProfiles, profile as any] };
  }),

  updateReferences: (refs: ReferenciaModel[]) => set({ references: refs }),
  addReference: (ref) => set((state) => ({ references: [...state.references, ref] })),
  
  removeReference: (id) => set((state) => ({ references: state.references.filter((r) => r.id !== id) })),

  resolveDoiReference: async (doi: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${getApiBase()}/resolve-doi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doi }),
      });
      if (res.ok) {
        const data = await res.json();
        get().addReference({
          id: Date.now().toString(),
          authors: data.authors || ['Autor'],
          year: data.year || '2026',
          title: data.title || 'Título',
          source: data.source || 'Revista',
          doi_or_url: doi,
          raw_text: data.apa_formatted || doi,
          formatted_apa: data.apa_formatted || doi,
        });
      }
    } catch (e) {
      console.error('Error resolving DOI:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  runValidation: async () => {
    const { doc, references } = get();
    if (!doc) return;
    try {
      const issues = await api.validateDocument(doc.session_id, references);

      set({ validationIssues: issues });
    } catch (err: any) {
      console.error('Error validating document:', err);
    }
  },

  runCitationAudit: async () => {
    const { doc } = get();
    if (!doc) return;
    set({ isLoading: true, error: null });
    try {
      const result = await api.validateCitations(doc.session_id);
      set({ citationAuditResult: result });
    } catch (err: any) {
      set({ error: err.message || 'Error al validar citas' });
      get().showToast(err.message, 'error');
    } finally {
      set({ isLoading: false });
    }
  },

  exportDocx: async (tracked = false) => {
    const { doc, rules, portada, references } = get();
    if (!doc) return;
    set({ isLoading: true });
    try {
      const base = getApiBase();
      const endpoint = tracked ? `${base}/generate-tracked` : `${base}/generate`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: doc.session_id, rules, portada, references }),
      });
      if (!res.ok) throw new Error('Error al exportar documento');
      const data = await res.json();
      // En Electron, download_url es relativo (/api/download/...). Necesitamos la URL absoluta.
      const downloadUrl = data.download_url.startsWith('http')
        ? data.download_url
        : `${base}${data.download_url.startsWith('/api') ? data.download_url : data.download_url}`;
      window.location.href = downloadUrl;
      set({ hasUnsavedChanges: false, exportSuccessAt: Date.now() });
    } catch (err: any) {
      set({ error: err.message || 'Error al exportar documento', isLoading: false });
    } finally {
      set({ isLoading: false });
    }
  },

  exportPdf: async () => {
    const { doc, rules, portada, references } = get();
    if (!doc) return;
    set({ isLoading: true });
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: doc.session_id,
          rules,
          portada,
          references,
        }),
      });
      if (!res.ok) throw new Error('Error al exportar PDF');
      const data = await res.json();
      if (data.download_url) {
        const downloadUrl = data.download_url.startsWith('http')
          ? data.download_url
          : `${base}${data.download_url.startsWith('/api') ? data.download_url : data.download_url}`;
        window.location.href = downloadUrl;
        set({ hasUnsavedChanges: false, exportSuccessAt: Date.now() });
      }
    } catch (err: any) {
      set({ error: err.message || 'Error al exportar PDF', isLoading: false });
      useDocStore.getState().showToast(err.message || 'Error al descargar PDF', 'error');
    } finally {
      set({ isLoading: false });
    }
  },
    }),
    {
      name: 'wordapa7-storage',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        apiKey: state.apiKey,
        rules: state.rules,
        ruleProfiles: state.ruleProfiles,
        portadaProfiles: state.portadaProfiles,
        aiProviderConfig: state.aiProviderConfig,
        // NOTE: doc, tabs, tabDocs, history intentionally NOT persisted
        // so the app always starts fresh (like Word opening without any file)
        hasSeenTour: state.hasSeenTour,
      }),
    }
  )
);

// Rompe el ciclo de importación backend.ts ↔ store: el tracing de X-Request-ID
// se registra como listener en http.ts en vez de importar el store desde la API.
setRequestIdListener((id) => useDocStore.getState().setLastRequestId(id));

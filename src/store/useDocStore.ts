/* WordAPA7 — Complete Unified State Management (Zustand) */

import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { DocumentModel, ElementType, APARuleSet, PortadaData, PortadaProfile, ReferenciaModel, ValidationIssue, WorkMode, LLMProgressState, ImageModel } from '../types';
import * as api from '../api/backend';

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
  activeTab: 'classifier' | 'portada' | 'referencias' | 'rules' | 'validator';
  apiKey: string;
  isLoading: boolean;
  isBackendReady: boolean;  // true cuando el motor Python ha confirmado que está listo
  error: string | null;
  selectedElementId: string | null;
  zoomLevel: number;
  nimLogs: any[];
  isNIMDiagnosticsOpen: boolean;

  // Toast notifications
  toastMessage: string | null;
  toastType: 'success' | 'error' | 'info';
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;

  // Debug request tracing
  lastRequestId: string | null;
  setLastRequestId: (id: string | null) => void;

  // LLM Progress tracking
  llmProgress: LLMProgressState;
  aiCitationValidation: boolean;
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
  appliedTemplate: string | null;
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
  wizardComplete: boolean;
  wizardAnswers: any;
  hasSeenTour: boolean;
  workMode: WorkMode;
  viewMode: 'edit' | 'result' | 'native-pdf' | 'split';
  forceRightPanelOpen: boolean;
  setForceRightPanelOpen: (open: boolean) => void;
  recoverySession: any;
  recoveryDismissed: boolean;
  previewHtml: string;
  isPreviewLoading: boolean;
  tabs: { session_id: string; file_name: string }[];
  activeTabIndex: number;
  tabDocs: Record<string, DocumentModel>;
  pdfPreviewCache: { hash: string; url: string } | null;

  // Undo/Redo
  history: DocumentModel[];
  historyIndex: number;

  rules: APARuleSet;
  ruleProfiles: APARuleSet[];
  portada: PortadaData;
  portadaProfiles: PortadaProfile[];
  references: ReferenciaModel[];
  validationIssues: ValidationIssue[];
  validateCitationsOnGenerate: boolean;

  setApiKey: (key: string) => void;
  setAiCitationValidation: (enabled: boolean) => void;
  setAiProviderConfig: (config: Partial<{ nimUrl: string, useLocal: boolean, providerId: string }>) => void;
  setValidateCitationsOnGenerate: (enabled: boolean) => void;
  setWizardStep: (step: number) => void;
  setActiveTab: (tab: 'classifier' | 'portada' | 'referencias' | 'rules' | 'validator') => void;
  setSelectedElementId: (id: string | null) => void;
  setShowTemplateDialog: (show: boolean) => void;
  setAppliedTemplate: (name: string | null) => void;
  fetchTemplates: () => Promise<void>;
  applyTemplate: (templateName: string) => Promise<void>;
  renumberHeadings: (style: 'roman' | 'decimal') => void;
  setZoomLevel: (zoom: number) => void;
  setShowFileMenu: (show: boolean) => void;
  setWizardComplete: (answers?: any) => void;
  setHasSeenTour: (seen: boolean) => void;
  resetWizard: () => void;
  setWorkMode: (mode: WorkMode) => void;
  setViewMode: (mode: 'edit' | 'result' | 'native-pdf' | 'split') => void;
  setRecoverySession: (session: any) => void;
  dismissRecovery: () => void;
  setPreviewHtml: (html: string) => void;
  setPreviewLoading: (loading: boolean) => void;
  generatePreview: () => Promise<void>;
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
  reorderElements: (elementIds: string[]) => Promise<void>;
  acceptHighConfidenceElements: () => Promise<void>;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  pushHistory: (doc: DocumentModel) => void;

  setRules: (rules: Partial<APARuleSet>) => void;
  setRulesFull: (rules: APARuleSet) => void;
  saveRuleProfile: (name: string) => void;
  loadRuleProfile: (name: string) => void;
  resetRulesToDefault: () => void;

  setPortada: (portada: Partial<PortadaData>) => void;
  setPortadaFull: (portada: PortadaData) => void;
  savePortadaProfile: (name: string) => void;
  loadPortadaProfile: (name: string) => void;

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
};

const defaultPortada: PortadaData = {
  apa_format: 'student',
  use_original_cover: true,
  title: '',
  author: '',
  institution: '',
  course: '',
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
const getApiBase = () => (window as any).electronAPI ? 'http://127.0.0.1:8742/api' : '/api';

export const useDocStore = create<DocState>()(
  persist(
    (set, get) => ({
      doc: null,
      activeTab: 'classifier',
      apiKey: '',
  isLoading: false,
  isBackendReady: false,
  error: null,
  selectedElementId: null,
  zoomLevel: 100,
  llmProgress: defaultLLMProgress,
  aiCitationValidation: false,
  showTemplateDialog: false,
  appliedTemplate: null,
  availableTemplates: [],
  llmUsageStats: {
    total_tokens: 0,
    providers_used: [],
    estimated_cost_usd: 0,
    cache_hits: 0,
    api_calls: 0,
  },

  toastMessage: null,
  toastType: 'info',
  lastRequestId: null,

  aiProviderConfig: {
    nimUrl: 'http://localhost:8000/v1/chat/completions',
    useLocal: false,
    providerId: 'nvidia_nim',
  },
  citationAuditResult: null,

  wizardStep: 2,
  showFileMenu: false,
  wizardComplete: true,
  wizardAnswers: null,
  hasSeenTour: false,
  workMode: 'review',
  viewMode: 'edit',
  forceRightPanelOpen: false,
  setForceRightPanelOpen: (open: boolean) => set({ forceRightPanelOpen: open }),
  recoverySession: null,
  recoveryDismissed: false,
  previewHtml: '',
  isPreviewLoading: false,
  tabs: [],
  activeTabIndex: 0,
  tabDocs: {},
  pdfPreviewCache: null,
  nimLogs: [],
  isNIMDiagnosticsOpen: false,
  validateCitationsOnGenerate: true,

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

  setApiKey: (key) => set({ apiKey: key }),
  setAiCitationValidation: (enabled) => set({ aiCitationValidation: enabled }),
  setAiProviderConfig: (config) => set((state) => ({ 
    aiProviderConfig: { ...state.aiProviderConfig, ...config } 
  })),
  setValidateCitationsOnGenerate: (enabled: boolean) => set({ validateCitationsOnGenerate: enabled }),
  showToast: (message, type = 'info') => {
    set({ toastMessage: message, toastType: type });
    setTimeout(() => {
      set({ toastMessage: null });
    }, 4000);
  },
  clearToast: () => set({ toastMessage: null }),
  setLastRequestId: (id) => set({ lastRequestId: id }),
  setWizardStep: (step) => set({ wizardStep: step }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setZoomLevel: (zoom) => set({ zoomLevel: Math.min(200, Math.max(50, zoom)) }),
  setShowFileMenu: (show) => set({ showFileMenu: show }),
  setWizardComplete: (answers) => set({ wizardComplete: true, wizardAnswers: answers }),
  setHasSeenTour: (seen) => set({ hasSeenTour: seen }),
  resetWizard: () => set({ wizardStep: 0, wizardComplete: false, wizardAnswers: null }),
  setWorkMode: (mode) => set({ workMode: mode }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setRecoverySession: (session) => set({ recoverySession: session }),
  dismissRecovery: () => set({ recoveryDismissed: true, recoverySession: null }),
  setPreviewHtml: (html) => set({ previewHtml: html }),
  setPreviewLoading: (loading) => set({ isPreviewLoading: loading }),
  setPdfPreviewCache: (cache) => set({ pdfPreviewCache: cache }),

  generatePreview: async () => {
    const { doc, rules, portada, references } = get();
    if (!doc) return;
    set({ isPreviewLoading: true, previewHtml: '' });
    try {
      // Reload session first to get latest state (cover_template_id, etc.)
      const sessionRes = await fetch(`/api/session/${doc.session_id}`);
      if (sessionRes.ok) {
        const freshDoc = await sessionRes.json();
        set({ doc: freshDoc });
      }

      // Generate the preview DOCX via backend
      const previewRes = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: doc.session_id, rules, portada, references }),
      });
      if (!previewRes.ok) throw new Error('Preview generation failed');

      // Download the generated DOCX
      const blobRes = await fetch(`/api/download-preview/${doc.session_id}`);
      if (!blobRes.ok) throw new Error('Preview download failed');
      const blob = await blobRes.blob();

      // Convert to HTML using mammoth
      const mammoth = await import('mammoth');
      const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });

      // Inject page-break markers: add visual separators before H1 headings
      // mammoth outputs <h1> for Heading 1, so we wrap them with a page separator
      let html = result.value;
      // Add page-break simulation: wrap content in pages with visible separators
      // Split on H1 headings to create visual pages
      const h1Pattern = /<h1(\s[^>]*)?>/gi;
      const parts = html.split(h1Pattern);
      if (parts.length > 1) {
        // Reconstruct with page separators before each H1
        html = parts[0]; // Content before first H1 (cover page area)
        for (let i = 1; i < parts.length; i += 2) {
          const attrs = parts[i] || '';
          const content = parts[i + 1] || '';
          html += `
            <div style="border-top:2px dashed #d0d0d0;margin:16px 0 8px;text-align:center;
                        font-size:10px;color:#a0a0a0;font-family:system-ui;padding-top:6px;">
              — Nueva Página —
            </div>
            <h1${attrs}>${content.split('</h1>')[0]}</h1>
            ${content.split('</h1>').slice(1).join('</h1>')}
          `;
        }
      }

      // Wrap in page containers with APA dimensions
      const pageHtml = `
        <style>
          .preview-page h1 { page-break-before: always; }
          @media print { .preview-page h1 { break-before: page; } }
        </style>
        <div class="preview-page" style="max-width:816px;margin:0 auto;background:white;padding:96px;
                    box-shadow:0 2px 12px rgba(0,0,0,0.15);font-family:'Times New Roman',serif;
                    min-height:1056px;line-height:2;font-size:12pt;">
          ${html}
        </div>`;

      set({ previewHtml: pageHtml, isPreviewLoading: false });
    } catch (err) {
      console.error('Preview error:', err);
      set({ isPreviewLoading: false });
    }
  },
  setShowTemplateDialog: (show) => set({ showTemplateDialog: show }),
  setAppliedTemplate: (name) => set({ appliedTemplate: name }),

  fetchTemplates: async () => {
    try {
      const res = await fetch('/api/templates');
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
      const res = await fetch('/api/apply-template', {
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
      const updatedRes = await fetch(`/api/session/${doc.session_id}`);
      if (updatedRes.ok) {
        const updatedDoc = await updatedRes.json();
        pushHistory(updatedDoc);
        set({ doc: updatedDoc, appliedTemplate: templateName, isLoading: false });
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
      return { activeTabIndex: index, doc: tabDoc };
    }
    return { activeTabIndex: index };
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
    };
  }),

  uploadFile: async (file) => {
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
          isLoading: false,
          tabs: newTabs,
          activeTabIndex: newTabs.length - 1,
          tabDocs: newTabDocs,
          history: [doc],
          historyIndex: 0,
          // Tras importar, aterrizar en el Paso 0 (Preferencias)
          // para que el usuario configure las reglas base antes de la revisión guiada.
          wizardStep: 0,
        };
      });
      // Auto-disparar clasificación LLM en background después del upload
      const uncertainCount = doc.elements.filter(
        (e: any) => e.needs_review || (e.confidence < 0.85 && e.type !== 'empty' && e.type !== 'image' && e.type !== 'table')
      ).length;
      if (uncertainCount > 0) {
        // Disparar en background sin bloquear la UI
        get().runLLMClassify().catch(() => {});
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
    const { doc, apiKey, aiProviderConfig } = get();
    if (!doc) return;
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
        isNIMDiagnosticsOpen: true,
      }));
    }
  },

  updateElementType: async (elementId, type, headingLevel, text) => {
    const { doc, pushHistory } = get();
    if (!doc) return;
    try {
      const updated = await api.updateElement(doc.session_id, elementId, type, headingLevel, text);
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

  setRules: (newRules) => set((state) => ({ rules: { ...state.rules, ...newRules } })),
  setRulesFull: (newRules) => set({ rules: newRules }),

  saveRuleProfile: (name) => set((state) => {
    const profile = { ...state.rules, profile_name: name, is_default: false };
    return { ruleProfiles: [...state.ruleProfiles, profile] };
  }),

  loadRuleProfile: (name) => set((state) => {
    if (name === 'APA 7 Estándar') return { rules: defaultRules };
    const profile = state.ruleProfiles.find((p) => p.profile_name === name);
    return profile ? { rules: profile } : {};
  }),

  resetRulesToDefault: () => set({ rules: defaultRules }),

  setPortada: (newPortada) => set((state) => ({ portada: { ...state.portada, ...newPortada } })),
  setPortadaFull: (newPortada) => set({ portada: newPortada }),

  savePortadaProfile: (name) => set((state) => {
    const profile = { profile_name: name, created_at: new Date().toISOString(), data: state.portada };
    return { portadaProfiles: [...state.portadaProfiles, profile as any] };
  }),

  loadPortadaProfile: (name) => set((state) => {
    const profile = state.portadaProfiles.find((p: any) => p.profile_name === name);
    return profile ? { portada: profile.data } : {};
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
    const { doc, references, aiCitationValidation, apiKey, aiProviderConfig } = get();
    if (!doc) return;
    try {
      const issues = await api.validateDocument(doc.session_id, references);

      // If AI citation validation is enabled, run LLM pass (requires apiKey or local NIM URL)
      if (aiCitationValidation && (apiKey || aiProviderConfig.useLocal)) {
        try {
          const aiIssues = await api.validateCitationsWithAI(doc.session_id, references, apiKey, aiProviderConfig);
          issues.push(...aiIssues);
        } catch (aiErr) {
          console.warn('AI citation validation failed (non-fatal):', aiErr);
        }
      }

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
        : `http://127.0.0.1:8742${data.download_url}`;
      window.location.href = downloadUrl;
      set({ hasUnsavedChanges: false });
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
          : `http://127.0.0.1:8742${data.download_url}`;
        window.location.href = downloadUrl;
        set({ hasUnsavedChanges: false });
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
        aiCitationValidation: state.aiCitationValidation,
        validateCitationsOnGenerate: state.validateCitationsOnGenerate,
        // NOTE: doc, tabs, tabDocs, history intentionally NOT persisted
        // so the app always starts fresh (like Word opening without any file)
        wizardComplete: false, // always reset to show QuickStart
        wizardAnswers: state.wizardAnswers,
        hasSeenTour: state.hasSeenTour,
        workMode: state.workMode,
      }),
    }
  )
);

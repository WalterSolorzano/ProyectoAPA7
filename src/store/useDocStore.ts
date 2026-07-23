/* WordAPA7 — Complete Unified State Management (Zustand) */

import { create } from 'zustand';
import { DocumentModel, ElementType, APARuleSet, PortadaData, ReferenciaModel, ValidationIssue, WorkMode } from '../types';
import * as api from '../api/backend';

interface DocState {
  doc: DocumentModel | null;
  activeTab: 'classifier' | 'portada' | 'referencias' | 'rules' | 'validator';
  apiKey: string;
  isLoading: boolean;
  error: string | null;
  selectedElementId: string | null;
  zoomLevel: number;
  nimLogs: any[];
  isNIMDiagnosticsOpen: boolean;

  setIsNIMDiagnosticsOpen: (open: boolean) => void;

  wizardStep: number;
  showFileMenu: boolean;
  wizardComplete: boolean;
  wizardAnswers: any;
  workMode: WorkMode;
  recoverySession: any;
  recoveryDismissed: boolean;
  previewHtml: string;
  isPreviewLoading: boolean;
  tabs: { session_id: string; file_name: string }[];
  activeTabIndex: number;
  tabDocs: Record<string, DocumentModel>;

  // Undo/Redo
  history: DocumentModel[];
  historyIndex: number;

  rules: APARuleSet;
  ruleProfiles: APARuleSet[];
  portada: PortadaData;
  portadaProfiles: PortadaData[];
  references: ReferenciaModel[];
  validationIssues: ValidationIssue[];

  setApiKey: (key: string) => void;
  setWizardStep: (step: number) => void;
  setActiveTab: (tab: 'classifier' | 'portada' | 'referencias' | 'rules' | 'validator') => void;
  setSelectedElementId: (id: string | null) => void;
  setZoomLevel: (zoom: number) => void;
  setShowFileMenu: (show: boolean) => void;
  setWizardComplete: (answers?: any) => void;
  resetWizard: () => void;
  setWorkMode: (mode: WorkMode) => void;
  setRecoverySession: (session: any) => void;
  dismissRecovery: () => void;
  setPreviewHtml: (html: string) => void;
  setPreviewLoading: (loading: boolean) => void;

  switchToTab: (index: number) => void;
  removeTab: (index: number) => void;

  uploadFile: (file: File) => Promise<void>;
  runLLMClassify: () => Promise<void>;
  updateElementType: (elementId: string, type: ElementType, headingLevel?: number, text?: string) => Promise<void>;
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

  addReference: (ref: ReferenciaModel) => void;
  removeReference: (id: string) => void;
  resolveDoiReference: (doi: string) => Promise<void>;

  runValidation: () => Promise<void>;
  exportDocx: (tracked?: boolean) => Promise<void>;
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
  reference_hanging_indent_cm: 1.27,
  doi_as_hyperlink: true,
  figure_label_prefix: 'Figura',
  table_label_prefix: 'Tabla',
};

const defaultPortada: PortadaData = {
  apa_format: 'student',
  title: '',
  author: '',
  institution: '',
  course: '',
  instructor: '',
  date: '',
  running_head: '',
  author_note: '',
};

export const useDocStore = create<DocState>((set, get) => ({
  doc: null,
  activeTab: 'classifier',
  apiKey: '',
  isLoading: false,
  error: null,
  selectedElementId: null,
  zoomLevel: 100,

  wizardStep: 0,
  showFileMenu: false,
  wizardComplete: true,
  wizardAnswers: null,
  workMode: 'review',
  recoverySession: null,
  recoveryDismissed: false,
  previewHtml: '',
  isPreviewLoading: false,
  tabs: [],
  activeTabIndex: 0,
  tabDocs: {},
  nimLogs: [],
  isNIMDiagnosticsOpen: false,

  setIsNIMDiagnosticsOpen: (open) => set({ isNIMDiagnosticsOpen: open }),

  history: [],
  historyIndex: -1,

  rules: defaultRules,
  ruleProfiles: [defaultRules],
  portada: defaultPortada,
  portadaProfiles: [{ ...defaultPortada, title: 'Portada Estándar' } as any],
  references: [],
  validationIssues: [],

  setApiKey: (key) => set({ apiKey: key }),
  setWizardStep: (step) => set({ wizardStep: step }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setZoomLevel: (zoom) => set({ zoomLevel: Math.min(200, Math.max(50, zoom)) }),
  setShowFileMenu: (show) => set({ showFileMenu: show }),
  setWizardComplete: (answers) => set({ wizardComplete: true, wizardAnswers: answers || null }),
  resetWizard: () => set({ wizardComplete: false, wizardAnswers: null }),
  setWorkMode: (mode) => set({ workMode: mode }),
  setRecoverySession: (session) => set({ recoverySession: session }),
  dismissRecovery: () => set({ recoveryDismissed: true, recoverySession: null }),
  setPreviewHtml: (html) => set({ previewHtml: html }),
  setPreviewLoading: (loading) => set({ isPreviewLoading: loading }),

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
      const doc = await api.uploadDocxFile(file);
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
        };
      });
    } catch (err: any) {
      set({ error: err.message || 'Error al procesar archivo', isLoading: false });
    }
  },

  // Undo/Redo
  pushHistory: (doc) => set((state) => {
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(structuredClone(doc));
    if (newHistory.length > 50) newHistory.shift();
    return { history: newHistory, historyIndex: newHistory.length - 1 };
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
    const { doc, apiKey } = get();
    if (!doc) return;
    set({ isLoading: true, error: null });
    const startTime = Date.now();
    try {
      const updated = await api.classifyWithLLM(doc.session_id, apiKey);
      const durationMs = Date.now() - startTime;

      const logItem = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        endpoint: '/api/classify-batch',
        statusCode: 200,
        tokensUsed: Math.min(3000, doc.elements.length * 20),
        durationMs,
        status: 'success' as const,
        message: apiKey
          ? 'Clasificación procesada exitosamente con NVIDIA NIM LLaMA 3.1 70B.'
          : 'Completado con clasificación heurística local (Sin API Key configurada).'
      };

      set((state) => ({
        doc: updated,
        isLoading: false,
        nimLogs: [logItem, ...(state.nimLogs || [])],
        isNIMDiagnosticsOpen: true
      }));
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const logItem = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        endpoint: '/api/classify-batch',
        statusCode: 500,
        tokensUsed: 0,
        durationMs,
        status: 'error' as const,
        message: err.message || 'Error en comunicación con NVIDIA NIM'
      };
      set((state) => ({
        error: err.message || 'Error en clasificación LLM',
        isLoading: false,
        nimLogs: [logItem, ...(state.nimLogs || [])],
        isNIMDiagnosticsOpen: true
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
    const profile = { ...state.rules, profile_name: name };
    return { ruleProfiles: [...state.ruleProfiles, profile] };
  }),

  loadRuleProfile: (name) => set((state) => {
    const profile = state.ruleProfiles.find((p) => p.profile_name === name);
    return profile ? { rules: profile } : {};
  }),

  resetRulesToDefault: () => set({ rules: defaultRules }),

  setPortada: (newPortada) => set((state) => ({ portada: { ...state.portada, ...newPortada } })),
  setPortadaFull: (newPortada) => set({ portada: newPortada }),

  savePortadaProfile: (name) => set((state) => {
    const profile = { ...state.portada, title: name };
    return { portadaProfiles: [...state.portadaProfiles, profile as any] };
  }),

  loadPortadaProfile: (name) => set((state) => {
    const profile = state.portadaProfiles.find((p: any) => p.title === name || p.profile_name === name);
    return profile ? { portada: profile } : {};
  }),

  addReference: (ref) => set((state) => ({ references: [...state.references, ref] })),
  
  removeReference: (id) => set((state) => ({ references: state.references.filter((r) => r.id !== id) })),

  resolveDoiReference: async (doi: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/resolve-doi', {
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

  exportDocx: async (tracked = false) => {
    const { doc, rules, portada, references } = get();
    if (!doc) return;
    set({ isLoading: true });
    try {
      const endpoint = tracked ? '/api/generate-tracked' : '/api/generate';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: doc.session_id, rules, portada, references }),
      });
      if (!res.ok) throw new Error('Error al exportar documento');
      const data = await res.json();
      window.location.href = data.download_url;
    } catch (err: any) {
      set({ error: err.message || 'Error al exportar documento', isLoading: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));

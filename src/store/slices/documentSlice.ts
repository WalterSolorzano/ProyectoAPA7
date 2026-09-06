import { StateCreator } from 'zustand';
import { DocState } from '../types';
import { DocumentModel, ElementModel, ElementType, APARuleSet, FormatProfile, ReferenciaModel, ValidationIssue, LLMProgressState, ImageModel } from '../../types';
import * as api from '../../api/backend';
import { migrateDocument, toRoman, cleanHeadingPrefix } from '../../lib/textUtils';
import { syncCoverFieldToElements, defaultPortada } from './coverSlice';

const getApiBase = () => api.getApiBase();

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

const defaultLLMProgress: LLMProgressState = {
  status: 'idle',
  total_batches: 0,
  completed_batches: 0,
  current_provider: '',
  current_provider_id: '',
  elements_processed: 0,
  elements_total: 0,
  estimated_time_remaining_seconds: 0,
  current_sample: '',
  provider_fallbacks: [],
  last_error: null,
};

/** Triggers a file download without navigating away from the app (Electron-safe). */
function triggerDownload(url: string, filename?: string) {
  const a = document.createElement('a');
  a.href = url;
  a.style.display = 'none';
  if (filename) a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function safeRefText(ref: unknown): string {
  try {
    const o = (ref ?? {}) as any;
    const a = Array.isArray(o.authors) ? o.authors.filter(Boolean).join(', ') : '';
    return [a, o.year ? `(${o.year})` : '', o.title || ''].filter(Boolean).join(' ').trim();
  } catch { return ''; }
}

export const createDocumentSlice: StateCreator<DocState, [], [], Partial<DocState>> = (set, get) => ({
  doc: null,
  apiKey: (() => {
    try {
      const providers = [
        'NVIDIA_API_KEY',
        'GROQ_API_KEY',
        'OPENROUTER_API_KEY',
        'CEREBRAS_API_KEY',
        'MISTRAL_API_KEY',
        'OPENCODEZEN_API_KEY',
        'ZENMUX_API_KEY',
        'GEMINI_API_KEY',
      ];
      for (const p of providers) {
        const val = localStorage.getItem(`wordapa7-provider-key:${p}`);
        if (val && val.trim()) return val.trim();
      }
      return '';
    } catch { return ''; }
  })(),
  // Consentimiento explícito para enviar contenido a un LLM en la nube.,
  llmCloudConsent: false,
  llmConsentPending: false,
  setLlmConsentPending: (v) => set({ llmConsentPending: v }),
  error: null,
  selectedElementId: null,
  selectedReferenceId: null,
  tableStyles: {},
  llmProgress: defaultLLMProgress,
  llmUsageStats: {
    total_tokens: 0,
    providers_used: [],
    estimated_cost_usd: 0,
    cache_hits: 0,
    api_calls: 0,
  },
  aiProviderConfig: {
    nimUrl: 'http://localhost:8000/v1/chat/completions',
    useLocal: false,
    providerId: 'nvidia_nim',
  },
  pdfPreviewCache: null,
  history: [],
  historyIndex: -1,
  rules: defaultRules,
  ruleProfiles: [defaultRules],
  profiles: [],
  activeProfileId: 'apa7',
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
  setSelectedElementId: (id) => set((state) => ({
    selectedElementId: id,
    selectedReferenceId: id ? null : state.selectedReferenceId,
  })),
  setSelectedReferenceId: (id) => set((state) => ({
    selectedReferenceId: id,
    selectedElementId: id ? null : state.selectedElementId,
  })),
  setTableStyle: (elementId, style) => set((state) => ({ tableStyles: { ...state.tableStyles, [elementId]: style } })),
  runProactiveAudits: async () => {
    const { doc, sugerenciasProactivas, apiKey, aiProviderConfig } = get();
    if (!sugerenciasProactivas || !doc) return;
    try {
      const result = await api.validateCitations(doc.session_id);
      set({ citationAuditResult: result });
    } catch { /* silencioso: los globos de citas esperarán la auditoría manual */ }
    try {
      const result = await api.runAIReview(doc.session_id);
      // FILTER_QUE: 'que' aislado NO es problema (falso positivo clasico del LLM)
      try {
        const ev = (result as any)?.findings || (result as any)?.issues || [];
        for (const f of ev as any[]) {
          if (typeof f?.evidence === 'string' && /^\s*["\u00ab']?que["\u00bb']?\.?\s*$/i.test(f.evidence)) {
            (f as any)._dismissed = true;
          }
          if (typeof f?.message === 'string' && /\bque\b/i.test(f.message) && String(f?.category||'').includes('ai')) {
            f.message = f.message.replace(/\b"que"\b/gi, 'conector');
          }
        }
      } catch {}
      set({ reviewResult: result });
    } catch { /* silencioso: estilo/IA esperarán la revisión manual */ }
    // Proactivo total: buscar referencias faltantes en Crossref sin molestar.
    try { await get().autoResolveGhosts(); } catch { /* noop */ }
  },
  runProactiveAutoCaptioning: async () => {
    const { doc } = get();
    if (!doc) return;
    try {
      const res = await api.fetchProactiveCaptions(doc.session_id);
      if (res.suggestions && res.suggestions.length > 0) {
        res.suggestions.forEach((sug) => {
          if (sug.type === 'image') {
            get().updateElementImage(sug.element_id, { caption: sug.caption, note: sug.note });
          } else if (sug.type === 'table') {
            get().updateElementTable(sug.element_id, { caption: sug.caption, note: sug.note });
          }
        });
        get().pushActivityEvent(
          'success',
          `Auto-captioning proactivo: ${res.suggestions.length} leyendas generadas`,
          'Títulos y notas APA 7 asignados automáticamente'
        );
      }
    } catch { /* silencioso */ }
  },
  setPdfPreviewCache: (cache) => set({ pdfPreviewCache: cache }),
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
            references: recovered.referencias || [],
            tabDocs: newTabDocs,
            activeTabIndex: existing,
            atHome: false,
            isLoading: false,
            wizardStep: Math.max(1, state.wizardStep),
            selectedElementId: null,
            selectedReferenceId: null,
            scrollTargetId: null,
          };
        }
        const newTab = { session_id: recovered.session_id, file_name: recovered.file_name };
        const newTabs = [...state.tabs, newTab];
        const newTabDocs = { ...state.tabDocs, [recovered.session_id]: recovered };
        return {
          doc: recovered,
          references: recovered.referencias || [],
          tabs: newTabs,
          activeTabIndex: newTabs.length - 1,
          tabDocs: newTabDocs,
          atHome: false,
          isLoading: false,
          history: [recovered],
          historyIndex: 0,
          wizardStep: 1,
          selectedElementId: null,
          selectedReferenceId: null,
          scrollTargetId: null,
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
  uploadFile: async (file, opts) => {
    // Chistes contextuales: nombre de archivo tipo "final_v3" y reincidencia
    try {
      const { getFilenameComment, getRepeatComment } = await import('../../lib/studentJokes');
      const joke = getFilenameComment(file.name) || getRepeatComment();
      if (joke) get().showToast(joke, 'info');
    } catch { /* no crítico */ }

    const effectiveMode = opts?.mode || 'review';
    set({ isLoading: true, error: null });
    get().pushActivityEvent('info', `Procesando ${file.name}…`);
    try {
      let doc = await api.uploadDocxFile(file, { profileId: opts?.profileId, mode: effectiveMode });
      doc = migrateDocument(doc);
      // Sincronizar reglas con el perfil elegido en la subida (si el backend lo aplicó)
      const uploadedProfile = get().profiles.find((p) => p.profile_id === (opts?.profileId || doc.profile_id || 'apa7'));
      set((state) => {
        const newTab = { session_id: doc.session_id, file_name: doc.file_name };
        const newTabs = [...state.tabs, newTab];
        const newTabDocs = { ...state.tabDocs, [doc.session_id]: doc };

        let updatedPortada = { ...state.portada };
        if (doc.portada?.fields && typeof doc.portada.fields === 'object') {
          const f = doc.portada.fields as any;
          const toStr = (v: any) => (Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : v != null ? String(v) : '');
          updatedPortada = {
            ...updatedPortada,
            title: toStr(f.title) || updatedPortada.title,
            author: toStr(f.author) || updatedPortada.author,
            institution: toStr(f.institution) || updatedPortada.institution,
            course: toStr(f.course) || updatedPortada.course || '',
            instructor: toStr(f.instructor) || updatedPortada.instructor || '',
            date: toStr(f.date) || updatedPortada.date || '',
          };
        }

        return {
          doc,
          references: doc.referencias || [],
          portada: updatedPortada,
          rules: uploadedProfile ? uploadedProfile.rules : state.rules,
          activeProfileId: uploadedProfile ? uploadedProfile.profile_id : state.activeProfileId,
          isLoading: true, // mantener loading hasta que clasificación termine
          tabs: newTabs,
          activeTabIndex: newTabs.length - 1,
          tabDocs: newTabDocs,
          history: [doc],
          historyIndex: 0,
          coverSetupDone: false,
          atHome: false,
          wizardStep: 1,
        };
      });
      if (doc.portada?.fields && Object.keys(doc.portada.fields).length > 0) {
        get().showToast('Detectamos datos de tu portada y los precargamos', 'info');
      }
      if (!doc.elements || doc.elements.length === 0) {
        get().showToast(
          'El documento se abrió pero no se detectó contenido. Puede estar protegido, corrupto o ser un formato no soportado.',
          'error'
        );
      }
      get().pushActivityEvent('success', `Documento listo: ${doc.elements.length} elementos`, doc.file_name);
      // Globos proactivos: auditorías silenciosas en background
      get().runProactiveAudits().catch(() => {});
      get().runProactiveAutoCaptioning().catch(() => {});
      // Revisor por lotes (ortografía/IA/pegado): silencioso
      get().runProofreadBatch().catch(() => {});

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
      get().pushActivityEvent('error', 'Error al procesar el archivo', err.message || 'Intenta de nuevo.');
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
          wizardStep: 1,
        };
      });
    } catch (err: any) {
      set({ error: err.message || 'Error al iniciar documento', isLoading: false });
    }
  },
  createFromTemplate: async (templateId) => {
    set({ isLoading: true, error: null });
    try {
      let doc = await api.createFromTemplate(templateId, get().activeProfileId);
      doc = migrateDocument(doc);
      const prof = get().profiles.find((p) => p.profile_id === (doc.profile_id || get().activeProfileId));
      set((state) => {
        const newTab = { session_id: doc.session_id, file_name: doc.file_name };
        const newTabs = [...state.tabs, newTab];
        const newTabDocs = { ...state.tabDocs, [doc.session_id]: doc };
        return {
          doc,
          references: doc.referencias || [],
          rules: prof ? prof.rules : state.rules,
          activeProfileId: prof ? prof.profile_id : state.activeProfileId,
          isLoading: false,
          tabs: newTabs,
          activeTabIndex: newTabs.length - 1,
          tabDocs: newTabDocs,
          history: [doc],
          historyIndex: 0,
          coverSetupDone: false,
          atHome: false,
          wizardStep: 1,
        };
      });
      get().showToast('Documento creado desde la plantilla: completá la portada y escribí.', 'success');
    } catch (err: any) {
      set({ error: err.message || 'Error al crear documento desde plantilla', isLoading: false });
      get().showToast(err?.message || 'No se pudo crear el documento desde la plantilla', 'error');
    }
  },

  // Undo/Redo,
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
      const d = get().doc || updated;
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
      get().showToast(
        `Clasificación completada: ${heads} títulos, ${figs} figuras, ${tabs} tablas. Abrir Revisor IA →`,
        'success',
        {
          label: 'Abrir Revisor',
          onClick: () => {
            get().runAIReview();
            get().setForceRightPanelOpen(true);
            get().setRightPanelTab('activity');
          },
        }
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
      // C7: Show visible error toast instead of silent console.error
      get().showToast(err?.message || 'Error al actualizar elemento', 'error');
    }
  },
  updateElementText: async (elementId, text) => {
    const { doc } = get();
    if (!doc) return;
    const elem = doc.elements.find((e) => e.id === elementId);
    if (!elem) return;
    await get().updateElementType(elementId, elem.type, elem.heading_level, text);
  },
  updateElementImage: async (elementId, imageInfo) => {
    const { doc, pushHistory } = get();
    if (!doc) return;
    try {
      const updated = await api.updateElementImage(doc.session_id, elementId, imageInfo);
      pushHistory(updated);
      set({ doc: updated });
    } catch (err: any) {
      // C7: Show visible error toast instead of silent console.error
      get().showToast(err?.message || 'Error al actualizar imagen', 'error');
    }
  },

  // C2: Persist table_info changes (caption, note, table_number, etc.) via the
  // backend updateElementTable endpoint so they survive regeneration.,
  updateElementTable: async (elementId, tableInfo) => {
    const { doc, pushHistory } = get();
    if (!doc) return;
    try {
      const updated = await api.updateElementTable(doc.session_id, elementId, tableInfo);
      pushHistory(updated);
      set({ doc: updated });
    } catch (err: any) {
      get().showToast(err?.message || 'Error al actualizar tabla', 'error');
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
    const { doc, pushHistory } = get();
    if (!doc) return;
    const highConf = doc.elements.filter((e) => e.confidence >= 0.85 && !e.is_user_modified && e.type !== 'empty');
    if (highConf.length === 0) return;
    set({ isLoading: true });
    try {
      const updated = await api.bulkAcceptElements(doc.session_id, highConf.map(e => e.id));
      pushHistory(updated);
      set({ doc: updated, isLoading: false });
    } catch (e: any) {
      set({ error: e.message || 'Error al aprobar elementos', isLoading: false });
    }
  },
  approveAllHeadings: async () => {
    const { doc, pushHistory } = get();
    if (!doc) return;
    const headings = doc.elements.filter((e) => e.type === 'heading');
    if (headings.length === 0) return;
    set({ isLoading: true });
    try {
      const updated = await api.bulkAcceptElements(doc.session_id, headings.map(e => e.id));
      const updatedElements = updated.elements.map(e => {
        if (e.type === 'heading') {
          return { ...e, needs_review: false, is_user_modified: true, confidence: 1.0, auto_applied: true };
        }
        return e;
      });
      const finalDoc = { ...updated, elements: updatedElements };
      pushHistory(finalDoc);
      set({ doc: finalDoc, isLoading: false });
      get().showToast(`${headings.length} títulos validados y aprobados`, 'success');
    } catch (e: any) {
      set({ error: e.message || 'Error al aprobar títulos', isLoading: false });
    }
  },
  autoNormalizeHeadings: async () => {
    const { doc, pushHistory } = get();
    if (!doc) return;
    set({ isLoading: true });
    try {
      const updated = await api.normalizeHeadings(doc.session_id);
      pushHistory(updated);
      set({ doc: updated, isLoading: false });
      get().showToast('Jerarquía de títulos normalizada según APA 7ma edición', 'success');
    } catch (e: any) {
      set({ error: e.message || 'Error al normalizar títulos', isLoading: false });
    }
  },
  runQuickFix: async () => {
    const { doc } = get();
    if (!doc) {
      get().showToast('Subí un documento primero', 'warning');
      return;
    }
    set({ isLoading: true });
    try {
      await get().acceptHighConfidenceElements().catch(() => {});
      await get().runValidation().catch(() => {});
      await get().runCitationAudit().catch(() => {});
      const res = get().citationAuditResult;
      const ghosts = res?.ghost_citations?.length || 0;
      const orphans = res?.orphan_references?.length || 0;
      get().pushActivityEvent(
        'success',
        'Formato aplicado automáticamente',
        ghosts + orphans > 0
          ? `Quedan ${ghosts + orphans} citas/referencias por resolver`
          : 'Clasificación, validación y citas al día',
      );
      get().showToast(
        ghosts + orphans > 0
          ? 'Documento arreglado. Revisá las citas en Referencias.'
          : 'Documento arreglado: formato aplicado y citas al día.',
        ghosts + orphans > 0 ? 'warning' : 'success',
      );
    } catch (err: any) {
      get().showToast(err.message || 'No se pudo aplicar el formato', 'error');
    } finally {
      set({ isLoading: false });
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
  removeTocElement: () => {
    const { doc } = get();
    if (!doc) return;
    const next = doc.elements.filter((e) => e.type !== 'toc');
    get().pushHistory(doc);
    set({ doc: { ...doc, elements: next } });
    get().showToast('Índice eliminado del documento.', 'info');
  },

  // C6: Auto-generate captions for all images and tables that lack one.
  // Iterates sequentially with error protection per element.,
  setRules: (newRules) => set((state) => ({ rules: { ...state.rules, ...newRules } })),
  fetchProfiles: async () => {
    try {
      const data = await api.listProfiles();
      set({ profiles: data.profiles || [] });
    } catch {
      // Sin red/backend: quedan los perfiles persistidos en IndexedDB (partialize).
      // El fallback a APA7 por defecto no bloquea el arranque.
    }
  },
  setActiveProfile: async (profileId) => {
    const profile = get().profiles.find((p) => p.profile_id === profileId);
    if (!profile) return;
    set({ activeProfileId: profileId, rules: profile.rules });
    const doc = get().doc;
    if (doc) {
      try {
        const updated = await api.setSessionProfile(doc.session_id, profileId);
        const migrated = migrateDocument(updated);
        set((state) => ({
          doc: migrated,
          tabDocs: { ...state.tabDocs, [doc.session_id]: migrated },
        }));
      } catch (err: any) {
        get().showToast(err.message || 'Error al aplicar el perfil', 'error');
      }
    }
  },
  saveRuleProfile: (name) => set((state) => {
    const profile = { ...state.rules, profile_name: name, is_default: false };
    return { ruleProfiles: [...state.ruleProfiles, profile] };
  }),
  resetRulesToDefault: () => set({ rules: defaultRules }),
  updateReferences: (refs) => set((state) => ({ references: refs, doc: state.doc ? { ...state.doc, referencias: refs } : state.doc })),
  addReference: (ref) => set((state) => {
    const nextRefs = [...state.references, ref];
    return { references: nextRefs, doc: state.doc ? { ...state.doc, referencias: nextRefs } : state.doc };
  }),
  addReferencia: (ref) => get().addReference(ref),
  removeReference: (id) => set((state) => {
    const nextRefs = state.references.filter((r) => r.id !== id);
    return { references: nextRefs, doc: state.doc ? { ...state.doc, referencias: nextRefs } : state.doc };
  }),
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
        get().showToast('Referencia agregada desde DOI', 'success');
      } else {
        get().showToast(`No se pudo resolver el DOI (error ${res.status})`, 'error');
      }
    } catch (e) {
      console.error('Error resolving DOI:', e);
      get().showToast(e instanceof Error ? e.message : 'Error al resolver el DOI', 'error');
    } finally {
      set({ isLoading: false });
    }
  },
  resolveGhostCitation: async (authors: string[], year: string) => {
    // NOTA: sin isLoading global — el overlay fullscreen de carga tapaba toda
    // la UI (parecía "volver al menú de carga"). El panel ya muestra su propio
    // spinner por ítem (ReferencesPanel.resolving).
    try {
      const result = await api.resolveGhostCitation(authors, year);
      if (result.found && result.candidates && result.candidates.length > 0) {
        // Auto-agregar el primer candidato (relevance=high) o todos para que el usuario elija
        const ref = result.candidates[0];
        const newRef = {
          id: `ghost-${Date.now()}`,
          authors: ref.authors,
          year: ref.year,
          title: ref.title,
          source: ref.source,
          doi_or_url: ref.doi || '',
          raw_text: ref.formatted_apa,
          formatted_apa: ref.formatted_apa,
        };
        get().addReference(newRef);
        const extra = result.candidates.length > 1 ? ` (${result.candidates.length} resultados, se agregó el mejor match)` : '';
        get().showToast(`Referencia encontrada: ${safeRefText(ref) || 'candidato'}${extra}`, 'success');
        get().runCitationAudit();
        return { ...newRef, candidates: result.candidates };
      }
      get().showToast(`No se encontró referencia para "${authors.join(' ')} (${year})" en Crossref`, 'warning');
      return null;
    } catch (err: any) {
      get().showToast(err.message || 'Error al buscar referencia', 'error');
      return null;
    }
  },
  exportDocx: async (tracked = false) => {
    const { doc, rules, portada, references, sessionScopes } = get();
    if (!doc) return;
    set({ isLoading: true });
    try {
      const base = getApiBase();
      // Alcances activos → aplicar SOLO eso sobre el original (garantía).
      if (!tracked && sessionScopes.length > 0) {
        try {
          await api.scopedApply(doc.session_id, sessionScopes);
          triggerDownload(`${base}/download-scoped/${doc.session_id}`, `Scoped_${doc.file_name}`);
          set({ hasUnsavedChanges: false, exportSuccessAt: Date.now() });
          get().showToast('Exportado con los alcances elegidos', 'success');
          return;
        } catch (e: any) {
          get().showToast(`Alcances fallaron, exportando completo: ${e.message}`, 'warning');
        }
      }
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
      triggerDownload(downloadUrl, data.filename || `APA7_${doc.file_name}`);
      set({ hasUnsavedChanges: false, exportSuccessAt: Date.now() });
    } catch (err: any) {
      set({ error: err.message || 'Error al exportar documento', isLoading: false });
      get().showToast(err.message || 'Error al descargar DOCX', 'error');
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
      if (data.status === 'fallback_docx' && data.download_url) {
        // El backend no pudo generar el PDF: avisa en vez de entregar un DOCX como si nada.
        get().showToast('El PDF no pudo generarse en este equipo; se descargó el DOCX oficial.', 'error');
      }
      if (data.download_url) {
        const downloadUrl = data.download_url.startsWith('http')
          ? data.download_url
          : `${base}${data.download_url.startsWith('/api') ? data.download_url : data.download_url}`;
        triggerDownload(downloadUrl, data.pdf_name || (doc.file_name?.replace(/\.[^.]+$/, '') + '.pdf'));
        set({ hasUnsavedChanges: false, exportSuccessAt: Date.now() });
      }
    } catch (err: any) {
      set({ error: err.message || 'Error al exportar PDF', isLoading: false });
      get().showToast(err.message || 'Error al descargar PDF', 'error');
    } finally {
      set({ isLoading: false });
    }
  },
});

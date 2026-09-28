import { StateCreator } from 'zustand';
import { DocState } from '../types';
import { DocumentModel } from '../../types';
import type { PestanaId } from '../../components/settings/tabs';

let mascotTimer: ReturnType<typeof setTimeout> | null = null;

export const createUISlice: StateCreator<DocState, [], [], Partial<DocState>> = (set, get) => ({
  isLoading: false,
  exportSuccessAt: null,
  isBackendReady: false,
  retryBackend: () => set((state) => ({ backendCheckNonce: state.backendCheckNonce + 1 })),
  backendCheckNonce: 0,
  zoomLevel: 100,
  setZoomLevel: (zoom) => set({ zoomLevel: Math.min(300, Math.max(50, zoom)) }),
  // El rail de iconos es de 56px fijos. Su detalle se abre en un flyout al
  // hover, no estirando la columna, así que ya no hay ancho que ajustar.
  railPinned: false,
  setRailPinned: (pinned) => set({ railPinned: pinned }),
  nimLogs: [],
  isNIMDiagnosticsOpen: false,
  setIsNIMDiagnosticsOpen: (open) => set({ isNIMDiagnosticsOpen: open }),
  toastMessage: null,
  toasts: [],
  showToast: (message, type = 'info', action) => {
    const DURATIONS: Record<string, number> = { info: 4000, success: 5000, warning: 6000, error: 8000 };
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    set((state) => ({
      toastMessage: message,
      toasts: [...state.toasts.slice(-2), { id, message, type, action }],
      // NOTA (Layer 4, ruido): los toasts NO se empujan al feed de actividad.
      // El panel de trabajo solo muestra eventos útiles (clasificación,
      // validación, revisiones), no mensajes sociales ni de sistema.
    }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      set((state) => ({ toastMessage: state.toasts.length > 0 ? state.toasts[state.toasts.length - 1].message : null }));
    }, DURATIONS[type]);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  rightPanelTab: 'inspector',
  setRightPanelTab: (tab) => set((state) => ({
    rightPanelTab: tab,
    // Abrir la pestaña Actividad marca todos los eventos como vistos
    activityUnseen: tab === 'activity' ? 0 : state.activityUnseen,
  })),
  activityUnseen: 0,
  activityEvents: [],
  pushActivityEvent: (kind, title, detail) => set((state) => {
    const first = state.activityEvents[0];
    if (first && first.title === title && Date.now() - first.time < 5000) {
      const updated = [{ ...first, kind, detail: detail || first.detail, time: Date.now() }, ...state.activityEvents.slice(1)];
      return { activityEvents: updated };
    }
    return {
      activityEvents: [
        {
          id: `act_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          kind,
          title,
          detail,
          time: Date.now(),
        },
        ...state.activityEvents,
      ].slice(0, 60),
      activityUnseen: state.activityUnseen + 1,
    };
  }),
  lastRequestId: null,
  setLastRequestId: (id) => set({ lastRequestId: id }),
  wizardStep: 1,
  setWizardStep: (step) => set({ wizardStep: Math.min(6, Math.max(1, step)), viewMode: step === 6 ? 'export' : 'edit' }),
  structureTab: 'headings',
  setStructureTab: (tab) => set({ structureTab: tab }),
  showFileMenu: false,
  setShowFileMenu: (show) => set({ showFileMenu: show }),
  /* El hub de Ajustes: una sola pantalla con cinco pestañas, alcanzable desde
     cualquier lado. La pestaña vive acá, no en el componente, para que las siete
     entradas que lo abren compartan el mismo estado. `setSettingsStudioOpen` de
     arriba es el menú viejo: no se borra hasta la Fase 7, porque `App.tsx` y
     `Step0QuickStart.tsx` todavía lo leen. */
  settingsHubOpen: false,
  settingsHubTab: 'documento',
  setSettingsHubOpen: (open: boolean, tab?: PestanaId) => set({ settingsHubOpen: open, settingsHubTab: tab || 'documento' }),
  setSettingsHubTab: (tab: PestanaId) => set({ settingsHubTab: tab }),
  settingsStudioOpen: false,
  settingsStudioTab: 'format',
  setSettingsStudioOpen: (open: boolean, tab?: 'format' | 'ai' | 'privacy' | 'about' | 'addin') => set({ settingsStudioOpen: open, settingsStudioTab: tab || (open ? 'format' : 'format') }),
  isDownloadModalOpen: false,
  setDownloadModalOpen: (open: boolean) => set((state) => ({
    isDownloadModalOpen: open,
    // El modo rápido solo bloquea la descarga mientras su modal está abierto;
    // si el usuario lo cierra, vuelve a un flujo normal (edición guiada).
    pendingQuickExport: open ? state.pendingQuickExport : false,
  })),
  pendingQuickExport: false,
  clearQuickExport: () => set({ pendingQuickExport: false }),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  hasSeenTour: false,
  setHasSeenTour: (seen) => set({ hasSeenTour: seen }),
  viewMode: 'edit',
  setViewMode: (mode) => set({ viewMode: mode }),
  forceRightPanelOpen: false,
  setForceRightPanelOpen: (open: boolean) => set({ forceRightPanelOpen: open }),
  mascotMessage: null,
  sayMascot: (text, tone = 'info') => {
    set({ mascotMessage: { text, tone } });
    if (mascotTimer) clearTimeout(mascotTimer);
    mascotTimer = setTimeout(() => set({ mascotMessage: null }), 7000);
  },
  scrollTargetId: null,
  setScrollTargetId: (id) => set({ scrollTargetId: id }),
  validatorOpen: false,
  setValidatorOpen: (open) => set({ validatorOpen: open }),
  openExportTunnel: () => set({ isDownloadModalOpen: false, viewMode: 'export', forceRightPanelOpen: false }),
  /* Resaltado de citas APA: UN interruptor para los DOS canales que muestran el
     hallazgo (el lienzo y la tarjeta de lectura). Antes cada canal decidía por
     su cuenta --el lienzo con estado local, la tarjeta con `true` fijo-- y
     apagar uno dejaba al otro subrayando citas: un defecto, dos verdades. El
     dueño es el store porque los dos canales viven en vistas distintas.

     SIN SETTER a propósito: hoy no hay ningún control que lo apague (el
     `setShowCitationMarks` local que tenía el lienzo tampoco lo tenía), y una
     API de escritura en el store es más superficie que un `useState` muerto.
     Cuando exista el control, escribe acá con `set({ showCitationMarks })` y
     los dos canales la siguen solos. */
  showCitationMarks: true,
  dismissedCommentIds: [],
  dismissComment: (id) => set((state) => ({
    dismissedCommentIds: state.dismissedCommentIds.includes(id) ? state.dismissedCommentIds : [...state.dismissedCommentIds, id],
  })),
  restoreComment: (id) => set((state) => ({ dismissedCommentIds: state.dismissedCommentIds.filter((x) => x !== id) })),
  imagePanelOpen: false,
  setImagePanelOpen: (open: boolean) => set({ imagePanelOpen: open }),
  tabs: [],
  activeTabIndex: 0,
  tabDocs: {},
  switchToTab: (index) => set((state) => {
    if (index < 0 || index >= state.tabs.length) return {};
    const tab = state.tabs[index];
    const tabDoc = state.tabDocs[tab.session_id];
    if (tabDoc) {
      // Cambio de documento activo → la verdad COM (cortes/eco/D-a) no aplica.
      const docChanged = state.doc?.session_id !== tabDoc.session_id;
      return {
        activeTabIndex: index, doc: tabDoc, references: tabDoc.referencias || [], atHome: false, selectedElementId: null, selectedReferenceId: null, scrollTargetId: null,
        ...(docChanged ? { layoutCuts: null, layoutEcho: 0, wordLayoutUnavailable: false } : {}),
      };
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
    // Cambio de documento activo → la verdad COM (cortes/eco/D-a) no aplica.
    const docChanged = (state.doc?.session_id ?? null) !== (newDoc?.session_id ?? null);
    return {
      tabs: newTabs,
      tabDocs: newTabDocs,
      activeTabIndex: Math.max(0, newIndex),
      doc: newDoc,
      atHome: newDoc ? false : state.atHome,
      selectedElementId: null,
      selectedReferenceId: null,
      scrollTargetId: null,
      ...(docChanged ? { layoutCuts: null, layoutEcho: 0, wordLayoutUnavailable: false } : {}),
    };
  }),
  projectImages: [],
  addProjectImage: (file: File) => {
    const url = URL.createObjectURL(file);
    const item = { id: `pimg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: file.name, url, file };
    set((state) => ({ projectImages: [...state.projectImages, item] }));
  },
  removeProjectImage: (id: string) => {
    set((state) => ({ projectImages: state.projectImages.filter((img) => img.id !== id) }));
  },
  mergeDocuments: (targetSessionId: string, sourceSessionId: string, parts: ('cover' | 'body' | 'references')[]) => {
    set((state) => {
      const targetDoc = state.tabDocs[targetSessionId];
      const sourceDoc = state.tabDocs[sourceSessionId];
      if (!targetDoc || !sourceDoc) return {};

      let mergedElements = [...targetDoc.elements];
      const mergedReferences = [...(targetDoc.referencias || [])];

      // 1. Fusionar Portada (si se solicita, reemplaza los bloques de portada de destino por los de origen)
      if (parts.includes('cover')) {
        const sourceCoverElements = sourceDoc.elements.filter((e) => e.is_cover_section || e.type === 'portada_block');
        const targetBodyElements = mergedElements.filter((e) => !e.is_cover_section && e.type !== 'portada_block');
        mergedElements = [...sourceCoverElements, ...targetBodyElements];
      }

      // 2. Fusionar Cuerpo (si se solicita, añade los elementos del cuerpo de origen tras el cuerpo de destino)
      if (parts.includes('body')) {
        const sourceBodyElements = sourceDoc.elements.filter((e) => !e.is_cover_section && e.type !== 'portada_block');
        mergedElements = [...mergedElements, ...sourceBodyElements];
      }

      // 3. Fusionar Referencias (deduplicadas por texto)
      if (parts.includes('references')) {
        const sourceRefs = sourceDoc.referencias || [];
        const existingTexts = new Set(mergedReferences.map((r) => (r.raw_text || r.title || '').toLowerCase().trim()));
        for (const sRef of sourceRefs) {
          const refKey = (sRef.raw_text || sRef.title || '').toLowerCase().trim();
          if (refKey && !existingTexts.has(refKey)) {
            mergedReferences.push(sRef);
            existingTexts.add(refKey);
          }
        }
      }

      const updatedDoc: DocumentModel = {
        ...targetDoc,
        elements: mergedElements,
        referencias: mergedReferences,
      };

      const updatedTabDocs = {
        ...state.tabDocs,
        [targetSessionId]: updatedDoc,
      };

      return {
        tabDocs: updatedTabDocs,
        doc: state.doc?.session_id === targetSessionId ? updatedDoc : state.doc,
        references: state.doc?.session_id === targetSessionId ? mergedReferences : state.references,
        hasUnsavedChanges: true,
      };
    });
  },
  atHome: true,
  goHome: () => set({ atHome: true }),
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
  focusMode: false,
  setFocusMode: (f) => set({ focusMode: f }),
  actionToast: null,
  triggerActionToast: (message) => set({ actionToast: { message, timestamp: Date.now() } }),
  clearActionToast: () => set({ actionToast: null }),
  aiStudioOpen: false,
  setAiStudioOpen: (open) => set({ aiStudioOpen: open }),
  liveChatOpen: true,
  setLiveChatOpen: (open) => set({ liveChatOpen: open }),
  stressTestModalOpen: false,
  setStressTestModalOpen: (open) => set({ stressTestModalOpen: open }),
  auditorMode: false,
  setAuditorMode: (open) => set({ auditorMode: open }),
});

/* WordAPA7 — Full Desktop Application Assembly (Fluent Design with Guided Wizard Flow) */

import React, { useState, useEffect } from 'react';
import { useDocStore, migrateDocument } from './store/useDocStore';
import { needsReview } from './lib/portadaAuthors';
import { UnifiedToolbar } from './components/toolbar/UnifiedToolbar';
import { ProjectTabs } from './components/layout/ProjectTabs';
import { FileMenu } from './components/layout/FileMenu';
import { TemplateDialog } from './components/shared/TemplateDialog';
import { ElementInspector } from './components/inspector/ElementInspector';
import { PDFPreview } from './components/layout/PDFPreview';
import { ReactPDFPreview } from './components/layout/ReactPDFPreview';
import { StatusBar } from './components/layout/StatusBar';
import { Step0QuickStart } from './components/wizard/Step0QuickStart';
import { SettingsPreviewStudio } from './components/settings/SettingsPreviewStudio';
import { DownloadModal } from './components/wizard/DownloadModal';
import { DocumentMascot, getMascotExpression } from './components/layout/DocumentMascot';
import { LoadingTips } from './components/layout/LoadingTips';
import { DownloadSuccessOverlay } from './components/layout/DownloadSuccessOverlay';
import { CommandPalette } from './components/CommandPalette';

// Guided Wizard Components
import { Step1PortadaWizard } from './components/wizard/Step1PortadaWizard';
import { Step2HeadingsWizard } from './components/wizard/Step2HeadingsWizard';
import { Step3FiguresTablesWizard } from './components/wizard/Step3FiguresTablesWizard';
import { Step5BodyWizard } from './components/wizard/Step5BodyWizard';
import { Step5ReferencesWizard } from './components/wizard/Step5ReferencesWizard';

import { LLMProgressPanel } from './components/shared/LLMProgressPanel';
import { LLMConsentDialog } from './components/shared/LLMConsentDialog';
import { ResizablePanel } from './components/shared/ResizablePanel';
import { Toast } from './components/shared/Toast';
import { OnboardingTour } from './components/shared/OnboardingTour';
import * as api from './api/backend';
import { AIBatteryIndicator } from './components/AIBatteryIndicator';
import { ReviewPanel } from './components/reviewer/ReviewPanel';
import { ContentReviewPanel } from './components/reviewer/ContentReviewPanel';
import { AIStudioPanel } from './components/shared/AIStudioPanel';
import { DesignAuditor } from './components/auditor/DesignAuditor';
import { syncAllProviderKeys } from './api/backend';

const pendingCountForPhase = (phaseId: number) => {
  const doc = useDocStore.getState().doc;
  if (!doc) return 0;
  if (phaseId === 2) {
    return doc.elements.filter((e) => e.type === 'heading' && needsReview(e as any)).length;
  }
  if (phaseId === 3) {
    const figures = doc.elements.filter((e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0 && !(e.image_info as any).render_error && needsReview(e as any)).length;
    const tables = doc.elements.filter((e) => e.type === 'table' && e.table_info && (e.table_info.table_number || 0) > 0 && needsReview(e as any)).length;
    return figures + tables;
  }
  return 0;
};

export const App: React.FC = () => {
  const {
    doc,
    showFileMenu,
    exportDocx,
    exportPdf,
    undo,
    redo,
    wizardStep,
    setWizardStep,
    llmProgress,
    setIsNIMDiagnosticsOpen,
    viewMode,
    forceRightPanelOpen,
    settingsStudioOpen,
    commandPaletteOpen,
    atHome,
    goHome,
    tabs,
    isReviewOpen,
    isContentReviewOpen,
    aiStudioOpen,
    auditorMode,
    setAuditorMode,
  } = useDocStore();

  const [llmProgressExpanded, setLlmProgressExpanded] = useState(false);

  // Auto-oculta el panel de progreso unos segundos después de completar o fallar,
  // para que no quede cubriendo la sección (el usuario pidió que se empequeñezca/solo)
  useEffect(() => {
    if (llmProgress.status !== 'complete' && llmProgress.status !== 'error') return;
    const t = setTimeout(() => {
      useDocStore.setState({
        llmProgress: {
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
        },
      });
    }, 9000);
    return () => clearTimeout(t);
  }, [llmProgress.status, llmProgress.elements_total]);

  // Session recovery is NOT automatic — user must go to Archivo → Abrir → Sesiones recientes
  // This prevents the app from auto-loading the last document on startup (Word behavior)

  // Saludo de bienvenida según la hora, una sola vez al abrir la app
  useEffect(() => {
    if (sessionStorage.getItem('wordapa7-greeting-shown')) return;
    sessionStorage.setItem('wordapa7-greeting-shown', '1');
    const hour = new Date().getHours();
    const late = hour >= 1 && hour < 5;
    const morning = hour >= 5 && hour < 12;
    const afternoon = hour >= 12 && hour < 20;
    let msg = 'buenas noches';
    if (late) msg = 'buenas noches, vamos a formatear esto';
    else if (morning) msg = 'buenos días';
    else if (afternoon) msg = 'buenas tardes';
    useDocStore.getState().showToast(msg, 'info');
  }, []);

  // Global backend readiness: listen for the IPC event from Electron PythonManager
  // This is the SINGLE source of truth for isBackendReady across the entire app
  useEffect(() => {
    const electronWindow = window as any;
    
    // Always do an initial check just in case we missed the IPC event
    const checkBackend = async () => {
      try {
        const port = electronWindow.electronAPI ? electronWindow.electronAPI.getBackendPort() : 8742;
        const res = await fetch(`http://127.0.0.1:${port}/api/version`);
        if (res.ok) {
          useDocStore.setState({ isBackendReady: true });
          // Sincroniza las claves de IA guardadas (localStorage) con el backend
          // para que "Refinar con IA", "Revisor" y "Generar 3 versiones" funcionen
          // sin tener que abrir antes el panel de Ajustes.
          syncAllProviderKeys().catch(() => {});
        }
      } catch (_) {}
    };

    if (electronWindow.electronAPI?.onPythonReady) {
      // Electron environment: wait for the IPC event, but also check once immediately
      checkBackend();
      
      const cleanup = electronWindow.electronAPI.onPythonReady(() => {
        useDocStore.setState({ isBackendReady: true });
        // El backend se reinició (watchdog) y perdió las claves de os.environ:
        // re-sincronizarlas para que la IA siga funcionando.
        syncAllProviderKeys().catch(() => {});
        useDocStore.getState().showToast('Motor de procesamiento listo', 'success');
      });

      // Watchdog: el backend crasheó o se está reiniciando
      if (electronWindow.electronAPI.onPythonCrashed) {
        electronWindow.electronAPI.onPythonCrashed(() => {
          useDocStore.setState({ isBackendReady: false });
          useDocStore.getState().showToast('El motor falló y no pudo reiniciarse. Reiniciá la app.', 'error');
        });
      }
      if (electronWindow.electronAPI.onPythonRestarting) {
        electronWindow.electronAPI.onPythonRestarting(() => {
          useDocStore.setState({ isBackendReady: false });
          useDocStore.getState().showToast('El motor se está reiniciando…', 'info');
        });
      }

      return () => { if (typeof cleanup === 'function') cleanup(); };
    } else {
      // Web/development mode: poll until backend responds
      let cancelled = false;
      const poll = async () => {
        for (let i = 0; i < 60; i++) {
          if (cancelled) return;
          try {
            const port = electronWindow.electronAPI ? electronWindow.electronAPI.getBackendPort() : 8742;
            const res = await fetch(`http://127.0.0.1:${port}/api/version`);
            if (res.ok) { useDocStore.setState({ isBackendReady: true }); return; }
          } catch (_) {}
          await new Promise(r => setTimeout(r, 1000));
        }
      };
      poll();
      return () => { cancelled = true; };
    }
  }, []);

  // Keyboard shortcuts and Native Menu actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
      if (isInput) return;

      // Escape cierra las UIs superpuestas de mayor a menor prioridad
      if (e.key === 'Escape') {
        const s = useDocStore.getState();
        if (s.isReviewOpen) { s.setReviewOpen(false); return; }
        if (s.isContentReviewOpen) { s.setContentReviewOpen(false); return; }
        if (s.isNIMDiagnosticsOpen) { s.setIsNIMDiagnosticsOpen(false); return; }
        if (s.aiStudioOpen) { s.setAiStudioOpen(false); return; }
        if (s.commandPaletteOpen) { s.setCommandPaletteOpen(false); return; }
        if (s.showFileMenu) { s.setShowFileMenu(false); return; }
        if (s.isDownloadModalOpen) { s.setDownloadModalOpen(false); return; }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey && (e.key === ']' || e.key === '}')) {
          e.preventDefault();
          if (!doc) return;
          const step = useDocStore.getState().wizardStep;
          if (step < 5) useDocStore.getState().setWizardStep(step + 1);
          return;
        }
        if (e.shiftKey && (e.key === '[' || e.key === '{')) {
          e.preventDefault();
          if (!doc) return;
          const step = useDocStore.getState().wizardStep;
          if (step > 1) useDocStore.getState().setWizardStep(step - 1);
          return;
        }

        switch (e.key.toLowerCase()) {
          case 'enter': {
            e.preventDefault();
            if (!doc) break;
            const step = useDocStore.getState().wizardStep;
            const nextWithPending = [1, 2, 3, 4, 5].find(s => s > step && pendingCountForPhase(s) > 0);
            if (nextWithPending) {
              useDocStore.getState().setWizardStep(nextWithPending);
            } else if (step < 5) {
              useDocStore.getState().setWizardStep(step + 1);
            }
            break;
          }
          case 's':
            e.preventDefault();
            if (doc) {
              if (e.shiftKey) exportPdf();
              else exportDocx(false);
            }
            break;
          case 'z':
            e.preventDefault();
            if (!e.shiftKey) undo();
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          case 'k':
            e.preventDefault();
            useDocStore.setState({ commandPaletteOpen: true });
            break;
          case '1': case '2': case '3': case '4': case '5':
            e.preventDefault();
            if (doc) {
              useDocStore.getState().setWizardStep(parseInt(e.key));
            }
            break;
          case '6':
            e.preventDefault();
            if (doc) {
              useDocStore.getState().setDownloadModalOpen(true);
            }
            break;
          default:
            break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Listen to native OS menu clicks from Electron
    let removeMenuListener = () => {};
    const electronWindow = window as any;
    if (electronWindow.electronAPI && electronWindow.electronAPI.onMenuAction) {
      removeMenuListener = electronWindow.electronAPI.onMenuAction((_event: any, action: string) => {
        if (action === 'trigger-export') {
           useDocStore.getState().exportDocx(false);
        } else if (action === 'trigger-upload' || action === 'wordapa7-start-blank' || action === 'trigger-preferences' || action === 'wordapa7-start-template') {
           window.dispatchEvent(new CustomEvent(action));
        }
      });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [doc, exportDocx, exportPdf, undo, redo]);

  // Native menu events dispatched by the Electron handler above
  // (trigger-upload, wordapa7-start-blank, trigger-preferences, wordapa7-start-template)
  useEffect(() => {
    const listeners: Array<[string, () => void]> = [
      ['trigger-upload', () => useDocStore.getState().setShowFileMenu(true)],
      ['wordapa7-start-blank', () => { useDocStore.getState().startBlankDocument(); }],
      ['trigger-preferences', () => useDocStore.getState().setSettingsStudioOpen(true)],
      ['wordapa7-start-template', () => useDocStore.getState().setShowTemplateDialog(true)],
    ];
    const cleanups = listeners.map(([action, handler]) => {
      const fn = () => handler();
      window.addEventListener(action, fn);
      return () => window.removeEventListener(action, fn);
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  // Settings Studio (previsualizador de ajustes) — full screen override
  if (settingsStudioOpen) {
    return (
      <>
        <SettingsPreviewStudio
          onClose={() => useDocStore.setState({ settingsStudioOpen: false })}
        />
        <LoadingTips />
        <Toast />
      </>
    );
  }

  // Quick Start screen — show when no doc OR when the user returned "home"
  // (like Word's backstage). Open tabs remain accessible via ProjectTabs.
  if (!doc || atHome) {
    return (
      <>
        {tabs.length > 0 && (
          <div style={{ position: 'sticky', top: 0, zIndex: 15 }}>
            <ProjectTabs />
          </div>
        )}
        <Step0QuickStart />
        {/* LoadingTips debe vivir en TODAS las ramas para que se vea al importar */}
        <LoadingTips />
        {isReviewOpen && <ReviewPanel />}
        {aiStudioOpen && <AIStudioPanel />}
        <ContentReviewPanel />
        <DesignAuditor open={auditorMode} onClose={() => setAuditorMode(false)} />
        <Toast />
      </>
    );
  }

  // File menu
  if (showFileMenu) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', borderRadius: '0', backgroundColor: 'var(--app-bg)' }}>
          <FileMenu />
          <StatusBar />
        </div>
        <LoadingTips />
        <Toast />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', borderRadius: '0', overflow: 'hidden', backgroundColor: 'var(--app-bg)', position: 'relative' }}>
      <UnifiedToolbar />
      <ProjectTabs />
      
      <div className="app-main" style={{ flex: 1, overflow: 'hidden', display: 'flex', backgroundColor: 'var(--app-bg)', minWidth: 0 }}>
        {viewMode === 'result' ? (
          <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--canvas-bg)' }}>
             <PDFPreview />
          </div>
        ) : viewMode === 'native-pdf' ? (
          <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--canvas-bg)' }}>
             <ReactPDFPreview />
          </div>
        ) : viewMode === 'split' ? (
          <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', minWidth: 0 }}>
            {/* Editor Side */}
            <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', minWidth: 0 }}>
              <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', minWidth: 0 }} className="wizard-step-enter" key={`split-${wizardStep}`}>
                {wizardStep === 0 && <SettingsPreviewStudio onContinue={() => useDocStore.getState().setWizardStep(1)} />}
                {wizardStep === 1 && <Step1PortadaWizard />}
                {wizardStep === 2 && <Step2HeadingsWizard />}
                {wizardStep === 3 && <Step3FiguresTablesWizard />}
                {wizardStep === 4 && <Step5BodyWizard />}
                {wizardStep === 5 && <Step5ReferencesWizard />}
              </div>
            </div>
            {/* Preview Side */}
            <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--canvas-bg)', borderLeft: '2px solid var(--border-subtle)' }}>
              <ReactPDFPreview />
            </div>
          </div>
        ) : (
          <>
            {/* Renderizado Guiado según el Paso Actual del Asistente */}
            <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', minHeight: 0, minWidth: 0 }} className="wizard-step-enter" key={`step-${wizardStep}`}>
              {wizardStep === 0 && <SettingsPreviewStudio onContinue={() => useDocStore.getState().setWizardStep(1)} />}
              {wizardStep === 1 && <Step1PortadaWizard />}
              {wizardStep === 2 && <Step2HeadingsWizard />}
              {wizardStep === 3 && <Step3FiguresTablesWizard />}
              {wizardStep === 4 && <Step5BodyWizard />}
              {wizardStep === 5 && <Step5ReferencesWizard />}
            </div>

            {/* Panel Derecho: solo visible cuando el usuario lo activa manualmente */}
            {forceRightPanelOpen && (
              <ResizablePanel side="right" defaultWidth={320} minWidth={250} maxWidth={600} localStorageKey="wordapa7-inspector-width">
                <div className="inspector-pane" style={{
                  flexShrink: 0, display: 'flex', flexDirection: 'column',
                  height: '100%', overflow: 'hidden',
                  background: 'var(--sidebar-bg)', borderLeft: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <ElementInspector />
                  </div>
                </div>
              </ResizablePanel>
            )}
          </>
        )}
      </div>

      {/* LLM Progress Panel — shows during/after classification */}
      {(llmProgress.status === 'processing' ||
        llmProgress.status === 'complete' ||
        llmProgress.status === 'error') && (
        <LLMProgressPanel
          progress={llmProgress}
          isExpanded={llmProgressExpanded}
          onToggle={() => setLlmProgressExpanded(!llmProgressExpanded)}
          onClose={() => useDocStore.setState({ llmProgress: {
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
          }})}
          onOpenDiagnostics={() => setIsNIMDiagnosticsOpen(true)}
        />
      )}

      {/* Template Dialog */}
      <TemplateDialog />

      <OnboardingTour />

      <DownloadModal />

      <LLMConsentDialog />

      {doc && commandPaletteOpen && <CommandPalette />}

      <Toast />

      {/* Mascota fija en la esquina — clickable con burbuja "Tocame" */}
      {doc && (
        <div
          className="doc-mascot-corner"
          onClick={() => {
            const s = useDocStore.getState();
            const ex = getMascotExpression();
            if (ex === 'worried' || ex === 'curious') {
              s.setContentReviewOpen(true);
            } else {
              s.setReviewOpen(true);
            }
          }}
          style={{ cursor: 'pointer' }}
          role="button"
          aria-label="Abrir revisión"
        >
          {(() => {
            const ex = getMascotExpression();
            if (ex === 'worried' || ex === 'curious') {
              return (
                <div className="doc-mascot-bubble">
                  {ex === 'worried' ? '¡Tocame! Hay cosas que revisar' : 'Oye, tocame un segundo'}
                </div>
              );
            }
            return null;
          })()}
          <DocumentMascot size={48} />
          <span className="doc-mascot-label">
            {(() => {
              const ex = getMascotExpression();
              if (ex === 'worried') return 'hay cosas por revisar';
              if (ex === 'curious') return 'con un par de cositas';
              if (ex === 'excited') return 'todo limpio';
              return 'todo tranqui';
            })()}
          </span>
        </div>
      )}

      {/* Pantalla de carga estilo juego (mascota + tips) */}
      <LoadingTips />

      {/* Micro-animación de cierre cuando la descarga termina con éxito */}
      <DownloadSuccessOverlay />

      <StatusBar />
      <AIBatteryIndicator />

      {isReviewOpen && <ReviewPanel />}

      {isContentReviewOpen && <ContentReviewPanel />}

      {aiStudioOpen && <AIStudioPanel />}
        <DesignAuditor open={auditorMode} onClose={() => setAuditorMode(false)} />
    </div>
  );
};

export default App;

/* WordAPA7 — Full Desktop Application Assembly (Fluent Design with Guided Wizard Flow) */

import React, { useState, useEffect } from 'react';
import { useDocStore, migrateDocument } from './store/useDocStore';
import { AppTitlebar } from './components/layout/AppTitlebar';
import { UnifiedToolbar } from './components/toolbar/UnifiedToolbar';
import { ProjectTabs } from './components/layout/ProjectTabs';
import { FileMenu } from './components/layout/FileMenu';
import { DocumentOutlinePane } from './components/layout/DocumentOutlinePane';
import { NavigationOutlinePane } from './components/layout/NavigationOutlinePane';
import { TemplateDialog } from './components/shared/TemplateDialog';
import { PaperCanvas } from './components/layout/PaperCanvas';
import { ElementInspector } from './components/inspector/ElementInspector';
import { PDFPreview } from './components/layout/PDFPreview';
import { ReactPDFPreview } from './components/layout/ReactPDFPreview';
import { StatusBar } from './components/layout/StatusBar';
import { PortadaView } from './components/portada/PortadaView';
import { ReferenciasView } from './components/referencias/ReferenciasView';
import { RulesView } from './components/rules/RulesView';
import { ValidatorView } from './components/validator/ValidatorView';
import { Wizard } from './pages/Wizard';
import { Step0QuickStart } from './components/wizard/Step0QuickStart';
import { CoverDesignerPanel } from './components/wizard/CoverDesignerPanel';

// Guided Wizard Components
import { Step0PreferencesModal } from './components/wizard/Step0PreferencesModal';
import { Step1PortadaWizard } from './components/wizard/Step1PortadaWizard';
import { Step2HeadingsWizard } from './components/wizard/Step2HeadingsWizard';
import { Step3FiguresWizard } from './components/wizard/Step3FiguresWizard';
import { Step4TablesWizard } from './components/wizard/Step4TablesWizard';
import { Step5BodyWizard } from './components/wizard/Step5BodyWizard';
import { Step6ExportWizard } from './components/wizard/Step6ExportWizard';

import { SessionRecoveryDialog } from './components/shared/SessionRecoveryDialog';
import { LLMProgressPanel } from './components/shared/LLMProgressPanel';
import { ResizablePanel } from './components/shared/ResizablePanel';
import { Toast } from './components/shared/Toast';
import { OnboardingTour } from './components/shared/OnboardingTour';
import { Eye, Settings, Sparkles, Palette } from 'lucide-react';
import * as api from './api/backend';
import { AIBatteryIndicator } from './components/AIBatteryIndicator';

export const App: React.FC = () => {
  const {
    doc,
    activeTab,
    showFileMenu,
    wizardComplete,
    recoverySession,
    recoveryDismissed,
    setRecoverySession,
    dismissRecovery,
    exportDocx,
    undo,
    redo,
    wizardStep,
    llmProgress,
    setIsNIMDiagnosticsOpen,
    viewMode,
    forceRightPanelOpen,
  } = useDocStore();

  const [rightPanel, setRightPanel] = useState<'inspector' | 'preview' | 'cover-designer'>('inspector');
  const [llmProgressExpanded, setLlmProgressExpanded] = useState(false);

  // Session recovery is NOT automatic — user must go to Archivo → Abrir → Sesiones recientes
  // This prevents the app from auto-loading the last document on startup (Word behavior)

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
        }
      } catch (_) {}
    };

    if (electronWindow.electronAPI?.onPythonReady) {
      // Electron environment: wait for the IPC event, but also check once immediately
      checkBackend();
      
      const cleanup = electronWindow.electronAPI.onPythonReady(() => {
        useDocStore.setState({ isBackendReady: true });
      });
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

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            if (doc) exportDocx(false);
            break;
          case 'z':
            e.preventDefault();
            if (!e.shiftKey) undo();
            break;
          case 'y':
            e.preventDefault();
            redo();
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
  }, [doc, exportDocx, undo, redo]);

  // Handle session recovery
  const handleRecoverSession = async (sessionId: string) => {
    try {
      let recovered = await api.recoverSession(sessionId);
      recovered = migrateDocument(recovered);
      dismissRecovery();
      useDocStore.setState({ doc: recovered, wizardComplete: true, wizardStep: 1 });
    } catch {
      dismissRecovery();
    }
  };

  const handleStartFresh = () => {
    dismissRecovery();
  };

  // Welcome / Quick Start screen — always show when no doc is loaded
  if (!doc) {
    return <Step0QuickStart />;
  }

  // File menu
  if (showFileMenu) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', borderRadius: '0', backgroundColor: 'var(--app-bg)' }}>
        <FileMenu />
        <StatusBar />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', borderRadius: '0', overflow: 'hidden', backgroundColor: 'var(--app-bg)', position: 'relative' }}>
      <AppTitlebar />
      <UnifiedToolbar />
      <ProjectTabs />
      
      <div className="app-main" style={{ flex: 1, overflow: 'hidden', display: 'flex', backgroundColor: 'var(--app-bg)' }}>
        {viewMode === 'result' ? (
          <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--canvas-bg)' }}>
             <PDFPreview />
          </div>
        ) : viewMode === 'native-pdf' ? (
          <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--canvas-bg)' }}>
             <ReactPDFPreview />
          </div>
        ) : viewMode === 'split' ? (
          <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Editor Side */}
            <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
              <ResizablePanel side="left" defaultWidth={240} minWidth={140} maxWidth={400} localStorageKey="wordapa7-nav-width">
                <NavigationOutlinePane />
              </ResizablePanel>
              <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
                {wizardStep === 0 && <Step0PreferencesModal />}
                {wizardStep === 1 && <Step1PortadaWizard />}
                {wizardStep === 2 && <Step2HeadingsWizard />}
                {wizardStep === 3 && <Step3FiguresWizard />}
                {wizardStep === 4 && <Step4TablesWizard />}
                {wizardStep === 5 && <Step5BodyWizard />}
                {wizardStep === 6 && <Step6ExportWizard />}
              </div>
            </div>
            {/* Preview Side */}
            <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--canvas-bg)', borderLeft: '2px solid var(--border-subtle)' }}>
              <ReactPDFPreview />
            </div>
          </div>
        ) : (
          <>
            {/* Panel de navegación jerárquico (reemplaza al DocumentOutlinePane) */}
            <ResizablePanel side="left" defaultWidth={240} minWidth={140} maxWidth={400} localStorageKey="wordapa7-nav-width">
              <NavigationOutlinePane />
            </ResizablePanel>

            {/* Renderizado Guiado según el Paso Actual del Asistente */}
            <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
              {wizardStep === 0 && <Step0PreferencesModal />}
              {wizardStep === 1 && <Step1PortadaWizard />}
              {wizardStep === 2 && <Step2HeadingsWizard />}
              {wizardStep === 3 && <Step3FiguresWizard />}
              {wizardStep === 4 && <Step4TablesWizard />}
              {wizardStep === 5 && <Step5BodyWizard />}
              {wizardStep === 6 && <Step6ExportWizard />}
            </div>

            {/* Panel Derecho: Inspector / Preview / Cover Designer (pasos 1 a 5) */}
            {(wizardStep >= 1 && wizardStep <= 5 || forceRightPanelOpen) && (
              <ResizablePanel side="right" defaultWidth={320} minWidth={250} maxWidth={600} localStorageKey="wordapa7-inspector-width">
                <div className="inspector-pane" style={{
                  flexShrink: 0, display: 'flex', flexDirection: 'column',
                  height: '100%', overflow: 'hidden',
                  background: 'var(--sidebar-bg)', borderLeft: '1px solid var(--border-subtle)',
                }}>
                  {(wizardStep >= 1 && wizardStep <= 5 || forceRightPanelOpen) && (
                    <div style={{
                      display: 'flex', borderBottom: '1px solid var(--border-subtle)',
                      flexShrink: 0,
                    }}>
                      <button
                        className={`ribbon-tab${rightPanel === 'inspector' ? ' active' : ''}`}
                        onClick={() => setRightPanel('inspector')}
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        <Settings size={12} style={{ marginRight: '4px' }} />
                        Inspector
                      </button>
                      <button
                        className={`ribbon-tab${rightPanel === 'preview' ? ' active' : ''}`}
                        onClick={() => setRightPanel('preview')}
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        <Eye size={12} style={{ marginRight: '4px' }} />
                        Vista HTML
                      </button>
                      <button
                        className={`ribbon-tab${rightPanel === 'cover-designer' ? ' active' : ''}`}
                        onClick={() => setRightPanel('cover-designer')}
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        <Palette size={12} style={{ marginRight: '4px' }} />
                        Portadas
                      </button>
                    </div>
                  )}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    {rightPanel === 'inspector' && <ElementInspector />}
                    {rightPanel === 'preview' && <PDFPreview />}
                    {rightPanel === 'cover-designer' && <CoverDesignerPanel />}
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

      <Toast />

      <StatusBar />
      <AIBatteryIndicator />
    </div>
  );
};

export default App;

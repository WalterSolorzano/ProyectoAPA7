/* WordAPA7 — Full Desktop Application Assembly (Fluent Design with Guided Wizard Flow) */

import React, { useState, useEffect } from 'react';
import { useDocStore } from './store/useDocStore';
import { WindowTitlebar } from './components/layout/WindowTitlebar';
import { RibbonToolbar } from './components/layout/RibbonToolbar';
import { ProjectTabs } from './components/layout/ProjectTabs';
import { FileMenu } from './components/layout/FileMenu';
import { DocumentOutlinePane } from './components/layout/DocumentOutlinePane';
import { PaperCanvas } from './components/layout/PaperCanvas';
import { ElementInspector } from './components/inspector/ElementInspector';
import { LivePreview } from './components/layout/LivePreview';
import { StatusBar } from './components/layout/StatusBar';
import { PortadaView } from './components/portada/PortadaView';
import { ReferenciasView } from './components/referencias/ReferenciasView';
import { RulesView } from './components/rules/RulesView';
import { ValidatorView } from './components/validator/ValidatorView';
import { Welcome } from './pages/Welcome';
import { Wizard } from './pages/Wizard';

// Guided Wizard Components
import { GuidedWizardBar } from './components/wizard/GuidedWizardBar';
import { Step0PreferencesModal } from './components/wizard/Step0PreferencesModal';
import { Step1PortadaWizard } from './components/wizard/Step1PortadaWizard';
import { Step2HeadingsWizard } from './components/wizard/Step2HeadingsWizard';
import { Step3FiguresWizard } from './components/wizard/Step3FiguresWizard';
import { Step4TablesWizard } from './components/wizard/Step4TablesWizard';
import { Step5BodyWizard } from './components/wizard/Step5BodyWizard';
import { Step6ExportWizard } from './components/wizard/Step6ExportWizard';

import { SessionRecoveryDialog } from './components/shared/SessionRecoveryDialog';
import { Eye, Settings, Sparkles } from 'lucide-react';
import * as api from './api/backend';

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
  } = useDocStore();

  const [rightPanel, setRightPanel] = useState<'inspector' | 'preview'>('inspector');

  // Check for existing sessions on mount
  useEffect(() => {
    if (!recoveryDismissed && !doc) {
      api.listSessions().then((sessions) => {
        if (sessions.length > 0) {
          setRecoverySession(sessions[0]);
        }
      }).catch(() => {
        // No sessions available
      });
    }
  }, [recoveryDismissed, doc, setRecoverySession]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doc, exportDocx, undo, redo]);

  // Handle session recovery
  const handleRecoverSession = async (sessionId: string) => {
    try {
      const recovered = await api.recoverSession(sessionId);
      dismissRecovery();
      useDocStore.setState({ doc: recovered, wizardComplete: true });
    } catch {
      dismissRecovery();
    }
  };

  const handleStartFresh = () => {
    dismissRecovery();
  };

  // Show session recovery dialog over Wizard or Welcome
  if (recoverySession && !recoveryDismissed && !doc) {
    return (
      <>
        {wizardComplete ? <Welcome /> : <Wizard />}
        <SessionRecoveryDialog
          sessions={[recoverySession]}
          onContinue={handleRecoverSession}
          onStartFresh={handleStartFresh}
          onDismiss={dismissRecovery}
        />
      </>
    );
  }

  // Wizard: First-time setup
  if (!wizardComplete && !doc) {
    return <Wizard />;
  }

  // Welcome / Upload screen
  if (!doc) {
    return <Welcome />;
  }

  // File menu
  if (showFileMenu) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <WindowTitlebar />
        <FileMenu />
        <StatusBar />
      </div>
    );
  }

  // Main guided editor layout
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <WindowTitlebar />
      <RibbonToolbar />
      <ProjectTabs />
      
      {/* Barra de Navegación del Asistente Guiado (Timeline & Progress) */}
      <GuidedWizardBar />

      <div className="app-main" style={{ flex: 1, overflow: 'hidden' }}>
        <DocumentOutlinePane />

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

        {/* Panel Derecho: Inspector de Propiedades y Vista Previa */}
        <div style={{
          width: '320px', minWidth: '320px', maxWidth: '320px',
          flexShrink: 0, display: 'flex', flexDirection: 'column',
          height: '100%', overflow: 'hidden',
          background: 'var(--bg-base)', borderLeft: '1px solid var(--border-subtle)',
        }}>
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
              Vista Previa
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {rightPanel === 'inspector' ? <ElementInspector /> : <LivePreview />}
          </div>
        </div>
      </div>
      <StatusBar />
    </div>
  );
};

export default App;

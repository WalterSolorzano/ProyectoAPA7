/* WordAPA7 — Full Desktop Application Assembly (Fluent Design with Guided Wizard Flow) */

import React, { useState, useEffect, useRef } from 'react';
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
import { ExportView } from './components/export/ExportView';
import { LoadingTips } from './components/layout/LoadingTips';
import { DownloadSuccessOverlay } from './components/layout/DownloadSuccessOverlay';
import { CommandPalette } from './components/CommandPalette';

// Guided Wizard Components
import { Step1PortadaWizard } from './components/wizard/Step1PortadaWizard';
import { Step2HeadingsWizard } from './components/wizard/Step2HeadingsWizard';
import { Step3FiguresTablesWizard } from './components/wizard/Step3FiguresTablesWizard';
import { Step5BodyWizard } from './components/wizard/Step5BodyWizard';
import { Step5ReferencesWizard } from './components/wizard/Step5ReferencesWizard';
import { EditorRail } from './components/wizard/EditorRail';
import { CoverEditorPanel } from './components/wizard/CoverEditorPanel';

import { LLMConsentDialog } from './components/shared/LLMConsentDialog';
import { OnboardingTour } from './components/shared/OnboardingTour';
import * as api from './api/backend';
import { getApiBaseAsync } from './api/http';
import { AIBatteryIndicator } from './components/AIBatteryIndicator';
import { DesignAuditor } from './components/auditor/DesignAuditor';
import { RightSidePanel } from './components/activity/RightSidePanel';
import { MascotBubble } from './components/activity/MascotBubble';
import { syncAllProviderKeys } from './api/backend';

/* ═══ WIZARD STEP MAPPING (refactor UX) ═══
   1. Portada                          — CoverEditorPanel + Step1PortadaWizard (PaperCanvas)
   2. Estructura   (Títulos + Cuerpo)  — Step2HeadingsWizard / Step5BodyWizard
   3. Figuras y tablas                 — Step3FiguresTablesWizard
   4. Referencias                      — Step5ReferencesWizard
   5. Exportar                         — openExportTunnel() (viewMode='export')
*/

const pendingCountForPhase = (phaseId: number) => {
  const doc = useDocStore.getState().doc;
  if (!doc) return 0;

  // Step 1: Portada — verificar si faltan campos requeridos
  if (phaseId === 1) {
    const portada = useDocStore.getState().portada;
    let pending = 0;
    if (!portada.title?.trim()) pending++;
    if (!portada.author?.trim()) pending++;
    return pending;
  }

  // Step 2: Estructura (headings pending review)
  if (phaseId === 2) {
    return doc.elements.filter((e) => e.type === 'heading' && needsReview(e as any)).length;
  }

  // Step 3: Figuras y tablas (figures + tables pending review)
  if (phaseId === 3) {
    const figures = doc.elements.filter((e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0 && !(e.image_info as any).render_error && needsReview(e as any)).length;
    const tables = doc.elements.filter((e) => e.type === 'table' && e.table_info && (e.table_info.table_number || 0) > 0 && needsReview(e as any)).length;
    return figures + tables;
  }

  return 0;
};

/** Toggle bar for step 2 (Estructura): Títulos | Cuerpo */
const StructureTabBar: React.FC<{ tab: 'headings' | 'body'; setTab: (t: 'headings' | 'body') => void }> = ({ tab, setTab }) => (
  <div style={{
    display: 'flex', gap: '2px', padding: '6px 10px',
    borderBottom: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--sidebar-bg)', flexShrink: 0,
  }}>
    {([['headings', 'Títulos'], ['body', 'Cuerpo']] as const).map(([key, label]) => (
      <button
        key={key}
        type="button"
        onClick={() => setTab(key)}
        style={{
          padding: '4px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12px',
          fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
          background: tab === key ? 'var(--color-accent-soft)' : 'transparent',
          color: tab === key ? 'var(--accent-primary)' : 'var(--text-secondary)',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        {label}
      </button>
    ))}
  </div>
);

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
    setIsNIMDiagnosticsOpen,
    viewMode,
    settingsStudioOpen,
    commandPaletteOpen,
    atHome,
    goHome,
    tabs,
    auditorMode,
    setAuditorMode,
    isBackendReady,
  } = useDocStore();

  // Structure sub-tab: Títulos | Cuerpo (step 2 combines both)
  const [structureTab, setStructureTab] = useState<'headings' | 'body'>('headings');

  // ── Context Menu Integration ──────────────────────────────────────────────
  // Cuando el usuario hace click derecho → "Convertir a APA 7" en un .docx,
  // el main process lee el archivo y lo envía acá. Lo guardamos en un ref
  // porque el backend puede no estar listo todavía.
  const pendingOSFile = useRef<{ fileName: string; buffer: Uint8Array } | null>(null);

  const processPendingOSFile = () => {
    const data = pendingOSFile.current;
    if (!data) return;
    pendingOSFile.current = null;

    // Convertir el buffer IPC (Uint8Array) a un ArrayBuffer nativo para File.
    // Es necesario porque TS no acepta Uint8Array<ArrayBufferLike> como BlobPart.
    const ab = new ArrayBuffer(data.buffer.byteLength);
    new Uint8Array(ab).set(data.buffer);
    const file = new File(
      [ab],
      data.fileName,
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    );

    useDocStore.getState().showToast(`Abriendo "${data.fileName}" desde el menú contextual…`, 'info');
    useDocStore.getState().uploadFile(file);
  };

  // Listener IPC: recibe el archivo del main process (context menu)
  useEffect(() => {
    const electronWindow = window as any;
    if (!electronWindow.electronAPI?.onOpenFileFromOS) return;

    const cleanup = electronWindow.electronAPI.onOpenFileFromOS(
      (data: { fileName: string; buffer: Uint8Array }) => {
        pendingOSFile.current = data;
        // Si el backend ya está listo, procesar inmediatamente
        if (useDocStore.getState().isBackendReady) {
          processPendingOSFile();
        }
        // Si no, el useEffect de [isBackendReady] se encargará cuando esté listo
      }
    );
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, []);

  // Cuando el backend se vuelve ready, procesar archivo pendiente del context menu
  useEffect(() => {
    if (isBackendReady && pendingOSFile.current) {
      processPendingOSFile();
    }
  }, [isBackendReady]);

  // Session recovery is NOT automatic — user must go to Archivo → Abrir → Sesiones recientes
  // This prevents the app from auto-loading the last document on startup (Word behavior)

  // Global backend readiness: listen for the IPC event from Electron PythonManager
  // This is the SINGLE source of truth for isBackendReady across the entire app
  const backendCheckNonce = useDocStore((s) => s.backendCheckNonce);
  useEffect(() => {
    const electronWindow = window as any;
    let cancelled = false;

    // Chequeo puntual (retorna true si el motor responde)
    // Prueba HTTPS primero (cuando hay SSL para el Word Add-in) y cae a HTTP.
    const checkBackendOnce = async (): Promise<boolean> => {
      try {
        const apiBase = await getApiBaseAsync();
        const res = await fetch(`${apiBase}/version`);
        if (res.ok) {
          useDocStore.setState({ isBackendReady: true });
          syncAllProviderKeys().catch(() => {});
          useDocStore.getState().fetchProfiles().catch(() => {});
          return true;
        }
      } catch (_) {}
      return false;
    };

    // Polling INFINITO (cada 2s) hasta que el motor responda
    const pollLoop = async () => {
      while (!cancelled) {
        if (await checkBackendOnce()) return;
        await new Promise((r) => setTimeout(r, 2000));
      }
    };

    if (electronWindow.electronAPI?.onPythonReady) {
      const cleanup = electronWindow.electronAPI.onPythonReady(() => {
        useDocStore.setState({ isBackendReady: true });
        syncAllProviderKeys().catch(() => {});
        useDocStore.getState().fetchProfiles().catch(() => {});
        useDocStore.getState().showToast('Motor de procesamiento listo', 'success');
      });

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

      // ── Add-in sideload: notificar cuando el complemento de Word se registre ──
      // PythonManager llama a /api/addin/registry-sideload automáticamente después
      // de que el backend arranca. Si tiene éxito, registra el manifiesto en el
      // registro de Windows (HKCU\...\Wef\Developer\WordAPA7) y Word detecta el
      // complemento al reiniciar.
      let addinCleanup: (() => void) | undefined;
      if (electronWindow.electronAPI.onAddinSideloaded) {
        addinCleanup = electronWindow.electronAPI.onAddinSideloaded((data: { status: string; hint: string }) => {
          if (data.status === 'ok') {
            useDocStore.getState().showToast(
              'Complemento de Word disponible. Reiniciá Word para usarlo.',
              'success'
            );
          }
        });
      }

      pollLoop();
      return () => {
        cancelled = true;
        if (typeof cleanup === 'function') cleanup();
        if (typeof addinCleanup === 'function') addinCleanup();
      };
    } else {
      pollLoop();
      return () => { cancelled = true; };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendCheckNonce]);

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
        if (s.validatorOpen) { s.setValidatorOpen(false); return; }
        if (s.viewMode === 'export') { s.setViewMode('edit'); return; }
        if (s.isNIMDiagnosticsOpen) { s.setIsNIMDiagnosticsOpen(false); return; }
        if (s.commandPaletteOpen) { s.setCommandPaletteOpen(false); return; }
        if (s.showFileMenu) { s.setShowFileMenu(false); return; }
        if (s.isDownloadModalOpen) { s.setDownloadModalOpen(false); return; }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        // Navegación entre pasos del wizard (Ctrl+Shift+[ / ]）
        if (e.shiftKey && (e.key === ']' || e.key === '}')) {
          e.preventDefault();
          if (!doc) return;
          const step = useDocStore.getState().wizardStep;
          if (step < 4) useDocStore.getState().setWizardStep(step + 1);
          else if (step === 4) useDocStore.getState().openExportTunnel();
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
            const nextWithPending = [1, 2, 3, 4].find(s => s > step && pendingCountForPhase(s) > 0);
            if (nextWithPending) {
              useDocStore.getState().setWizardStep(nextWithPending);
            } else if (step < 4) {
              useDocStore.getState().setWizardStep(step + 1);
            } else if (step === 4) {
              useDocStore.getState().openExportTunnel();
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
          // Steps 1-4: wizard navigation
          case '1': case '2': case '3': case '4':
            e.preventDefault();
            if (doc) {
              useDocStore.getState().setWizardStep(parseInt(e.key));
            }
            break;
          // Step 5: Export tunnel
          case '5': case '6':
            e.preventDefault();
            if (doc) {
              useDocStore.getState().openExportTunnel();
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

  // Settings Studio (previsualizador de ajustes) — full screen override.
  // Ahora es OPCIONAL: se abre desde el toolbar ("Ajustes avanzados"), no es
  // parte del flujo obligatorio del wizard. Las reglas APA 7 se aplican por defecto.
  if (settingsStudioOpen) {
    return (
      <>
        <SettingsPreviewStudio
          onClose={() => useDocStore.setState({ settingsStudioOpen: false })}
        />
        <LoadingTips />
      </>
    );
  }

  // File menu (backstage "Archivo")
  if (showFileMenu) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', borderRadius: '0', backgroundColor: 'var(--app-bg)' }}>
          <FileMenu />
          <StatusBar />
        </div>
        <LoadingTips />
      </>
    );
  }

  // Quick Start screen — show when no doc OR when the user returned "home"
  if (!doc || atHome) {
    return (
      <>
        {tabs.length > 0 && (
          <div style={{ position: 'sticky', top: 0, zIndex: 15 }}>
            <ProjectTabs />
          </div>
        )}
        {isBackendReady ? <Step0QuickStart /> : <div style={{ flex: 1 }} />}
        {/* LoadingTips debe vivir en TODAS las ramas para que se vea al importar */}
        <LoadingTips />
        <DesignAuditor open={auditorMode} onClose={() => setAuditorMode(false)} />
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
        ) : viewMode === 'export' ? (
          <ExportView />
        ) : viewMode === 'native-pdf' ? (
          <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--canvas-bg)' }}>
             <ReactPDFPreview />
          </div>
        ) : viewMode === 'split' ? (
          <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', minWidth: 0 }}>
            {/* Editor Side */}
            <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', minWidth: 0, flexDirection: 'column' }}>
              {wizardStep === 2 && <StructureTabBar tab={structureTab} setTab={setStructureTab} />}
              <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', minWidth: 0 }} className="wizard-step-enter" key={`split-${wizardStep}-${structureTab}`}>
                {wizardStep === 1 && <Step1PortadaWizard />}
                {wizardStep === 2 && (structureTab === 'headings' ? <Step2HeadingsWizard /> : <Step5BodyWizard />)}
                {wizardStep === 3 && <Step3FiguresTablesWizard />}
                {wizardStep === 4 && <Step5ReferencesWizard />}
              </div>
            </div>
            {/* Preview Side */}
            <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--canvas-bg)', borderLeft: '2px solid var(--border-subtle)' }}>
              <ReactPDFPreview />
            </div>
          </div>
        ) : wizardStep === 1 ? (
          // Paso 1 (Portada): división del espacio 35% / 65%.
          //   EditorRail (izquierda, nav) | CoverEditorPanel (35%, control)
          //   | PaperCanvas (65%, hoja A4 centrada, flex-grow).
          <div style={{ display: 'flex', flexDirection: 'row', flex: 1, height: '100%', overflow: 'hidden', minWidth: 0 }}>
            <EditorRail />
            <div style={{ width: '35%', minWidth: 340, maxWidth: 560, flexShrink: 0, height: '100%', overflow: 'hidden' }}>
              <CoverEditorPanel />
            </div>
            <div style={{ flex: 1, height: '100%', overflow: 'hidden', minWidth: 0 }} className="wizard-step-enter" key="step-1-canvas">
              <Step1PortadaWizard />
            </div>
          </div>
        ) : (
          <>
            {/* ETAPA 2 — EDITOR UNIFICADO:
                rail lateral izquierdo de secciones + contenido del editor. */}
            <div style={{ display: 'flex', flexDirection: 'row', flex: 1, height: '100%', overflow: 'hidden', minWidth: 0, position: 'relative' }}>
              <EditorRail />
              <div style={{ flex: 1, height: '100%', overflow: 'hidden', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                {wizardStep === 2 && <StructureTabBar tab={structureTab} setTab={setStructureTab} />}
                <div style={{ flex: 1, height: '100%', overflow: 'hidden', minWidth: 0 }} className="wizard-step-enter" key={`step-${wizardStep}-${structureTab}`}>
                  {wizardStep === 2 && (structureTab === 'headings' ? <Step2HeadingsWizard /> : <Step5BodyWizard />)}
                  {wizardStep === 3 && <Step3FiguresTablesWizard />}
                  {wizardStep === 4 && <Step5ReferencesWizard />}
                </div>
              </div>

              {/* Panel Derecho flotante: se monta sobre el canvas sin quitarle espacio */}
              <RightSidePanel />
            </div>
          </>
        )}
      </div>

      {/* Template Dialog */}
      <TemplateDialog />

      {/* Onboarding como tooltips (primera vez) */}
      <OnboardingTour />

      <LLMConsentDialog />

      {doc && commandPaletteOpen && <CommandPalette />}

      {/* Pantalla de carga estilo juego (mascota + tips) */}
      <LoadingTips />

      {/* Micro-animación de cierre cuando la descarga termina con éxito */}
      <DownloadSuccessOverlay />

      <StatusBar />
      <AIBatteryIndicator />

      {/* Mascota con globo de diálogo — hitos importantes, no bloquea */}
      {doc && <MascotBubble />}

      <DesignAuditor open={auditorMode} onClose={() => setAuditorMode(false)} />
    </div>
  );
};

export default App;

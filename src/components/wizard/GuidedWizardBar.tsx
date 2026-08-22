import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { UploadCloud, PenLine, Download, Check } from 'lucide-react';

/* WordAPA7 — Barra de ETAPAS (3, no más), con verbos de ACCIÓN del usuario.
   1. SUBIR  →  2. REVISAR  →  3. DESCARGAR
   Cada etapa que ya se completó muestra un check verde (confianza visual). */

type Stage = 1 | 2 | 3;

const STAGES: { id: Stage; title: string; icon: React.ReactNode; hint: string }[] = [
  { id: 1, title: 'Subir', icon: <UploadCloud size={14} />, hint: 'Subí tu .docx' },
  { id: 2, title: 'Revisar', icon: <PenLine size={14} />, hint: 'Revisá y corregí' },
  { id: 3, title: 'Descargar', icon: <Download size={14} />, hint: 'Exportá el resultado' },
];

export const GuidedWizardBar: React.FC = () => {
  const {
    doc, atHome, goHome, viewMode, setViewMode, openExportTunnel,
    tabs, activeTabIndex, switchToTab, setShowFileMenu, exportSuccessAt,
  } = useDocStore();

  const activeStage: Stage = (!doc || atHome) ? 1 : (viewMode === 'export' ? 3 : 2);

  // Etapas ya completadas: 1 al subir, 2 al revisar, 3 al haber descargado.
  const completedStage = (stage: Stage): boolean => {
    if (stage === 1) return !!doc;
    if (stage === 2) return !!doc && exportSuccessAt != null;
    if (stage === 3) return exportSuccessAt != null;
    return false;
  };

  const goToStage = (stage: Stage) => {
    if (stage === 1) {
      setShowFileMenu(false);
      setViewMode('edit');
      goHome();
      return;
    }
    if (stage === 2) {
      setViewMode('edit');
      if (atHome && tabs.length > 0) {
        switchToTab(activeTabIndex || 0);
      }
      return;
    }
    if (stage === 3 && doc) {
      openExportTunnel();
      return;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        height: '100%',
        overflowX: 'auto',
        scrollbarWidth: 'thin',
      }}
    >
      {STAGES.map((stage, i) => {
        const isActive = stage.id === activeStage;
        const isDone = completedStage(stage.id);
        const disabled = stage.id === 3 && !doc;
        return (
          <React.Fragment key={stage.id}>
            {i > 0 && (
              <span style={{ color: 'var(--border-strong)', margin: '0 2px', fontSize: '11px' }}>›</span>
            )}
            <button
              type="button"
              onClick={() => goToStage(stage.id)}
              disabled={disabled}
              title={`${stage.id}. ${stage.title} — ${stage.hint}`}
              aria-current={isActive ? 'step' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
                padding: '0 12px', cursor: disabled ? 'not-allowed' : 'pointer',
                border: 'none', background: 'transparent',
                height: '100%', whiteSpace: 'nowrap',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontSize: '12px', fontWeight: isActive ? 800 : 600,
                opacity: disabled ? 0.45 : 1,
                borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                transition: 'color 0.15s ease',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px' }}>
                {isDone && !isActive ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'var(--accent-success)', color: '#fff' }}>
                    <Check size={10} strokeWidth={3} />
                  </span>
                ) : (
                  stage.icon
                )}
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, opacity: 0.6, lineHeight: 1 }}>{stage.id}</span>
                <span className="wizard-tab-label">{stage.title}</span>
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default GuidedWizardBar;

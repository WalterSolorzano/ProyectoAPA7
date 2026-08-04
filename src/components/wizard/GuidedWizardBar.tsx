import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { UploadCloud, PenLine, Download, Check } from 'lucide-react';

/* WordAPA7 — Barra de ETAPAS (3, no más).
   1. INICIO / CARGAR  → 2. EDITOR UNIFICADO  → 3. DESCARGA & REPORTE
   Los sub-pasos internos del editor (portada, estructura, figuras, cuerpo,
   referencias) viven DENTRO de la etapa 2, nunca en la barra superior. */

type Stage = 1 | 2 | 3;

const STAGES: { id: Stage; title: string; icon: React.ReactNode; hint: string }[] = [
  { id: 1, title: 'Inicio / Cargar', icon: <UploadCloud size={14} />, hint: 'Subí tu .docx' },
  { id: 2, title: 'Editor unificado', icon: <PenLine size={14} />, hint: 'Revisá y corregí' },
  { id: 3, title: 'Descarga & Reporte', icon: <Download size={14} />, hint: 'Exportá el resultado' },
];

export const GuidedWizardBar: React.FC = () => {
  const {
    doc, atHome, goHome, isDownloadModalOpen, setDownloadModalOpen,
    tabs, activeTabIndex, switchToTab, setShowFileMenu,
  } = useDocStore();

  const activeStage: Stage = (!doc || atHome) ? 1 : (isDownloadModalOpen ? 3 : 2);

  const goToStage = (stage: Stage) => {
    if (stage === 1) {
      setShowFileMenu(false);
      setDownloadModalOpen(false);
      goHome();
      return;
    }
    if (stage === 2) {
      setDownloadModalOpen(false);
      if (atHome && tabs.length > 0) {
        switchToTab(activeTabIndex || 0);
      }
      return;
    }
    if (stage === 3 && doc) {
      setDownloadModalOpen(true);
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
        const disabled = stage.id === 3 && !doc;
        return (
          <React.Fragment key={stage.id}>
            {i > 0 && (
              <Check size={12} style={{ flexShrink: 0, color: 'var(--text-muted)', margin: '0 2px' }} />
            )}
            <button
              type="button"
              onClick={() => goToStage(stage.id)}
              disabled={disabled}
              title={`${stage.title} — ${stage.hint}`}
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
              {stage.icon}
              <span className="wizard-tab-label">{stage.title}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default GuidedWizardBar;

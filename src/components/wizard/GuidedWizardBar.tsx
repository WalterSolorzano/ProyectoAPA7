import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Check } from 'lucide-react';
import { EDITOR_SECTIONS, getStepProgress } from './EditorRail';

/* WordAPA7 — Barra superior de navegación.
   ESPEJA EXACTA del EditorRail izquierdo: mismos 5 pasos, mismos números,
   mismos títulos y mismo progreso. Antes había dos modelos mentales
   incoherentes (3 etapas acá vs 5 pasos en el rail) y el usuario no sabía
   dónde estaba ni a dónde ir.
   1 Portada · 2 Estructura · 3 Figuras y tablas · 4 Referencias · 5 Exportar */

export const GuidedWizardBar: React.FC = () => {
  const {
    doc, viewMode, openExportTunnel, setViewMode, atHome,
    tabs, activeTabIndex, switchToTab,
    setSelectedReferenceId, setSelectedElementId,
    exportSuccessAt,
  } = useDocStore();
  const wizardStep = useDocStore((s) => s.wizardStep);

  // El paso activo en la barra = el mismo que marca el rail.
  const activeStep = viewMode === 'export' ? 5 : wizardStep;

  const goToStep = (id: number) => {
    if (!doc || id === activeStep) return;
    // Misma limpieza de contexto que hace el rail al cambiar de sección.
    setSelectedReferenceId(null);
    setSelectedElementId(null);
    setViewMode('edit');
    if (atHome && tabs.length > 0) {
      switchToTab(activeTabIndex || 0);
    }
    if (id === 5) {
      openExportTunnel();
    } else {
      useDocStore.getState().setWizardStep(id);
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
      {EDITOR_SECTIONS.map((section, i) => {
        const isActive = section.id === activeStep;
        const isDone = section.id === 5
          ? exportSuccessAt != null
          : !!doc && getStepProgress(section.id) >= 1;
        const disabled = !doc;
        const Icon = section.icon;
        return (
          <React.Fragment key={section.id}>
            {i > 0 && (
              <span style={{ color: 'var(--border-strong)', margin: '0 2px', fontSize: '11px' }}>›</span>
            )}
            <button
              type="button"
              onClick={() => goToStep(section.id)}
              disabled={disabled}
              title={`${section.id}. ${section.title} — ${section.hint}`}
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
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px' }}>
                {isDone && !isActive ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'var(--accent-success)', color: '#fff' }}>
                    <Check size={10} strokeWidth={3} />
                  </span>
                ) : (
                  <Icon size={14} />
                )}
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, opacity: 0.6, lineHeight: 1 }}>{section.id}</span>
                <span className="wizard-tab-label">{section.title}</span>
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default GuidedWizardBar;

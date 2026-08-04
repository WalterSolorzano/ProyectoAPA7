import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Layout, Type, Image, AlignLeft, BookOpen, ShieldCheck } from 'lucide-react';
import { needsReview } from '../../lib/portadaAuthors';

export const WIZARD_STEPS = [
  { id: 1, title: 'Portada', icon: Layout, desc: 'Plantilla y metadatos' },
  { id: 2, title: 'Estructura', icon: Type, desc: 'Jerarquía 1, 2, 3' },
  { id: 3, title: 'Figuras y tablas', icon: Image, desc: 'Rotulación APA' },
  { id: 4, title: 'Cuerpo', icon: AlignLeft, desc: 'Sangría y Listas' },
  { id: 5, title: 'Referencias', icon: BookOpen, desc: 'Citas y bibliografía' },
];

const getPendingCount = (stepId: number) => {
  const doc = useDocStore.getState().doc;
  if (!doc) return 0;
  if (stepId === 2) {
    return doc.elements.filter((e) => e.type === 'heading' && needsReview(e as any)).length;
  }
  if (stepId === 3) {
    const figures = doc.elements.filter((e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0 && !(e.image_info as any).render_error && needsReview(e as any)).length;
    const tables = doc.elements.filter((e) => e.type === 'table' && e.table_info && (e.table_info.table_number || 0) > 0 && needsReview(e as any)).length;
    return figures + tables;
  }
  return 0;
};

export const GuidedWizardBar: React.FC = () => {
  const { doc, wizardStep, setWizardStep, runAIReview, isReviewLoading, reviewResult, setForceRightPanelOpen, setRightPanelTab } = useDocStore();

  const openReviewer = () => {
    // Layer 4: el resultado de la revisión IA vive en la pestaña Actividad
    if (!isReviewLoading && !reviewResult) {
      runAIReview();
    }
    setForceRightPanelOpen(true);
    setRightPanelTab('activity');
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '2px', height: '100%',
      overflowX: 'auto', scrollbarWidth: 'thin',
    }}>
      {WIZARD_STEPS.map((step) => {
        const Icon = step.icon;
        const isActive = step.id === wizardStep;
        const pendingCount = getPendingCount(step.id);

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => setWizardStep(step.id)}
            title={`${step.title} — ${step.desc}`}
            aria-current={isActive ? 'page' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
              padding: '0 12px', cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontSize: '12px', fontWeight: isActive ? 600 : 500,
              height: '100%',
              whiteSpace: 'nowrap', transition: 'color 0.15s ease',
            }}
          >
            <Icon size={14} style={{ flexShrink: 0, color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }} />
            <span className="wizard-tab-label">{step.title}</span>
            {pendingCount > 0 && (
              <span style={{
                width: 4, height: 4, borderRadius: '50%',
                backgroundColor: 'var(--color-warning)',
                flexShrink: 0, marginLeft: -2,
              }} />
            )}
          </button>
        );
      })}

      {/* Separador */}
      <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--color-border-subtle)', margin: '0 6px', flexShrink: 0 }} />

      {/* Tab Revisor IA — el resultado se muestra en el panel Actividad */}
      <button
        type="button"
        onClick={openReviewer}
        disabled={!doc || isReviewLoading}
        title="Revisor IA + Ortografía por párrafo (resultado en el panel Actividad)"
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
          padding: '0 12px', cursor: 'pointer',
          border: 'none', background: 'transparent',
          color: 'var(--color-text-primary)', fontSize: '12px', fontWeight: 600,
          height: '100%', whiteSpace: 'nowrap', opacity: doc ? 1 : 0.5,
        }}
      >
        <ShieldCheck size={14} style={{ color: 'var(--color-accent)' }} />
        <span className="wizard-tab-label">Revisor IA</span>
        {reviewResult && reviewResult.flagged_count > 0 && (
          <span style={{
            minWidth: '16px', height: '16px', borderRadius: '999px',
            backgroundColor: reviewResult.flagged_count > 10 ? 'var(--color-danger)' : 'var(--color-warning)',
            color: '#fff', fontSize: '9px', fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>
            {reviewResult.flagged_count}
          </span>
        )}
      </button>
    </div>
  );
};

export default GuidedWizardBar;

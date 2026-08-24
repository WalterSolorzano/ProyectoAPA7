import React from 'react';
import { FileText, ListTree, Image as ImageIcon, AlignLeft, BookOpen, Check } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';

/**
 * StepRail — navegación de pasos como lista vertical a la izquierda.
 * Reemplaza la barra superior de tabs (decisión de producto: la lista
 * lateral es más clara y deja la barra superior solo con acciones globales).
 */

const STEPS = [
  { step: 1, label: 'Portada', Icon: FileText },
  { step: 2, label: 'Estructura', Icon: ListTree },
  { step: 3, label: 'Figuras', Icon: ImageIcon },
  { step: 4, label: 'Referencias', Icon: BookOpen },
] as const;

export function StepRail() {
  const wizardStep = useDocStore((s) => s.wizardStep);
  const setWizardStep = useDocStore((s) => s.setWizardStep);
  const doc = useDocStore((s) => s.doc);
  const coverSetupDone = useDocStore((s) => s.coverSetupDone);

  const elements = doc?.elements || [];
  const pendingHeadings = elements.filter((e) => e.type === 'heading' && e.needs_review).length;
  const pendingFigures = elements.filter(
    (e) => (e.type === 'image' || e.type === 'table') && e.needs_review,
  ).length;
  const hasReferences = (doc?.referencias?.length || 0) > 0;

  const doneByStep: Record<number, boolean> = {
    1: coverSetupDone,
    2: !!doc && pendingHeadings === 0,
    3: !!doc && pendingFigures === 0,
    4: hasReferences,
  };

  const badgeByStep: Record<number, number> = {
    2: pendingHeadings,
    3: pendingFigures,
  };

  return (
    <nav
      aria-label="Pasos del asistente"
      style={{
        width: '200px',
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
        borderRight: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--sidebar-bg)',
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          padding: '4px 10px 8px',
        }}
      >
        Pasos
      </div>
      {STEPS.map(({ step, label, Icon }) => {
        const active = wizardStep === step;
        const done = doneByStep[step];
        const badge = badgeByStep[step] || 0;
        return (
          <button
            key={step}
            type="button"
            onClick={() => setWizardStep(step)}
            title={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              border: active ? '1px solid var(--accent-primary)' : '1px solid transparent',
              background: active ? 'var(--color-accent-soft)' : 'transparent',
              color: active ? 'var(--accent-primary)' : 'var(--text-main)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '12px',
              fontWeight: active ? 700 : 500,
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.background = 'var(--surface-subtle)';
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.background = 'transparent';
            }}
          >
            <Icon size={14} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
            {done ? (
              <Check size={13} color="var(--accent-success)" style={{ flexShrink: 0 }} />
            ) : badge > 0 ? (
              <span
                style={{
                  minWidth: '18px',
                  height: '18px',
                  borderRadius: 999,
                  padding: '0 5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 800,
                  background: 'var(--accent-warning, #b45309)',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                {badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

export default StepRail;

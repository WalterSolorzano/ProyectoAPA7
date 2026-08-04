/* WordAPA7 — Selector compacto de sub-secciones DENTRO del Editor Unificado.
   No es una barra de etapas: son las secciones internas (portada, estructura,
   figuras, cuerpo, referencias) a las que se llega desde la etapa 2. */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Layout, Type, Image, AlignLeft, BookOpen } from 'lucide-react';
import { needsReview } from '../../lib/portadaAuthors';

export const EDITOR_SECTIONS = [
  { id: 1, title: 'Portada', icon: Layout },
  { id: 2, title: 'Estructura', icon: Type },
  { id: 3, title: 'Figuras y tablas', icon: Image },
  { id: 4, title: 'Cuerpo', icon: AlignLeft },
  { id: 5, title: 'Referencias', icon: BookOpen },
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

export const EditorSectionTabs: React.FC = () => {
  const { wizardStep, setWizardStep } = useDocStore();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '2px',
      height: '100%', overflowX: 'auto', scrollbarWidth: 'thin',
    }}>
      {EDITOR_SECTIONS.map((step) => {
        const Icon = step.icon;
        const isActive = step.id === wizardStep;
        const pendingCount = getPendingCount(step.id);
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => setWizardStep(step.id)}
            aria-current={isActive ? 'page' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
              padding: '0 12px', cursor: 'pointer',
              border: 'none', background: 'transparent',
              color: isActive ? 'var(--text-main)' : 'var(--text-secondary)',
              fontSize: '12px', fontWeight: isActive ? 700 : 500,
              height: '100%', whiteSpace: 'nowrap',
              borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
              transition: 'color 0.15s ease',
            }}
          >
            <Icon size={13} style={{ flexShrink: 0, color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
            <span className="wizard-tab-label">{step.title}</span>
            {pendingCount > 0 && (
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                backgroundColor: 'var(--accent-warning)', flexShrink: 0,
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default EditorSectionTabs;

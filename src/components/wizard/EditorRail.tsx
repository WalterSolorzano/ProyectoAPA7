/* WordAPA7 — Rail lateral izquierdo del Editor Unificado.
   Reemplaza la barra horizontal de sub-secciones por una columna estrecha
   de iconos. Cada icono despliega la sección correspondiente y deja el
   documento como protagonista. */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Layout, Type, Image, AlignLeft, BookOpen } from 'lucide-react';
import { needsReview } from '../../lib/portadaAuthors';

export const EDITOR_SECTIONS = [
  { id: 1, title: 'Portada', icon: Layout, hint: 'Metadatos y autores' },
  { id: 2, title: 'Estructura', icon: Type, hint: 'Jerarquía de títulos' },
  { id: 3, title: 'Figuras y tablas', icon: Image, hint: 'Rotulación APA' },
  { id: 4, title: 'Cuerpo', icon: AlignLeft, hint: 'Sangría y listas' },
  { id: 5, title: 'Referencias', icon: BookOpen, hint: 'Citas y bibliografía' },
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

export const EditorRail: React.FC = () => {
  const { wizardStep, setWizardStep, setSelectedReferenceId, setSelectedElementId } = useDocStore();

  const goToSection = (id: number) => {
    // Al cambiar de sección se limpian las selecciones para que el panel
    // derecho cambie de contexto (no queda "estático" mostrando el inspector
    // de una imagen mientras el usuario está en Referencias, por ejemplo).
    setSelectedReferenceId(null);
    setSelectedElementId(null);
    setWizardStep(id);
  };

  return (
    <div
      style={{
        width: '52px', flexShrink: 0,
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: '8px', gap: '2px', overflowY: 'auto',
      }}
    >
      {EDITOR_SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = section.id === wizardStep;
        const pending = getPendingCount(section.id);
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => goToSection(section.id)}
            title={`${section.title} — ${section.hint}`}
            aria-label={section.title}
            aria-current={isActive ? 'page' : undefined}
            style={{
              width: '40px', height: '40px', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', border: 'none', background: 'transparent',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'var(--color-accent-soft)' : 'transparent',
              position: 'relative', flexShrink: 0,
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-subtle)'; }}
            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Icon size={17} />
            {pending > 0 && (
              <span style={{
              position: 'absolute', top: '5px', right: '5px',
              width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: 'var(--accent-warning)',
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default EditorRail;

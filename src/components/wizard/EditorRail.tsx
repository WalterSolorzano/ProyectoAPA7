/* WordAPA7 — Rail lateral izquierdo del Editor Unificado.
   - Íconos con ProgressRing: el anillo se llena conforme se resuelven los
     pendientes de cada etapa (adiós al health-check final que asusta).
   - DocumentOutline: mini-mapa colapsable para navegar documentos largos. */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Layout, Type, Image, AlignLeft, BookOpen, Map } from 'lucide-react';
import { needsReview } from '../../lib/portadaAuthors';
import { ProgressRing } from './ProgressRing';
import { DocumentOutline } from './DocumentOutline';

export const EDITOR_SECTIONS = [
  { id: 1, title: 'Portada', icon: Layout, hint: 'Metadatos y autores' },
  { id: 2, title: 'Estructura', icon: Type, hint: 'Jerarquía de títulos' },
  { id: 3, title: 'Figuras y tablas', icon: Image, hint: 'Rotulación APA' },
  { id: 4, title: 'Cuerpo', icon: AlignLeft, hint: 'Sangría y listas' },
  { id: 5, title: 'Referencias', icon: BookOpen, hint: 'Citas y bibliografía' },
];

const COVER_REQUIRED = ['title', 'author'];

const getStepProgress = (stepId: number): number => {
  const s = useDocStore.getState();
  const doc = s.doc;
  if (!doc) return 0;

  if (stepId === 1) {
    const required = (s.profiles.find((p) => p.profile_id === s.activeProfileId)?.cover_required_fields || COVER_REQUIRED)
      .filter((f) => COVER_REQUIRED.includes(f));
    if (required.length === 0) return 1;
    const filled = required.filter((f) => (s.portada[f as keyof typeof s.portada] || '').toString().trim()).length;
    return filled / required.length;
  }

  if (stepId === 2) {
    const headings = doc.elements.filter((e) => e.type === 'heading' && !e.is_cover_section);
    if (headings.length === 0) return 1;
    const review = headings.filter((e) => needsReview(e as any)).length;
    return (headings.length - review) / headings.length;
  }

  if (stepId === 3) {
    const figures = doc.elements.filter((e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0 && !(e.image_info as any).render_error);
    const tables = doc.elements.filter((e) => e.type === 'table' && e.table_info);
    const total = figures.length + tables.length;
    if (total === 0) return 1;
    const review = figures.filter((e) => needsReview(e as any)).length + tables.filter((e) => needsReview(e as any)).length;
    return (total - review) / total;
  }

  if (stepId === 5) {
    const refs = doc.referencias?.length || 0;
    const issues = (s.citationAuditResult?.ghost_citations?.length || 0) + (s.citationAuditResult?.orphan_references?.length || 0);
    if (refs === 0 && issues === 0) return 0;
    if (refs > 0 && issues === 0) return 1;
    return refs / (refs + issues);
  }

  return 0;
};

export const EditorRail: React.FC = () => {
  const { wizardStep, setWizardStep, setSelectedReferenceId, setSelectedElementId } = useDocStore();
  const [outlineOpen, setOutlineOpen] = useState(false);

  const goToSection = (id: number) => {
    // Al cambiar de sección se limpian las selecciones para que el panel
    // derecho cambie de contexto (no queda "estático" mostrando el inspector
    // de una imagen mientras el usuario está en Referencias, por ejemplo).
    setSelectedReferenceId(null);
    setSelectedElementId(null);
    setWizardStep(id);
  };

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'row', alignItems: 'stretch' }}>
      <div
        style={{
          width: '52px', flexShrink: 0,
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: '8px', gap: '2px', overflowY: 'auto',
          height: '100%',
        }}
      >
        {EDITOR_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = section.id === wizardStep;
          const progress = getStepProgress(section.id);
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
              <ProgressRing progress={progress} size={34} strokeWidth={2.5} style={{ position: 'absolute', inset: 0, margin: 'auto' }} />
              <Icon size={16} style={{ position: 'relative' }} />
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* DocumentOutline toggle */}
        <button
          type="button"
          onClick={() => setOutlineOpen((o) => !o)}
          title={outlineOpen ? 'Ocultar mapa del documento' : 'Mapa del documento (navegación rápida)'}
          aria-label="Mapa del documento"
          aria-expanded={outlineOpen}
          style={{
            width: '40px', height: '40px', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', border: 'none', background: 'transparent',
            color: outlineOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
            marginBottom: '8px', flexShrink: 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-subtle)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          <Map size={16} />
        </button>
      </div>

      {outlineOpen && (
        <div style={{
          position: 'absolute', top: 0, left: 52, bottom: 0,
          width: '210px', zIndex: 30,
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '8px 0 20px rgba(0,0,0,0.15)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
          }}>
            <Map size={13} color="var(--accent-primary)" />
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>Mapa del documento</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <DocumentOutline />
          </div>
        </div>
      )}
    </div>
  );
};

export default EditorRail;

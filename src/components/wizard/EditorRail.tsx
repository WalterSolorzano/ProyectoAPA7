/* WordAPA7 — Rail lateral izquierdo del Editor Unificado.
   - Íconos con ProgressRing: el anillo se llena conforme se resuelven los
     pendientes de cada etapa (adiós al health-check final que asusta).
   - DocumentOutline: ahora se renderiza como panel permanente en el lado
     derecho del layout (ver App.tsx), no como panel flotante aquí.

   ORDEN DE ETAPAS (refactor UX):
   1. Portada
   2. Estructura (Títulos + Cuerpo)
   3. Figuras y tablas
   4. Referencias
   5. Exportar
*/

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Layout, Type, Image, BookOpen, Download, Sparkles } from 'lucide-react';
import { needsReview } from '../../lib/portadaAuthors';
import { ProgressRing } from './ProgressRing';

export const EDITOR_SECTIONS = [
  { id: 1, title: 'Portada', icon: Layout, hint: 'Metadatos de portada' },
  { id: 2, title: 'Estructura', icon: Type, hint: 'Títulos y cuerpo' },
  { id: 3, title: 'Figuras y tablas', icon: Image, hint: 'Rotulación APA' },
  { id: 4, title: 'Referencias', icon: BookOpen, hint: 'Citas y bibliografía' },
  { id: 5, title: 'Exportar', icon: Download, hint: 'Descargar documento final' },
];

const COVER_REQUIRED = ['title', 'author'];

export const getStepProgress = (stepId: number): number => {
  const s = useDocStore.getState();
  const doc = s.doc;
  if (!doc) return 0;

  // Step 5 (Exportar) — no progress ring, always "ready"
  if (stepId === 5) return 1;

  // Step 1 (Portada)
  if (stepId === 1) {
    const required = (s.profiles.find((p) => p.profile_id === s.activeProfileId)?.cover_required_fields || COVER_REQUIRED)
      .filter((f) => COVER_REQUIRED.includes(f));
    if (required.length === 0) return 1;
    const filled = required.filter((f) => (s.portada[f as keyof typeof s.portada] || '').toString().trim()).length;
    return filled / required.length;
  }

  // Step 2 (Estructura) — headings pending
  if (stepId === 2) {
    const headings = doc.elements.filter((e) => e.type === 'heading' && !e.is_cover_section);
    if (headings.length === 0) return 1;
    const review = headings.filter((e) => needsReview(e as any)).length;
    return (headings.length - review) / headings.length;
  }

  // Step 3 (Figuras y tablas)
  if (stepId === 3) {
    const figures = doc.elements.filter((e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0 && !(e.image_info as any).render_error);
    const tables = doc.elements.filter((e) => e.type === 'table' && e.table_info);
    const total = figures.length + tables.length;
    if (total === 0) return 1;
    const review = figures.filter((e) => needsReview(e as any)).length + tables.filter((e) => needsReview(e as any)).length;
    return (total - review) / total;
  }

  // Step 4 (Referencias)
  if (stepId === 4) {
    const refs = doc.referencias?.length || 0;
    const issues = (s.citationAuditResult?.ghost_citations?.length || 0) + (s.citationAuditResult?.orphan_references?.length || 0);
    if (refs === 0 && issues === 0) return 0;
    if (refs > 0 && issues === 0) return 1;
    return refs / (refs + issues);
  }

  return 0;
};

export const EditorRail: React.FC = () => {
  const { wizardStep, setWizardStep, setSelectedReferenceId, setSelectedElementId, forceRightPanelOpen, setForceRightPanelOpen } = useDocStore();

  const goToSection = (id: number) => {
    // Al cambiar de sección se limpian las selecciones para que el panel
    // derecho cambie de contexto (no queda "estático" mostrando el inspector
    // de una imagen mientras el usuario está en Referencias, por ejemplo).
    setSelectedReferenceId(null);
    setSelectedElementId(null);
    if (id === 5) {
      // "Exportar" abre el túnel de exportación (viewMode='export')
      useDocStore.getState().openExportTunnel();
    } else {
      setWizardStep(id);
    }
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

        {/* Asistente IA toggle */}
        <button
          type="button"
          onClick={() => {
            setSelectedReferenceId(null);
            setSelectedElementId(null);
            setForceRightPanelOpen(!forceRightPanelOpen);
          }}
          title={forceRightPanelOpen ? 'Ocultar Asistente IA' : 'Asistente IA (Herramientas de revisión)'}
          aria-label="Asistente IA"
          aria-expanded={forceRightPanelOpen}
          style={{
            width: '40px', height: '40px', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', border: 'none', background: 'transparent',
            color: forceRightPanelOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
            marginBottom: '4px', flexShrink: 0,
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-subtle)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          <Sparkles size={16} />
        </button>
      </div>
    </div>
  );
};

export default EditorRail;

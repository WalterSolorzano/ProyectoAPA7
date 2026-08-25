/* WordAPA7 — Helpers de progreso por etapa.
   D1: el componente EditorRail (columna de 52px con el botón estrella del
   Asistente IA) fue eliminado. El toggle vive ahora en RightSidePanel.
   Este archivo conserva solo los helpers puros usados por la UI:
   EDITOR_SECTIONS y getStepProgress.

   ORDEN DE ETAPAS (refactor UX):
   1. Portada
   2. Estructura (Títulos + Cuerpo)
   3. Figuras y tablas
   4. Referencias
   5. Exportar
*/

import { useDocStore } from '../../store/useDocStore';
import { needsReview } from '../../lib/portadaAuthors';
import { Layout, Type, Image, BookOpen, Download } from 'lucide-react';

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

/* WordAPA7 — shell: estado de cada destino del rail.
   Concentra aquí el cálculo de "listo" y "pendientes" que hoy vivía dentro de
   StepRail, para que el rail de 56px y su flyout no puedan discrepar. */

import { useMemo } from 'react';
import { useDocStore } from '../store/useDocStore';
import { EDITOR_RAIL_ITEMS, type RailDestination, type RailStatus } from '../components/shell/railItems';

export function useRailDestinations(): RailDestination[] {
  const doc = useDocStore((s) => s.doc);
  const coverSetupDone = useDocStore((s) => s.coverSetupDone);
  const proofreadFindings = useDocStore((s) => s.proofreadFindings);
  const citationAuditResult = useDocStore((s) => s.citationAuditResult);

  return useMemo<RailDestination[]>(() => {
    const elements = doc?.elements || [];
    const pendingHeadings = elements.filter((e) => e.type === 'heading' && e.needs_review).length;
    const pendingFigures = elements.filter(
      (e) => (e.type === 'image' || e.type === 'table') && e.needs_review,
    ).length;
    const hasReferences = (doc?.referencias?.length || 0) > 0;
    const ghosts = citationAuditResult?.ghost_citations?.length || 0;
    const pendingAudit = proofreadFindings.length + ghosts;

    const pendingByStep: Record<number, number> = {
      2: pendingHeadings,
      3: pendingFigures,
      5: pendingAudit,
    };
    const doneByStep: Record<number, boolean> = {
      1: coverSetupDone,
      2: !!doc && pendingHeadings === 0,
      3: !!doc && pendingFigures === 0,
      4: hasReferences,
      5: !!doc && pendingAudit === 0,
    };

    return EDITOR_RAIL_ITEMS.map(({ step, label, Icon, showOutline }) => {
      const pending = pendingByStep[step] || 0;
      const status: RailStatus = !doc ? 'idle' : doneByStep[step] ? 'done' : pending > 0 ? 'pending' : 'idle';
      return { id: `step-${step}`, step, label, Icon, status, pending, showOutline };
    });
  }, [doc, coverSetupDone, proofreadFindings, citationAuditResult]);
}

/* WordAPA7 — Conteo de pendientes por fase. Derivado una sola vez desde auditItems.ts.
   Lo consumen StepRail y el atajo de teclado de App.tsx. */
import type { ElementModel, ProofreadFinding } from '../types';
import type { AIReviewResult } from '../api/backend';
import { collectAuditItems } from './auditItems';

export interface RailPendingInput {
  elements: ElementModel[];
  reviewResult: AIReviewResult | null;
  proofreadFindings: ProofreadFinding[];
  citationAuditResult: { ghost_citations: any[]; orphan_references: any[] } | null;
  portada: { title?: string; author?: string };
}

function needsReview(e: any): boolean {
  return Boolean(e?.needs_review);
}

export function pendingCountForPhase(phaseId: number, input: RailPendingInput): number {
  const { elements, portada } = input;

  if (phaseId === 1) {
    let pending = 0;
    if (!portada.title?.trim()) pending++;
    if (!portada.author?.trim()) pending++;
    return pending;
  }
  if (phaseId === 2) {
    return elements.filter((e) => e.type === 'heading' && needsReview(e)).length;
  }
  if (phaseId === 3) {
    const figures = elements.filter(
      (e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0
        && !(e.image_info as any).render_error && needsReview(e),
    ).length;
    const tables = elements.filter(
      (e) => e.type === 'table' && e.table_info && (e.table_info.table_number || 0) > 0 && needsReview(e),
    ).length;
    return figures + tables;
  }
  if (phaseId === 4) {
    return input.citationAuditResult?.ghost_citations?.length ?? 0;
  }
  if (phaseId === 5) {
    return collectAuditItems({
      elements,
      reviewResult: input.reviewResult,
      proofreadFindings: input.proofreadFindings,
      citationAuditResult: input.citationAuditResult,
    }).length;
  }
  return 0;
}

export function readPhaseStates(input: RailPendingInput): Record<number, number> {
  const states: Record<number, number> = {};
  for (let phase = 1; phase <= 5; phase++) {
    states[phase] = pendingCountForPhase(phase, input);
  }
  return states;
}

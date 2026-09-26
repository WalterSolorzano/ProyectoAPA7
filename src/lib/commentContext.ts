/* WordAPA7 — contexto de comentarios del lienzo.
   UNA sola construcción para el subrayado inline (renderReviewedText) y para
   las burbujas del gutter (WhatsAppComment). La regla de styleAuditRun incluye
   el corrector: si solo corrio proofread, hay burbuja y tiene que haber
   subrayado, o el hallazgo queda resaltado a medias. */

import type { WhatsAppContext } from '../components/layout/WhatsAppComment';
import type { AIReviewResult } from '../api/backend';
import type { ProofreadFinding, ValidationIssue } from '../types';

/** Subconjunto del store que necesita la construcción del contexto. */
export interface CommentContextSource {
  citationAuditResult: { ghost_citations: any[]; orphan_references: any[] } | null;
  validationIssues: ValidationIssue[] | null | undefined;
  /** Opcional a propósito: quien llama pasa el valor crudo del store y la
   *  normalización vive acá. `undefined` (store sin la tecla) se trata como
   *  habilitado, igual que el `!== false` que ya usaban dos de los tres
   *  llamadores: sin sugerencias solo significa "el usuario las apagó". */
  sugerenciasProactivas?: boolean;
  reviewResult: AIReviewResult | null;
  proofreadFindings: ProofreadFinding[];
}

export function buildCommentContext(s: CommentContextSource): WhatsAppContext {
  return {
    ghostCitations: s.citationAuditResult?.ghost_citations || [],
    orphanReferences: s.citationAuditResult?.orphan_references || [],
    // Normalizar DENTRO: los dos canales (subrayado y burbuja) tienen que
    // coincidir, y eso no puede depender de que cada llamador se acuerde.
    validationIssues: s.sugerenciasProactivas === false ? [] : s.validationIssues || [],
    // Corrector O revisor de IA habilitan los comentarios de estilo: sin esto,
    // un hallazgo del corrector se anunciaba en una burbuja sin subrayado.
    // El `|| []` tolera un store que llegue sin el array (setState parcial).
    styleAuditRun: !!s.reviewResult || (s.proofreadFindings || []).length > 0,
  };
}

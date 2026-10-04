import { describe, it, expect } from 'vitest';
import { pendingCountForPhase, readPhaseStates } from '../lib/railPending';

const base = {
  elements: [], reviewResult: null, proofreadFindings: [], citationAuditResult: null,
  portada: { title: 'T', author: 'A' },
};

describe('pendingCountForPhase', () => {
  it('fase 5 devuelve el total de hallazgos de revisión', () => {
    const input = {
      ...base,
      proofreadFindings: [{
        element_id: 'e1', start: 0, end: 2, excerpt: 'ab', kind: 'ortografia',
        severity: 'error' as const, message: 'm', source: 'local' as const,
      }],
    };
    expect(pendingCountForPhase(5, input)).toBe(1);
  });

  it('fase 4 devuelve el total de citas fantasma', () => {
    const input = {
      ...base,
      citationAuditResult: {
        ghost_citations: [{ citation_text: 'X' }, { citation_text: 'Y' }],
        orphan_references: [],
      },
    };
    expect(pendingCountForPhase(4, input)).toBe(2);
  });

  it('fase 1 cuenta campos de portada faltantes', () => {
    expect(pendingCountForPhase(1, { ...base, portada: { title: '', author: '' } })).toBe(2);
  });

  it('readPhaseStates incluye las fases 1 a 5', () => {
    const states = readPhaseStates(base);
    expect(Object.keys(states).sort()).toEqual(['1', '2', '3', '4', '5']);
  });

  it('la fase 4 cuenta citas fantasma y la 5 las excluye', () => {
    const input = {
      ...base,
      citationAuditResult: { ghost_citations: [{ citation_text: 'x' }], orphan_references: [] },
    };
    expect(pendingCountForPhase(4, input)).toBe(1);
    expect(pendingCountForPhase(5, input)).toBe(0);
  });

  it('la fase 2 cuenta headings con baja confianza aunque needs_review sea false', () => {
    const input = {
      ...base,
      elements: [
        { id: 'h1', type: 'heading', text: 'A', needs_review: false, confidence: 0.5, is_user_modified: false },
        { id: 'h2', type: 'heading', text: 'B', needs_review: true, confidence: 0.99, is_user_modified: false },
        { id: 'h3', type: 'heading', text: 'C', needs_review: false, confidence: 0.99, is_user_modified: false },
      ] as any,
    };
    expect(pendingCountForPhase(2, input)).toBe(2);
  });

  it('la fase 3 cuenta figuras/tablas con baja confianza aunque needs_review sea false', () => {
    const input = {
      ...base,
      elements: [
        { id: 'f1', type: 'image', needs_review: false, confidence: 0.4, image_info: { figure_number: 1 } },
        { id: 't1', type: 'table', needs_review: false, confidence: 0.4, table_info: { table_number: 1 } },
      ] as any,
    };
    expect(pendingCountForPhase(3, input)).toBe(2);
  });

  it('fase 5 descuenta los findings descartados via dismissedIds', () => {
    const proofreadFindings = [
      { element_id: 'e1', start: 0, end: 2, excerpt: 'ab', kind: 'ortografia', severity: 'error' as const, message: 'm', source: 'local' as const },
      { element_id: 'e2', start: 0, end: 2, excerpt: 'cd', kind: 'ortografia', severity: 'error' as const, message: 'm', source: 'local' as const },
    ];
    const full = pendingCountForPhase(5, { ...base, proofreadFindings });
    expect(full).toBe(2);
    const withDismissed = pendingCountForPhase(5, {
      ...base,
      proofreadFindings,
      dismissedIds: new Set(['proact_e1_0']),
    });
    expect(withDismissed).toBe(1);
  });
});

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
});

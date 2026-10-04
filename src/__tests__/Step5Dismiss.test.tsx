import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDocStore } from '../store/useDocStore';
import { readPhaseStates } from '../lib/railPending';

let origState: any;

beforeEach(() => {
  origState = useDocStore.getState();
});

afterEach(() => {
  useDocStore.setState(origState as any);
});

describe('badge de fase 5 tras descartar/aceptar', () => {
  it('dismissFinding decrementa el conteo pendiente de la fase 5', () => {
    useDocStore.setState({
      doc: { session_id: 'x', elements: [] } as any,
      reviewResult: null,
      citationAuditResult: null,
      proofreadFindings: [
        { element_id: 'e1', start: 0, end: 2, excerpt: 'ab', kind: 'ortografia', severity: 'error', message: 'm', source: 'local' },
        { element_id: 'e2', start: 0, end: 2, excerpt: 'cd', kind: 'ortografia', severity: 'error', message: 'm', source: 'local' },
      ],
      dismissedCommentIds: [],
      dismissedFindingIds: [],
      portada: { title: 'T', author: 'A' },
    } as any);

    const input = () => {
      const s = useDocStore.getState();
      return readPhaseStates({
        elements: s.doc?.elements || [],
        reviewResult: s.reviewResult,
        proofreadFindings: s.proofreadFindings || [],
        citationAuditResult: s.citationAuditResult,
        portada: s.portada,
        dismissedIds: new Set([...(s.dismissedCommentIds || []), ...(s.dismissedFindingIds || [])]),
      });
    };

    expect(input()[5]).toBe(2);
    useDocStore.getState().dismissFinding('proact_e1_0');
    expect(useDocStore.getState().dismissedFindingIds).toContain('proact_e1_0');
    expect(input()[5]).toBe(1);
  });

  it('restoreFinding vuelve a subir el conteo', () => {
    useDocStore.setState({
      doc: { session_id: 'x', elements: [] } as any,
      proofreadFindings: [
        { element_id: 'e1', start: 0, end: 2, excerpt: 'ab', kind: 'ortografia', severity: 'error', message: 'm', source: 'local' },
      ],
      dismissedCommentIds: [],
      dismissedFindingIds: [],
    } as any);
    useDocStore.getState().dismissFinding('proact_e1_0');
    expect(useDocStore.getState().dismissedFindingIds).toContain('proact_e1_0');
    useDocStore.getState().restoreFinding('proact_e1_0');
    expect(useDocStore.getState().dismissedFindingIds).not.toContain('proact_e1_0');
  });
});

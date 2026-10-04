import { describe, it, expect } from 'vitest';
import { collectAuditItems } from '../lib/auditItems';
import type { ElementModel, ProofreadFinding } from '../types';

const elem: ElementModel = {
  id: 'e1', type: 'paragraph', text: 'Este párrafo habla de metodología.',
  heading_level: null, needs_review: false,
} as unknown as ElementModel;

describe('collectAuditItems', () => {
  it('marca la ortografía como categoria spelling', () => {
    const items = collectAuditItems({
      elements: [elem],
      reviewResult: null,
      proofreadFindings: [{
        element_id: 'e1', start: 0, end: 4, excerpt: 'Este',
        kind: 'ortografia', severity: 'error', message: 'Falta tilde',
        suggestion: 'Éste', source: 'local',
      }],
      citationAuditResult: null,
    });
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe('spelling');
    expect(items[0].suggestedText).toBe('Éste');
    expect(items[0].readOnly).toBe(false);
  });

  it('no ofrece suggestion en un hallazgo de portada de solo lectura', () => {
    const items = collectAuditItems({
      elements: [{ ...elem, id: 'cover1', is_cover_section: true } as unknown as ElementModel],
      reviewResult: null,
      proofreadFindings: [{
        element_id: 'cover1', start: 0, end: 4, excerpt: 'Títu',
        kind: 'portada_punto', severity: 'warn', message: 'Título con punto final',
        suggestion: 'Título', source: 'local', read_only: true,
      } as unknown as ProofreadFinding],
      citationAuditResult: null,
    });
    expect(items).toHaveLength(1);
    expect(items[0].readOnly).toBe(true);
    expect(items[0].suggestedText).toBeUndefined();
  });

  it('un hallazgo con element_id inexistente no rompe y cae en pagina 1', () => {
    const items = collectAuditItems({
      elements: [],
      reviewResult: null,
      proofreadFindings: [{
        element_id: 'fantasma', start: 0, end: 3, excerpt: 'abc',
        kind: 'muletilla', severity: 'warn', message: 'Muletilla',
        source: 'local',
      }],
      citationAuditResult: null,
    });
    expect(items).toHaveLength(1);
    expect(items[0].pageNumber).toBe(1);
    expect(items[0].originalText).toBe('abc');
  });
});

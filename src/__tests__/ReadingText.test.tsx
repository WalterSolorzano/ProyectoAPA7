import { describe, it, expect } from 'vitest';
import { marksForElement, MARK_STYLE } from '../components/review/ReadingText';
import type { ProofreadFinding } from '../types';

const f = (over: Partial<ProofreadFinding>): ProofreadFinding => ({
  element_id: 'e1', start: 0, end: 3, excerpt: 'abc', kind: 'ai_phrase',
  severity: 'warn', message: 'm', source: 'local', ...over,
});

describe('marksForElement', () => {
  it('devuelve solo las marcas del elemento pedido', () => {
    const findings = [f({}), f({ element_id: 'e2' })];
    expect(marksForElement(findings, 'e1')).toHaveLength(1);
  });

  it('cada kind conocido tiene estilo con tokens, sin hex', () => {
    for (const style of Object.values(MARK_STYLE)) {
      expect(style.color).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style.color).toMatch(/^var\(--/);
    }
  });
});

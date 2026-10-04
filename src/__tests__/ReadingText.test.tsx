import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { marksForElement, MARK_STYLE, ReadingText } from '../components/review/ReadingText';
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

describe('ReadingText con marcas solapadas', () => {
  it('no duplica los chars de marcas solapadas [0,10] y [5,8]', () => {
    const findings = [
      f({ start: 0, end: 10, excerpt: '0123456789' }),
      f({ start: 5, end: 8, excerpt: '567' }),
    ];
    const { container } = render(<ReadingText text="0123456789ABC" elementId="e1" findings={findings} />);
    expect(container.textContent).toBe('0123456789ABC');
    expect(container.textContent?.includes('5678956789')).toBe(false);
  });
});

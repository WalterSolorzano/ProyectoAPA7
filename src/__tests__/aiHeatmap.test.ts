import { describe, it, expect } from 'vitest';
import { construirHeatmap, RANGOS_IA } from '../lib/aiHeatmap';
import type { AuditItem } from '../lib/auditItems';

const ia = (id: string, aiScore?: number): AuditItem =>
  ({ id, element_id: 'x', category: 'ai', subtype: 'parrafo_ia', severity: 'medium', summary: '', detail: '', originalText: '', pageNumber: null, phase: null, readOnly: false, aiScore }) as AuditItem;

describe('construirHeatmap', () => {
  it('expone los cortes 45/60/75/90', () => {
    expect([...RANGOS_IA]).toEqual([45, 60, 75, 90]);
  });

  it('ubica cada índice en su bucket', () => {
    const { filas, max } = construirHeatmap([
      { id: 'h1', titulo: 'Intro', findings: [ia('a', 0.5), ia('b', 0.62), ia('c', 0.8), ia('d', 0.95)] },
    ]);
    expect(filas[0].counts).toEqual([1, 1, 1, 1]);
    expect(filas[0].total).toBe(4);
    expect(max).toBe(1);
  });

  it('cuenta sinMedir aparte y no lo mete en buckets', () => {
    const { filas } = construirHeatmap([{ id: 'h1', titulo: 'Intro', findings: [ia('a', 0.9), ia('b')] }]);
    expect(filas[0].counts).toEqual([0, 0, 0, 1]);
    expect(filas[0].sinMedir).toBe(1);
    expect(filas[0].total).toBe(1);
  });

  it('max es el mayor conteo de cualquier celda', () => {
    const { max } = construirHeatmap([
      { id: 'h1', titulo: 'A', findings: [ia('a', 0.5), ia('b', 0.5)] },
      { id: 'h2', titulo: 'B', findings: [ia('c', 0.5)] },
    ]);
    expect(max).toBe(2);
  });
});

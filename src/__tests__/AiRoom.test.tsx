import { describe, it, expect } from 'vitest';
import { segmentsFromParagraphs } from '../components/review/AiRoom';
import type { ElementModel } from '../types';

const el = (id: string, type: string, text: string): ElementModel =>
  ({ id, type, text } as unknown as ElementModel);

describe('segmentsFromParagraphs', () => {
  it('agrupa los parrafos bajo su H1', () => {
    const elements = [el('h1', 'heading', 'Resultados'), el('p1', 'paragraph', 'texto')];
    const segs = segmentsFromParagraphs([{ element_id: 'p1', text: 'texto', ai_score: 80, ai_category: 'HIGH' }], elements);
    expect(segs.length).toBeGreaterThan(0);
    expect(segs.flatMap((s) => s.paragraphs)).toHaveLength(1);
  });

  it('sin H1 cae en un unico segmento de documento completo', () => {
    const segs = segmentsFromParagraphs([{ element_id: 'p1', text: 'x', ai_score: 80, ai_category: 'HIGH' }], [el('p1', 'paragraph', 'x')]);
    expect(segs).toHaveLength(1);
  });
});

/**
 * flowPagination — empaquetado de elementos medidos en hojas con split de
 * párrafos: nada se recorta, nada se pierde ni duplica (fin del desborde).
 */
import { describe, it, expect } from 'vitest';
import { flowPagination, MeasuredElement } from '../lib/flowPagination';
import { getPageGeometry } from '../lib/pageGeometry';
import { ElementModel, ElementType } from '../types';

const geom = getPageGeometry({ margins_cm: 2.54, font_size_pt: 12, line_spacing: 2 });
const LH = geom.lineHeightPx;
const TOTAL_LINES = Math.floor(geom.contentH / LH);

const me = (id: string, lines: number | null, splittable = true): MeasuredElement => ({
  elem: {
    id,
    type: 'paragraph' as ElementType,
    text: 'x'.repeat((lines ?? 10) * 90),
    confidence: 1,
    is_user_modified: false,
    needs_review: false,
    auto_applied: false,
    cita_ids: [],
  } as ElementModel,
  heightPx: lines === null ? null : lines * LH,
  splittable,
});

describe('flowPagination', () => {
  it('empaqueta elementos que caben sin exceder contentH', () => {
    const items = [me('a', 5), me('b', 5), me('c', TOTAL_LINES - 15)];
    const pages = flowPagination(items, geom);
    expect(pages.length).toBe(1);
    expect(pages[0].chunks.map((c) => c.elem.id)).toEqual(['a', 'b', 'c']);
  });

  it('parte párrafo que no cabe: continuidad exacta sin pérdida', () => {
    const items = [me('big', TOTAL_LINES * 2)];
    const pages = flowPagination(items, geom);
    expect(pages.length).toBe(2);
    const c1 = pages[0].chunks[0];
    const c2 = pages[1].chunks[0];
    expect(c1.startLine).toBe(0);
    expect(c1.endLine).toBe(TOTAL_LINES);
    expect(c2.startLine).toBe(TOTAL_LINES);
    expect(c2.endLine).toBeNull();
    expect(c1.elem.id).toBe('big');
    expect(c2.elem.id).toBe('big');
  });

  it('elemento no splittable pasa entero a página nueva aunque exceda', () => {
    const items = [me('a', 10), me('table', TOTAL_LINES + 50, false)];
    const pages = flowPagination(items, geom);
    expect(pages.length).toBe(2);
    expect(pages[1].chunks.length).toBe(1);
    expect(pages[1].chunks[0].startLine).toBe(0);
    expect(pages[1].chunks[0].endLine).toBeNull();
  });

  it('altura null (sin medición) usa estimación, no pierde el elemento', () => {
    const items = [me('unknown', null)];
    const pages = flowPagination(items, geom, () => 5);
    expect(pages.length).toBe(1);
    expect(pages[0].chunks[0].elem.id).toBe('unknown');
  });

  it('párrafo gigante: los cubos cubren todas las líneas exactas', () => {
    const totalLines = TOTAL_LINES * 2 + Math.floor(TOTAL_LINES / 2);
    const items = [me('huge', totalLines)];
    const pages = flowPagination(items, geom);
    expect(pages.length).toBe(3);
    let line = 0;
    for (const pg of pages) {
      for (const c of pg.chunks) {
        expect(c.startLine).toBe(line);
        // endLine null = resto final del elemento = totalLines conocido aquí
        line = c.endLine ?? totalLines;
      }
    }
    expect(line).toBe(totalLines); // todo cubierto hasta el final
  });

  it('cola de párrafos cortos tras un split sigue empaquetando', () => {
    const items = [me('big', TOTAL_LINES + 3), me('after', 2)];
    const pages = flowPagination(items, geom);
    // pág1: 3 líneas de 'after'? no: big ocupa TOTAL (llena), after cabe donde quepa
    const allChunks = pages.flatMap((pg) => pg.chunks);
    const after = allChunks.filter((c) => c.elem.id === 'after');
    expect(after.length).toBe(1); // 'after' sin partir
    expect(after[0].endLine).toBeNull();
  });
});

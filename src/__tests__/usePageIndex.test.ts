/**
 * WordAPA7 — T10: el indice de paginas sale del computePages real.
   El mapa de 1800 caracteres por pagina moria con este hook: un hallazgo
   caia en una pagina que el minimapa no marcaba.
 */
import { describe, it, expect } from 'vitest';
import { computePages } from '../components/layout/PaperCanvas';
import { buildPageIndex } from '../hooks/usePageIndex';
import type { ElementModel } from '../types';

const parrafo = (id: string, largo = 100) =>
  ({ id, type: 'paragraph', text: 'a'.repeat(largo) }) as never;

describe('T10 — usePageIndex', () => {
  it('sin documento, cero páginas y ninguna página asignada', () => {
    const idx = buildPageIndex([]);
    expect(idx.totalPages).toBe(0);
    expect(idx.pageOf('lo-que-sea')).toBeNull();
  });

  it('cada elemento cae en la página que el computePages le dio', () => {
    const elementos = [parrafo('a'), parrafo('b'), parrafo('c'), parrafo('d')];
    const paginas = computePages(elementos);
    const idx = buildPageIndex(elementos);
    expect(idx.totalPages).toBe(paginas.length);
    for (const [i, pagina] of paginas.entries()) {
      for (const el of pagina) {
        expect(idx.pageOf(el.id)).toBe(i + 1);
      }
    }
  });

  it('un elemento inexistente devuelve null, nunca una página inventada', () => {
    const idx = buildPageIndex([parrafo('a')]);
    expect(idx.pageOf('fantasma')).toBeNull();
  });

  it('la portada es indivisible: sus elementos no se reparten en la página 2', () => {
    const portada = [
      { id: 't', type: 'heading', text: 'Universidad', is_cover_section: true } as never,
      { id: 'a', type: 'paragraph', text: 'Autor', is_cover_section: true } as never,
    ];
    const idx = buildPageIndex(portada);
    expect(idx.pageOf('t')).toBe(1);
    expect(idx.pageOf('a')).toBe(1);
  });

  it('una portada que no cabe igual se queda entera en la página 1', () => {
    // Si el índice re-derivara la paginación sin el bloque de portada, estos 20
    // elementos (3 unidades cada uno) se repartirían en varias páginas.
    const portadaLarga = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`,
      type: 'paragraph',
      text: 'a'.repeat(400),
      is_cover_section: true,
    })) as unknown as ElementModel[];
    const cuerpo = Array.from({ length: 30 }, (_, i) => parrafo(`b${i}`, 400));
    const idx = buildPageIndex([...portadaLarga, ...cuerpo]);
    expect(idx.totalPages).toBeGreaterThan(1);
    for (let i = 0; i < 20; i++) expect(idx.pageOf(`c${i}`)).toBe(1);
    expect(idx.pageOf('b0')).toBe(2);
  });

  it('ningún elemento queda sin página asignada', () => {
    const elementos = Array.from({ length: 120 }, (_, i) => parrafo(`e${i}`, 400));
    const idx = buildPageIndex(elementos);
    expect(idx.totalPages).toBeGreaterThan(1);
    for (let i = 0; i < elementos.length; i++) {
      expect(idx.pageOf(`e${i}`)).not.toBeNull();
    }
  });
});

/**
 * WordAPA7 — T10: el indice de paginas sale de la paginacion REAL del lienzo.
   El mapa de 1800 caracteres por pagina moria con este hook: un hallazgo
   caia en una pagina que el minimapa no marcaba.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { computeRenderedPages, type PageRules } from '../components/layout/PaperCanvas';
import { buildPageIndex, usePageIndex } from '../hooks/usePageIndex';
import { useDocStore } from '../store/useDocStore';
import type { APARuleSet, ElementModel } from '../types';

const parrafo = (id: string, largo = 100) =>
  ({ id, type: 'paragraph', text: 'a'.repeat(largo) }) as never;

const rulesLetter: PageRules = {
  margins_cm: 2.54,
  font_size_pt: 12,
  line_spacing: 2,
  page_size: 'letter',
};

describe('T10 — usePageIndex', () => {
  it('sin documento, cero páginas y ninguna página asignada', () => {
    const idx = buildPageIndex([]);
    expect(idx.totalPages).toBe(0);
    expect(idx.pageOf('lo-que-sea')).toBeNull();
  });

  it('cada elemento cae en la página que el lienzo dibujó', () => {
    const elementos = [parrafo('a'), parrafo('b'), parrafo('c'), parrafo('d')];
    // Oracle = la misma función que pinta el lienzo, con las mismas reglas.
    const { pages: paginas } = computeRenderedPages({ elements: elementos, rules: rulesLetter });
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

  it('la densidad es la de la hoja real, no la del 14 por defecto', () => {
    // 20 párrafos de una unidad: la densidad vieja (14) los partía en 2 páginas
    // y el minimapa dibujaba otra cosa. La hoja real (Letter ≈ 28 unidades) los
    // entra en una sola.
    const elementos = Array.from({ length: 20 }, (_, i) => parrafo(`d${i}`));
    const idx = buildPageIndex(elementos, { rules: rulesLetter });
    expect(idx.totalPages).toBe(1);
    expect(idx.pageOf('d19')).toBe(1);
    // Y más allá de la densidad, el índice no se adelanta al lienzo.
    const muchos = Array.from({ length: 40 }, (_, i) => parrafo(`m${i}`));
    const idx2 = buildPageIndex(muchos, { rules: rulesLetter });
    expect(idx2.totalPages).toBe(2);
    expect(idx2.pageOf('m39')).toBe(2);
  });

  it('la página es donde el elemento empieza, aunque siga en la siguiente', () => {
    const largo = {
      id: 'largo',
      type: 'paragraph',
      text: 'palabra con contenido real '.repeat(2000),
    } as unknown as ElementModel;
    // Medición DOM: el párrafo ocupa varias hojas de alto.
    const heights = new Map<string, number>([['largo', 20000]]);
    const idx = buildPageIndex([largo, parrafo('despues')], { heights });

    expect(idx.totalPages).toBeGreaterThan(1);
    // Se sigue el ELEMENTO, no su último fragmento.
    expect(idx.pageOf('largo')).toBe(1);
    // Y el elemento sí aparece repartido en varias páginas dibujadas.
    const fragmentos = idx.pages.flat().filter((e) => e.id === 'largo').length;
    expect(fragmentos).toBeGreaterThan(1);
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

describe('T10 — usePageIndex sobre el store', () => {
  // APARuleSet todavía no declara page_size (el lienzo también lo lee con cast).
  const setRules = (rules: PageRules) => {
    act(() => {
      useDocStore.setState({
        rules: { ...useDocStore.getState().rules, ...rules } as APARuleSet,
      });
    });
  };

  beforeEach(() => {
    useDocStore.setState({ doc: null });
    setRules(rulesLetter);
  });

  it('sin documento en el store no hay páginas', () => {
    const { result } = renderHook(() => usePageIndex());
    expect(result.current.totalPages).toBe(0);
    expect(result.current.pageOf('lo-que-sea')).toBeNull();
  });

  it('cambia el documento y el índice no sirve la paginación vieja', () => {
    const { result, rerender } = renderHook(() => usePageIndex());

    act(() => {
      useDocStore.setState({
        doc: { elements: [parrafo('a'), parrafo('b')] } as never,
      });
    });
    rerender();
    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageOf('a')).toBe(1);

    act(() => {
      useDocStore.setState({
        doc: { elements: Array.from({ length: 40 }, (_, i) => parrafo(`x${i}`)) } as never,
      });
    });
    rerender();
    expect(result.current.totalPages).toBe(2);
    // El id del documento anterior ya no existe: un memo rancio lo devolvería.
    expect(result.current.pageOf('a')).toBeNull();
    expect(result.current.pageOf('x39')).toBe(2);
  });

  it('cambian las reglas de la hoja y el índice se recalcula', () => {
    const { result, rerender } = renderHook(() => usePageIndex());
    // 29 párrafos de una unidad: Letter (28) los parte, A4 (30) no.
    const elementos = Array.from({ length: 29 }, (_, i) => parrafo(`d${i}`));

    act(() => {
      useDocStore.setState({ doc: { elements: elementos } as never });
    });
    rerender();
    expect(result.current.totalPages).toBe(2);
    expect(result.current.pageOf('d28')).toBe(2);

    setRules({ ...rulesLetter, page_size: 'a4' });
    rerender();
    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageOf('d28')).toBe(1);
  });
});

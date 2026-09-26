/* WordAPA7 — paginación real como única fuente de páginas.
   El workbench usaba 1800 caracteres por página mientras el lienzo usaba
   computePages: un hallazgo podía caer en una página que el minimapa no
   marcaba. Aquí hay un solo índice, y quien no esté en él devuelve null. */

import { useMemo } from 'react';
import { useDocStore } from '../store/useDocStore';
import { computeRenderedPages, type PageRules } from '../components/layout/PaperCanvas';
import type { ElementModel } from '../types';

export type { PageRules };

export interface PageIndexOptions {
  /** Reglas APA vigentes: definen el tamaño real de la hoja. */
  rules?: PageRules;
  /** Formato APA del documento (define el alto del encabezado de página). */
  apaFormat?: string;
  /** Alturas medidas en el DOM (id → px), si el que pagina ya midió. */
  heights?: Map<string, number> | null;
}

export interface PageIndex {
  totalPages: number;
  pages: ElementModel[][];
  pageOfElement: ReadonlyMap<string, number>;
  /**
   * Página 1-based del elemento, o `null` si no está en el índice (nunca un
   * número estimado). Es la página donde el elemento **empieza**: si un párrafo
   * se parte entre hojas, el índice lo ancla a la del primer fragmento, que es
   * la única lectura defendible desde el id. Un hallazgo anclado a la mitad de
   * ese párrafo queda en la página de inicio, no en la de su texto.
   */
  pageOf: (elementId: string) => number | null;
}

/** Índice de páginas que sale de la paginación REAL del lienzo, sin re-derivar
 *  nada. Lo que esa paginación descarta (elementos 'empty', 'page_break' o sin
 *  id) no entra al índice: pageOf devuelve null antes que inventar una página. */
export function buildPageIndex(
  elements: ElementModel[],
  { rules, apaFormat, heights }: PageIndexOptions = {},
): PageIndex {
  const pages = elements.length
    ? computeRenderedPages({ elements, rules, apaFormat, heights }).pages
    : [];
  const pageOfElement = new Map<string, number>();
  pages.forEach((page, i) => {
    for (const el of page) {
      // Un párrafo partido repite su id en varias páginas (mismo id, distinto
      // fragmento): gana la primera, que es donde el elemento empieza.
      if (el?.id && !pageOfElement.has(el.id)) pageOfElement.set(el.id, i + 1);
    }
  });
  return {
    totalPages: pages.length,
    pages,
    pageOfElement,
    pageOf: (elementId: string) => pageOfElement.get(elementId) ?? null,
  };
}

/**
 * Índice del documento abierto, sobre la paginación real del lienzo.
 * SIN mediciones DOM: las alturas medidas viven en un ref dentro de
 * `PaperCanvas`, así que aquí un párrafo más largo que la hoja no se parte
 * (queda entero en su página de inicio, que es lo que `pageOf` promete).
 * Quien necesite el reflow exacto mide y pasa `heights` a `buildPageIndex`.
 */
export function usePageIndex(): PageIndex {
  const doc = useDocStore((s) => s.doc);
  const rules = useDocStore((s) => s.rules);
  return useMemo(
    () => buildPageIndex(doc?.elements || [], { rules, apaFormat: doc?.apa_format }),
    [doc, rules],
  );
}

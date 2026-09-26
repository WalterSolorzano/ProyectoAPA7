/* WordAPA7 — paginación real como única fuente de páginas.
   El workbench usaba 1800 caracteres por página mientras el lienzo usaba
   computePages: un hallazgo podía caer en una página que el minimapa no
   marcaba. Aquí hay un solo índice, y quien no esté en él devuelve null. */

import { useMemo } from 'react';
import { useDocStore } from '../store/useDocStore';
import { computePages } from '../components/layout/PaperCanvas';
import type { ElementModel } from '../types';

export interface PageIndex {
  totalPages: number;
  pages: ElementModel[][];
  pageOfElement: Map<string, number>;
  pageOf: (elementId: string) => number | null;
}

/** Índice de páginas que sale del computePages real, sin re-derivar nada.
 *  Lo que computePages descarta (elementos 'empty', 'page_break' o sin id) no
 *  entra al índice: pageOf devuelve null para ellos antes que inventar una. */
export function buildPageIndex(elements: ElementModel[]): PageIndex {
  const pages = elements.length ? computePages(elements) : [];
  const pageOfElement = new Map<string, number>();
  pages.forEach((page, i) => {
    for (const el of page) {
      // computePages nunca repite un elemento, pero si el id viniera duplicado
      // gana la primera aparición: el índice no inventa una segunda página.
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

export function usePageIndex(): PageIndex {
  const doc = useDocStore((s) => s.doc);
  return useMemo(() => buildPageIndex(doc?.elements || []), [doc]);
}

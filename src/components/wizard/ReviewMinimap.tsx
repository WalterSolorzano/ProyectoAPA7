/* WordAPA7 — Minimapa de páginas para la vista "Revisión & IA".
   Columna angosta (~19px) con UNA marca por página del documento:
   - Color según el motor que detectó hallazgos en esa página.
   - Página actual resaltada (marca ancha con contorno de acento).
   - Click = saltar a esa página (navegación sin scroll a ciegas).
   - Teclado: roving tabindex — UNA sola parada de tab en todo el minimapa
     (marca activa con tabIndex 0, el resto -1). Flechas ←/→/↑/↓ mueven la
     marca activa y el foco; Enter/Space activan la marca (botón nativo).
   Solo reorganiza espacio: usa tokens CSS existentes, sin nuevos colores. */

import React, { useEffect, useRef, useState } from 'react';

export interface MinimapMark {
  /** Token CSS del motor dominante en la página */
  color: string;
  /** Cantidad de hallazgos en la página */
  count: number;
  /** Nombre del motor dominante (para el tooltip) */
  label: string;
}

interface ReviewMinimapProps {
  totalPages: number;
  marks: Map<number, MinimapMark>;
  currentPage: number;
  onPageClick: (page: number) => void;
}

export const ReviewMinimap: React.FC<ReviewMinimapProps> = ({
  totalPages,
  marks,
  currentPage,
  onPageClick,
}) => {
  /* Roving tabindex: la marca activa es la ÚNICA parada de tab del minimapa */
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /* La marca activa sigue a la página actual: entrar con Tab siempre aterriza
     en el contexto del documento. */
  useEffect(() => {
    if (totalPages <= 0) return;
    setActiveIndex(Math.min(Math.max(currentPage - 1, 0), totalPages - 1));
  }, [currentPage, totalPages]);

  if (totalPages <= 0) return null;

  const activeIdx = Math.min(Math.max(activeIndex, 0), totalPages - 1);

  const moveActive = (next: number) => {
    const idx = ((next % totalPages) + totalPages) % totalPages; // envuelve
    setActiveIndex(idx);
    itemRefs.current[idx]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let delta = 0;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') delta = 1;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') delta = -1;
    else return;
    e.preventDefault(); // las flechas no deben scrollear el contenedor
    moveActive(activeIdx + delta);
  };

  return (
    <div
      role="group"
      aria-label="Minimap de páginas"
      onKeyDown={handleKeyDown}
      style={{
        width: '19px',
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
        padding: '6px 3px',
        borderRight: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--sidebar-bg)',
        overflowY: 'auto',
        overflowX: 'hidden',
        zIndex: 5,
      }}
    >
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
        const mark = marks.get(page);
        const isCurrent = page === currentPage;
        const isActive = page - 1 === activeIdx;
        const count = mark?.count ?? 0;
        return (
          <button
            key={page}
            type="button"
            ref={(el) => {
              itemRefs.current[page - 1] = el;
            }}
            tabIndex={isActive ? 0 : -1}
            onClick={() => {
              setActiveIndex(page - 1); // las flechas continúan desde el click
              onPageClick(page);
            }}
            /* El conteo es el del ÍNDICE DE REVISIÓN, no el de la hoja medida, y
               en modo Hoja el minimapa está al lado de la hoja con la que
               discrepa. Por eso el alcance se LEE (aria-label y tooltip), igual
               que en la tira: "de la revisión". La calibración de la paginación
               del lienzo es un trabajo aparte, más grande, y sigue ABIERTO: esto
               dice de qué número se trata, no arregla la diferencia. */
            title={
              mark
                ? `Página ${page} de ${totalPages} de la revisión — ${mark.count} hallazgo(s) · ${mark.label}`
                : `Página ${page} de ${totalPages} de la revisión`
            }
            aria-label={`Página ${page} de ${totalPages} de la revisión, ${count} ${
              count === 1 ? 'hallazgo' : 'hallazgos'
            }`}
            style={{
              flex: isCurrent ? '2 1 0' : '1 1 0',
              /* Hit target efectivo ≥4px (visual = la propia barra flex);
                 el ancho de la columna (19px) no crece. */
              minHeight: isCurrent ? '7px' : '4px',
              width: mark || isCurrent ? '100%' : '50%',
              margin: mark || isCurrent ? '0' : '0 auto',
              padding: 0,
              /* Token, no literal: los cinco radios del sistema son
                 `--radius-sm|md|lg|xl|full`, y un `1px` escrito a mano es un
                 radio fuera del vocabulario. `--radius-sm` es lo más cercano a
                 la intención (una marca de 4-7px de alto apenas redondeada) y
                 el navegador lo recorta a la mitad del lado corto, que es
                 exactamente lo que se veía antes. */
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: isCurrent
                ? mark?.color || 'var(--text-secondary)'
                : mark?.color || 'var(--border-subtle)',
              opacity: mark ? 1 : isCurrent ? 0.9 : 0.45,
              /* Anillo de acento de la página actual vía outline (libera
                 box-shadow para el focus ring global :focus-visible) */
              outline: isCurrent ? '1.5px solid var(--accent-primary)' : undefined,
              transition:
                'background-color 0.15s ease, box-shadow 0.15s ease, outline-color 0.15s ease',
            }}
          />
        );
      })}
    </div>
  );
};

export default ReviewMinimap;

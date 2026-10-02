/* WordAPA7 - Minimapa de páginas para la vista "Revisión & IA".
   Columna de páginas con etiqueta: el número de cada página y el nombre del motor
   dominante van en el TEXTO, el `aria-label` y el `title`. El color sigue estando,
   pero dejó de ser el único portador del significado, que era el defecto.

   Qué cambió y por qué:
   - 19 px → 44 px. 19 no alcanzan ni para el número de una página de tres
     dígitos, así que "poner el número" sin ensanchar la columna era imposible.
   - 4 px → 6 px de alto mínimo. Un botón de 4 px de alto no es un botón: es un
     pelo, y un pelo no es un blanco de pulsación.
   - `--border-subtle` sobre `--sidebar-bg` no se ve en tema claro: 9% de negro
     sobre blanco es gris sobre blanco, y a 6 px de alto tampoco alcanza para
     leerse. Los niveles bajos usan `--color-border-strong`, que tiene presencia
     en los dos temas.
   - Los tokens pasan a los canónicos `--color-*`. `--sidebar-bg`,
     `--text-secondary`, `--border-subtle` y `--accent-primary` son alias legacy,
     y un alias es un token que nadie sabe si existe.
   - Con la ventana más angosta que `MINIMAP_ANCHO_MINIMO` devuelve `null`: una
     columna ilegible es peor que ninguna columna, y su función queda en el flyout
     del rail.

   Lo que NO cambió: el roving tabindex —UNA sola parada de tab en toda la
   columna—, el `role="group"` con nombre, y el `<button>` nativo. Eso es lo que
   hace que la columna sea navegable con teclado, y cambiar la forma no puede
   cambiar eso. */

import React, { useEffect, useRef, useState } from 'react';

export interface MinimapMark {
  /** Token CSS del motor dominante en la página */
  color: string;
  /** Cantidad de hallazgos en la página */
  count: number;
  /** Nombre del motor dominante (para el texto, el `title` y el `aria-label`) */
  label: string;
}

interface ReviewMinimapProps {
  totalPages: number;
  marks: Map<number, MinimapMark>;
  currentPage: number;
  onPageClick: (page: number) => void;
}

/**
 * El ancho de ventana por debajo del cual la columna no se renderiza.
 *
 * Es un ANCHO DE VENTANA y no un ancho de columna, y hay que decirlo porque es la
 * decisión menos obvia del archivo: la columna son 44 px y podría entrar en casi
 * cualquier ventana, así que el corte no lo pone el ancho de la columna sino el
 * de lo que la rodea. Con la ventana angosta, el rack ya se retiró y el ancho se
 * lo queda la barra y el resto del chrome; una columna de 44 px al borde de eso
 * no es un mapa, es una lista de números sin contexto. El mismo número lo usa
 * `ReviewWorkbench` para decidir si guarda la columna en la grilla, así que la
 * decisión vive en un solo sitio y no puede desincronizarse.
 */
export const MINIMAP_ANCHO_MINIMO = 640;

export const MINIMAP_WIDTH = 44;

export const ReviewMinimap: React.FC<ReviewMinimapProps> = ({
  totalPages,
  marks,
  currentPage,
  onPageClick,
}) => {
  /* Roving tabindex: la marca activa es la ÚNICA parada de tab del minimapa */
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [ancho, setAncho] = useState(() => (typeof window === 'undefined' ? MINIMAP_ANCHO_MINIMO : window.innerWidth));

  useEffect(() => {
    const onResize = () => setAncho(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* La marca activa sigue a la página actual: entrar con Tab siempre aterriza
     en el contexto del documento. */
  useEffect(() => {
    if (totalPages <= 0) return;
    setActiveIndex(Math.min(Math.max(currentPage - 1, 0), totalPages - 1));
  }, [currentPage, totalPages]);

  if (totalPages <= 0) return null;
  if (ancho < MINIMAP_ANCHO_MINIMO) return null;

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
        width: `${MINIMAP_WIDTH}px`,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
        padding: '6px 4px',
        borderRight: '1px solid var(--color-border-subtle)',
        backgroundColor: 'var(--color-bg-surface-alt)',
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
        const plural = count === 1 ? 'hallazgo' : 'hallazgos';
        /* El alcance se LEE en el texto, el `title` y el `aria-label`: el conteo
           es el del ÍNDICE DE REVISIÓN, no el de la hoja medida, y en modo Hoja el
           minimapa está al lado de la hoja con la que discrepa. La calibración
           de la paginación del lienzo es un trabajo aparte y sigue ABIERTO: esto
           dice de qué número se trata, no arregla la diferencia. */
        const alcance = `Página ${page} de ${totalPages} de la revisión`;
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
            title={mark ? `${alcance} — ${count} ${plural} · ${mark.label}` : alcance}
            aria-label={mark ? `${alcance}, ${count} ${plural}, ${mark.label}` : `${alcance}, ${count} ${plural}`}
            style={{
              flex: isCurrent ? '2 1 0' : '1 1 0',
              /* El número va DENTRO: es lo que hace que 44 px sirvan de algo y lo
                 que saca al color de ser el único portador del significado. */
              minHeight: isCurrent ? '18px' : '14px',
              width: '100%',
              padding: 0,
              fontSize: '10px',
              fontWeight: isCurrent ? 700 : 500,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              color: isCurrent ? 'var(--color-text-on-accent)' : 'var(--color-text-secondary)',
              /* Token, no literal: los cinco radios del sistema son
                 `--radius-sm|md|lg|xl|full`, y un `1px` escrito a mano es un
                 radio fuera del vocabulario. */
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              /* Tres casos y ninguno es un literal:
                 - con marca: el color del motor, que ES un token de ENGINE_META;
                 - página actual sin marca: el acento, para que se vea dónde estás;
                 - página limpia: `--color-border-strong`, no `--color-border-subtle`.
                   El sutil no se ve sobre la superficie clara, y una página que no
                   se ve es indistinguible de una columna más corta. */
              backgroundColor: isCurrent
                ? mark?.color || 'var(--color-accent)'
                : mark?.color || 'var(--color-border-strong)',
              opacity: mark ? 1 : isCurrent ? 0.9 : 1,
              /* Anillo de acento de la página actual vía outline (libera
                 box-shadow para el focus ring global :focus-visible) */
              outline: isCurrent ? '1.5px solid var(--color-accent)' : undefined,
              transition:
                'background-color 0.15s ease, box-shadow 0.15s ease, outline-color 0.15s ease',
            }}
          >
            {page}
          </button>
        );
      })}
    </div>
  );
};

export default ReviewMinimap;

/* WordAPA7 — Minimapa de páginas para la vista "Revisión & IA".
   Columna angosta (~19px) con UNA marca por página del documento:
   - Color según el motor que detectó hallazgos en esa página.
   - Página actual resaltada (marca ancha con contorno de acento).
   - Click = saltar a esa página (navegación sin scroll a ciegas).
   Solo reorganiza espacio: usa tokens CSS existentes, sin nuevos colores. */

import React from 'react';

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
  if (totalPages <= 0) return null;

  return (
    <nav
      aria-label="Minimapa de páginas del documento"
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
        return (
          <button
            key={page}
            type="button"
            onClick={() => onPageClick(page)}
            title={
              mark
                ? `Página ${page} — ${mark.count} hallazgo(s) · ${mark.label}`
                : `Página ${page}`
            }
            aria-label={`Ir a la página ${page}`}
            style={{
              flex: isCurrent ? '2 1 0' : '1 1 0',
              minHeight: isCurrent ? '7px' : '2px',
              width: mark || isCurrent ? '100%' : '50%',
              margin: mark || isCurrent ? '0' : '0 auto',
              padding: 0,
              borderRadius: '1px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: isCurrent
                ? mark?.color || 'var(--text-secondary)'
                : mark?.color || 'var(--border-subtle)',
              opacity: mark ? 1 : isCurrent ? 0.9 : 0.45,
              boxShadow: isCurrent ? '0 0 0 1.5px var(--accent-primary)' : 'none',
              transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
            }}
          />
        );
      })}
    </nav>
  );
};

export default ReviewMinimap;

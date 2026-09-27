/* WordAPA7 — review: tira superior.
   Izquierda, los filtros por motor con su contador. Derecha, el cumplimiento
   (solo si fue medido), el paginador, "Siguiente hallazgo" y el salto entre la
   tarjeta de lectura y la hoja completa. Es la unica barra de la vista.

   La tira NO filtra nada: recibe los `groups` que ya trae filtrados de
   `useReviewWorkbench` y los REPRESENTA (el chip activo con `aria-pressed`).
   Quien estrecha el rack de acciones y el minimapa es el hook, no este archivo.

   `strokeWidth` va en 1.75 --el valor de `--icon-stroke`-- porque Lucide pide un
   número, no una cadena de token. Los colores, radios y espacios sí son tokens. */

import React from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, ScanLine, LayoutList, FileText } from 'lucide-react';
import type { EngineGroup, EngineFilter } from '../../hooks/useReviewWorkbench';

export interface ReviewStripProps {
  groups: EngineGroup[];
  filter: EngineFilter;
  onFilter: (f: EngineFilter) => void;
  totalPages: number;
  currentPage: number;
  onPage: (p: number) => void;
  onNextFinding: () => void;
  /** `null` = nadie midió el cumplimiento: la tira calla en vez de inventar 0 */
  compliance: number | null;
  viewMode: 'focus' | 'canvas';
  onViewMode: (m: 'focus' | 'canvas') => void;
  hasFindings: boolean;
  onScan: () => void;
  isScanning: boolean;
}

const chipStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid transparent',
  background: active ? 'var(--color-accent-soft)' : 'transparent',
  color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
  fontFamily: 'inherit',
  fontSize: 'var(--text-xs)',
  fontWeight: active ? 600 : 500,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
});

const countStyle: React.CSSProperties = {
  fontWeight: 700,
  opacity: 0.85,
};

export function ReviewStrip(p: ReviewStripProps) {
  const total = p.groups.reduce((n, g) => n + g.count, 0);

  return (
    <div
      style={{
        height: 44,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        padding: `0 var(--space-5)`,
        backgroundColor: 'var(--color-bg-surface)',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <div
        role="group"
        aria-label="Filtros por motor"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {!p.hasFindings && (
          <button
            type="button"
            onClick={p.onScan}
            disabled={p.isScanning}
            style={{ ...chipStyle(false), opacity: p.isScanning ? 0.6 : 1 }}
          >
            <ScanLine size={14} strokeWidth={1.75} aria-hidden />
            {p.isScanning ? 'Escaneando' : 'Escanear'}
          </button>
        )}
        <button
          type="button"
          aria-pressed={p.filter === 'all'}
          onClick={() => p.onFilter('all')}
          style={chipStyle(p.filter === 'all')}
        >
          <span>Todo</span>{/* El separador no es decoración: sin él el nombre
            accesible del chip es "Ortografía48", que se lee como una palabra. */}
          {' '}
          <span style={countStyle}>{total}</span>
        </button>
        {p.groups.map((g) => (
          <button
            key={g.engine}
            type="button"
            aria-pressed={p.filter === g.engine}
            onClick={() => p.onFilter(g.engine)}
            style={chipStyle(p.filter === g.engine)}
          >
            <span>{g.title}</span>{' '}
            <span style={countStyle}>{g.count}</span>
          </button>
        ))}
      </div>

      <div
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}
      >
        {p.compliance !== null && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: `var(--space-1) var(--space-2)`,
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border-subtle)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
            }}
          >
            Cumplimiento {p.compliance}%
          </span>
        )}

        {/* Sin páginas reales no hay "Página 1 de 0": el paginador desaparece
            en vez de anunciar un documento que no existe. */}
        {p.totalPages > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <button
              type="button"
              aria-label="Página anterior"
              disabled={p.currentPage <= 1}
              onClick={() => p.onPage(p.currentPage - 1)}
              style={{
                ...chipStyle(false),
                padding: 'var(--space-1) 6px',
                opacity: p.currentPage <= 1 ? 0.4 : 1,
              }}
            >
              <ChevronLeft size={14} strokeWidth={1.75} aria-hidden />
            </button>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              Página {p.currentPage} de {p.totalPages}
            </span>
            <button
              type="button"
              aria-label="Página siguiente"
              disabled={p.currentPage >= p.totalPages}
              onClick={() => p.onPage(p.currentPage + 1)}
              style={{
                ...chipStyle(false),
                padding: 'var(--space-1) 6px',
                opacity: p.currentPage >= p.totalPages ? 0.4 : 1,
              }}
            >
              <ChevronRight size={14} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={p.onNextFinding}
          style={{
            ...chipStyle(false),
            background: 'var(--color-accent)',
            color: 'var(--color-text-on-accent)',
            fontWeight: 600,
          }}
        >
          <span>Siguiente hallazgo</span>
          <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
        </button>

        <div
          role="group"
          aria-label="Modo de vista"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: 2,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg-surface-alt)',
          }}
        >
          {([['focus', 'Foco', LayoutList], ['canvas', 'Hoja', FileText]] as const).map(
            ([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                aria-label={label}
                aria-pressed={p.viewMode === id}
                onClick={() => p.onViewMode(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: `var(--space-1) var(--space-2)`,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: p.viewMode === id ? 'var(--color-bg-surface)' : 'transparent',
                  color:
                    p.viewMode === id ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Icon size={14} strokeWidth={1.75} aria-hidden />
                {label}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

export default ReviewStrip;

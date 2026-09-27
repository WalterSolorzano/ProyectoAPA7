/* WordAPA7 — review: tira superior.
   Izquierda, los filtros por motor con su contador. Derecha, el cumplimiento
   (solo si fue medido), el paginador, "Siguiente hallazgo" y el salto entre la
   tarjeta de lectura y la hoja completa. Es la unica barra de la vista.

   La tira NO filtra nada: `engineGroups` es el resumen SIN filtro que publica el
   hook y esta barra lo REPRESENTA (el chip activo, con `aria-pressed`). `total`
   es `metrics.total` del hook; la tira no lo re-deriva sumando sus propios chips,
   porque esa suma es lo que el filtro deja ver. Quien estrecha el rack de
   acciones y el minimapa es el hook, no este archivo.

   `strokeWidth` va en 1.75 --el valor de `--icon-stroke`-- porque Lucide pide un
   número, no una cadena de token. Colores, radios y casi todos los espacios son
   tokens; quedan literales el alto de la barra (44), el padding horizontal de las
   flechas (6) y el gutter del toggle (2), porque no existe token para 2, 6 ni 44. */

import React from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, ScanLine, LayoutList, FileText } from 'lucide-react';
import type { EngineGroup, EngineFilter } from '../../hooks/useReviewWorkbench';

export interface ReviewStripProps {
  /** Un grupo por motor SIN filtro (`allGroups` del hook). Alimentado con
   *  `groups` —que sí está filtrado— los chips pierden a los demás motores en
   *  cuanto hay un filtro activo, y no hay forma de volver a elegir otro. */
  engineGroups: EngineGroup[];
  filter: EngineFilter;
  onFilter: (f: EngineFilter) => void;
  /** Total de hallazgos del DOCUMENTO (`metrics.total`), no la suma de los
   *  chips: esa suma es lo que el filtro deja ver, y "Todo" tiene que decir
   *  todo. */
  total: number;
  totalPages: number;
  currentPage: number;
  onPage: (p: number) => void;
  onNextFinding: () => void;
  /** `null` = nadie midió el cumplimiento. La tira lo DICE ("sin medir") en
   *  vez de callar: un hueco y un 0 se leen igual. */
  compliance: number | null;
  viewMode: 'focus' | 'canvas';
  onViewMode: (m: 'focus' | 'canvas') => void;
  hasFindings: boolean;
  /** Hay hallazgos VISIBLES con el filtro activo. Lo publica el hook
   *  (`visibleCount`), que es quien tiene el predicado del filtro: derivarlo
   *  acá fue una re-derivación de una regla de otro archivo. Si no llega, esta
   *  barra cae a `hasFindings` (comportamiento de siempre). */
  canNextFinding?: boolean;
  /** El escaneo del hook devuelve una promesa; el tipo lo dice en vez de
   *  mentir con un `() => void` que devolvería un rechazo sin manejar. */
  onScan: () => void | Promise<void>;
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
  /* `scanAll` publica el resultado de cada motor con un toast propio; lo único
     que le falta a la vista es no dejar su rechazo como una promesa sin
     manejar en la consola de la persona. Este guardián NO informa del fallo:
     informar del escaneo es del hook, no de una tira de 44px. */
  const escanear = () => {
    Promise.resolve(p.onScan()).catch(() => undefined);
  };
  const puedeAvanzar = p.canNextFinding ?? p.hasFindings;

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
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {/* El escaneo NO es un filtro: vive fuera del grupo para que un lector
            de pantalla no lo anuncie como parte del conjunto de filtros. Y no
            desaparece cuando hay hallazgos: un "Escanear" que solo existe en el
            documento sin hallazgos quita la única forma de re-escanear después
            de editar, que es justo cuando hace falta, y deja el estado
            "Escaneando" inalcanzable en el único caso en que se quiere un
            rescan. El botón se apaga, no se esconde. */}
        <button
          type="button"
          onClick={escanear}
          disabled={p.isScanning}
          style={{ ...chipStyle(false), opacity: p.isScanning ? 0.6 : 1 }}
        >
          <ScanLine size={14} strokeWidth={1.75} aria-hidden />
          {p.isScanning ? 'Escaneando' : 'Escanear'}
        </button>
        <div
          role="group"
          aria-label="Filtros por motor"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0 }}
        >
          <button
            type="button"
            aria-pressed={p.filter === 'all'}
            onClick={() => p.onFilter('all')}
            style={chipStyle(p.filter === 'all')}
          >
            <span>Todo</span>
            {/* El separador no es decoración: sin él el nombre accesible del
                chip es "Ortografía48", que se lee como una sola palabra. */}
            {' '}
            <span style={countStyle}>{p.total}</span>
          </button>
          {p.engineGroups.map((g) => (
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
      </div>

      <div
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}
      >
        {/* El cumplimiento tiene TRES estados, no dos: medido, sin medir, y (lo
            que no puede ser) un 0 inventado. Callarse cuando nadie midió deja
            el hueco indistinguible de "está todo bien": el HUD antiguo decía
            "Sin analizar" y esa es la parte de la información que faltaba. */}
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
            color: p.compliance === null
              ? 'var(--color-text-tertiary)'
              : 'var(--color-text-secondary)',
          }}
        >
          {p.compliance === null ? 'Cumplimiento sin medir' : `Cumplimiento ${p.compliance}%`}
        </span>

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
            {/* El número y su alcance van en nodos separados. El alcance se
                LEE ("de la revisión"), no se esconde en un `title` que quien
                mira la barra no ve y un lector de pantalla puede no
                anunciar: el conteo del índice no es el de la hoja medida, y
                por eso tiene que estar a la vista. `FocusReadingCard` dice
                lo mismo desde T14. */}
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 'var(--space-1)' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                Página {p.currentPage} de {p.totalPages}
              </span>
              <span
                title="Es el conteo del índice de revisión, el mismo que usa el minimapa. Puede diferir del de la hoja hasta que el motor mida el reflujo del lienzo."
                style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}
              >
                de la revisión
              </span>
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
          disabled={!puedeAvanzar}
          onClick={p.onNextFinding}
          style={{
            ...chipStyle(false),
            background: 'var(--color-accent)',
            color: 'var(--color-text-on-accent)',
            fontWeight: 600,
            /* Sin hallazgos (o sin hallazgos visibles con el filtro puesto) el
               botón se apaga, pero NO desaparece: es parte de la barra y un
               control que aparece y desaparece hace saltar el resto.
               Deshabilitado dice "aquí no hay nada" sin mentir. */
            opacity: puedeAvanzar ? 1 : 0.4,
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

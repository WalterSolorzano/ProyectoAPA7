/* WordAPA7 — review: tarjeta de motor y fila de subtipo.
   Cabecera con el nombre, el conteo y la acción en masa pegada a la
   derecha. Solo el grupo mas critico arranca abierto, y esa decision la
   toma useReviewWorkbench, no este componente.

   El RÓTULO y la ACCIÓN los trae el grupo ya calculados (`massLabel`,
   `massAction`): esta tarjeta no decide si un motor acepta o marca, solo
   pinta lo que el hook dice y se lo devuelve a `onMassAction`. Por eso un
   grupo con `massLabel` vacío (lo que `massLabelFor('none')` produce) NO
   pinta botón: un control sin nombre no es accionable, es ruido.

   Las FILAS las compone la vista: una `SubtypeRow` por subtipo, cada una con
   su propio `open` y `onToggle`, y el estado de cuáles están abiertas es el
   `openSubtypes` del hook. Por eso esta tarjeta no recibe `openSubtypes`
   ni `onToggleSubtype`: dos fuentes de verdad para lo mismo sería una que
   miente.

   `strokeWidth` va en 1.75 --el valor de `--icon-stroke`-- porque Lucide pide
   un número, no una cadena de token. Colores y radios son tokens, y el
   espaciado usa `--space-*` donde el token existe (4, 8, 12); quedan
   literales los valores para los que no hay token (3, 5, 6, 10, 14, 18, 20). */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AuditItem, EngineGroup, SubtypeGroup } from '../../hooks/useReviewWorkbench';

export interface EngineGroupCardProps {
  group: EngineGroup;
  open: boolean;
  onToggle: () => void;
  onMassAction: (group: EngineGroup) => void;
  /** Qué parte del motor cubre la acción en masa, en palabras. La cabecera
   *  promete "Aceptar todas" y `runGroupAction` solo toca los subtipos que
   *  comparten su acción: sin este aviso, el motor entero parece tocado y no
   *  lo está. Quien lo calcula es la vista (que ve los grupos), no este
   *  componente (que no sabe qué va a hacer la acción). */
  massNote?: string;
  children: React.ReactNode;
}

export function EngineGroupCard({ group, open, onToggle, onMassAction, massNote, children }: EngineGroupCardProps) {
  const Chevron = open ? ChevronDown : ChevronRight;
  const regionId = `engine-${group.engine}`;
  return (
    <section
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
          padding: '10px 14px',
          backgroundColor: 'var(--color-bg-surface-alt)',
          borderBottom: open ? '1px solid var(--color-border-subtle)' : 'none',
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          /* Solo cuando la región existe: cerrada no está en el DOM. */
          aria-controls={open ? regionId : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: 0,
            background: 'transparent', border: 'none', padding: 0,
            font: 'inherit', fontSize: 'var(--text-xs)', fontWeight: 600,
            color: 'var(--color-text-primary)', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <Chevron size={13} strokeWidth={1.75} aria-hidden style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {group.title} ({group.count})
          </span>
        </button>
        {/* 'mark' no es un borrón en bloque: se marca y el texto queda igual, y
            por eso el botón va fantasma en vez de sólido. */}
        {group.massLabel && (
          <button
            type="button"
            onClick={() => onMassAction(group)}
            style={{
              flexShrink: 0, padding: 'var(--space-1) 10px',
              border: group.massAction === 'mark' ? '1px solid var(--color-border-subtle)' : 'none',
              borderRadius: 'var(--radius-sm)',
              background: group.massAction === 'mark' ? 'transparent' : 'var(--color-accent)',
              color: group.massAction === 'mark' ? 'var(--color-text-secondary)' : 'var(--color-text-on-accent)',
              font: 'inherit', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {group.massLabel}
          </button>
        )}
      </div>
      {massNote && (
        <p style={{ margin: 0, padding: '6px 14px', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          {massNote}
        </p>
      )}
      {open && <div id={regionId}>{children}</div>}
    </section>
  );
}

export interface SubtypeRowProps {
  group: SubtypeGroup;
  open: boolean;
  onToggle: () => void;
  onMassAction: (group: SubtypeGroup) => void;
  children: React.ReactNode;
}

/** `AuditItem['severity']` es el vocabulario de la CAPA DE REVISIÓN
 *  ('critical' | 'high' | 'medium' | 'low'), no el del backend
 *  ('info' | 'warn' | 'error'): el hook ya lo tradujo. Los cuatro tienen
 *  color, para que el ×N diga de un vistazo cuán grave es lo que agrupa.
 *
 *  `medium` NO es `--color-info`: ese token y `--color-accent` son el mismo
 *  azul (#4f7cff), y la sugerencia de la fila va en el acento. Con el mismo
 *  color, el badge y la sugerencia se leerían como la misma señal. */
const SEVERITY_COLOR: Record<AuditItem['severity'], string> = {
  critical: 'var(--color-danger)',
  high: 'var(--color-warning)',
  medium: 'var(--color-text-secondary)',
  low: 'var(--color-text-tertiary)',
};

const SEVERITY_RANK: Record<AuditItem['severity'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** El badge se tiñe por la PEOR severidad del grupo, no por su primer ítem:
 *  el orden de los ítems lo produce el motor, no la gravedad, y un grupo con
 *  un `critical` al final se pintaría igual que uno de puros `low`. Grupo
 *  vacío → `low`, que es lo menos grave que existe. */
const peorSeveridad = (items: AuditItem[]): AuditItem['severity'] =>
  items.reduce<AuditItem['severity']>(
    (peor, it) => (SEVERITY_RANK[it.severity] < SEVERITY_RANK[peor] ? it.severity : peor),
    'low',
  );

export function SubtypeRow({ group, open, onToggle, onMassAction, children }: SubtypeRowProps) {
  const primero = group.items[0];
  const Chevron = open ? ChevronDown : ChevronRight;
  const regionId = `subtype-${group.key}`;
  /* Páginas REALES y únicas. Un hallazgo sin página (`null`) no aporta una:
     inventarla sería la estimación por caracteres que este proyecto ya
     eliminó (`pageOf` es el índice real del lienzo). */
  const paginas = [...new Set(group.items.map((i) => i.pageNumber).filter((p): p is number => p != null))];
  return (
    <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 'var(--space-2)', padding: '10px 14px',
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={open ? regionId : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: 0,
            background: 'transparent', border: 'none', padding: 0,
            font: 'inherit', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <Chevron size={12} strokeWidth={1.75} aria-hidden style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          <span
            style={{
              flexShrink: 0, minWidth: 20, height: 18, padding: '0 5px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-bg-surface-alt)',
              color: SEVERITY_COLOR[peorSeveridad(group.items)],
              fontSize: 'var(--text-xs)', fontWeight: 700,
            }}
          >
            ×{group.items.length}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', flexShrink: 0 }}>{group.label}</span>
          {primero?.originalText && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 'var(--text-xs)' }}>
              {/* Original y sugerencia se RECORTAN los dos: una leyenda de 56
                  caracteres tiene que compartir la fila con el badge, la
                  etiqueta y las páginas, y lo que no se encoge se pinta encima
                  del botón de acción. `title` deja el texto íntegro a un hover. */}
              <span
                title={primero.originalText}
                style={{
                  minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textDecoration: 'line-through', color: 'var(--color-text-tertiary)',
                }}
              >
                {primero.originalText}
              </span>
              {primero.suggestedText && (
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'baseline', gap: 6, minWidth: 0,
                    color: 'var(--color-accent)', fontWeight: 600,
                  }}
                >
                  {/* La flecha va en su propio elemento: mezclada con la
                      sugerencia haría que el texto propuesto no se pudiera
                      seleccionar ni leer como unidad. */}
                  <span aria-hidden style={{ flexShrink: 0 }}>→</span>
                  <span
                    title={primero.suggestedText}
                    style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {primero.suggestedText}
                  </span>
                </span>
              )}
            </span>
          )}
          {paginas.length > 0 && (
            <span style={{ flexShrink: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              pág. {paginas.slice(0, 3).join(', ')}{paginas.length > 3 ? '…' : ''}
            </span>
          )}
        </button>
        {group.massLabel && (
          <button
            type="button"
            onClick={() => onMassAction(group)}
            style={{
              flexShrink: 0, padding: '3px var(--space-2)',
              border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)',
              background: 'transparent', color: 'var(--color-text-primary)',
              font: 'inherit', fontSize: 'var(--text-xs)', fontWeight: 500, cursor: 'pointer',
            }}
          >
            {group.massLabel}
          </button>
        )}
      </div>
      {open && <div id={regionId}>{children}</div>}
    </div>
  );
}

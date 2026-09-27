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
import { SEVERITY_RANK } from '../../hooks/useReviewWorkbench';
import type { AuditItem, EngineGroup, SubtypeGroup } from '../../hooks/useReviewWorkbench';

export interface EngineGroupCardProps {
  group: EngineGroup;
  open: boolean;
  onToggle: () => void;
  onMassAction: (group: EngineGroup) => void;
  /** Qué parte del motor cubre la acción en masa, en palabras. La cabecera
   *  promete "Aceptar todas" y `runGroupAction` solo toca los subtipos que
   *  comparten su acción: sin este aviso, el motor entero parece tocado y no
   *  lo está. La REDACCIÓN es de la vista; los dos números que la sostienen
   *  (`covered` y `count`) los publica el hook. */
  massNote?: string;
  /** Hay una escritura al documento en curso (`isApplying` del hook). */
  busy?: boolean;
  children: React.ReactNode;
}

export function EngineGroupCard({ group, open, onToggle, onMassAction, massNote, busy, children }: EngineGroupCardProps) {
  const Chevron = open ? ChevronDown : ChevronRight;
  const regionId = `engine-${group.engine}`;
  /* El acento sólido es de UNA sola acción: `accept`, la que de verdad corrige el
     texto de alguien. `mark` va fantasma porque no borra nada. Y los dos
     mecanismos de DOCUMENTO —`resolveGhosts` y `autoCaption`, que rotulan el
     archivo entero y llaman a la red— tampoco lo llevan: son igual de
     irreversibles que aceptar, pero no son la corrección del texto, y
     vestirse del acento de la aceptación hacía que las tres acciones de la
     cabecera se leyeran como la misma. Ahora la de documento se ve como lo que
     es: un botón con borde que hay que querer pulsar. */
  const solido = group.massAction === 'accept';
  const atenuado = group.massAction === 'mark';
  /* El cerrojo de la acción en masa, que la vista cablea desde el hook. Vale
     solo para `accept`: los otros mecanismos son de documento y no llaman
     `updateElementText` por hallazgo, así que re-ejecutarlos no duplica
     escrituras (sí vuelve a rotular, que es idempotente). */
  const grupoApretado = group.massAction === 'accept' && !!busy;
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
            /* Se apaga con la acción en curso: la cabecera comparte mecanismo
               con el detalle, y un "Aceptar todas" que se puede pulsar dos
               veces escribe dos veces el mismo texto. */
            disabled={grupoApretado}
            style={{
              flexShrink: 0, padding: 'var(--space-1) 10px',
              opacity: grupoApretado ? 0.6 : 1,
              cursor: grupoApretado ? 'default' : 'pointer',
              border: solido ? 'none' : '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-sm)',
              background: solido ? 'var(--color-accent)' : 'transparent',
              color: solido
                ? 'var(--color-text-on-accent)'
                : atenuado
                  ? 'var(--color-text-secondary)'
                  : 'var(--color-text-primary)',
              font: 'inherit', fontSize: 'var(--text-xs)', fontWeight: 600,
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
  /** Cerrojo de la acción en masa, igual que en la cabecera. */
  busy?: boolean;
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

/* El ORDEN de gravedad NO se re-declara aquí: `SEVERITY_RANK` se importa del
   hook, que es quien ordena los subtipos. Tener las dos tablas era un modo de
   fallo silencioso —un nivel nuevo en el vocabulario iba al hook y el badge se
   quedaba con el viejo, de modo que el ×N se teñía con una gravedad que el sort
   no compartía, sin que nada lo dijera—. Ahora `peorSeveridad` lee la MISMA
   tabla que el sort, así que no pueden discrepar. */

/** El badge se tiñe por la PEOR severidad del grupo, no por su primer ítem:
 *  el orden de los ítems lo produce el motor, no la gravedad, y un grupo con
 *  un `critical` al final se pintaría igual que uno de puros `low`. Grupo
 *  vacío → `low`, que es lo menos grave que existe. */
const peorSeveridad = (items: AuditItem[]): AuditItem['severity'] =>
  items.reduce<AuditItem['severity']>(
    (peor, it) => (SEVERITY_RANK[it.severity] < SEVERITY_RANK[peor] ? it.severity : peor),
    'low',
  );

export function SubtypeRow({ group, open, onToggle, onMassAction, busy, children }: SubtypeRowProps) {
  const primero = group.items[0];
  const Chevron = open ? ChevronDown : ChevronRight;
  const regionId = `subtype-${group.key}`;
  /* Páginas REALES, únicas y EN ORDEN. Un `Set` conserva el orden en que las
     aporta el primer hallazgo de cada una, así que una fila podía leerse
     "pág. 7, 2, 5": el orden de aparición de los hallazgos no es el orden del
     documento, y una lista de páginas desordenada se lee como un error de
     paginación. */
  const paginas = [...new Set(group.items.map((i) => i.pageNumber).filter((p): p is number => p != null))]
    .sort((a, b) => a - b);
  const apretado = group.action === 'accept' && !!busy;
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
            disabled={apretado}
            style={{
              flexShrink: 0, padding: '3px var(--space-2)',
              border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)',
              background: 'transparent', color: 'var(--color-text-primary)',
              font: 'inherit', fontSize: 'var(--text-xs)', fontWeight: 500,
              opacity: apretado ? 0.6 : 1,
              cursor: apretado ? 'default' : 'pointer',
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

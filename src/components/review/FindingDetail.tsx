/* WordAPA7 — review: detalle de una aparicion.
   Aqui se ve el texto original, la propuesta y la accion. El detector de
   IA no tiene "Aplicar correccion": es probabilistico, y la unica accion
   honesta es marcarlo para que lo mire una persona.

   Tres reglas que este componente no re-deriva: qué motor es (el
   `category` del hallazgo), si hay corrección que aplicar (el
   `suggestedText`) y qué hace la acción (el `onAccept` / `onMark` que le
   pase la vista). Un hallazgo objetivo SIN sugerencia tampoco ofrece
   "Aplicar corrección": no hay nada que aplicar, y un botón que llama al
   reescritor del backend sobre un texto que el motor no propuso sería
   inventar la corrección.

   `strokeWidth` va en 1.75 --el valor de `--icon-stroke`-- porque Lucide pide
   un número, no una cadena de token. */

import React from 'react';
import { ChevronLeft, ChevronRight, Check, Flag, X } from 'lucide-react';
import type { AuditItem } from '../../hooks/useReviewWorkbench';

export interface FindingDetailProps {
  item: AuditItem;
  index: number;
  total: number;
  onStep: (delta: number) => void;
  onAccept: (item: AuditItem) => void;
  onMark: (item: AuditItem) => void;
  onDismiss: (item: AuditItem) => void;
  busy: boolean;
}

interface AccionProps {
  label: string;
  Icon: typeof Check;
  onClick: () => void;
  disabled: boolean;
  /** La acción que cambia el documento va sólida; la que solo lo anota, fantasma. */
  primary: boolean;
}

function Accion({ label, Icon, onClick, disabled, primary }: AccionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 10px',
        border: primary ? 'none' : '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-sm)',
        background: primary ? 'var(--color-accent)' : 'transparent',
        color: primary ? 'var(--color-text-on-accent)' : 'var(--color-text-primary)',
        font: 'inherit', fontSize: 'var(--text-xs)', fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
      }}
    >
      <Icon size={12} strokeWidth={1.75} aria-hidden />
      {label}
    </button>
  );
}

const monoStyle: React.CSSProperties = {
  margin: 0,
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-xs)',
  color: 'var(--color-text-primary)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

export function FindingDetail({ item, index, total, onStep, onAccept, onMark, onDismiss, busy }: FindingDetailProps) {
  /* El detector de IA es el motor probabilístico: propone, la persona
     decide. Ninguna otra ruta de la app aplica una sugerencia suya. */
  const esIA = item.category === 'ai';
  const conSugerencia = Boolean(item.suggestedText);
  return (
    <div
      style={{
        padding: '12px 14px',
        borderTop: '1px solid var(--color-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        {item.pageNumber != null ? (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Pág. {item.pageNumber}</span>
        ) : (
          /* Una referencia huérfana vive en la bibliografía y la lista no tiene
             página: se dice, en vez de mostrar la página 0 o la del final. */
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Sin página asignada</span>
        )}
        {total > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <button
              type="button"
              aria-label="Aparición anterior"
              onClick={() => onStep(-1)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}
            >
              <ChevronLeft size={13} strokeWidth={1.75} aria-hidden />
            </button>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{index + 1} de {total}</span>
            <button
              type="button"
              aria-label="Siguiente aparición"
              onClick={() => onStep(1)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}
            >
              <ChevronRight size={13} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        )}
      </div>

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>{item.detail}</p>

      <pre style={{ ...monoStyle, backgroundColor: 'var(--severity-critical-tint)' }}>{item.originalText}</pre>

      {conSugerencia && (
        <>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
            {esIA ? 'Revisión manual (motor probabilístico)' : 'Sugerencia académica APA 7'}
          </p>
          <pre style={{ ...monoStyle, backgroundColor: 'var(--severity-success-tint)' }}>{item.suggestedText}</pre>
        </>
      )}

      {esIA && (
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          Este motor es probabilístico: propone, no decide. Revísalo tú antes de aplicarlo.
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {esIA && (
          <Accion label="Marcar para revisar" Icon={Flag} onClick={() => onMark(item)} disabled={busy} primary />
        )}
        {!esIA && conSugerencia && (
          <Accion label="Aplicar corrección" Icon={Check} onClick={() => onAccept(item)} disabled={busy} primary />
        )}
        <Accion label="Descartar" Icon={X} onClick={() => onDismiss(item)} disabled={busy} primary={false} />
      </div>
    </div>
  );
}

export default FindingDetail;

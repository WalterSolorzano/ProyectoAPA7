/* WordAPA7 — review: detalle de una aparicion.
   Aqui se ve el texto original, la propuesta y la accion.

   LA AFORDANCE SIGUE A LA ACCIÓN DECLARADA, no a la presencia de una
   sugerencia. El hook tiene cuatro mecanismos (`SubtypeAction`) y solo uno
   de ellos es "aplicar este texto": `accept`. Estructura (`autoCaption`)
   trae `suggestedText` —una leyenda genérica— y_ofrecer "Aplicar
   corrección" mandaría esa cadena al documento en vez de rotular, que es
   justo lo que el comentario del hook en `engineAction` dice que no pase
   ("Estructura rotula, no corrige"). Por eso la acción viaja como prop: la
   vista la pasa tal cual viene de `SubtypeGroup.action` y este componente
   no mantiene una lista de motores.

   El detector de IA tampoco tiene "Aplicar corrección": es probabilistico,
   y su unica accion honesta es marcarlo para que lo mire una persona.

   `strokeWidth` va en 1.75 --el valor de `--icon-stroke`-- porque Lucide pide
   un número, no una cadena de token. Colores y radios son tokens, y el
   espaciado usa `--space-*` donde el token existe (4, 8, 12); quedan
   literales los valores sin token (0, 5, 10, 14). */

import React from 'react';
import { ChevronLeft, ChevronRight, Check, Flag, Quote, Tags, X, type LucideIcon } from 'lucide-react';
import type { AuditItem, SubtypeAction } from '../../hooks/useReviewWorkbench';
import { phaseLabel } from '../../lib/auditItems';

export interface FindingDetailProps {
  item: AuditItem;
  /** Acción declarada por el grupo de la vista (`SubtypeGroup.action`). Es la
   *  que decide qué botón existe; la lista de motores no está aquí. */
  action: SubtypeAction;
  index: number;
  total: number;
  /** La persona ya marcó este hallazgo para revisión manual (`markedIds` del
   *  hook). Sin esto, "Marcar para revisar" es un botón sin consecuencia
   *  observable: se aprieta, sale un toast y no cambia nada en la vista, así
   *  que se vuelve a apretar. El estado se PINTA, no se recuerda. */
  marked?: boolean;
  onStep: (delta: number) => void;
  onAccept: (item: AuditItem) => void;
  onMark: (item: AuditItem) => void;
  onDismiss: (item: AuditItem) => void;
  /** Mecanismo del motor para las acciones que NO son "aplicar esta
   *  sugerencia" (rotular figuras y tablas, resolver citas fantasma): la
   *  vista lo cablea a `runGroupAction` del hook. El detalle no inventa un
   *  mecanismo propio, y por eso es opcional: sin él, esas acciones no se
   *  ofrecen. */
  onEngineAction?: () => void;
  busy: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

interface AccionProps {
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  disabled: boolean;
  /** La acción que cambia el documento va sólida; la que solo lo anota, fantasma. */
  primary: boolean;
  title?: string;
}

function Accion({ label, Icon, onClick, disabled, primary, title }: AccionProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={title}
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

/** Los mecanismos que el motor ejecuta sobre el DOCUMENTO, no sobre este
 *  texto. Sus rótulos dicen "todo" porque es lo que hacen. */
const ACCION_MOTOR: Partial<Record<SubtypeAction, { label: string; Icon: LucideIcon; title: string }>> = {
  autoCaption: {
    label: 'Rotular todo',
    Icon: Tags,
    title: 'Redacta la leyenda de todas las figuras y tablas del documento, no solo de esta.',
  },
  resolveGhosts: {
    label: 'Resolver citas',
    Icon: Quote,
    title: 'Resuelve las citas ausentes en la bibliografía de todo el documento.',
  },
};

/** Encabezado del bloque de propuesta: dice de dónde salió ese texto. */
const ETIQUETA_PROPUESTA = (action: SubtypeAction, esIA: boolean): string => {
  if (action === 'accept') return 'Sugerencia académica APA 7';
  if (action === 'mark') {
    return esIA ? 'Revisión manual (motor probabilístico)' : 'Revisión manual (sin corrección automática)';
  }
  if (action === 'autoCaption') return 'Rotulación propuesta por el motor';
  if (action === 'resolveGhosts') return 'Referencia que el motor no encontró';
  return 'Detalle del hallazgo';
};

/** Lo que la acción NO puede hacer por sí sola, dicho en la vista en vez de
 *  descubrirlo en un silencio. Es el mismo mensaje que el toast del hook. */
const NOTA_ACCION: Partial<Record<SubtypeAction, string>> = {
  autoCaption: 'El motor no corrige este texto: redacta la leyenda de todas las figuras y tablas del documento.',
  resolveGhosts: 'La cita no se resuelve aquí: el motor la resuelve en el documento completo.',
  none: 'Este hallazgo no tiene corrección automática: revísalo o descártalo.',
};

const monoStyle: React.CSSProperties = {
  margin: 0,
  padding: 'var(--space-2) 10px',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-xs)',
  color: 'var(--color-text-primary)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

/** El aviso de que no hay texto. Mismo papel que el `pre`, pero DICE lo que pasa
 *  en vez de mostrar una cadena que parece una cita y no lo es. El texto es el
 *  mismo para todos los motores, porque es una verdad sobre el elemento y no
 *  sobre el hallazgo. */
const avisoStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  lineHeight: 1.5,
  margin: 0,
  padding: 'var(--space-2) 10px',
  borderRadius: 'var(--radius-sm)',
  fontStyle: 'italic',
};

/** Lo que se dice cuando el hallazgo apunta a un elemento sin texto. Una figura
 *  o una tabla sin leyenda: no hay texto al que aplicar una corrección, y decirlo
 *  es distinto de inventar un texto con forma de documento. */
const AVISO_SIN_TEXTO: Record<'figura' | 'tabla', string> = {
  figura:
    'Esta figura todavía no tiene leyenda, así que no hay texto al que aplicar una corrección.',
  tabla:
    'Esta tabla todavía no tiene título, así que no hay texto al que aplicar una corrección.',
};

export function FindingDetail({
  item,
  action,
  index,
  total,
  marked = false,
  onStep,
  onAccept,
  onMark,
  onDismiss,
  onEngineAction,
  busy,
  isSelected = false,
  onSelect,
}: FindingDetailProps) {
  /* El detector de IA es el motor probabilístico: propone, la persona
     decide. Ninguna otra ruta de la app aplica una sugerencia suya. */
  const esIA = item.category === 'ai';
  const conSugerencia = Boolean(item.suggestedText);
  const motor = action !== 'none' && action !== 'accept' && action !== 'mark' ? ACCION_MOTOR[action] : undefined;
  return (
    <div
      onClick={onSelect}
      style={{
        padding: 'var(--space-3) 14px',
        borderTop: '1px solid var(--color-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        backgroundColor: isSelected ? 'var(--color-bg-surface-alt)' : 'transparent',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'background-color 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        {/* La FASE como contexto, no como eje. Los H1 son las fases del
            documento (spec D1) y el usuario piensa en ellas, así que el
            hallazgo dice en qué fase está en vez de que el usuario lo adivine
            por el subtipo del motor. Una regla general no pertenece a ninguna
            fase: se nombra como "todo el documento", que es lo que es. */}
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          {phaseLabel(item.phase)}
          {item.readOnly && ' · solo lectura'}
        </span>
        {item.pageNumber != null ? (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Pág. {item.pageNumber}</span>
        ) : (
          /* Una referencia huérfana vive en la bibliografía y la lista no tiene
             página: se dice, en vez de mostrar la página 0 o la del final. */
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Sin página asignada</span>
        )}
        {total > 1 && (
          /* Navegar es LEER, no escribir: estas flechas no se apagan con
             `busy` porque no pueden dejar una operación a medias. */
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <button
              type="button"
              aria-label="Aparición anterior"
              onClick={(e) => {
                e.stopPropagation();
                onStep(-1);
              }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}
            >
              <ChevronLeft size={13} strokeWidth={1.75} aria-hidden />
            </button>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{index + 1} de {total}</span>
            <button
              type="button"
              aria-label="Siguiente aparición"
              onClick={(e) => {
                e.stopPropagation();
                onStep(1);
              }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}
            >
              <ChevronRight size={13} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        )}
      </div>

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>{item.detail}</p>

      {item.sinTexto ? (
        <p style={{ ...avisoStyle, backgroundColor: 'var(--severity-critical-tint)' }}>
          {AVISO_SIN_TEXTO[item.sinTexto.clase]}
        </p>
      ) : (
        <pre style={{ ...monoStyle, backgroundColor: 'var(--severity-critical-tint)' }}>{item.originalText}</pre>
      )}

      {conSugerencia && (
        <>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
            {ETIQUETA_PROPUESTA(action, esIA)}
          </p>
          <pre style={{ ...monoStyle, backgroundColor: 'var(--severity-success-tint)' }}>{item.suggestedText}</pre>
        </>
      )}

      {NOTA_ACCION[action] && (
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{NOTA_ACCION[action]}</p>
      )}

      {esIA && (
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          Este motor es probabilístico: propone, no decide. Revísalo tú antes de aplicarlo.
        </p>
      )}

      {marked && (
        <p
          role="status"
          style={{ margin: 0, fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}
        >
          Marcado para revisión manual. El texto original no se modifica.
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {action === 'mark' && (
          /* Fantasma, no sólida: marcar ANOTA y no cambia el documento, y el
             acento sólido está reservado para lo que sí lo cambia (el mismo
             criterio que fijó la cabecera del motor en `EngineGroupCard`). En un
             hallazgo de IA es el ÚNICO botón, y llevaba el peso visual que la
             rama reservó para "aceptar" — justo en el motor que nunca acepta. */
          <Accion
            label={marked ? 'Marcado para revisar' : 'Marcar para revisar'}
            Icon={Flag}
            onClick={() => onMark(item)}
            disabled={busy || marked}
            primary={false}
            title={marked ? 'Este hallazgo ya está marcado para revisión manual.' : undefined}
          />
        )}
        {action === 'accept' && conSugerencia && !item.readOnly && (
          /* `!item.readOnly` no es redundante con `conSugerencia`: el motor
             garantiza que un hallazgo de solo lectura no trae sugerencia, pero
             esta puerta no depende de esa garantía. Si mañana un motor nuevo
             publica un hallazgo de portada con texto sugerido, el botón igual
             no aparece — y la portada original no se muta (AGENTS.md §1). */
          <Accion label="Aplicar corrección" Icon={Check} onClick={() => onAccept(item)} disabled={busy} primary />
        )}
        {motor && onEngineAction && (
          /* Los dos mecanismos de DOCUMENTO tampoco llevan el acento sólido, por
             la misma razón que en la cabecera del motor: redactan leyendas y
             resuelven referencias sobre todo el archivo, no corrigen el texto de
             este hallazgo, y vestirse del acento de la aceptación hacía que las
             dos acciones de la fila se leyeran como la misma. */
          <Accion
            label={motor.label}
            Icon={motor.Icon}
            onClick={onEngineAction}
            disabled={busy}
            primary={false}
            title={motor.title}
          />
        )}
        <Accion label="Descartar" Icon={X} onClick={() => onDismiss(item)} disabled={busy} primary={false} />
      </div>
    </div>
  );
}

export default FindingDetail;

/* WordAPA7 — una fila del índice: el nivel, el nombre, la medida y el estado.
 *
 * UNA FILA, CUATRO DATOS. El nivel como etiqueta y no como tamaño de fuente
 * gigante —un H1 tiene que ser distinguible de un H2 sin que el índice se
 * vuelva una maqueta del documento—, el título entero, las palabras de la
 * rama, y el estado de salud DICHO EN PALABRAS.
 *
 * El motivo va en palabras y no en un punto de color. Un punto rojo no se
 * puede discutir: no se sabe contra qué, no se sabe cuánto, y no se puede
 * copiar a un comentario. "Desbalanceada: 4 % de la rama hermana más corta" se
 * puede discutir, que es justo lo que hace falta antes de ir a corregir.
 *
 * Este componente NO se recurse a sí mismo: recibe una fila ya resuelta —
 * Including el balance de sus HERMANAS, que es un dato del padre— y la pinta.
 * Que la comparación entre hermanas se resuelva en un solo lugar es lo que
 * impide que dos filas comparen contra cosas distintas.
 */

import React from 'react';
import { TriangleAlert } from 'lucide-react';
import type { NodoJerarquia } from '../../lib/jerarquia';
import type { DiagnosticoRama } from '../../lib/jerarquia';
import { BarraBalance, miles } from './BarraBalance';

export interface NodoIndiceProps {
  nodo: NodoJerarquia;
  /** El diagnóstico de la fila: estado, motivo y el balance de sus hermanas. */
  diagnostico: DiagnosticoRama;
  /** La profundidad, para la sangría. */
  profundidad?: number;
  onSelect?: (nodo: NodoJerarquia) => void;
  /** Si esta fila es la seleccionada actualmente en el Inspector */
  seleccionado?: boolean;
}

export const NodoIndice: React.FC<NodoIndiceProps> = ({
  nodo,
  diagnostico,
  profundidad = 0,
  onSelect,
  seleccionado = false,
}) => {
  const { salud, motivo, balance } = diagnostico;
  const esAlerta = salud !== 'completa';
  const esH1 = nodo.nivel === 1;

  // Fondo distintivo para H1: azul marino de contraste alto con texto blanco
  const bgFila = seleccionado
    ? 'var(--color-accent-soft)'
    : esH1
      ? 'var(--color-navy-header)'
      : 'transparent';

  const colorTexto = seleccionado
    ? 'var(--color-text-primary)'
    : esH1
      ? 'var(--color-navy-header-text)'
      : 'var(--color-text-primary)';

  return (
    <div
      role="listitem"
      onClick={onSelect ? () => onSelect(nodo) : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: esH1 ? 'var(--space-3) var(--space-4)' : 'var(--space-2) var(--space-3)',
        marginTop: esH1 && profundidad === 0 ? 'var(--space-3)' : '0',
        paddingLeft: `calc(var(--space-3) + ${profundidad} * var(--space-4))`,
        borderBottom: esH1 ? '1px solid rgba(0,0,0,0.1)' : '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: bgFila,
        borderLeft: seleccionado
          ? '4px solid var(--color-accent)'
          : esH1
            ? '4px solid var(--color-accent)'
            : '4px solid transparent',
        transition: 'all var(--transition-fast, 150ms ease)',
        cursor: onSelect ? 'pointer' : 'default',
        boxShadow: esH1 ? 'var(--shadow-sm)' : 'none',
      }}
      className="nodo-indice-row"
    >
      {/* El nivel como ETIQUETA estilizada con color según jerarquía */}
      <span
        style={{
          flex: '0 0 auto',
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          color: esH1 && !seleccionado ? 'var(--color-navy-header-text)' : nodo.nivel === 1 ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
          border: '1px solid',
          borderColor: esH1 && !seleccionado ? 'rgba(255,255,255,0.3)' : nodo.nivel === 1 ? 'var(--color-accent)' : 'var(--color-border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '1px 6px',
          fontVariantNumeric: 'tabular-nums',
          backgroundColor: esH1 && !seleccionado ? 'rgba(255, 255, 255, 0.15)' : nodo.nivel === 1 ? 'var(--color-accent-soft)' : 'var(--color-bg-surface-alt)',
        }}
      >
        H{nodo.nivel}
      </span>

      <span
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          fontSize: 'var(--text-sm)',
          fontWeight: esH1 ? 700 : 400,
          color: colorTexto,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: esH1 ? '0.01em' : 'normal',
        }}
        title={nodo.titulo}
      >
        {nodo.titulo}
      </span>

      <span
        style={{
          flex: '0 0 auto',
          fontSize: 'var(--text-sm)',
          fontVariantNumeric: 'tabular-nums',
          color: esH1 && !seleccionado ? 'rgba(255,255,255,0.85)' : 'var(--color-text-secondary)',
        }}
      >
        {miles(nodo.palabras)} <span style={{ color: esH1 && !seleccionado ? 'rgba(255,255,255,0.6)' : 'var(--color-text-tertiary)' }}>pal.</span>
      </span>

      {/* El balance, con la escala de la hermana más larga. Sin hermanas no hay
          barra: `null` es un estado de primera clase, no un cero. */}
      {balance ? (
        <span style={{ flex: '0 0 88px', display: 'flex' }}>
          <BarraBalance
            palabras={nodo.palabras}
            escala={balance.mayor}
            laMasLarga={balance.laMasLarga}
            nombre={nodo.titulo}
          />
        </span>
      ) : (
        <span style={{ flex: '0 0 88px', fontSize: 'var(--text-xs)', color: esH1 && !seleccionado ? 'rgba(255,255,255,0.6)' : 'var(--color-text-tertiary)' }}>
          sin comparar
        </span>
      )}

      <span
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontSize: 'var(--text-xs)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: esAlerta ? 'var(--severity-warning-soft, rgba(217, 119, 6, 0.1))' : 'transparent',
          color: esAlerta ? 'var(--color-warning)' : esH1 && !seleccionado ? 'rgba(255,255,255,0.7)' : 'var(--color-text-tertiary)',
        }}
      >
        {esAlerta && (
          <TriangleAlert size={13} strokeWidth="var(--icon-stroke)" aria-hidden style={{ color: 'var(--color-warning)' }} />
        )}
        {/* El motivo va ENTERO y a la vista; el `title` solo para el caso largo. */}
        <span
          style={{ maxWidth: '36ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={motivo}
        >
          {motivo}
        </span>
      </span>

      {/*
        Figuras, tablas y citas cuelgan de la rama.
      */}
      <span
        style={{
          flex: '0 0 auto',
          fontSize: 'var(--text-xs)',
          color: esH1 && !seleccionado ? 'rgba(255,255,255,0.8)' : 'var(--color-text-tertiary)',
          fontVariantNumeric: 'tabular-nums',
          backgroundColor: esH1 && !seleccionado ? 'rgba(255,255,255,0.12)' : 'var(--color-bg-surface-alt)',
          padding: '1px 6px',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        {[nodo.figuras > 0 ? `${nodo.figuras} fig` : null,
          nodo.tablas > 0 ? `${nodo.tablas} tab` : null,
          nodo.citas > 0 ? `${nodo.citas} cit` : null]
          .filter(Boolean)
          .join(' · ') || 'sin elementos'}
      </span>
    </div>
  );
};

export default NodoIndice;

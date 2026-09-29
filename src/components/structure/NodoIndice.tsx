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
}

export const NodoIndice: React.FC<NodoIndiceProps> = ({ nodo, diagnostico, profundidad = 0, onSelect }) => {
  const { salud, motivo, balance } = diagnostico;
  return (
    <div
      role="listitem"
      onClick={onSelect ? () => onSelect(nodo) : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-2) 0',
        paddingLeft: `calc(var(--space-2) + ${profundidad} * var(--space-4))`,
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      {/* El nivel como ETIQUETA. Un H1 grande y un H3 chico convierten el índice
          en una maqueta del documento, que es la navegación, que es lo que esta
          vista dejó de ser. */}
      <span
        style={{
          flex: '0 0 auto',
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          color: 'var(--color-text-tertiary)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '0 4px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        H{nodo.nivel}
      </span>

      <span
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
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
          color: 'var(--color-text-secondary)',
        }}
      >
        {miles(nodo.palabras)} <span style={{ color: 'var(--color-text-tertiary)' }}>pal.</span>
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
        <span style={{ flex: '0 0 88px', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
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
          color: salud === 'completa' ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
        }}
      >
        {salud !== 'completa' && (
          <TriangleAlert size={13} strokeWidth="var(--icon-stroke)" aria-hidden />
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
        Figuras, tablas y citas cuelgan de la rama. Se cuentan juntos porque en
        el índice son la misma pregunta —"¿qué tiene esta rama además de
        párrafos?"— y separarlos en tres columnas hace una tabla de cinco
        columnas para un dato de un número.
      */}
      <span
        style={{
          flex: '0 0 auto',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-tertiary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {[nodo.figuras > 0 ? `${nodo.figuras} fig` : null,
          nodo.tablas > 0 ? `${nodo.tablas} tab` : null,
          nodo.citas > 0 ? `${nodo.citas} cit` : null]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </div>
  );
};

export default NodoIndice;

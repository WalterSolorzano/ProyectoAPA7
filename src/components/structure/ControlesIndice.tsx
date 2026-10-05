/* Controles de diseño del Índice: profundidad, numeración e insertar/quitar.
 *
 * El índice es el único destino de la fase que ESCRIBE en el documento, así que
 * sus controles viven pegados a la previsualización que los refleja. Los
 * controles son botones con `aria-pressed`, como el resto de la fase: nunca un
 * desplegable nativo.
 * TOKENS, NO HEX.
 */

import React from 'react';
import { ListTree, Plus, Trash2 } from 'lucide-react';

export type ProfundidadIndice = 1 | 2 | 3 | 4;

export interface ControlesIndiceProps {
  profundidad: ProfundidadIndice;
  onProfundidad: (p: ProfundidadIndice) => void;
  onRegla: (clave: string, valor: string) => void;
  hayIndice: boolean;
  onInsertar: () => void;
  onQuitar: () => void;
  numeracionH1: string;
  numeracionH2: string;
}

const PROFUNDIDADES: Array<{ valor: ProfundidadIndice; label: string }> = [
  { valor: 1, label: 'Hasta H1' },
  { valor: 2, label: 'Hasta H2' },
  { valor: 3, label: 'Hasta H3' },
  { valor: 4, label: 'Todo' },
];

/** Notación de numeración de títulos. Espejo de `NUMERACIONES_DE_TITULO`. */
export const NUMERACIONES_DE_TITULO: Array<{ valor: string; label: string }> = [
  { valor: 'none', label: 'Sin numerar' },
  { valor: 'decimal', label: '1. 2. 3.' },
  { valor: 'upperRoman', label: 'I. II. III.' },
  { valor: 'lowerRoman', label: 'i. ii. iii.' },
  { valor: 'upperLetter', label: 'A. B. C.' },
  { valor: 'lowerLetter', label: 'a. b. c.' },
];

export const ControlesIndice: React.FC<ControlesIndiceProps> = ({
  profundidad,
  onProfundidad,
  onRegla,
  hayIndice,
  onInsertar,
  onQuitar,
  numeracionH1,
  numeracionH2,
}) => (
  <section
    data-testid="controles-indice"
    aria-label="Diseño del índice"
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
      padding: 'var(--space-3)',
      fontFamily: 'var(--font-sans)',
    }}
  >
    <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <ListTree
        size={16}
        strokeWidth="var(--icon-stroke)"
        aria-hidden
        style={{ color: 'var(--color-accent)' }}
      />
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--text-sm)',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
        }}
      >
        Diseño del índice
      </h2>
    </header>

    <div>
      <span style={estiloEtiqueta}>Profundidad visible</span>
      <div role="group" aria-label="Profundidad" style={estiloGrupo}>
        {PROFUNDIDADES.map(({ valor, label }) => (
          <button
            key={valor}
            type="button"
            aria-pressed={profundidad === valor}
            onClick={() => onProfundidad(valor)}
            style={estiloChip(profundidad === valor)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>

    <div>
      <span style={estiloEtiqueta}>Numeración de H1</span>
      <div role="group" aria-label="Numeración de H1" style={estiloGrupo}>
        {NUMERACIONES_DE_TITULO.map(({ valor, label }) => (
          <button
            key={valor}
            type="button"
            aria-pressed={numeracionH1 === valor}
            onClick={() => onRegla('heading_numbering_style_lvl1', valor)}
            style={estiloChip(numeracionH1 === valor)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>

    <div>
      <span style={estiloEtiqueta}>Numeración de H2</span>
      <div role="group" aria-label="Numeración de H2" style={estiloGrupo}>
        {NUMERACIONES_DE_TITULO.map(({ valor, label }) => (
          <button
            key={valor}
            type="button"
            aria-pressed={numeracionH2 === valor}
            onClick={() => onRegla('heading_numbering_style_lvl2', valor)}
            style={estiloChip(numeracionH2 === valor)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>

    <button
      type="button"
      onClick={hayIndice ? onQuitar : onInsertar}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        alignSelf: 'flex-start',
        padding: 'var(--space-2) var(--space-3)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-xs)',
        cursor: 'pointer',
      }}
    >
      {hayIndice ? (
        <Trash2 size={14} strokeWidth="var(--icon-stroke)" aria-hidden />
      ) : (
        <Plus size={14} strokeWidth="var(--icon-stroke)" aria-hidden />
      )}
      {hayIndice ? 'Quitar índice' : 'Insertar índice'}
    </button>
  </section>
);

const estiloEtiqueta: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-xs)',
  color: 'var(--color-text-tertiary)',
  marginBottom: 'var(--space-1)',
};

const estiloGrupo: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-1)',
  flexWrap: 'wrap',
};

const estiloChip = (activo: boolean): React.CSSProperties => ({
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-xs)',
  fontWeight: activo ? 600 : 400,
  color: activo ? 'var(--color-accent)' : 'var(--color-text-secondary)',
  background: activo ? 'var(--color-accent-soft)' : 'transparent',
  border: '1px solid ' + (activo ? 'var(--color-accent)' : 'var(--color-border-subtle)'),
  borderRadius: 'var(--radius-full)',
  padding: '2px var(--space-2)',
  cursor: 'pointer',
});

export default ControlesIndice;

/* WordAPA7 — la sección de IA: el documento como mosaico.
 *
 * Vive en su PROPIO modo de vista, no en la pantalla de Revisión. La revisión
 * ya tiene lo suyo —un párrafo a la vez, una lectura secuencial que es una
 * decisión de diseño y no un descuido— y meterle un mapa arriba la volvería
 * exactamente lo que no es. El mosaico contesta una pregunta distinta: dónde
 * está el trabajo. La revisión contesta otra: qué hacer con este hallazgo.
 *
 * LO QUE SE VE, Y NADA MÁS:
 *
 *   un bloque por sección, EN EL ORDEN DEL DOCUMENTO. El área es su tamaño,
 *   el color su intensidad, y el número impreso el porcentaje. El nombre de la
 *   sección va en el rótulo al pasar el mouse y en el nombre accesible, porque
 *   rotular veinte bloques convierte el mapa en una lista — y entonces no es un
 *   mapa, es la tabla que el mapa reemplazó.
 *
 *   Una línea de leyenda, porque una rampa de color sin escala no se lee. Cuatro
 *   cuadrados, cuatro palabras. Nada más.
 *
 * LO QUE NO HAY AQUÍ, A PROPÓSITO: sin panel lateral, sin chat, sin lista de
 * hallazgos, sin estadísticas. El clic no abre nada: aplica el filtro de fase y
 * el de motor que YA existen, y devuelve al usuario a la lectura secuencial con
 * el párrafo sospechoso delante. El mapa sirve para decidir a dónde ir; la
 * revisión sirve para trabajar. Dos pantallas, un trabajo.
 *
 * Y esa reutilización no es pereza: `useReviewWorkbench` ya intersecta el filtro
 * de fase en `visibles`, así que "Siguiente hallazgo" respeta el recorte por
 * construcción. Un mosaico con su propia navegación sería un segundo sistema de
 * recorte, y dos sistemas de recorte muestran dos cosas distintas.
 */

import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import {
  construirMosaico,
  filasDeBloques,
  columnasDeBloque,
  tokenDeNivel,
  type BloqueMosaico,
  type NivelIa,
} from '../../lib/aiMosaic';
import type { ElementModel } from '../../types';
import type { AuditItem } from '../../lib/auditItems';

/** Una columna de la retícula, en píxeles. El área del bloque se reparte entre
 *  este número de columnas, y el ancho de cada bloque sale de `columnasDeBloque`. */
const COLS_POR_FILA = 12;
const ANCHO_COL = 44;
const GAP = 6;

/** El mínimo del cuadrado, en píxeles. Sin él una sección de un párrafo queda
 *  en una mancha de cinco píxeles que no se puede apuntar. */
const MIN_LADO = 34;

const LEYENDA: { nivel: NivelIa; texto: string }[] = [
  { nivel: 4, texto: 'casi todo' },
  { nivel: 3, texto: 'bastante' },
  { nivel: 2, texto: 'algo' },
  { nivel: 1, texto: 'nada' },
];

const pct = (b: BloqueMosaico): string =>
  b.parrafos === 0 ? '—' : `${Math.round(b.proporcion * 100)}%`;

export interface AiMosaicProps {
  elements: readonly ElementModel[] | null;
  /** La MISMA lista que abre el workbench y que cuenta el rail. */
  items: readonly AuditItem[];
  /** Fase abierta, para pintar cuál es. */
  activa: string | 'all';
  onSelect: (key: string) => void;
}

export const AiMosaic: React.FC<AiMosaicProps> = ({ elements, items, activa, onSelect }) => {
  const bloques = useMemo(
    () => construirMosaico(elements ?? [], items),
    [elements, items],
  );

  if (bloques.length === 0) {
    /* Sin documento no hay secciones. El hueco se dice: un espacio en blanco en
       el lugar del mapa se lee como "el detector no vio nada", que es otra
       cosa. */
    return (
      <div
        role="status"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 'var(--space-3)', height: '100%', padding: 'var(--space-6)', textAlign: 'center',
        }}
      >
        <Sparkles size={22} strokeWidth={1.75} aria-hidden style={{ color: 'var(--color-text-tertiary)' }} />
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: '40ch' }}>
          Abrí un documento para ver el mapa de IA.
        </p>
      </div>
    );
  }

  const filas = filasDeBloques(bloques, COLS_POR_FILA);
  const maxParrafos = bloques.reduce((m, b) => Math.max(m, b.parrafos), 0);

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
        padding: 'var(--space-5) var(--space-6)', overflowY: 'auto', minHeight: 0,
      }}
    >
      {/* La leyenda. Una línea, porque una rampa sin escala no se lee. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          Porcentaje de párrafos que el detector marcó como IA
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: 'auto' }}>
          {LEYENDA.map(({ nivel, texto }) => (
            <span
              key={nivel}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}
            >
              <span
                aria-hidden
                style={{ width: '10px', height: '10px', borderRadius: 'var(--radius-sm)', background: tokenDeNivel(nivel) }}
              />
              {texto}
            </span>
          ))}
        </div>
      </div>

      {/* El mosaico. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
        {filas.map((fila, i) => (
          <div key={i} style={{ display: 'flex', gap: GAP, alignItems: 'stretch' }}>
            {fila.map((idx) => {
              const b = bloques[idx];
              const cols = columnasDeBloque(b.parrafos, maxParrafos);
              const esActiva = activa !== 'all' && activa === b.key;
              const rotulo = `${b.label}: ${pct(b)} de ${b.parrafos} párrafos marcados`;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => onSelect(b.key)}
                  title={rotulo}
                  aria-label={rotulo}
                  aria-pressed={esActiva}
                  style={{
                    /* El área es la información: se estira en la fila y crece con
                       los párrafos. La altura la comparte toda la fila para que
                       el tamaño se lea de un vistazo. */
                    flex: `0 0 ${cols * ANCHO_COL + (cols - 1) * GAP}px`,
                    minHeight: MIN_LADO,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 2,
                    padding: '6px 7px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    borderRadius: 'var(--radius-sm)',
                    border: esActiva ? '1px solid var(--color-accent)' : '1px solid transparent',
                    background: tokenDeNivel(b.nivel),
                    /* Sobre el escalón 4 el fondo es el rojo sólido de la
                       paleta, y el texto tiene que ser el de encima de un
                       botón primario. En los tres escalas de abajo el fondo es
                       un tinte y alcanza el texto principal. */
                    color: b.nivel === 4 ? 'var(--color-text-on-accent)' : 'var(--color-text-primary)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--text-sm)', fontWeight: 700, lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {pct(b)}
                  </span>
                  {cols >= 2 && (
                    <span style={{ fontSize: 'var(--text-xs)', opacity: 0.8, lineHeight: 1 }}>
                      {b.parrafos} párr.
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
        El tamaño del bloque es su cantidad de párrafos. Toca uno para ver sus hallazgos.
      </p>
    </div>
  );
};

export default AiMosaic;

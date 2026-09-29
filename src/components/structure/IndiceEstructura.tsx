/* WordAPA7 — el índice de estructura: el documento de trabajo.
 *
 * QUÉ ES. La pantalla responde "¿aguanta el armazón?". Cada fila es un
 * encabezado real del documento y dice cuatro cosas: qué nivel tiene, cómo se
 * llama, cuántas palabras cuelgan de su rama y en qué estado está, con el
 * motivo en palabras.
 *
 * LO QUE NO ES. No es navegación. No hay árbol plegable, ni columnas, ni
 * "ir a", ni contador de secciones: el índice no lleva a ningún lado, MIDE. Y el
 * documento entero no está de centro: es un toggle, apagado, porque lo que se
 * reportó fue exactamente que el centro era el archivo vomitado.
 *
 * EL BALANCE ES ENTRE HERMANAS. Una barra que pone a todos los capítulos del
 * mismo nivel en la misma escala hace visible lo que hoy no se ve en ninguna
 * parte: cuarenta capítulos donde uno tiene doce mil palabras y tres tienen
 * ochenta. Y con menos de dos hermanas no hay barra, porque no hay con qué
 * comparar y un cien por ciento parece una nota.
 *
 * EL ESTADO SALE DE REGLAS. `en-duda` es un encabezado de nivel dos o más cuyo
 * título abre una fase en modo estricto —`match_phase_exact`—, no una
 * heurística de texto. Ver `diagnosticoDe` en `lib/jerarquia.ts`, que es donde
 * vive la regla y donde se revisa.
 */

import React, { useMemo, useState } from 'react';
import { FileText, ListTree } from 'lucide-react';
import {
  construirJerarquia,
  diagnosticoDe,
  filasDelIndice,
  preambuloDe,
  type FasesConocidas,
  type NodoJerarquia,
  type VocabularioFases,
} from '../../lib/jerarquia';
import type { ElementModel } from '../../types';
import { NodoIndice } from './NodoIndice';
import { MapaEstructura } from './MapaEstructura';
import { miles } from './BarraBalance';

/* Las reglas y los diagnósticos se IMPORTAN y no se redefinen: el componente
   pinta, `lib/jerarquia.ts` decide. Un componente que vuelve a derivar la salud
   de la rama es el mismo defecto que vino a matar, en la capa de arriba. */
export {
  balanceDe,
  diagnosticoDe,
  filasDelIndice,
  motivoDe,
  preambuloDe,
  saludDe,
  tituloEnDuda,
  type BalanceRama,
  type DiagnosticoRama,
  type SaludNodo,
} from '../../lib/jerarquia';

/**
 * Qué se ve en el centro de la vista de estructura.
 *
 * `indice` es el estado inicial y es el que tiene que serlo: el defecto
 * reportado fue que el centro era el documento vomitado, y un documento
 * apagado por omisión es una decisión que alguien tomó mientras que uno encendido
 * es un forgot que nadie revisó.
 *
 * SON TRES ESTADOS Y NO DOS BOOLEANOS. Con dos banderas se puede estar mostrando
 * el documento y el mapa a la vez, que es exactamente la capa flotante que se
 * pidió sacar. Un solo valor de estado hace que eso sea imposible de escribir.
 */
export type VistaEstructura = 'indice' | 'documento' | 'mapa';

export const VISTA_POR_DEFECTO: VistaEstructura = 'indice';

/** ¿El documento se ve por omisión? La regla, en una función que se puede leer. */
export function porDefectoSeVeElDocumento(): boolean {
  return VISTA_POR_DEFECTO === 'documento';
}

/** El resumen de una fila, en una línea de texto: palabras y estado. */
export function captionDe(nodo: NodoJerarquia): string {
  const partes = [`${miles(nodo.palabras)} palabras`];
  if (nodo.figuras) partes.push(`${nodo.figuras} figuras`);
  if (nodo.tablas) partes.push(`${nodo.tablas} tablas`);
  if (nodo.citas) partes.push(`${nodo.citas} citas`);
  partes.push(diagnosticoDe(nodo).motivo);
  return partes.join(' · ');
}

export interface IndiceEstructuraProps {
  /** El documento. `null` es "no hay documento", y el hueco se dice. */
  elementos: readonly ElementModel[] | null;
  /** Las fases que ya calculó el backend, por elemento. */
  faseConocida?: FasesConocidas;
  /** El vocabulario de fases del backend, cuando ya llegó. */
  vocabulario?: VocabularioFases;
  /** El documento entero, que es un toggle y no el centro. */
  documento?: React.ReactNode;
  onSelect?: (nodo: NodoJerarquia) => void;
}

/** Un toggle: dice qué muestra, y por eso `aria-pressed` alcanza con su texto. */
const BotonToggle: React.FC<{ activo: boolean; onClick: () => void; children: React.ReactNode }> = ({
  activo,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={activo}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      font: 'inherit',
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-secondary)',
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-sm)',
      padding: '4px 8px',
      cursor: 'pointer',
    }}
  >
    {children}
  </button>
);

export const IndiceEstructura: React.FC<IndiceEstructuraProps> = ({
  elementos,
  faseConocida,
  vocabulario,
  documento,
  onSelect,
}) => {
  const [vista, setVista] = useState<VistaEstructura>(VISTA_POR_DEFECTO);
  const raices = useMemo(
    () => construirJerarquia(elementos ?? [], faseConocida ?? {}, vocabulario),
    [elementos, faseConocida, vocabulario],
  );
  const filas = useMemo(() => filasDelIndice(raices), [raices]);
  const preambulo = useMemo(() => preambuloDe(elementos ?? []), [elementos]);

  if (!elementos || elementos.length === 0) {
    return (
      <div
        role="status"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 'var(--space-3)', padding: 'var(--space-6)', textAlign: 'center',
        }}
      >
        <ListTree size={22} strokeWidth="var(--icon-stroke)" aria-hidden style={{ color: 'var(--color-text-tertiary)' }} />
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: '44ch' }}>
          Abrí un documento para ver su estructura.
        </p>
      </div>
    );
  }

  return (
    <div
      /* El nombre de la vista, para el guardián que vigila que siga montada. Un
         componente terminado que nadie importa no existe, y el cheapest jeito
         de saber que existe es preguntárselo a la pantalla. */
      data-testid="indice-estructura"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        padding: 'var(--space-5) var(--space-6)',
        overflowY: 'auto',
        minHeight: 0,
      }}
    >
      {/* Los toggles. UNA línea, arriba, y arrancando en el índice.
       *
       * El mapa entra AQUÍ, dentro de la vista de índice y en el flujo, nunca
       * como una capa encima: una capa que tapa el contenido se lee como un
       * estorbo, y además un mapa superpuesto deja de poder compararse con la
       * lista de al lado. Por eso son tres estados y no dos banderas. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <ListTree size={16} strokeWidth="var(--icon-stroke)" aria-hidden style={{ color: 'var(--color-text-tertiary)' }} />
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Estructura</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
          <BotonToggle
            activo={vista === 'mapa'}
            onClick={() => setVista(vista === 'mapa' ? 'indice' : 'mapa')}
          >
            {vista === 'mapa' ? 'Ver el indice' : 'Ver el mapa'}
          </BotonToggle>
          <BotonToggle
            activo={vista === 'documento'}
            onClick={() => setVista(vista === 'documento' ? 'indice' : 'documento')}
          >
            <FileText size={13} strokeWidth="var(--icon-stroke)" aria-hidden />
            {vista === 'documento' ? 'Ver la estructura' : 'Ver el documento'}
          </BotonToggle>
        </div>
      </div>

      {vista === 'documento' ? (
        <div data-testid="documento-completo">{documento ?? null}</div>
      ) : vista === 'mapa' ? (
        /* El mapa reemplaza la lista en el flujo, y el toggle lo devuelve. */
        <div data-testid="mapa-estructura" style={{ overflow: 'auto' }}>
          <MapaEstructura raices={raices} />
        </div>
      ) : (
        <>
          {/* El preámbulo existe y no es un capítulo. Decirlo evita que la
              pantalla prometa menos texto del que hay. */}
          {preambulo.elementos > 0 && (
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              {miles(preambulo.palabras)} palabras antes del primer capítulo ({preambulo.elementos} elementos).
            </p>
          )}

          {filas.length === 0 ? (
            <p role="status" style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
              Este documento no tiene encabezados: no hay estructura que medir.
            </p>
          ) : (
            <div role="list" style={{ display: 'flex', flexDirection: 'column' }}>
              {filas.map((f) => (
                <NodoIndice
                  key={f.nodo.id}
                  nodo={f.nodo}
                  diagnostico={f.diagnostico}
                  profundidad={f.profundidad}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}

          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            El índice no lleva a ningún lado: mide. La comparación es entre capítulos hermanos.
          </p>
        </>
      )}
    </div>
  );
};

export default IndiceEstructura;

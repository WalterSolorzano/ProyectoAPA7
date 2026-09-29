/* WordAPA7 — el mapa de la estructura: SVG escrito a mano.
 *
 * CERO LIBRERÍA. Ni `dagre`, ni `reactflow`, ni `cytoscape`, ni `elk`. El
 * layout de un árbol por niveles son tres cuentas —la columna es la profundidad,
 * la hoja toma la siguiente fila, el padre promedia sus hijas— y una
 * dependencia de 300 kB para dibujar cuarenta cajas que nadie va a leer en 3D
 * es un mal negocio. El plan de la fase lo dice y esta es la forma de que no se
 * convierta en una excepción: `estructuraNoMiente.test.ts` falla si aparece
 * cualquiera de esas seis.
 *
 * LA REGLA DURA: TODO NODO TIENE SU ETIQUETA DENTRO. Sin excepción. El bug del
 * `AiMosaic` fue exactamente eso —el nombre solo en el `title` de hover— y
 * "dentro del botón había un porcentaje y nada más" es como se construye esto.
 * Si la etiqueta no entra, se acorta con puntos suspensivos y el entero queda
 * en el `<title>` del nodo, pero el NOMBRE ESTÁ EN PANTALLA. Un nodo truncado
 * lleva su conteo de hijos al lado, para que se sepa que debajo hay más.
 *
 * Y NO ES UNA CAPA FLOTANTE. Va dentro de la vista de índice, en el flujo, sin
 * `position: fixed` ni `absolute`: una capa que tapa el contenido se lee como un
 * estorbo, que es lo que pidió el usuario al pedir sacarla de ahí. Un mapa que
 * se superpone deja de poder compararse con la lista de al lado.
 */

import React from 'react';
import { construirJerarquia, type NodoJerarquia } from '../../lib/jerarquia';
import { miles } from './BarraBalance';
import type { ElementModel } from '../../types';

export const ANCHO_NODO = 200;
export const ALTO_NODO = 56;
const SEPARACION_Y = 18;
const SEPARACION_X = 56;
const MARGEN = 12;

/** Cuántos caracteres entran en el nodo. Un número medido, no supuesto. */
const CARACTERES_POR_NODO = 26;

/** La etiqueta del nodo, recortada con puntos suspensivos si no entra. */
export function etiquetaCortada(titulo: string, max = CARACTERES_POR_NODO): string {
  const limpio = (titulo || '').trim() || 'Sin título';
  if (limpio.length <= max) return limpio;
  return `${limpio.slice(0, Math.max(1, max - 1))}…`;
}

export interface PosicionNodo {
  nodo: NodoJerarquia;
  x: number;
  y: number;
  /** El nivel REAL del encabezado (1, 2, 3), no el índice de columna. */
  nivel: number;
  /** La etiqueta YA CORTADA, que es la que se pinta. */
  etiqueta: string;
  /** Si se recortó: el nodo tiene que avisarlo con su conteo de hijos. */
  truncada: boolean;
  hijos: number;
}

/**
 * La posición de cada nodo. Tres cuentas, en este orden:
 *
 *   1. las HOJAS toman filas seguidas, en el orden del documento;
 *   2. un padre se queda en el promedio de sus hijas, que es lo que hace que un
 *      padre con dos ramas se dibuje ENTRE las dos y no pegado a una;
 *   3. la columna es la profundidad.
 *
 * Es la misma cuenta que haría un grafo por niveles, con cuarenta cajas y sin
 * cargar trescientos kilobytes.
 */
export function posicionesDe(raices: readonly NodoJerarquia[]): PosicionNodo[] {
  /* Las posiciones se CALCULAN de abajo hacia arriba —una hoja toma fila, un
   * padre promedia sus hijas— pero se DEVUELVEN en el orden del documento. Un
   * mapa cuyo orden de dibujo fuera post-orden se leería al revés, y el orden
   * del documento es la memoria espacial que tiene quien lo está mirando. */
  const porId = new Map<string, PosicionNodo>();
  let fila = 0;
  const SEPARACION_Y_FILA = ALTO_NODO + SEPARACION_Y;

  const visitar = (nodos: readonly NodoJerarquia[], columna: number): number => {
    const filasDeEsteNivel: number[] = [];
    for (const n of nodos) {
      const yHijo = n.hijos.length > 0 ? visitar(n.hijos, columna + 1) : fila++ * SEPARACION_Y_FILA;
      filasDeEsteNivel.push(yHijo);
      const etiqueta = etiquetaCortada(n.titulo);
      porId.set(n.id, {
        nodo: n,
        x: MARGEN + columna * (ANCHO_NODO + SEPARACION_X),
        y: yHijo,
        nivel: n.nivel,
        etiqueta,
        truncada: etiqueta.length < (n.titulo || '').trim().length,
        hijos: n.hijos.length,
      });
    }
    /* El promedio, y no el primero: un padre pegado a su primera hija parece
     * una hoja más. */
    return filasDeEsteNivel.reduce((a, b) => a + b, 0) / (filasDeEsteNivel.length || 1);
  };
  visitar(raices, 0);

  const salida: PosicionNodo[] = [];
  const enOrden = (nodos: readonly NodoJerarquia[]): void => {
    for (const n of nodos) {
      const p = porId.get(n.id);
      if (p) salida.push(p);
      enOrden(n.hijos);
    }
  };
  enOrden(raices);
  return salida;
}

export interface MapaEstructuraProps {
  /** El árbol, ya construido. */
  raices: readonly NodoJerarquia[];
  /** Los elementos, si se quiere construir el árbol acá. */
  elementos?: readonly ElementModel[] | null;
  onSelect?: (nodo: NodoJerarquia) => void;
}

export const MapaEstructura: React.FC<MapaEstructuraProps> = ({ raices, elementos, onSelect }) => {
  const arbol = raices && raices.length > 0 ? raices : elementos ? construirJerarquia(elementos) : [];
  const nodos = posicionesDe(arbol);

  if (nodos.length === 0) {
    return (
      <p role="status" style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
        No hay nodos que dibujar: el documento no tiene encabezados.
      </p>
    );
  }

  const ancho = Math.max(...nodos.map((n) => n.x + ANCHO_NODO)) + MARGEN;
  const alto = Math.max(...nodos.map((n) => n.y + ALTO_NODO)) + MARGEN;
  const porId = new Map(nodos.map((n) => [n.nodo.id, n]));

  return (
    /* `className` en el `<svg>`: es una ILUSTRACIÓN y no un ícono, y la marca
       es la que lo dice. Un ícono viene de `lucide-react`; este dibujo no. */
    <svg
      className="mapa-estructura"
      role="img"
      aria-label={`Mapa de la estructura: ${nodos.length} encabezados`}
      width={ancho}
      height={alto}
      viewBox={`0 0 ${ancho} ${alto}`}
      style={{ display: 'block', maxWidth: '100%', overflow: 'auto' }}
    >
      {/* Las ramas, primero, para que los nodos queden encima de ellas. */}
      {nodos.flatMap((n) =>
        n.nodo.hijos.map((hijo) => {
          const destino = porId.get(hijo.id);
          if (!destino) return null;
          const x1 = n.x + ANCHO_NODO;
          const y1 = n.y + ALTO_NODO / 2;
          const x2 = destino.x;
          const y2 = destino.y + ALTO_NODO / 2;
          const medio = (x1 + x2) / 2;
          return (
            <path
              key={`${n.nodo.id}-${hijo.id}`}
              d={`M ${x1} ${y1} C ${medio} ${y1}, ${medio} ${y2}, ${x2} ${y2}`}
              fill="none"
              style={{
                stroke: 'var(--color-border-strong)',
                strokeWidth: 'var(--icon-stroke)',
              }}
            />
          );
        }),
      )}

      {nodos.map((n) => (
        <g
          key={n.nodo.id}
          data-nodo={n.nodo.id}
          onClick={onSelect ? () => onSelect(n.nodo) : undefined}
          style={{ cursor: onSelect ? 'pointer' : 'default' }}
        >
          {/* El nombre entero, para el hover y para el lector de pantalla. */}
          <title>{n.nodo.titulo}</title>
          <rect
            x={n.x}
            y={n.y}
            width={ANCHO_NODO}
            height={ALTO_NODO}
            rx={6}
            style={{
              fill: 'var(--color-bg-surface)',
              stroke: 'var(--color-border-subtle)',
              strokeWidth: 'var(--icon-stroke)',
            }}
          />
          {/* EL NOMBRE, DENTRO. Un nodo sin nombre en pantalla es un nodo que no
              existe, por mucho que tenga un `title`. */}
          <text
            x={n.x + 10}
            y={n.y + 20}
            style={{
              fill: 'var(--color-text-primary)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
            }}
          >
            {n.etiqueta}
          </text>
          {/* Las palabras, y el conteo de hijos cuando el nombre se recortó:
              sin ese "+3" un nodo truncado se lee como una hoja. */}
          <text
            x={n.x + 10}
            y={n.y + 40}
            style={{ fill: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}
          >
            {`${miles(n.nodo.palabras)} palabras`}
            {n.truncada && n.hijos > 0 ? `  +${n.hijos} subsecciones` : ''}
          </text>
        </g>
      ))}
    </svg>
  );
};

export default MapaEstructura;

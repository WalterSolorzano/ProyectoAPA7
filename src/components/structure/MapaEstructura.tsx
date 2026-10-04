/* WordAPA7 — MapaEstructura
 *
 * El diagrama de la fase: responsive, con color por nivel y aristas curvas.
 * Sigue sin usar librerías de grafos (lo prohíbe `estructuraNoMiente.test.ts`):
 * el layout es cálculo propio y el SVG se dibuja a mano.
 *
 * ETIQUETA DENTRO DEL NODO. El nombre vive en un `<text>` y el `<title>` lleva
 * el nombre completo, para que nunca haya un tooltip flotante que el test no
 * pueda ver. El texto visible y el `<title>` llevan además la métrica, así que
 * el nombre exacto solo aparece en el esquema (evita ambigüedad de `getByText`).
 */

import React, { useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { NodoJerarquia } from '../../lib/jerarquia';

export const ANCHO_NODO = 200;
export const ALTO_NODO = 56;
export const SEPARACION_Y = 18;
export const SEPARACION_X = 56;
export const MARGEN = 12;
export const CARACTERES_POR_NODO = 26;

/** Id del nodo raíz sintético: el documento que contiene a las H1. */
export const RAIZ_ID = '__documento__';

/**
 * `true` si `candidatoId` cuelga de `ancestroId` (a cualquier profundidad).
 * Reubicar una rama dentro de sí misma partiría el árbol; el arrastre usa
 * esto para rechazar ese destino antes de tocar el documento.
 */
export const esDescendiente = (
  nodos: readonly NodoJerarquia[],
  ancestroId: string,
  candidatoId: string,
): boolean => {
  const contiene = (n: NodoJerarquia, id: string): boolean =>
    n.hijos.some((h) => h.id === id || contiene(h, id));
  const busca = (lista: readonly NodoJerarquia[]): boolean =>
    lista.some((n) => (n.id === ancestroId ? contiene(n, candidatoId) : busca(n.hijos)));
  return busca(nodos);
};

export interface PosicionNodo {
  nodo: NodoJerarquia;
  nivel: number;
  x: number;
  y: number;
  etiqueta: string;
  truncada: boolean;
  hijos: number;
}

export const etiquetaCortada = (titulo: string, max: number = CARACTERES_POR_NODO): string => {
  const limpio = String(titulo ?? '').trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1).trimEnd()}…` : limpio;
};

export const posicionesDe = (
  raices: readonly NodoJerarquia[],
  nivelBase = 1,
): PosicionNodo[] => {
  const posiciones: PosicionNodo[] = [];
  let fila = 0;

  const visitar = (nodos: readonly NodoJerarquia[], nivel: number): PosicionNodo[] => {
    const delNivel: PosicionNodo[] = [];
    for (const nodo of nodos) {
      const etiqueta = etiquetaCortada(nodo.titulo);
      const pos: PosicionNodo = {
        nodo,
        nivel,
        x: MARGEN + (nivel - nivelBase) * (ANCHO_NODO + SEPARACION_X),
        y: 0,
        etiqueta,
        truncada: etiqueta !== String(nodo.titulo ?? '').trim(),
        hijos: nodo.hijos.length,
      };
      posiciones.push(pos);
      delNivel.push(pos);
      if (nodo.hijos.length > 0) {
        const hijas = visitar(nodo.hijos, nivel + 1);
        pos.y = (hijas[0].y + hijas[hijas.length - 1].y) / 2;
      } else {
        pos.y = MARGEN + fila * (ALTO_NODO + SEPARACION_Y);
        fila += 1;
      }
    }
    return delNivel;
  };

  visitar(raices, nivelBase);
  return posiciones;
};

export interface MapaEstructuraProps {
  raices: readonly NodoJerarquia[];
  elementos?: unknown;
  onSelect?: (nodo: NodoJerarquia) => void;
  nodoSeleccionadoId?: string | null;
  onReubicar?: (origenId: string, destinoId: string) => void;
}

export const MapaEstructura: React.FC<MapaEstructuraProps> = ({
  raices,
  onSelect,
  nodoSeleccionadoId,
  onReubicar,
}) => {
  const [soloTitulos, setSoloTitulos] = useState(false);
  const [escala, setEscala] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);
  const arrastreRef = useRef<{ x: number; y: number } | null>(null);

  /* La raíz sintética: el documento del que cuelgan las H1. Existe solo para
   * el dibujo, no es un elemento del documento ni se puede seleccionar. */
  const raizDocumento = useMemo(
    () =>
      ({
        id: RAIZ_ID,
        titulo: 'Documento',
        nivel: 0,
        elementoId: RAIZ_ID,
        palabras: 0,
        figuras: 0,
        tablas: 0,
        citas: 0,
        hijos: [...raices],
        fase: null,
      }) as unknown as NodoJerarquia,
    [raices],
  );

  const todas = useMemo(() => posicionesDe([raizDocumento], 0), [raizDocumento]);
  const visibles = useMemo(
    () => (soloTitulos ? todas.filter((p) => p.nivel <= 2) : todas),
    [todas, soloTitulos],
  );

  if (raices.length === 0) {
    return (
      <div className="mapa-vacio" style={{ padding: 'var(--space-6)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
        No hay nodos para dibujar todavía.
      </div>
    );
  }

  const ids = new Set(visibles.map((p) => p.nodo.id));
  const porId = new Map(visibles.map((p) => [p.nodo.id, p]));
  const maxX = visibles.reduce((m, p) => Math.max(m, p.x), 0);
  const maxY = visibles.reduce((m, p) => Math.max(m, p.y), 0);
  const ancho = maxX + ANCHO_NODO + MARGEN;
  const alto = maxY + ALTO_NODO + MARGEN;

  const ajustar = () => {
    setEscala(1);
    setPan({ x: 0, y: 0 });
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setEscala((v) => Math.min(3, Math.max(0.5, v - e.deltaY * 0.001)));
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('[data-nodo]')) return;
    arrastreRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!arrastreRef.current) return;
    setPan({ x: e.clientX - arrastreRef.current.x, y: e.clientY - arrastreRef.current.y });
  };
  const onPointerUp = () => {
    arrastreRef.current = null;
  };

  return (
    <div className="mapa-envoltorio" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div className="mapa-barra" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <button
          type="button"
          aria-pressed={soloTitulos}
          onClick={() => setSoloTitulos((v) => !v)}
          style={estiloBoton(soloTitulos)}
        >
          Solo H1–H2
        </button>
        <button type="button" aria-label="Alejar" title="Alejar" onClick={() => setEscala((v) => Math.max(0.5, v - 0.2))} style={estiloIconoBoton}>
          <ZoomOut size={15} strokeWidth="var(--icon-stroke)" aria-hidden />
        </button>
        <button type="button" aria-label="Acercar" title="Acercar" onClick={() => setEscala((v) => Math.min(3, v + 0.2))} style={estiloIconoBoton}>
          <ZoomIn size={15} strokeWidth="var(--icon-stroke)" aria-hidden />
        </button>
        <button type="button" aria-label="Ajustar" title="Ajustar" onClick={ajustar} style={estiloBoton(escala !== 1 || pan.x !== 0 || pan.y !== 0)}>
          Ajustar
        </button>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          <i className="leyenda lv1" aria-hidden /> H1
          <i className="leyenda lv2" aria-hidden /> H2
          <i className="leyenda lv3" aria-hidden /> H3
        </span>
      </div>

      <svg
        className="mapa-estructura"
        data-testid="diagrama-estructura"
        role="img"
        aria-label="Diagrama de estructura del documento"
        viewBox={`0 0 ${ancho} ${alto}`}
        width="100%"
        style={{ display: 'block', width: '100%', height: 'auto', touchAction: 'none' }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <g data-testid="mapa-zoom" transform={`translate(${pan.x} ${pan.y}) scale(${escala})`}>
          {visibles.flatMap((padre) =>
            padre.nodo.hijos
              .filter((hijo) => ids.has(hijo.id))
              .map((hijo) => {
                const destino = porId.get(hijo.id);
                if (!destino) return null;
                const x1 = padre.x + ANCHO_NODO;
                const y1 = padre.y + ALTO_NODO / 2;
                const x2 = destino.x;
                const y2 = destino.y + ALTO_NODO / 2;
                const dx = Math.max(16, (x2 - x1) / 2);
                return (
                  <path
                    key={`${padre.nodo.id}-${hijo.id}`}
                    className={`mapa-arista e${destino.nivel}`}
                    d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                  />
                );
              }),
          )}

          {visibles.map((n) => {
            const sel = n.nodo.id === nodoSeleccionadoId;
            const esRaiz = n.nodo.id === RAIZ_ID;
            return (
              <g
                key={n.nodo.id}
                data-nodo={n.nodo.id}
                className={`mapa-nodo lv${n.nivel}${sel ? ' sel' : ''}`}
                onClick={() => {
                  if (!esRaiz) onSelect?.(n.nodo);
                }}
                onPointerDown={(e) => {
                  if (!onReubicar || esRaiz) return;
                  e.stopPropagation();
                  draggingRef.current = n.nodo.id;
                  setDragging(n.nodo.id);
                }}
                onPointerUp={() => {
                  const origen = draggingRef.current;
                  const destino = n.nodo.id;
                  draggingRef.current = null;
                  setDragging(null);
                  if (!origen || esRaiz || origen === destino) return;
                  if (esDescendiente([raizDocumento], origen, destino)) return;
                  onReubicar?.(origen, destino);
                }}
                style={{
                  cursor: esRaiz ? 'default' : onSelect ? 'pointer' : 'default',
                  opacity: dragging === n.nodo.id ? 0.45 : 1,
                }}
              >
                <title>{`Sección: ${n.nodo.titulo}`}</title>
                <rect className="mapa-caja" x={n.x} y={n.y} width={ANCHO_NODO} height={ALTO_NODO} rx={8} />
                <text className="mapa-etiqueta" x={n.x + 12} y={n.y + 24}>
                  {n.etiqueta}
                  {n.hijos > 0 ? ` · +${n.hijos}` : ''}
                </text>
                {sel ? (
                  <rect className="mapa-anillo" x={n.x - 3} y={n.y - 3} width={ANCHO_NODO + 6} height={ALTO_NODO + 6} rx={10} />
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

const estiloBoton = (activo: boolean): React.CSSProperties => ({
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-xs)',
  color: activo ? 'var(--color-accent)' : 'var(--color-text-secondary)',
  background: activo ? 'var(--color-accent-soft)' : 'transparent',
  border: '1px solid ' + (activo ? 'var(--color-accent)' : 'var(--color-border-subtle)'),
  borderRadius: 'var(--radius-full)',
  padding: '2px var(--space-2)',
  cursor: 'pointer',
});

const estiloIconoBoton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--color-text-secondary)',
  background: 'transparent',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-full)',
  padding: '3px',
  cursor: 'pointer',
};

export default MapaEstructura;

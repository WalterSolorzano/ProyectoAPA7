/* WordAPA7 — Diagrama Anatómico SVG
 *
 * Cero librerías pesadas (0 KB extras; ni dagre ni cytoscape ni reactflow).
 * Diagramación SVG matemática procedimental con nodos para H1, H2, H3.
 * Toggles de densidad: 'Ocultar figuras' y 'Solo hasta H2'.
 * Drag & Drop con proyección de línea fantasma (guía punteada).
 * 0 emojis, solo lucide-react y tokens CSS.
 */

import React, { useState, useMemo } from 'react';
import { Eye, EyeOff, Layers, Move } from 'lucide-react';
import type { NodoJerarquia } from '../../lib/jerarquia';

export const ANCHO_NODO = 210;
export const ALTO_NODO = 58;
const SEPARACION_Y = 18;
const SEPARACION_X = 54;
const MARGEN = 16;
const CARACTERES_MAX = 28;

export function recortarTitulo(titulo: string, max = CARACTERES_MAX): string {
  const limpio = (titulo || '').trim() || 'Sin título';
  if (limpio.length <= max) return limpio;
  return `${limpio.slice(0, Math.max(1, max - 1))}…`;
}

export interface PosicionNodoAnatomico {
  nodo: NodoJerarquia;
  x: number;
  y: number;
  nivel: number;
  etiqueta: string;
}

export interface DiagramaAnatomicoSVGProps {
  arbol: readonly NodoJerarquia[];
  selectedId?: string | null;
  onSelect?: (nodo: NodoJerarquia) => void;
  onReorder?: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
}

export const DiagramaAnatomicoSVG: React.FC<DiagramaAnatomicoSVGProps> = ({
  arbol,
  selectedId,
  onSelect,
  onReorder,
}) => {
  const [ocultarFiguras, setOcultarFiguras] = useState(false);
  const [soloHastaH2, setSoloHastaH2] = useState(false);

  // Estado del drag-and-drop
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: 'before' | 'after';
    x: number;
    y: number;
    width: number;
  } | null>(null);

  // Filtrar árbol según opciones de densidad
  const arbolFiltrado = useMemo(() => {
    function filtrar(nodos: readonly NodoJerarquia[]): NodoJerarquia[] {
      return nodos.map((n) => {
        const hijosFiltrados = soloHastaH2 && n.nivel >= 2 ? [] : filtrar(n.hijos);
        return {
          ...n,
          hijos: hijosFiltrados,
        };
      });
    }
    return filtrar(arbol);
  }, [arbol, soloHastaH2]);

  // Cálculo procedimental de posiciones (layout de árbol de izquierda a derecha)
  const posiciones = useMemo(() => {
    const mapa = new Map<string, PosicionNodoAnatomico>();
    let fila = 0;
    const SEPARACION_Y_FILA = ALTO_NODO + SEPARACION_Y;

    const visitar = (nodos: readonly NodoJerarquia[], columna: number): number => {
      const filasDeEsteNivel: number[] = [];
      for (const n of nodos) {
        const yHijo = n.hijos.length > 0 ? visitar(n.hijos, columna + 1) : fila++ * SEPARACION_Y_FILA;
        filasDeEsteNivel.push(yHijo);
        mapa.set(n.id, {
          nodo: n,
          x: MARGEN + columna * (ANCHO_NODO + SEPARACION_X),
          y: yHijo,
          nivel: n.nivel,
          etiqueta: recortarTitulo(n.titulo),
        });
      }
      return filasDeEsteNivel.reduce((a, b) => a + b, 0) / (filasDeEsteNivel.length || 1);
    };

    visitar(arbolFiltrado, 0);

    const resultado: PosicionNodoAnatomico[] = [];
    const enOrden = (nodos: readonly NodoJerarquia[]) => {
      for (const n of nodos) {
        const p = mapa.get(n.id);
        if (p) resultado.push(p);
        enOrden(n.hijos);
      }
    };
    enOrden(arbolFiltrado);
    return resultado;
  }, [arbolFiltrado]);

  if (posiciones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-[var(--color-text-tertiary,#94a3b8)]">
        <p>No hay secciones que graficar en este nivel de filtro.</p>
      </div>
    );
  }

  const ancho = Math.max(...posiciones.map((n) => n.x + ANCHO_NODO)) + MARGEN * 2;
  const alto = Math.max(...posiciones.map((n) => n.y + ALTO_NODO)) + MARGEN * 2;
  const porId = new Map(posiciones.map((p) => [p.nodo.id, p]));

  // Handlers para Drag & Drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedNodeId(id);
  };

  const handleDragOver = (e: React.DragEvent, p: PosicionNodoAnatomico) => {
    e.preventDefault();
    if (!draggedNodeId || draggedNodeId === p.nodo.id) return;

    let isBefore = true;
    if (e.currentTarget && typeof (e.currentTarget as Element).getBoundingClientRect === 'function') {
      const rect = (e.currentTarget as Element).getBoundingClientRect();
      if (rect.height > 0) {
        const offsetY = e.clientY - rect.top;
        isBefore = offsetY < rect.height / 2;
      } else {
        // En entorno de test JSDOM donde getBoundingClientRect devuelve 0
        const clientY = typeof e.clientY === 'number' ? e.clientY : 0;
        isBefore = clientY < ALTO_NODO / 2;
      }
    }

    setDropTarget({
      id: p.nodo.id,
      position: isBefore ? 'before' : 'after',
      x: p.x,
      y: isBefore ? p.y - 4 : p.y + ALTO_NODO + 4,
      width: ANCHO_NODO,
    });
  };

  const handleDragLeave = () => {
    // Si sale de los límites
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedNodeId && dropTarget && onReorder) {
      onReorder(draggedNodeId, targetId, dropTarget.position);
    }
    setDraggedNodeId(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedNodeId(null);
    setDropTarget(null);
  };

  return (
    <div className="flex flex-col w-full h-full bg-[var(--color-bg-canvas,#f8fafc)] select-none">
      {/* Barra de Controles de Densidad */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle,#e2e8f0)] bg-[var(--color-bg-surface,#ffffff)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[var(--color-text-secondary,#64748b)]">
            Densidad Anatómica:
          </span>
          <button
            type="button"
            onClick={() => setOcultarFiguras(!ocultarFiguras)}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors ${
              ocultarFiguras
                ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/30 font-medium'
                : 'text-[var(--text-main,#1e293b)] bg-[var(--color-bg-surface-alt,#f1f5f9)] border-[var(--border-subtle,#e2e8f0)] hover:bg-[var(--border-subtle,#e2e8f0)]'
            }`}
          >
            {ocultarFiguras ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>Ocultar figuras</span>
          </button>

          <button
            type="button"
            onClick={() => setSoloHastaH2(!soloHastaH2)}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors ${
              soloHastaH2
                ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/30 font-medium'
                : 'text-[var(--text-main,#1e293b)] bg-[var(--color-bg-surface-alt,#f1f5f9)] border-[var(--border-subtle,#e2e8f0)] hover:bg-[var(--border-subtle,#e2e8f0)]'
            }`}
          >
            <Layers size={13} />
            <span>Solo hasta H2</span>
          </button>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary,#94a3b8)]">
          <Move size={12} />
          <span>Arrastra un nodo para reordenar</span>
        </div>
      </div>

      {/* Contenedor del Lienzo SVG */}
      <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
        <svg
          className="diagrama-anatomico-svg"
          role="img"
          aria-label={`Diagrama Anatómico: ${posiciones.length} secciones`}
          width={ancho}
          height={alto}
          viewBox={`0 0 ${ancho} ${alto}`}
          style={{ display: 'block' }}
          onDragOver={(e) => e.preventDefault()}
          onDragEnd={handleDragEnd}
        >
          {/* 1. Curvas de conexión anatómica entre padres e hijos */}
          {posiciones.flatMap((p) =>
            p.nodo.hijos.map((hijo) => {
              const destino = porId.get(hijo.id);
              if (!destino) return null;
              const x1 = p.x + ANCHO_NODO;
              const y1 = p.y + ALTO_NODO / 2;
              const x2 = destino.x;
              const y2 = destino.y + ALTO_NODO / 2;
              const medio = (x1 + x2) / 2;
              return (
                <path
                  key={`curva-${p.nodo.id}-${hijo.id}`}
                  d={`M ${x1} ${y1} C ${medio} ${y1}, ${medio} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="var(--color-border-strong,#cbd5e1)"
                  strokeWidth="1.5"
                />
              );
            }),
          )}

          {/* 2. Proyección de línea fantasma (guía punteada para soltar) */}
          {dropTarget && (
            <line
              data-testid="linea-fantasma-drop"
              x1={dropTarget.x - 6}
              y1={dropTarget.y}
              x2={dropTarget.x + dropTarget.width + 6}
              y2={dropTarget.y}
              stroke="var(--accent-primary, #0284c7)"
              strokeWidth="2.5"
              strokeDasharray="4 4"
            />
          )}

          {/* 3. Nodos SVG interactivos */}
          {posiciones.map((p) => {
            const isSelected = selectedId === p.nodo.id;
            const isDragging = draggedNodeId === p.nodo.id;
            const nivelBadge = `H${Math.min(Math.max(p.nivel, 1), 5)}`;

            return (
              <g
                key={p.nodo.id}
                data-testid={`nodo-svg-${p.nodo.id}`}
                data-nodo={p.nodo.id}
                draggable
                onDragStart={(e) => handleDragStart(e, p.nodo.id)}
                onDragOver={(e) => handleDragOver(e, p)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, p.nodo.id)}
                onClick={onSelect ? () => onSelect(p.nodo) : undefined}
                style={{
                  cursor: 'grab',
                  opacity: isDragging ? 0.45 : 1,
                  transition: 'opacity 120ms ease',
                }}
                aria-label={`Sección ${nivelBadge}: ${p.nodo.titulo}`}
              >

                {/* Caja de fondo del nodo */}
                <rect
                  x={p.x}
                  y={p.y}
                  width={ANCHO_NODO}
                  height={ALTO_NODO}
                  rx={6}
                  fill={isSelected ? 'var(--color-bg-surface, #ffffff)' : 'var(--color-bg-surface, #ffffff)'}
                  stroke={
                    isSelected
                      ? 'var(--accent-primary, #0284c7)'
                      : 'var(--border-subtle, #e2e8f0)'
                  }
                  strokeWidth={isSelected ? 2 : 1}
                />

                {/* Badge de Nivel H1 / H2 / H3 */}
                <rect
                  x={p.x + 8}
                  y={p.y + 10}
                  width={22}
                  height={15}
                  rx={3}
                  fill={
                    isSelected
                      ? 'var(--accent-primary, #0284c7)'
                      : 'var(--color-bg-surface-alt, #f1f5f9)'
                  }
                />
                <text
                  x={p.x + 19}
                  y={p.y + 21}
                  textAnchor="middle"
                  fill={isSelected ? '#ffffff' : 'var(--color-text-secondary, #64748b)'}
                  fontSize="9px"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {nivelBadge}
                </text>

                {/* Título de la sección */}
                <text
                  x={p.x + 36}
                  y={p.y + 22}
                  fill="var(--color-text-primary, #0f172a)"
                  fontSize="12px"
                  fontWeight={600}
                >
                  {p.etiqueta}
                </text>

                {/* Métricas: Palabras y Figuras */}
                <text
                  x={p.x + 10}
                  y={p.y + 44}
                  fill="var(--color-text-tertiary, #94a3b8)"
                  fontSize="10px"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {`${p.nodo.palabras} palabras`}
                  {!ocultarFiguras && p.nodo.figuras > 0 ? ` • ${p.nodo.figuras} fig` : ''}
                  {p.nodo.hijos.length > 0 && soloHastaH2 && p.nivel >= 2
                    ? ` • +${p.nodo.hijos.length} subs`
                    : ''}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default DiagramaAnatomicoSVG;

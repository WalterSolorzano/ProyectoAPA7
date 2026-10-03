import React from 'react';
import {
  Palette,
  Image as ImageIcon,
  Table as TableIcon,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react';
import type { NodoJerarquia } from '../../lib/jerarquia';
import type { ElementModel, ImageModel } from '../../types';
import type { DiagnosticItem } from '../../lib/academicRules';

export interface InspectorActivosSeccionProps {
  nodo: NodoJerarquia | null;
  elementos: readonly ElementModel[];
  diagnosticos?: readonly DiagnosticItem[];
  onLevelChange?: (nodo: NodoJerarquia, nuevoNivel: number) => void;
  onOpenFigureEditor?: (elemento: ElementModel) => void;
}

export const InspectorActivosSeccion: React.FC<InspectorActivosSeccionProps> = ({
  nodo,
  elementos,
  diagnosticos = [],
  onLevelChange,
  onOpenFigureEditor,
}) => {
  if (!nodo) {
    return (
      <aside
        className="w-full h-full p-4 flex flex-col items-center justify-center text-center bg-[var(--color-bg-surface,#ffffff)] border-l border-[var(--border-subtle,#e2e8f0)] text-[var(--text-muted,#64748b)] text-xs"
        aria-label="Inspector de sección"
      >
        <p>Selecciona una sección en el esquema para ver y editar sus propiedades.</p>
      </aside>
    );
  }

  // Activos visuales (figuras o tablas) pertenecientes a este capítulo
  const activos = React.useMemo(() => {
    const targetId = nodo.element_id || nodo.elementoId || nodo.id;
    const idxInicio = elementos.findIndex((e) => e.id === targetId);
    if (idxInicio === -1) return [];

    const items: ElementModel[] = [];
    for (let i = idxInicio + 1; i < elementos.length; i++) {
      const el = elementos[i];
      if (el.type === 'heading' && (el.heading_level || 1) <= nodo.nivel) {
        break;
      }
      if (el.type === 'image' || el.type === 'table') {
        items.push(el);
      }
    }
    return items;
  }, [nodo, elementos]);

  // Diagnósticos asociados a este nodo
  const diagsNodo = React.useMemo(() => {
    return diagnosticos.filter((d) => d.nodoId === nodo.id);
  }, [diagnosticos, nodo.id]);

  const niveles = [1, 2, 3, 4, 5];

  return (
    <aside
      className="w-full h-full flex flex-col bg-[var(--color-bg-surface,#ffffff)] border-l border-[var(--border-subtle,#e2e8f0)] overflow-y-auto text-[var(--text-main,#0f172a)] text-xs"
      aria-label="Inspector de sección y activos"
    >
      {/* Cabecera del Inspector */}
      <div className="p-3 border-b border-[var(--border-subtle,#e2e8f0)] space-y-2">
        <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-[var(--text-muted,#64748b)]">
          Nivel Jerárquico APA 7
        </span>

        {/* Botonera de Micro-Chips H1-H5 (Sin combobox ni dropdown) */}
        <div className="flex items-center gap-1.5" role="group" aria-label="Nivel jerárquico">
          {niveles.map((lvl) => {
            const isActive = nodo.nivel === lvl;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => onLevelChange?.(nodo, lvl)}
                className={`flex-1 py-1.5 px-2 rounded text-xs font-mono font-bold transition-colors duration-150 border ${
                  isActive
                    ? 'bg-[var(--accent-primary,#0284c7)] text-white border-transparent shadow-sm'
                    : 'bg-[var(--color-bg-surface-alt,#f8fafc)] text-[var(--text-main,#0f172a)] border-[var(--border-subtle,#e2e8f0)] hover:bg-[var(--accent-primary,#0284c7)]/10 hover:border-[var(--accent-primary,#0284c7)]/30'
                }`}
                aria-pressed={isActive}
              >
                H{lvl}
              </button>
            );
          })}
        </div>
      </div>

      {/* Activos Visuales: Figuras y Tablas del Capítulo */}
      <div className="p-3 border-b border-[var(--border-subtle,#e2e8f0)] space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-[var(--text-muted,#64748b)]">
            Activos Visuales del Capítulo
          </span>
          <span className="text-[10px] font-mono text-[var(--text-muted,#64748b)]">
            {activos.length} {activos.length === 1 ? 'activo' : 'activos'}
          </span>
        </div>

        {activos.length === 0 ? (
          <div className="p-2.5 rounded bg-[var(--color-bg-surface-alt,#f8fafc)] border border-[var(--border-subtle,#e2e8f0)] text-[var(--text-muted,#64748b)] text-[11px] italic text-center">
            No hay figuras ni tablas incrustadas en este capítulo.
          </div>
        ) : (
          <div className="space-y-2">
            {activos.map((activo) => {
              const esImagen = activo.type === 'image';
              const figNum = activo.image_info?.figure_number || 1;
              const titulo =
                activo.image_info?.caption ||
                activo.text ||
                (esImagen ? `Figura ${figNum}` : 'Tabla');

              return (
                <div
                  key={activo.id}
                  className="p-2.5 rounded border border-[var(--border-subtle,#e2e8f0)] bg-[var(--color-bg-surface-alt,#f8fafc)] space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <div className="p-1 rounded bg-[var(--color-bg-surface,#ffffff)] border border-[var(--border-subtle,#e2e8f0)] shrink-0 text-[var(--accent-primary,#0284c7)]">
                      {esImagen ? <ImageIcon size={14} /> : <TableIcon size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[11px] truncate">
                        {esImagen ? `Figura ${figNum}` : `Tabla ${figNum}`}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted,#64748b)] line-clamp-2">
                        {titulo}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenFigureEditor?.(activo)}
                    className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[11px] font-medium bg-[var(--color-bg-surface,#ffffff)] border border-[var(--border-subtle,#e2e8f0)] text-[var(--text-main,#0f172a)] hover:bg-[var(--accent-primary,#0284c7)]/10 hover:border-[var(--accent-primary,#0284c7)]/40 transition-colors"
                  >
                    <Palette size={12} className="text-[var(--accent-primary,#0284c7)]" />
                    <span>Abrir Estudio de Estilos & Leyenda</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Auditoría Académica de Prosa (APA 7) */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-[var(--text-muted,#64748b)]">
            Diagnósticos APA 7
          </span>
          {diagsNodo.length === 0 ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
              <CheckCircle2 size={11} /> Correcto
            </span>
          ) : (
            <span className="text-[10px] font-mono text-amber-600 font-medium">
              {diagsNodo.length} {diagsNodo.length === 1 ? 'observación' : 'observaciones'}
            </span>
          )}
        </div>

        {diagsNodo.length === 0 ? (
          <div className="p-2.5 rounded bg-[var(--color-bg-surface-alt,#f8fafc)] border border-[var(--border-subtle,#e2e8f0)] text-[var(--text-muted,#64748b)] text-[11px] text-center">
            Estructura y llamadas en regla según la norma APA 7.
          </div>
        ) : (
          <div className="space-y-1.5">
            {diagsNodo.map((diag) => (
              <div
                key={diag.id}
                className="flex items-start gap-2 p-2 rounded border border-[var(--border-subtle,#e2e8f0)] bg-[var(--color-bg-surface-alt,#f8fafc)] text-[11px]"
              >
                <AlertTriangle
                  size={13}
                  className="shrink-0 text-amber-500 mt-0.5"
                  aria-hidden="true"
                />
                <span className="leading-tight text-[var(--text-main,#0f172a)]">{diag.mensaje}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

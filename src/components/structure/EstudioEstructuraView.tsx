/* WordAPA7 — EstudioEstructuraView
 *
 * Contenedor unificado para la fase de Estructura (Paso 2):
 * - Barra superior con título de fase, switch [Diagrama Anatómico] / [Prosa de Sección]
 *   e indicador pasivo de análisis APA 7 al día.
 * - Columna 1: EsqueletoNavegacion (árbol jerárquico y selector de sección).
 * - Columna 2: DiagramaAnatomicoSVG (modo diagrama) o LecturaProsaSeccion (modo prosa).
 * - Columna 3: InspectorActivosSeccion (chips H1-H5, figuras/tablas, auditoría académica).
 * - Cero emojis, solo tokens CSS y lucide-react.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Network, BookOpen, CheckCircle2, AlertCircle } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { construirJerarquia, NodoJerarquia } from '../../lib/jerarquia';
import { auditarBinomio, auditarLlamadasFiguras, auditarEncuadre, DiagnosticItem } from '../../lib/academicRules';
import { EsqueletoNavegacion } from './EsqueletoNavegacion';
import { DiagramaAnatomicoSVG } from './DiagramaAnatomicoSVG';
import { LecturaProsaSeccion } from './LecturaProsaSeccion';
import { InspectorActivosSeccion } from './InspectorActivosSeccion';
import { ElementModel } from '../../types';

export const EstudioEstructuraView: React.FC = () => {
  const { doc, updateElementType, reorderElements, setSelectedElementId } = useDocStore();
  const [modoVisualizacion, setModoVisualizacion] = useState<'diagrama' | 'prosa'>('diagrama');
  const [seccionSeleccionadaId, setSeccionSeleccionadaId] = useState<string | null>(null);

  const elementos = useMemo(() => doc?.elements || [], [doc?.elements]);

  // Construir el árbol jerárquico de títulos
  const arbolJerarquico = useMemo(() => {
    return construirJerarquia(elementos);
  }, [elementos]);

  // Auditorías académicas APA 7
  const diagnosticos = useMemo(() => {
    const diags: DiagnosticItem[] = [];
    if (!arbolJerarquico || arbolJerarquico.length === 0) return diags;

    // Regla del binomio
    diags.push(...auditarBinomio(arbolJerarquico));

    // Reglas por capítulo raíz
    for (const capitulo of arbolJerarquico) {
      diags.push(...auditarLlamadasFiguras(capitulo, elementos));
    }

    return diags;
  }, [arbolJerarquico, elementos]);

  // Buscar nodo seleccionado o seleccionar el primer nodo por defecto
  const nodoSeleccionado = useMemo<NodoJerarquia | null>(() => {
    if (!arbolJerarquico || arbolJerarquico.length === 0) return null;

    if (!seccionSeleccionadaId) {
      return arbolJerarquico[0];
    }

    const buscarEnArbol = (nodos: readonly NodoJerarquia[]): NodoJerarquia | null => {
      for (const n of nodos) {
        if (n.id === seccionSeleccionadaId || n.elementoId === seccionSeleccionadaId) return n;
        if (n.hijos && n.hijos.length > 0) {
          const res = buscarEnArbol(n.hijos);
          if (res) return res;
        }
      }
      return null;
    };

    return buscarEnArbol(arbolJerarquico) || arbolJerarquico[0];
  }, [arbolJerarquico, seccionSeleccionadaId]);

  const activeId = nodoSeleccionado?.id || null;

  const handleSelect = useCallback((nodo: NodoJerarquia) => {
    setSeccionSeleccionadaId(nodo.id);
    if (nodo.elementoId) {
      setSelectedElementId(nodo.elementoId);
    }
  }, [setSelectedElementId]);

  const handleLevelChange = useCallback((nodo: NodoJerarquia, nuevoNivel: number) => {
    const elemId = nodo.elementoId || nodo.id;
    updateElementType(elemId, 'heading', nuevoNivel);
  }, [updateElementType]);

  const handleReorder = useCallback((draggedId: string, targetId: string, position: 'before' | 'after') => {
    if (!elementos || elementos.length === 0) return;
    const elemDraggedIdx = elementos.findIndex((e) => e.id === draggedId);
    const elemTargetIdx = elementos.findIndex((e) => e.id === targetId);

    if (elemDraggedIdx === -1 || elemTargetIdx === -1) return;

    const copia = [...elementos.map((e) => e.id)];
    const [removido] = copia.splice(elemDraggedIdx, 1);
    const nuevoTargetIdx = copia.indexOf(targetId);

    if (position === 'before') {
      copia.splice(nuevoTargetIdx, 0, removido);
    } else {
      copia.splice(nuevoTargetIdx + 1, 0, removido);
    }

    reorderElements(copia);
  }, [elementos, reorderElements]);

  return (
    <div
      className="flex flex-col w-full h-full overflow-hidden bg-[var(--canvas-bg,#f8fafc)]"
      data-testid="estudio-estructura-view"
    >
      {/* Barra Superior de Control de Estructura */}
      <header className="flex items-center justify-between px-4 py-2 bg-[var(--color-bg-surface,#ffffff)] border-b border-[var(--border-subtle,#e2e8f0)] z-10 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-[var(--text-main,#0f172a)] tracking-tight">
            Estructura del Documento
          </h2>
          {nodoSeleccionado && (
            <span className="text-xs text-[var(--text-muted,#64748b)] border-l border-[var(--border-subtle,#e2e8f0)] pl-3">
              Fase activa: <strong className="font-medium text-[var(--text-main,#0f172a)]">{nodoSeleccionado.titulo}</strong>
            </span>
          )}
        </div>

        {/* Switch Central [Diagrama Anatómico] / [Prosa de Sección] */}
        <div className="flex items-center bg-[var(--surface-subtle,#f1f5f9)] p-0.5 rounded-lg border border-[var(--border-subtle,#e2e8f0)]">
          <button
            type="button"
            onClick={() => setModoVisualizacion('diagrama')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              modoVisualizacion === 'diagrama'
                ? 'bg-[var(--color-bg-surface,#ffffff)] text-[var(--accent-primary,#2563eb)] shadow-sm'
                : 'text-[var(--text-muted,#64748b)] hover:text-[var(--text-main,#0f172a)]'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Diagrama Anatómico</span>
          </button>
          <button
            type="button"
            onClick={() => setModoVisualizacion('prosa')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              modoVisualizacion === 'prosa'
                ? 'bg-[var(--color-bg-surface,#ffffff)] text-[var(--accent-primary,#2563eb)] shadow-sm'
                : 'text-[var(--text-muted,#64748b)] hover:text-[var(--text-main,#0f172a)]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Prosa de Sección</span>
          </button>
        </div>

        {/* Indicador pasivo de análisis APA 7 */}
        <div className="flex items-center gap-2">
          {diagnosticos.length === 0 ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-[var(--surface-subtle,#f1f5f9)] text-[var(--accent-primary,#2563eb)] border border-[var(--border-subtle,#e2e8f0)]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Análisis APA 7 al día</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-amber-50 text-amber-800 border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>{diagnosticos.length} observaciones de estructura</span>
            </div>
          )}
        </div>
      </header>

      {/* Cuerpo Principal de 3 Columnas */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Columna 1: Esqueleto de Navegación */}
        <nav
          className="w-72 shrink-0 border-r border-[var(--border-subtle,#e2e8f0)] bg-[var(--color-bg-surface,#ffffff)] overflow-y-auto"
          aria-label="Esqueleto de navegación"
        >
          <EsqueletoNavegacion
            arbol={arbolJerarquico}
            selectedId={activeId}
            diagnosticos={diagnosticos}
            onSelect={handleSelect}
          />
        </nav>

        {/* Columna 2: Lienzo Central (Diagrama Anatómico o Prosa Editorial) */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--canvas-bg,#f8fafc)] relative">
          {modoVisualizacion === 'diagrama' ? (
            <DiagramaAnatomicoSVG
              arbol={arbolJerarquico}
              selectedId={activeId}
              onSelect={handleSelect}
              onReorder={handleReorder}
            />
          ) : (
            <div className="flex-1 overflow-y-auto p-4 flex justify-center">
              <div className="w-full max-w-3xl">
                <LecturaProsaSeccion
                  seccionActiva={nodoSeleccionado}
                  elementos={elementos}
                />
              </div>
            </div>
          )}
        </main>

        {/* Columna 3: Inspector de Activos y Propiedades */}
        <aside
          className="w-80 shrink-0 border-l border-[var(--border-subtle,#e2e8f0)] bg-[var(--color-bg-surface,#ffffff)] overflow-y-auto"
          aria-label="Inspector de activos de sección"
        >
          <InspectorActivosSeccion
            nodo={nodoSeleccionado}
            elementos={elementos}
            diagnosticos={diagnosticos}
            onLevelChange={handleLevelChange}
            onOpenFigureEditor={() => {}}
          />
        </aside>
      </div>
    </div>
  );
};

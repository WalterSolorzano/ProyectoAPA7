import React from 'react';
import { AlertTriangle, ChevronRight, FileText } from 'lucide-react';
import type { NodoJerarquia } from '../../lib/jerarquia';
import type { DiagnosticItem } from '../../lib/academicRules';

export interface EsqueletoNavegacionProps {
  arbol: readonly NodoJerarquia[];
  selectedId: string | null;
  diagnosticos?: readonly DiagnosticItem[];
  onSelect: (nodo: NodoJerarquia) => void;
}

export const EsqueletoNavegacion: React.FC<EsqueletoNavegacionProps> = ({
  arbol,
  selectedId,
  diagnosticos = [],
  onSelect,
}) => {
  const diagsPorNodo = React.useMemo(() => {
    const mapa = new Set<string>();
    for (const d of diagnosticos) {
      mapa.add(d.nodoId);
    }
    return mapa;
  }, [diagnosticos]);

  const renderNodo = (nodo: NodoJerarquia) => {
    const isSelected = selectedId === nodo.id;
    const tieneAlerta = diagsPorNodo.has(nodo.id);
    const nivelLabel = `H${Math.min(Math.max(nodo.nivel, 1), 5)}`;
    const paddingLeft = 8 + (nodo.nivel - 1) * 12;

    return (
      <div key={nodo.id} className="flex flex-col">
        <button
          type="button"
          onClick={() => onSelect(nodo)}
          style={{ paddingLeft: `${paddingLeft}px` }}
          className={`group flex items-center justify-between w-full py-1.5 pr-2.5 rounded text-left text-xs transition-colors duration-150 border ${
            isSelected
              ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/30 font-medium'
              : 'text-[var(--text-main)] hover:bg-[var(--color-bg-surface-alt,#f8fafc)] border-transparent'
          }`}
        >
          <div className="flex items-center min-w-0 gap-2 pr-1">
            <span
              className={`text-[10px] font-mono px-1 py-0.5 rounded font-semibold tabular-nums shrink-0 border ${
                isSelected
                  ? 'bg-[var(--accent-primary)] text-white border-transparent'
                  : 'bg-[var(--color-bg-surface-alt,#f1f5f9)] text-[var(--text-muted,#64748b)] border-[var(--border-subtle,#e2e8f0)]'
              }`}
            >
              {nivelLabel}
            </span>
            <span className="truncate">{nodo.titulo}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {tieneAlerta && (
              <span
                data-testid={`alerta-nodo-${nodo.id}`}
                title="Observación de estructura APA 7"
                className="text-amber-500 hover:text-amber-600 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform ${
                isSelected
                  ? 'text-[var(--accent-primary)] opacity-100'
                  : 'text-[var(--text-muted,#94a3b8)] opacity-0 group-hover:opacity-100'
              }`}
            />
          </div>
        </button>

        {nodo.hijos && nodo.hijos.length > 0 && (
          <div className="flex flex-col">
            {nodo.hijos.map((hijo) => renderNodo(hijo))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav
      aria-label="Esqueleto de Navegación Jerárquica"
      className="flex flex-col w-full h-full bg-[var(--color-bg-surface,#ffffff)] border-r border-[var(--border-subtle,#e2e8f0)] p-3 overflow-y-auto"
    >
      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-[var(--border-subtle,#e2e8f0)] text-xs font-semibold text-[var(--text-main)]">
        <FileText className="w-3.5 h-3.5 text-[var(--text-muted,#64748b)]" />
        <span>Estructura del Documento</span>
      </div>

      <div className="flex flex-col gap-0.5">
        {arbol.length === 0 ? (
          <div className="py-4 text-xs text-center text-[var(--text-muted,#94a3b8)]">
            Sin encabezados detectados
          </div>
        ) : (
          arbol.map((nodo) => renderNodo(nodo))
        )}
      </div>
    </nav>
  );
};

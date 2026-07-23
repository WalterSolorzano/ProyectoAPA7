/* WordAPA7 — Left Navigation & Collapsible Outline Pane (Con Botón de Ocultar/Mostrar) */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ConfidenceBadge } from '../shared/ConfidenceBadge';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Eye, EyeOff, ListFilter } from 'lucide-react';

export const DocumentOutlinePane: React.FC = () => {
  const { doc, selectedElementId, setSelectedElementId } = useDocStore();
  const [filter, setFilter] = useState<'problems' | 'headings' | 'all'>('problems');
  const [showHighConfidence, setShowHighConfidence] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  if (!doc) return null;

  // Si está colapsado, mostrar barra lateral delgada para expandir
  if (isCollapsed) {
    return (
      <div
        onClick={() => setIsCollapsed(false)}
        style={{
          width: '40px',
          minWidth: '40px',
          backgroundColor: '#ffffff',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '16px',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        title="Mostrar Esquema de Navegación"
      >
        <button
          className="btn btn-secondary btn-xs"
          style={{ padding: '6px', borderRadius: '50%' }}
          onClick={(e) => { e.stopPropagation(); setIsCollapsed(false); }}
        >
          <Eye size={16} color="var(--word-blue)" />
        </button>
        <span style={{
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--word-blue)',
          marginTop: '16px',
          letterSpacing: '1px'
        }}>
          ESQUEMA DE NAVEGACIÓN
        </span>
      </div>
    );
  }

  const problemElements = doc.elements.filter((e) => e.type !== 'empty' && e.confidence < 0.85 && !e.is_user_modified);
  const headingElements = doc.elements.filter((e) => e.type === 'heading');
  const highConfidenceElements = doc.elements.filter((e) => e.type !== 'empty' && e.confidence >= 0.85);

  const displayElements = doc.elements.filter((e) => {
    if (e.type === 'empty') return false;
    if (filter === 'problems') return e.confidence < 0.85 && !e.is_user_modified;
    if (filter === 'headings') return e.type === 'heading';
    return true;
  });

  return (
    <div className="nav-pane" style={{ width: '300px', minWidth: '300px', backgroundColor: '#ffffff', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header del Esquema con Botón Ocultar */}
      <div className="nav-pane-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ListFilter size={14} color="var(--word-blue)" /> ESQUEMA DE NAVEGACIÓN
        </span>
        
        <button
          onClick={() => setIsCollapsed(true)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '11px',
            color: '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 6px',
            borderRadius: '4px',
            transition: 'background 0.15s ease'
          }}
          title="Ocultar Esquema para ver el Lienzo Completo"
        >
          <EyeOff size={14} /> Ocultar
        </button>
      </div>

      {/* Chips de Filtro con "⚠️ Problemas" como Predeterminado */}
      <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
        <button
          className={`ribbon-tab ${filter === 'problems' ? 'active' : ''}`}
          onClick={() => setFilter('problems')}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            color: problemElements.length > 0 ? '#dc2626' : 'inherit',
            backgroundColor: filter === 'problems' && problemElements.length > 0 ? '#fee2e2' : undefined
          }}
        >
          <AlertTriangle size={12} style={{ marginRight: '4px' }} />
          Problemas ({problemElements.length})
        </button>

        <button
          className={`ribbon-tab ${filter === 'headings' ? 'active' : ''}`}
          onClick={() => setFilter('headings')}
          style={{ padding: '4px 10px', fontSize: '11px' }}
        >
          Títulos ({headingElements.length})
        </button>

        <button
          className={`ribbon-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
          style={{ padding: '4px 10px', fontSize: '11px' }}
        >
          Todos
        </button>
      </div>

      {/* Contenido Guiado */}
      <div className="nav-pane-content" style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        
        {/* Banner Informativo de Problemas */}
        {filter === 'problems' && (
          <div style={{ marginBottom: '12px' }}>
            {problemElements.length === 0 ? (
              <div style={{ padding: '16px', backgroundColor: '#dcfce7', borderRadius: '6px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                <CheckCircle2 size={24} color="#16a34a" style={{ display: 'block', margin: '0 auto 6px auto' }} />
                <strong style={{ fontSize: '12px', color: '#15803d', display: 'block' }}>¡Todo 100% Verificado!</strong>
                <span style={{ fontSize: '11px', color: '#166534' }}>
                  No hay elementos dudosos que requieran revisión manual.
                </span>
              </div>
            ) : (
              <div style={{ padding: '10px 12px', backgroundColor: '#fff7ed', borderRadius: '6px', border: '1px solid #ffedd5', fontSize: '11px', color: '#c2410c' }}>
                <strong>Tienes {problemElements.length} elementos por revisar:</strong>
                <span style={{ display: 'block', color: '#9a3412', marginTop: '2px' }}>
                  Haz clic en cada ítem para inspeccionarlo en el lienzo.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Resumen Colapsable de Elementos de Alta Confianza (95%+) */}
        {filter === 'all' && highConfidenceElements.length > 0 && (
          <div style={{ marginBottom: '12px', borderRadius: '6px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', overflow: 'hidden' }}>
            <div
              onClick={() => setShowHighConfidence(!showHighConfidence)}
              style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#166534' }}>
                <CheckCircle2 size={14} color="#16a34a" />
                <span>{highConfidenceElements.length} elementos correctos (95%+)</span>
              </div>
              {showHighConfidence ? <ChevronDown size={14} color="#166534" /> : <ChevronRight size={14} color="#166534" />}
            </div>

            {showHighConfidence && (
              <div style={{ padding: '8px', borderTop: '1px solid #bbf7d0', backgroundColor: '#ffffff', maxHeight: '180px', overflowY: 'auto' }}>
                {highConfidenceElements.map((elem) => (
                  <div
                    key={elem.id}
                    onClick={() => setSelectedElementId(elem.id)}
                    style={{ padding: '4px 8px', fontSize: '11px', color: '#334155', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                  >
                    <span style={{ fontWeight: 600 }}>[{elem.type}]</span> {(elem.text || '').slice(0, 40)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Renderizado de la Lista Filtrada */}
        {displayElements.length > 0 && (
          <div>
            {displayElements.map((elem) => {
              const isSelected = selectedElementId === elem.id;
              const isHeading = elem.type === 'heading';
              const lvl = elem.heading_level || 1;
              const indentPx = isHeading ? (lvl - 1) * 10 : 0;

              return (
                <div
                  key={elem.id}
                  onClick={() => setSelectedElementId(elem.id)}
                  style={{
                    marginLeft: `${indentPx}px`,
                    padding: '8px 10px',
                    marginBottom: '6px',
                    borderRadius: '4px',
                    border: `1px solid ${isSelected ? 'var(--word-blue)' : 'var(--border-color)'}`,
                    backgroundColor: isSelected ? '#eff6fc' : '#ffffff',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 1px var(--word-blue)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: isHeading ? 'var(--word-blue)' : '#475569' }}>
                      {elem.type} {elem.heading_level ? `Nivel ${elem.heading_level}` : ''}
                    </span>
                    <ConfidenceBadge confidence={elem.confidence} isUserModified={elem.is_user_modified} />
                  </div>

                  <p style={{
                    fontSize: '11px',
                    color: '#0f172a',
                    margin: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: isHeading ? 600 : 400
                  }}>
                    {elem.text || (elem.image_info ? `Figura: ${elem.image_info.filename}` : `Tabla ${elem.table_info?.table_number}`)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

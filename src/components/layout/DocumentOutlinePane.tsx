/* WordAPA7 — Left Navigation & Collapsible Outline Pane */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ConfidenceBadge } from '../shared/ConfidenceBadge';
import { FileText, BookOpen, Table2 } from '../shared/Icons';

export const DocumentOutlinePane: React.FC = () => {
  const { doc, selectedElementId, setSelectedElementId } = useDocStore();
  const [filter, setFilter] = useState<'all' | 'doubtful' | 'headings' | 'tables'>('all');

  if (!doc) return null;

  const doubtfulCount = doc.elements.filter((e) => e.confidence < 0.85 && !e.is_user_modified && e.type !== 'empty').length;

  const portadaElements = doc.elements.filter((e) => e.type === 'portada_block' || (doc.elements.indexOf(e) < 4 && e.type !== 'heading'));
  const headingElements = doc.elements.filter((e) => e.type === 'heading');
  const allFiltered = doc.elements.filter((e) => {
    if (e.type === 'empty') return false;
    if (filter === 'doubtful') return e.confidence < 0.85 && !e.is_user_modified;
    if (filter === 'headings') return e.type === 'heading';
    if (filter === 'tables') return e.type === 'table' || e.type === 'image';
    return true;
  });

  return (
    <div className="nav-pane">
      <div className="nav-pane-header">
        <span>ESQUEMA DE NAVEGACIÓN</span>
        <span style={{ fontSize: '11px', color: 'var(--word-blue)', fontWeight: 600 }}>{doc.elements.length} elems</span>
      </div>

      {/* Chips de Filtro */}
      <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', flexShrink: 0, backgroundColor: '#f3f2f1' }}>
        <button
          className={`ribbon-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
          style={{ padding: '4px 8px', fontSize: '11px' }}
        >
          Todos
        </button>
        <button
          className={`ribbon-tab ${filter === 'doubtful' ? 'active' : ''}`}
          onClick={() => setFilter('doubtful')}
          style={{ padding: '4px 8px', fontSize: '11px', color: doubtfulCount > 0 ? '#d97706' : 'inherit' }}
        >
          Dudas ({doubtfulCount})
        </button>
        <button
          className={`ribbon-tab ${filter === 'headings' ? 'active' : ''}`}
          onClick={() => setFilter('headings')}
          style={{ padding: '4px 8px', fontSize: '11px' }}
        >
          Títulos ({headingElements.length})
        </button>
      </div>

      {/* Lista del Esquema Organizada sin Emojis */}
      <div className="nav-pane-content">
        
        {/* Sección de Portada */}
        {portadaElements.length > 0 && filter === 'all' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileText size={12} /> PORTADA DEL DOCUMENTO
            </div>
            {portadaElements.map((elem) => (
              <div
                key={elem.id}
                onClick={() => setSelectedElementId(elem.id)}
                style={{
                  padding: '6px 8px',
                  marginBottom: '4px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${selectedElementId === elem.id ? 'var(--word-blue)' : 'var(--border-color)'}`,
                  backgroundColor: selectedElementId === elem.id ? 'var(--word-blue-light)' : '#ffffff',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--word-blue)' }}>[PORTADA] </span>
                <span style={{ fontSize: '11px', color: 'var(--text-main)' }}>{elem.text || 'Logo/Elemento Portada'}</span>
              </div>
            ))}
          </div>
        )}

        {/* Sección de Títulos y Cuerpo */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <BookOpen size={12} /> ESTRUCTURA DEL CUERPO
          </div>
          {allFiltered.map((elem) => {
            const isSelected = selectedElementId === elem.id;
            const isHeading = elem.type === 'heading';
            const lvl = elem.heading_level || 1;
            const indentPx = isHeading ? (lvl - 1) * 12 : 8;

            return (
              <div
                key={elem.id}
                onClick={() => setSelectedElementId(elem.id)}
                style={{
                  marginLeft: `${indentPx}px`,
                  padding: '6px 8px',
                  marginBottom: '4px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isSelected ? 'var(--word-blue)' : 'var(--border-color)'}`,
                  backgroundColor: isSelected ? 'var(--word-blue-light)' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: isHeading ? 'var(--word-blue)' : 'var(--text-secondary)' }}>
                    {elem.type} {elem.heading_level ? `N${elem.heading_level}` : ''}
                  </span>
                  <ConfidenceBadge confidence={elem.confidence} isUserModified={elem.is_user_modified} />
                </div>

                <p style={{
                  fontSize: '11px',
                  color: 'var(--text-main)',
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
      </div>
    </div>
  );
};

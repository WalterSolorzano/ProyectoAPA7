/* WordAPA7 — Paso 2: Headings & Hierarchy Wizard (Títulos Nivel 1, 2, 3 e Índice APA 7) */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Type, CheckCircle2, ListTree, BookOpen, Layers, ChevronUp, CornerDownRight } from 'lucide-react';
import { PaperCanvas } from '../layout/PaperCanvas';
import { APARuleSet } from '../../types';

export const Step2HeadingsWizard: React.FC = () => {
  const { doc, updateElementType, setSelectedElementId, selectedElementId } = useDocStore();
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all');

  if (!doc) return null;

  const headings = doc.elements.filter(e => e.type === 'heading');
  const filteredHeadings = headings.filter(h => levelFilter === 'all' || (h.heading_level || 1) === levelFilter);

  const level1Count = headings.filter(h => (h.heading_level || 1) === 1).length;
  const level2Count = headings.filter(h => (h.heading_level || 1) === 2).length;
  const level3Count = headings.filter(h => (h.heading_level || 1) === 3).length;

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* Panel Izquierdo: Lista Guiada por Niveles */}
      <div style={{
        width: '400px',
        backgroundColor: 'var(--canvas-bg)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Encabezado del Panel */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'var(--canvas-bg)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Type size={16} /> Paso 2: Clasificación de Títulos ({headings.length})
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Identifica tus Secciones Principales (Nivel 1) y Subsecciones (Nivel 2 y 3).
          </span>
        </div>

        {/* Filtros por Nivel Guiados (Títulos 1 vs Títulos 2) */}
        <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'var(--canvas-bg)' }}>
          <button
            className={`ribbon-tab ${levelFilter === 'all' ? 'active' : ''}`}
            onClick={() => setLevelFilter('all')}
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            Todos ({headings.length})
          </button>
          <button
            className={`ribbon-tab ${levelFilter === 1 ? 'active' : ''}`}
            onClick={() => setLevelFilter(1)}
            style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, color: 'var(--accent-primary)' }}
          >
            Nivel 1 ({level1Count})
          </button>
          <button
            className={`ribbon-tab ${levelFilter === 2 ? 'active' : ''}`}
            onClick={() => setLevelFilter(2)}
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            Nivel 2 ({level2Count})
          </button>
          <button
            className={`ribbon-tab ${levelFilter === 3 ? 'active' : ''}`}
            onClick={() => setLevelFilter(3)}
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            Nivel 3 ({level3Count})
          </button>
        </div>

        {/* Numeración de Títulos por Nivel */}
        {levelFilter !== 'all' ? (
          <div style={{ padding: '10px 12px', backgroundColor: 'rgba(250,173,20,0.08)', borderBottom: '1px solid rgba(250,173,20,0.2)', fontSize: '11px' }}>
            <strong style={{ color: '#92400e' }}>Estilo de Numeración (Nivel {levelFilter}):</strong>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              {[
                { val: 'roman', label: 'Romanos', icon: 'Ⅰ' },
                { val: 'decimal', label: 'Decimal', icon: '1.' },
                { val: 'none', label: 'Sin Num.', icon: '—' },
              ].map((opt) => {
                const ruleKey = `heading_numbering_style_lvl${levelFilter}` as keyof APARuleSet;
                const currentStyle = useDocStore.getState().rules[ruleKey] || 'decimal';
                return (
                  <button
                    key={opt.val}
                    onClick={() => {
                      useDocStore.getState().setRules({ [ruleKey]: opt.val });
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      border: `1.5px solid ${currentStyle === opt.val ? '#eab308' : '#e2e8f0'}`,
                      borderRadius: '6px',
                      backgroundColor: currentStyle === opt.val ? '#fef9c3' : '#ffffff',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: currentStyle === opt.val ? 700 : 500,
                      color: currentStyle === opt.val ? '#92400e' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>{opt.icon}</span> {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ padding: '10px 12px', backgroundColor: 'var(--canvas-bg)', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Selecciona un Nivel (1, 2 o 3) arriba para configurar su estilo de numeración de forma independiente.
          </div>
        )}

        {/* Leyenda APA 7 */}
        <div style={{ padding: '8px 12px', backgroundColor: 'rgba(124,92,252,0.1)', borderBottom: '1px solid #dbeafe', fontSize: '11px', color: '#1e40af' }}>
          <strong>Estándar de Alineación APA 7:</strong>
          <span style={{ display: 'block', marginTop: '2px', color: '#1e3a8a' }}>
            • <strong>Nivel 1:</strong> Centrado, Negrita (Secciones Principales)<br />
            • <strong>Nivel 2:</strong> Izquierda, Negrita (Subsecciones)<br />
            • <strong>Nivel 3:</strong> Izquierda, Negrita Cursiva
          </span>
        </div>

        {/* Lista de Títulos Filtrados */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {filteredHeadings.length === 0 ? (
            <div style={{ textIndent: 0, padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
              No se encontraron títulos en esta categoría.
            </div>
          ) : (
            filteredHeadings.map((h, idx) => {
              const isSelected = selectedElementId === h.id;
              const currentLvl = h.heading_level || 1;

              return (
                <div
                  key={h.id}
                  onClick={() => setSelectedElementId(h.id)}
                  style={{
                    padding: '8px 12px',
                    marginBottom: '4px',
                    borderRadius: '6px',
                    border: `1px solid ${isSelected ? 'var(--word-blue)' : 'transparent'}`,
                    backgroundColor: isSelected ? '#eff6fc' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: currentLvl === 1 ? 'var(--word-blue)' : currentLvl === 2 ? '#0284c7' : '#475569',
                      color: '#ffffff',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      L{currentLvl}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        title="Subir Nivel"
                        disabled={currentLvl <= 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateElementType(h.id, 'heading', Math.max(1, currentLvl - 1), h.text);
                        }}
                        style={{ padding: '2px 6px', fontSize: '10px', cursor: currentLvl <= 1 ? 'not-allowed' : 'pointer' }}
                      >
                        Subir Nivel
                      </button>
                      <button
                        title="Degradar a Párrafo"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateElementType(h.id, 'paragraph', 1, h.text);
                        }}
                        style={{ padding: '2px 6px', fontSize: '10px', cursor: 'pointer' }}
                      >
                        Degradar a Párrafo
                      </button>
                    </div>
                  </div>


                  <p style={{
                    fontSize: '12px',
                    fontWeight: isSelected ? '600' : '400',
                    margin: 0,
                    color: 'var(--text-main)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {h.text}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Panel Derecho: Lienzo Sincronizado y Slide-in Panel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: 'var(--canvas-bg)', position: 'relative' }}>
        <PaperCanvas />
        
        {/* Slide-in Panel para el Elemento Seleccionado */}
        {selectedElementId && headings.find(h => h.id === selectedElementId) && (
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '320px',
            backgroundColor: 'var(--canvas-bg)',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '16px',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-main)', fontWeight: 600 }}>Editar Título</h4>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              {headings.find(h => h.id === selectedElementId)?.text}
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[1, 2, 3].map((lvl) => {
                const h = headings.find(el => el.id === selectedElementId);
                const currentLvl = h?.heading_level || 1;
                return (
                  <button
                    key={lvl}
                    className={`btn btn-sm ${currentLvl === lvl ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => {
                      if (h) updateElementType(h.id, 'heading', lvl, h.text);
                    }}
                  >
                    Nivel {lvl}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-sm btn-secondary"
                style={{ flex: 1, color: '#991b1b', borderColor: 'rgba(255,77,79,0.2)' }}
                onClick={() => {
                  const h = headings.find(el => el.id === selectedElementId);
                  if (h) updateElementType(h.id, 'paragraph', 1, h.text);
                }}
              >
                Degradar a Párrafo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

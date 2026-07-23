/* WordAPA7 — Paso 2: Headings & Hierarchy Wizard (Títulos Nivel 1, 2, 3 e Índice APA 7) */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Type, CheckCircle2, ListTree, BookOpen, Layers } from 'lucide-react';
import { PaperCanvas } from '../layout/PaperCanvas';

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
        backgroundColor: '#ffffff',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Encabezado del Panel */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--word-blue)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Type size={16} /> Paso 2: Clasificación de Títulos ({headings.length})
          </h3>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Identifica tus Secciones Principales (Nivel 1) y Subsecciones (Nivel 2 y 3).
          </span>
        </div>

        {/* Filtros por Nivel Guiados (Títulos 1 vs Títulos 2) */}
        <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
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
            style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, color: 'var(--word-blue)' }}
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

        {/* Leyenda APA 7 */}
        <div style={{ padding: '8px 12px', backgroundColor: '#eff6fc', borderBottom: '1px solid #dbeafe', fontSize: '11px', color: '#1e40af' }}>
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
            <div style={{ textIndent: 0, padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
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
                    padding: '10px',
                    marginBottom: '8px',
                    borderRadius: '6px',
                    border: `1px solid ${isSelected ? 'var(--word-blue)' : '#e2e8f0'}`,
                    backgroundColor: isSelected ? '#eff6fc' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: currentLvl === 1 ? 'var(--word-blue)' : currentLvl === 2 ? '#0284c7' : '#475569',
                      color: '#ffffff',
                      padding: '1px 6px',
                      borderRadius: '4px'
                    }}>
                      TÍTULO NIVEL {currentLvl}
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>#{idx + 1}</span>
                  </div>

                  <p style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    margin: '6px 0',
                    color: '#0f172a',
                    fontStyle: currentLvl === 3 ? 'italic' : 'normal',
                    textAlign: currentLvl === 1 ? 'center' : 'left'
                  }}>
                    {h.text}
                  </p>

                  {/* Cambiar Nivel en 1 Clic */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                    {[1, 2, 3].map((lvl) => (
                      <button
                        key={lvl}
                        className={`btn btn-xs ${currentLvl === lvl ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '2px 8px', fontSize: '10px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateElementType(h.id, 'heading', lvl, h.text);
                        }}
                      >
                        Nivel {lvl}
                      </button>
                    ))}
                    <button
                      className="btn btn-xs btn-secondary"
                      style={{ padding: '2px 6px', fontSize: '10px', marginLeft: 'auto' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateElementType(h.id, 'paragraph', 1, h.text);
                      }}
                    >
                      Párrafo
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Panel Derecho: Lienzo Sincronizado */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: '#f1f5f9' }}>
        <PaperCanvas />
      </div>
    </div>
  );
};

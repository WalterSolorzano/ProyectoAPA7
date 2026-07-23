/* WordAPA7 — Paso 2: Headings & Hierarchy Wizard (Títulos Nivel 1, 2, 3) */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Type, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';
import { PaperCanvas } from '../layout/PaperCanvas';

export const Step2HeadingsWizard: React.FC = () => {
  const { doc, updateElementType, setSelectedElementId, selectedElementId } = useDocStore();

  if (!doc) return null;

  const headings = doc.elements.filter(e => e.type === 'heading');

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* Panel Izquierdo: Lista Guiada de Títulos Identificados */}
      <div style={{
        width: '380px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Encabezado del Panel */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--word-blue)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Type size={16} /> Paso 2: Jerarquía de Títulos ({headings.length})
          </h3>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Verifica y confirma los niveles de títulos detectados en tu documento.
          </span>
        </div>

        {/* Leyenda APA 7 de Niveles */}
        <div style={{ padding: '10px 16px', backgroundColor: '#eff6fc', borderBottom: '1px solid #dbeafe', fontSize: '11px', color: '#1e40af' }}>
          <strong>Regla APA 7 para Títulos:</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li><strong>Nivel 1:</strong> Centrado, Negrita (Sección Principal)</li>
            <li><strong>Nivel 2:</strong> Izquierda, Negrita (Subsección)</li>
            <li><strong>Nivel 3:</strong> Izquierda, Negrita Cursiva</li>
          </ul>
        </div>

        {/* Lista de Títulos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {headings.length === 0 ? (
            <div style={{ textIndent: 0, padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
              No se detectaron títulos explícitos. Haz clic derecho en cualquier párrafo del lienzo para convertirlo en Título.
            </div>
          ) : (
            headings.map((h, idx) => {
              const isSelected = selectedElementId === h.id;

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
                    <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: 'var(--word-blue)', color: '#ffffff', padding: '1px 6px', borderRadius: '4px' }}>
                      Nivel {h.heading_level || 1}
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>Título #{idx + 1}</span>
                  </div>

                  <p style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    margin: '4px 0',
                    color: '#0f172a',
                    fontStyle: h.heading_level === 3 ? 'italic' : 'normal',
                    textAlign: h.heading_level === 1 ? 'center' : 'left'
                  }}>
                    {h.text}
                  </p>

                  {/* Controles de Nivel en 1 Clic */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                    {[1, 2, 3].map((lvl) => (
                      <button
                        key={lvl}
                        className={`btn btn-xs ${h.heading_level === lvl ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '1px 6px', fontSize: '10px' }}
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
                      style={{ padding: '1px 6px', fontSize: '10px', marginLeft: 'auto' }}
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

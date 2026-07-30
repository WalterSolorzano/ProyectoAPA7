/* WordAPA7 — Paso 3: Figures & Images Wizard (Formato de Figuras APA 7) */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { PaperCanvas } from '../layout/PaperCanvas';

export const Step3FiguresWizard: React.FC = () => {
  const { doc, setSelectedElementId, selectedElementId } = useDocStore();

  if (!doc) return null;

  // Filtrar solo figuras reales del cuerpo (excluyendo portada_block)
  const figures = doc.elements.filter(e => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0);

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* Panel Izquierdo: Lista Guiada de Figuras Detectadas */}
      <div style={{
        width: '380px',
        backgroundColor: 'var(--canvas-bg)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'var(--canvas-bg)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ImageIcon size={16} /> Paso 3: Rotulación de Figuras ({figures.length})
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Verifica el etiquetado secuencial APA 7 (Figura 1, Figura 2...) de las imágenes de tu trabajo.
          </span>
        </div>

        <div style={{ padding: '10px 16px', backgroundColor: 'rgba(124,92,252,0.1)', borderBottom: '1px solid #dbeafe', fontSize: '11px', color: '#1e40af' }}>
          <strong>Estándar APA 7ma Edición para Figuras:</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li><strong>Número:</strong> "Figura X" en Negrita arriba de la imagen.</li>
            <li><strong>Título:</strong> Cursiva justo debajo del número.</li>
            <li><strong>Imagen:</strong> Alineada al centro sin bordes de figura.</li>
          </ul>
        </div>

        {/* Lista de Figuras */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {figures.length === 0 ? (
            <div style={{ textIndent: 0, padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
              No se detectaron figuras en el cuerpo del documento.
            </div>
          ) : (
            figures.map((fig, idx) => {
              const isSelected = selectedElementId === fig.id;

              return (
                <div
                  key={fig.id}
                  onClick={() => setSelectedElementId(fig.id)}
                  style={{
                    padding: '10px',
                    marginBottom: '10px',
                    borderRadius: '6px',
                    border: `1px solid ${isSelected ? 'var(--word-blue)' : '#e2e8f0'}`,
                    backgroundColor: isSelected ? '#eff6fc' : '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                      Figura {fig.image_info?.figure_number || idx + 1}
                    </span>
                    <span style={{ fontSize: '10px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <CheckCircle2 size={12} /> Formateado APA
                    </span>
                  </div>

                  {fig.image_info?.relative_url && (
                    <div style={{ textAlign: 'center', margin: '6px 0', backgroundColor: 'var(--canvas-bg)', padding: '4px', borderRadius: '4px' }}>
                      <img
                        src={fig.image_info.relative_url}
                        alt="Vista Previa Figura"
                        style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  )}

                  {fig.image_info?.caption && (
                    <p style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                      {fig.image_info.caption}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Panel Derecho: Lienzo Sincronizado */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: 'var(--canvas-bg)', position: 'relative' }}>
        <PaperCanvas />

      </div>
    </div>
  );
};

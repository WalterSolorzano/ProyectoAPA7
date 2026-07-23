/* WordAPA7 — Desktop Status Bar con Alto Contraste AAA y Slider de Zoom */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';

export const StatusBar: React.FC = () => {
  const { doc, rules, zoomLevel, setZoomLevel } = useDocStore();

  if (!doc) return null;

  const totalWords = doc.elements.reduce((acc, elem) => {
    if (elem.text) {
      return acc + elem.text.trim().split(/\s+/).filter(Boolean).length;
    }
    return acc;
  }, 0);

  const headingsCount = doc.elements.filter((e) => e.type === 'heading').length;
  const tablesCount = doc.elements.filter((e) => e.type === 'table').length;
  const figuresCount = doc.elements.filter((e) => e.type === 'image' && (e.image_info?.figure_number || 0) > 0).length;
  const estimatedPages = Math.max(1, Math.ceil(doc.elements.length / 14));

  return (
    <footer className="app-statusbar">
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', color: '#ffffff', fontWeight: 500 }}>
        <span>Páginas: {estimatedPages}</span>
        <span>{totalWords} Palabras</span>
        <span>{headingsCount} Títulos APA</span>
        <span>{tablesCount} Tablas</span>
        <span>{figuresCount} Figuras</span>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', color: '#ffffff', fontWeight: 500 }}>
        <span>Fuente: {rules.font_family} ({rules.font_size_pt}pt)</span>
        <span>Interlineado: {rules.line_spacing}x</span>

        {/* Zoom Slider Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setZoomLevel(zoomLevel - 10)}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
            title="Reducir Zoom"
          >
            –
          </button>
          <input
            type="range"
            min={50}
            max={200}
            step={5}
            value={zoomLevel}
            onChange={(e) => setZoomLevel(Number(e.target.value))}
            style={{ width: '80px', cursor: 'pointer' }}
          />
          <button
            onClick={() => setZoomLevel(zoomLevel + 10)}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
            title="Aumentar Zoom"
          >
            +
          </button>
          <span style={{ fontSize: '11px', width: '38px', textAlign: 'right', color: '#ffffff', fontWeight: 600 }}>{zoomLevel}%</span>
        </div>

        <span style={{ color: '#4ade80', fontWeight: 700 }}>● Conectado a FastAPI</span>
      </div>
    </footer>
  );
};

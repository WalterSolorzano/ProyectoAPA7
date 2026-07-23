/* WordAPA7 — Desktop Status Bar con Alto Contraste AAA y Slider de Zoom */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { NIMDiagnosticsModal } from '../shared/NIMDiagnosticsModal';
import { Cpu } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const {
    doc,
    rules,
    zoomLevel,
    setZoomLevel,
    apiKey,
    nimLogs,
    isNIMDiagnosticsOpen,
    setIsNIMDiagnosticsOpen
  } = useDocStore();

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
    <>
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

          <span style={{ color: '#4ade80', fontWeight: 700 }}>● FastAPI</span>

          {/* Badge Interactivo NVIDIA NIM */}
          <button
            onClick={() => setIsNIMDiagnosticsOpen(true)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px',
              padding: '2px 8px',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Ver Diagnóstico de IA e Historial de NVIDIA NIM"
          >
            <Cpu size={12} color={apiKey ? '#4ade80' : '#f59e0b'} />
            <span style={{ color: apiKey ? '#4ade80' : '#f59e0b', fontWeight: 700 }}>
              {apiKey ? 'NVIDIA NIM (Activo)' : 'NVIDIA NIM (Modo Reglas)'}
            </span>
          </button>
        </div>
      </footer>

      {/* Modal de Diagnóstico de NIM */}
      <NIMDiagnosticsModal
        isOpen={isNIMDiagnosticsOpen}
        onClose={() => setIsNIMDiagnosticsOpen(false)}
        logs={nimLogs || []}
        apiKeyPresent={!!apiKey}
      />
    </>
  );
};

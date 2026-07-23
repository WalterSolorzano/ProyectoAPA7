/* WordAPA7 — Microsoft Word Style Ribbon Toolbar (Interfaz Limpia y Botón Unificado) */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { WandIcon, ShieldCheckIcon } from '../shared/Icons';
import { Download, Sparkles, Sliders } from 'lucide-react';

export const RibbonToolbar: React.FC = () => {
  const { rules, setRules, runLLMClassify, exportDocx, acceptHighConfidenceElements, isLoading } = useDocStore();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="ribbon-container" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid var(--border-color)' }}>
      {/* Contenido Dinámico del Ribbon */}
      <div className="ribbon-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 16px' }}>
        
        {/* Lado Izquierdo: Acciones Rápidas y Configuración APA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          
          {/* Configuración APA Rápidas */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSettings(!showSettings)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '5px 10px' }}
          >
            <Sliders size={13} />
            <span>Configuración APA: <strong>{rules.font_family} ({rules.line_spacing}x)</strong></span>
          </button>

          {/* Menú Emergente de Configuración */}
          {showSettings && (
            <div style={{
              position: 'absolute',
              top: '42px',
              left: '16px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '12px',
              display: 'flex',
              gap: '12px',
              zIndex: 300,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
            }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Fuente APA 7</label>
                <select
                  className="form-control"
                  value={rules.font_family}
                  onChange={(e) => setRules({ font_family: e.target.value })}
                  style={{ width: '150px', padding: '4px', fontSize: '11px' }}
                >
                  <option value="Times New Roman">Times New Roman (12 pt)</option>
                  <option value="Calibri">Calibri (11 pt)</option>
                  <option value="Arial">Arial (11 pt)</option>
                  <option value="Georgia">Georgia (11 pt)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Interlineado</label>
                <select
                  className="form-control"
                  value={rules.line_spacing}
                  onChange={(e) => setRules({ line_spacing: parseFloat(e.target.value) })}
                  style={{ width: '100px', padding: '4px', fontSize: '11px' }}
                >
                  <option value={2.0}>Doble (2.0)</option>
                  <option value={1.5}>1.5 líneas</option>
                  <option value={1.0}>Sencillo</option>
                </select>
              </div>
            </div>
          )}

          {/* Botón 1: Aprobar Verdes */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={acceptHighConfidenceElements}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#15803d', borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }}
            title="Aprobar automáticamente todos los elementos con confianza >= 90%"
          >
            <ShieldCheckIcon size={13} />
            <span>Aprobar Verdes (≥90%)</span>
          </button>

          {/* Botón 2: Refinar con IA NVIDIA NIM */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={runLLMClassify}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--word-blue)' }}
          >
            <WandIcon size={13} />
            <span>{isLoading ? 'Consultando IA...' : 'Refinar con IA (NVIDIA NIM)'}</span>
          </button>
        </div>

        {/* Lado Derecho: Único Botón Principal "Descargar APA 7" */}
        <div>
          <button
            className="btn btn-primary"
            onClick={() => exportDocx(false)}
            disabled={isLoading}
            style={{
              padding: '6px 18px',
              fontSize: '13px',
              fontWeight: 700,
              backgroundColor: '#15803d',
              borderColor: '#15803d',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={15} />
            <span>Descargar APA 7</span>
          </button>
        </div>

      </div>
    </div>
  );
};

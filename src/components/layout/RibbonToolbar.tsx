/* WordAPA7 — Microsoft Word Style Ribbon Toolbar sin Emojis */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { WandIcon, DownloadIcon, ShieldCheckIcon } from '../shared/Icons';

export const RibbonToolbar: React.FC = () => {
  const { activeTab, setActiveTab, rules, setRules, apiKey, setApiKey, runLLMClassify, exportDocx, acceptHighConfidenceElements, isLoading } = useDocStore();
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div className="ribbon-container">
      {/* Pestañas superiores del Ribbon */}
      <div className="ribbon-tabs">
        <button
          className={`ribbon-tab ${activeTab === 'classifier' ? 'active' : ''}`}
          onClick={() => setActiveTab('classifier')}
        >
          Estructura & Títulos
        </button>
        <button
          className={`ribbon-tab ${activeTab === 'portada' ? 'active' : ''}`}
          onClick={() => setActiveTab('portada')}
        >
          Portada APA 7
        </button>
        <button
          className={`ribbon-tab ${activeTab === 'referencias' ? 'active' : ''}`}
          onClick={() => setActiveTab('referencias')}
        >
          Referencias
        </button>
        <button
          className={`ribbon-tab ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          Formato & Tipografía
        </button>
        <button
          className={`ribbon-tab ${activeTab === 'validator' ? 'active' : ''}`}
          onClick={() => setActiveTab('validator')}
        >
          Validador Citas
        </button>
      </div>

      {/* Contenido dinámico del Ribbon */}
      <div className="ribbon-content">
        {/* Grupo 1: Fuente y Estilo APA */}
        <div className="ribbon-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Fuente APA 7</label>
              <select
                className="form-control"
                value={rules.font_family}
                onChange={(e) => setRules({ font_family: e.target.value })}
                style={{ width: '140px', padding: '3px 6px', fontSize: '11px' }}
              >
                <option value="Times New Roman">Times New Roman (12 pt)</option>
                <option value="Calibri">Calibri (11 pt)</option>
                <option value="Arial">Arial (11 pt)</option>
                <option value="Georgia">Georgia (11 pt)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Interlineado</label>
              <select
                className="form-control"
                value={rules.line_spacing}
                onChange={(e) => setRules({ line_spacing: parseFloat(e.target.value) })}
                style={{ width: '90px', padding: '3px 6px', fontSize: '11px' }}
              >
                <option value={2.0}>Doble (2.0)</option>
                <option value={1.5}>1.5</option>
                <option value={1.0}>Sencillo</option>
              </select>
            </div>
          </div>
          <div className="ribbon-group-title">Tipografía</div>
        </div>

        {/* Grupo 2: Acciones Rápidas de Clasificación */}
        <div className="ribbon-group">
          <button
            className="ribbon-btn"
            onClick={acceptHighConfidenceElements}
            style={{ backgroundColor: 'rgba(16, 124, 65, 0.12)', color: '#107c41', borderColor: '#107c41' }}
            title="Aprobar automáticamente todos los elementos con confianza >= 90%"
          >
            <ShieldCheckIcon size={14} />
            <span>Aprobar Verdes (≥90%)</span>
          </button>
          <div className="ribbon-group-title">Revisión Masiva</div>
        </div>

        {/* Grupo 3: Inteligencia Artificial */}
        <div className="ribbon-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="password"
              placeholder="NVIDIA API Key"
              className="form-control"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ width: '120px', fontSize: '11px', padding: '3px 6px' }}
            />
            <button className="ribbon-btn" onClick={runLLMClassify} disabled={isLoading}>
              <WandIcon size={14} />
              <span>Refinar DUDAS</span>
            </button>
          </div>
          <div className="ribbon-group-title">IA NVIDIA NIM</div>
        </div>

        {/* Grupo 4: Exportar */}
        <div className="ribbon-group" style={{ borderRight: 'none', position: 'relative' }}>
          <button
            className="ribbon-btn ribbon-btn-primary"
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={isLoading}
          >
            <DownloadIcon size={14} />
            <span>Exportar .DOCX ▼</span>
          </button>

          {showExportMenu && (
            <div style={{
              position: 'absolute',
              top: '40px',
              right: '0',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              zIndex: 200,
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              minWidth: '240px'
            }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                onClick={() => { setShowExportMenu(false); exportDocx(false); }}
              >
                Documento Final Limpio APA 7
              </button>
              <button
                className="btn btn-secondary btn-sm"
                style={{ textAlign: 'left', justifyContent: 'flex-start', color: '#107c41' }}
                onClick={() => { setShowExportMenu(false); exportDocx(true); }}
              >
                Con Control de Cambios (Track Changes)
              </button>
            </div>
          )}

          <div className="ribbon-group-title">Generación</div>
        </div>
      </div>
    </div>
  );
};

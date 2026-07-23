/* WordAPA7 — Window Titlebar (Fluent Design) */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { FileText, Wand2, Download, Minus, Square, X } from 'lucide-react';

export const WindowTitlebar: React.FC = () => {
  const { doc, showFileMenu, setShowFileMenu, exportDocx, runLLMClassify, isLoading } = useDocStore();

  return (
    <div className="window-titlebar">
      <div className="window-titlebar-left">
        <div className="window-titlebar-icon">
          <FileText size={14} strokeWidth={2.5} />
        </div>

        {/* File button — toggles backstage */}
        <button
          className={`window-titlebar-file-btn${showFileMenu ? ' active' : ''}`}
          onClick={() => setShowFileMenu(!showFileMenu)}
        >
          Archivo
        </button>

        <span className="window-titlebar-title">WordAPA7</span>
        {doc && (
          <span className="window-titlebar-subtitle">
            — {doc.file_name} (APA 7 {doc.apa_format === 'student' ? 'Estudiante' : 'Profesional'})
          </span>
        )}
      </div>

      <div className="window-titlebar-actions">
        {doc && (
          <>
            <button
              className="ribbon-btn"
              onClick={runLLMClassify}
              disabled={isLoading}
              style={{ height: '28px', padding: '4px 10px' }}
            >
              <Wand2 size={14} strokeWidth={2} />
              Refinar IA
            </button>

            <button
              className="ribbon-btn ribbon-btn-success"
              onClick={() => exportDocx(false)}
              disabled={isLoading}
              style={{ height: '28px', padding: '4px 12px' }}
            >
              <Download size={14} strokeWidth={2} />
              Descargar .DOCX APA 7 (Ctrl+S)
            </button>
          </>
        )}

        <div className="window-controls">
          <button className="window-control-btn" title="Minimizar" aria-label="Minimizar">
            <Minus size={14} strokeWidth={2} />
          </button>
          <button className="window-control-btn" title="Maximizar" aria-label="Maximizar">
            <Square size={12} strokeWidth={2} />
          </button>
          <button className="window-control-btn btn-close" title="Cerrar" aria-label="Cerrar">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
};

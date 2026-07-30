/* WordAPA7 — Window Titlebar (Fluent Design) */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { FileText, Minus, Square, X } from 'lucide-react';

export const WindowTitlebar: React.FC = () => {
  const { doc, showFileMenu, setShowFileMenu } = useDocStore();

  return (
    <div className="window-titlebar" style={{ backgroundColor: 'var(--sidebar-bg)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="window-titlebar-left">
        <div className="window-titlebar-icon" style={{ borderRadius: '4px', overflow: 'hidden' }}>
          <img src="/logo.jpg" alt="Logo" style={{ width: '14px', height: '14px', objectFit: 'cover' }} />
        </div>



        <span className="window-titlebar-title" style={{ color: 'var(--text-main)' }}>WordAPA7</span>
        {doc && (
          <span className="window-titlebar-subtitle" style={{ color: 'var(--text-muted)' }}>
            — {doc.file_name} (APA 7 {doc.apa_format === 'student' ? 'Estudiante' : 'Profesional'})
          </span>
        )}
      </div>

      <div className="window-titlebar-actions">
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

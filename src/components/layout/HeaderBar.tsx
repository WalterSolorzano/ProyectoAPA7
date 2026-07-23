/* WordAPA7 — Header Bar (deprecated — replaced by WindowTitlebar + RibbonToolbar) */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Download, Wand2, FileText } from 'lucide-react';

export const HeaderBar: React.FC = () => {
  const { doc, apiKey, setApiKey, runLLMClassify, exportDocx, isLoading } = useDocStore();

  return (
    <header style={{
      height: '56px',
      backgroundColor: 'var(--bg-base)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '6px',
          background: 'var(--accent)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'white',
        }}>
          <FileText size={18} strokeWidth={2} />
        </div>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>WordAPA7</h1>
          {doc && <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{doc.file_name}</p>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <input
          type="password"
          placeholder="NVIDIA API Key (Opcional)"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="ribbon-input"
          style={{ width: '200px' }}
        />

        {doc && (
          <>
            <button className="ribbon-btn" onClick={runLLMClassify} disabled={isLoading}>
              <Wand2 size={14} strokeWidth={2} />
              Refinar con IA
            </button>

            <button className="ribbon-btn ribbon-btn-primary" onClick={() => exportDocx(false)} disabled={isLoading}>
              <Download size={14} strokeWidth={2} />
              {isLoading ? 'Procesando...' : 'Descargar APA 7 (.docx)'}
            </button>
          </>
        )}
      </div>
    </header>
  );
};

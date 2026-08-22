import React, { useEffect } from 'react';
import { Download, Sparkles, Undo, Redo, Sun, Moon, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { useUpdateStore } from '../../store/useUpdateStore';
import { GuidedWizardBar } from '../wizard/GuidedWizardBar';

type ChromeStyle = React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

const dragRegion = { WebkitAppRegion: 'drag' } as ChromeStyle;
const noDragRegion = { WebkitAppRegion: 'no-drag' } as ChromeStyle;

export function UnifiedToolbar() {
  const {
    uploadFile,
    undo,
    redo,
    doc,
    isBackendReady,
    isLoading,
    theme,
    setTheme,
    hasUnsavedChanges,
    viewMode,
  } = useDocStore();

  // Estado del historial de undo/redo (para deshabilitar los botones)
  const historyIndex = useDocStore((s) => s.historyIndex);
  const historyLen = useDocStore((s) => s.history.length);
  const canUndo = !!doc && historyIndex > 0;
  const canRedo = !!doc && historyIndex < historyLen - 1;

  // Chip de actualización: se muestra cuando la descarga terminó.
  const updateState = useUpdateStore((s) => s.state);
  const initUpdate = useUpdateStore((s) => s.init);
  const installUpdate = useUpdateStore((s) => s.install);
  useEffect(() => { initUpdate(); }, [initUpdate]);

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.docx';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        uploadFile(file);
      }
    };
    input.click();
  };

  // Electron draws native window buttons (min/max/close) over the top-right corner
  const isElectron = !!(window as any).electronAPI;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      height: '48px',
      backgroundColor: 'var(--sidebar-bg)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '0 16px 0 20px',
      position: 'relative',
      zIndex: 10,
      flexShrink: 0,
      ...dragRegion, // Single draggable chrome strip
    }}>
      {/* Left: Logo + Brand + File button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="15" y2="17" />
          </svg>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>WordAPA7</span>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-subtle)', margin: '0 4px', flexShrink: 0 }} />

        {/* File button */}
        <button type="button"
          onClick={() => useDocStore.getState().setShowFileMenu(!useDocStore.getState().showFileMenu)}
          style={{
            background: 'var(--surface-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-main)',
            fontSize: '12px',
            padding: '4px 10px',
            cursor: 'pointer',
            transition: 'background 0.15s',
            flexShrink: 0,
            ...noDragRegion,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-surface-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
        >Archivo</button>
      </div>

      {/* Center: GuidedWizardBar */}
      <div style={{ display: 'flex', justifyContent: 'center', minWidth: 0, overflow: 'hidden', ...noDragRegion }}>
        <GuidedWizardBar />
      </div>

      {/* Right: action buttons when doc is loaded */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0, overflow: 'hidden' }}>
        {doc && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0, paddingRight: isElectron ? '100px' : '12px', ...noDragRegion }}>
          {/* Save status chip (compact, passive) */}
          <span
            title={hasUnsavedChanges ? 'Hay cambios sin guardar. Se guardan automáticamente.' : 'Progreso guardado automáticamente.'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap',
              color: hasUnsavedChanges ? 'var(--accent-warning)' : 'var(--accent-success)',
            }}
          >
            {hasUnsavedChanges
              ? <><AlertCircle size={11} /> Sin guardar</>
              : <><CheckCircle2 size={11} /> Guardado</>}
          </span>

          <div style={toolbarDivider} />

          {/* Undo / Redo (icon only) */}
          <button type="button"
            onClick={() => undo()}
            disabled={!canUndo}
            title="Deshacer (Ctrl+Z)"
            style={ghostBtn}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(128,128,128,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
          >
            <Undo size={11} />
          </button>
          <button type="button"
            onClick={() => redo()}
            disabled={!canRedo}
            title="Rehacer (Ctrl+Y)"
            style={ghostBtn}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(128,128,128,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
          >
            <Redo size={11} />
          </button>

          <div style={toolbarDivider} />

          {/* Revisor — simplified to ghost style (no blue accent) */}
          <button type="button"
            onClick={() => useDocStore.getState().setForceRightPanelOpen(true)}
            disabled={!isBackendReady || !doc || isLoading}
            title="Revisor: auditar párrafos y revisar citas"
            style={ghostBtn}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(128,128,128,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
          >
            <Sparkles size={11} />
            <span className="toolbar-btn-label">Revisor</span>
          </button>

          {/* Descargar — primary CTA */}
          {viewMode !== 'export' && (
            <div style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
              <button type="button"
                onClick={() => useDocStore.getState().openExportTunnel()}
                disabled={!isBackendReady || !doc || isLoading}
                title="Túnel de exportación: elegí formato y descargá (Ctrl+6)"
                style={{
                  background: 'var(--accent-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '5px 12px',
                  cursor: isLoading ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  transition: 'opacity 0.15s',
                  opacity: (!isBackendReady || !doc || isLoading) ? 0.85 : 1,
                }}
              >
                {isLoading
                  ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Download size={12} />}
                <span className="toolbar-btn-label">{isLoading ? 'Generando…' : 'Descargar'}</span>
              </button>
              {isLoading && (
                <span style={{ position: 'absolute', left: 6, right: 6, bottom: -3, height: 2, borderRadius: 2, overflow: 'hidden', background: 'rgba(255,255,255,0.25)' }}>
                  <span className="toolbar-btn-progress" style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: '#fff' }} />
                </span>
              )}
            </div>
          )}

          {/* Update available (only when an update has been downloaded) */}
          {updateState === 'downloaded' && (
            <button
              type="button"
              onClick={() => installUpdate()}
              title="Actualización descargada. Clic para reiniciar e instalar."
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: 'rgba(82,196,26,0.14)',
                border: '1px solid rgba(82,196,26,0.4)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--accent-success)',
                fontSize: '11px', fontWeight: 700,
                padding: '4px 8px', cursor: 'pointer',
              }}
            >
              <Download size={11} />
              <span className="toolbar-btn-label">Actualización</span>
            </button>
          )}

          <div style={toolbarDivider} />

          {/* Theme toggle (icon only) */}
          <button type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            style={ghostBtn}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(128,128,128,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
          >
            {theme === 'dark' ? <Sun size={11} /> : <Moon size={11} />}
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  background: 'var(--surface-subtle)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-secondary)',
  fontSize: '11px',
  padding: '4px 8px',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '4px',
  transition: 'background 0.15s',
};

const toolbarDivider = {
  width: '1px', height: '20px', backgroundColor: 'var(--border-subtle)', margin: '0 2px', flexShrink: 0,
} as React.CSSProperties;

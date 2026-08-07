import React, { useEffect } from 'react';
import { Download, Sparkles, Undo, Redo, SlidersHorizontal, Home, Save, Command, Sun, Moon } from 'lucide-react';
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
    setSettingsStudioOpen,
    goHome,
    saveSnapshot,
    setCommandPaletteOpen,
    theme,
    setTheme,
  } = useDocStore();

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
      display: 'flex',
      alignItems: 'center',
      height: '48px',
      backgroundColor: 'var(--sidebar-bg)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '0 16px 0 20px',
      gap: '8px',
      position: 'relative',
      zIndex: 10,
      flexShrink: 0,
      ...dragRegion, // Single draggable chrome strip
    }}>
      {/* Left: Logo + Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <img
          src="/logo.jpg"
          alt="WordAPA7"
          style={{ height: '24px', width: 'auto', borderRadius: '6px', display: 'block' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>WordAPA7</span>
         <span style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '1px 5px', backgroundColor: 'var(--surface-subtle)', borderRadius: '3px', marginLeft: '2px' }}>APA 7</span>
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

      {/* Center: GuidedWizardBar — grows to fill space */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', ...noDragRegion }}>
        <GuidedWizardBar />
      </div>

      {/* Right: action buttons when doc is loaded */}
      {doc && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0, paddingRight: isElectron ? '100px' : '12px', ...noDragRegion }}>
          <button type="button"
            onClick={() => goHome()}
            title="Volver al inicio (sin salir)"
            style={ghostBtn}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(128,128,128,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
          >
            <Home size={11} /> <span className="toolbar-btn-label">Inicio</span>
          </button>
          <button type="button"
            onClick={() => saveSnapshot()}
            title="Guardar progreso de la sesión (snapshot)"
            style={ghostBtn}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(128,128,128,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
          >
            <Save size={11} /> <span className="toolbar-btn-label">Guardar</span>
          </button>
          <div style={toolbarDivider} />
          <button type="button"
            onClick={() => setCommandPaletteOpen(true)}
            disabled={!doc}
            title="Paleta de comandos (Ctrl+K)"
            style={{ ...ghostBtn, color: 'var(--accent-primary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(128,128,128,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
          >
            <Command size={11} /> <span className="toolbar-btn-label">Ctrl+K</span>
          </button>
          <div style={toolbarDivider} />
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
          <button type="button"
            onClick={() => setSettingsStudioOpen(true)}
            title="Abrir estudio de ajustes con vista previa en vivo"
            style={ghostBtn}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(128,128,128,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
          >
            <SlidersHorizontal size={11} />
          </button>
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
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px',
              transition: 'opacity 0.15s',
              opacity: (!isBackendReady || !doc || isLoading) ? 0.5 : 1,
            }}
          >
            <Download size={12} />
            <span className="toolbar-btn-label">Descargar</span>
          </button>
          <div style={toolbarDivider} />
          <button type="button"
            onClick={() => useDocStore.getState().setForceRightPanelOpen(true)}
            disabled={!isBackendReady || !doc || isLoading}
            title="Herramientas: auditar párrafos y revisar citas"
            style={{
              background: 'rgba(79,124,255,0.14)',
              border: '1px solid rgba(79,124,255,0.35)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-main)',
              fontSize: '11px',
              padding: '4px 8px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <Sparkles size={11} color="var(--accent-primary)" />
            <span className="toolbar-btn-label">Revisor</span>
          </button>
          <button type="button"
            onClick={() => undo()}
            disabled={!doc}
            title="Deshacer (Ctrl+Z)"
            style={ghostBtn}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(128,128,128,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
          >
            <Undo size={11} />
          </button>
          <button type="button"
            onClick={() => redo()}
            disabled={!doc}
            title="Rehacer (Ctrl+Y)"
            style={ghostBtn}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(128,128,128,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
          >
            <Redo size={11} />
          </button>
          <div style={toolbarDivider} />
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


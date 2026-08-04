import React, { useState, useRef, useEffect } from 'react';
import { FileUp, Download, Wand2, Undo, Redo, SlidersHorizontal, Home, Save, Cpu, ShieldCheck, Command, Sun, Moon } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { GuidedWizardBar } from '../wizard/GuidedWizardBar';

type ChromeStyle = React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

const dragRegion = { WebkitAppRegion: 'drag' } as ChromeStyle;
const noDragRegion = { WebkitAppRegion: 'no-drag' } as ChromeStyle;

const AIMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { llmProgress, runLLMClassify, setIsNIMDiagnosticsOpen, isLoading, isBackendReady, doc } = useDocStore();

  const busy = isLoading || llmProgress.status === 'processing';
  const disabled = !isBackendReady || !doc || busy;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', top: '48px', right: '20px', width: '300px', maxWidth: 'calc(100vw - 40px)',
        backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 300,
        padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Wand2 size={14} color="var(--accent-primary)" /> Refinamiento IA
        </strong>
        <span style={{
          fontSize: '10px', padding: '2px 8px', borderRadius: '999px', fontWeight: 700,
          backgroundColor: llmProgress.status === 'processing' ? 'rgba(250,173,20,0.15)' : 'rgba(79,124,255,0.15)',
          color: llmProgress.status === 'processing' ? 'var(--accent-warning)' : 'var(--accent-primary)',
        }}>
          {llmProgress.status === 'processing' ? 'PROCESANDO' : llmProgress.status === 'error' ? 'ERROR' : 'LISTO'}
        </span>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
        Refina la clasificación de los elementos del documento con un modelo de lenguaje. Si no configuras una API key, se usa la clasificación heurística.
      </p>

      {llmProgress.status === 'processing' && (
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Clasificando elementos</span>
            <span>{llmProgress.elements_processed}/{llmProgress.elements_total}</span>
          </div>
          <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${llmProgress.elements_total > 0 ? Math.round((llmProgress.elements_processed / llmProgress.elements_total) * 100) : 0}%`,
              height: '100%', backgroundColor: 'var(--accent-primary)', borderRadius: '3px',
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
        <button
          type="button"
          onClick={() => { if (!disabled) { runLLMClassify(); } }}
          disabled={disabled}
          style={{
            flex: 1, padding: '8px 10px', borderRadius: '10px', cursor: disabled ? 'not-allowed' : 'pointer',
            background: 'var(--accent-primary)',
            color: '#fff', border: 'none', fontSize: '12px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Wand2 size={13} /> {busy ? 'Clasificando…' : 'Refinar con IA'}
        </button>
        <button
          type="button"
          onClick={() => { setIsNIMDiagnosticsOpen(true); onClose(); }}
          style={{
            flexShrink: 0, padding: '8px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            background: 'var(--surface-subtle)', color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)', fontSize: '12px',
          }}
        >
          Diagnóstico
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        <button
          type="button"
          onClick={() => { useDocStore.getState().setAuditorMode(true); onClose(); }}
          style={{
            flex: 1, padding: '7px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'inherit',
            background: 'rgba(79,124,255,0.10)', color: 'var(--accent-primary)',
            border: '1px solid rgba(79,124,255,0.25)', fontSize: '12px', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          <ShieldCheck size={13} /> Auditor
        </button>
      </div>

      {!isBackendReady && (
        <div style={{ fontSize: '10px', color: 'var(--accent-warning)' }}>
          El backend no está listo todavía.
        </div>
      )}
      {!doc && (
        <div style={{ fontSize: '10px', color: 'var(--accent-warning)' }}>
          Sube un documento para poder clasificarlo.
        </div>
      )}
    </div>
  );
};

export function UnifiedToolbar() {
  const {
    uploadFile,
    undo,
    redo,
    doc,
    isBackendReady,
    isLoading,
    setDownloadModalOpen,
    setSettingsStudioOpen,
    goHome,
    saveSnapshot,
    setCommandPaletteOpen,
    theme,
    setTheme,
  } = useDocStore();

  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const aiMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutside = (e: MouseEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setAiMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, []);

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
        <div ref={aiMenuRef} style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0, paddingRight: isElectron ? '100px' : '12px', ...noDragRegion }}>
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
            onClick={() => setDownloadModalOpen(true)}
            disabled={!isBackendReady || !doc || isLoading}
            title="Descargar documento APA 7 (Ctrl+S)"
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
            onClick={() => setAiMenuOpen(!aiMenuOpen)}
            disabled={!isBackendReady || !doc || isLoading}
            title="Refinamiento con IA"
            aria-expanded={aiMenuOpen}
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
            <Wand2 size={11} color="var(--accent-primary)" />
            IA
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

          {aiMenuOpen && (
            <AIMenu onClose={() => setAiMenuOpen(false)} />
          )}
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


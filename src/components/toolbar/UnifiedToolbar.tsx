import React from 'react';
import { FileUp, Save, Download, Wand2, ShieldCheck, Undo } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { GuidedWizardBar } from '../wizard/GuidedWizardBar';

export function UnifiedToolbar() {
  const { 
    viewMode, 
    setViewMode, 
    uploadFile, 
    exportDocx, 
    runLLMClassify, 
    runCitationAudit,
    apiKey,
    setApiKey,
    undo,
    doc,
    isBackendReady,
    isLoading,
    wizardStep
  } = useDocStore();

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

  const isActionDisabled = !isBackendReady || !doc || isLoading;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: '44px',
      backgroundColor: 'var(--sidebar-bg)',  // #18181c
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      padding: '0 16px',
      gap: '8px',
      position: 'relative',
      zIndex: 10,
      flexShrink: 0,
    }}>
      {/* Left: Logo + Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '6px',
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px rgba(124,92,252,0.4)',
        }}>
          <FileUp size={13} color="white" strokeWidth={2.5} />
        </div>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>WordAPA7</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '1px 5px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginLeft: '2px' }}>APA 7</span>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 4px', flexShrink: 0 }} />

      {/* File button */}
      <button
        onClick={() => useDocStore.getState().setShowFileMenu(!useDocStore.getState().showFileMenu)}
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-main)',
          fontSize: '12px',
          padding: '3px 10px',
          cursor: 'pointer',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      >Archivo</button>

      {/* Center: GuidedWizardBar — grows to fill space */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <GuidedWizardBar />
      </div>

      {/* Right: action buttons when doc is loaded */}
      {doc && wizardStep !== 6 && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={() => exportDocx(false)}
            disabled={!isBackendReady || !doc || isLoading}
            style={{
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover))',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 12px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px',
              boxShadow: '0 0 10px rgba(124,92,252,0.3)',
              transition: 'opacity 0.15s',
              opacity: (!isBackendReady || !doc || isLoading) ? 0.5 : 1,
            }}
          >
            <Download size={12} strokeWidth={2.5} />
            Exportar APA7
          </button>
          <button
            onClick={() => runLLMClassify()}
            disabled={!isBackendReady || !doc || isLoading}
            title="Refinar con IA"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              padding: '3px 8px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <Wand2 size={11} />
            IA
          </button>
          <button
            onClick={() => undo()}
            disabled={!doc}
            title="Deshacer"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              padding: '3px 8px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <Undo size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

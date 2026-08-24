import React, { useCallback, useEffect, useState } from 'react';
import { Download, Sparkles, Undo, Redo, Sun, Moon, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { useUpdateStore } from '../../store/useUpdateStore';
import { getSideloadStatus, repairSideload, SideloadStatus } from '../../api/backend';

type ChromeStyle = React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };
const noDragRegion = { WebkitAppRegion: 'no-drag' } as ChromeStyle;

type SideloadState = 'active' | 'outdated' | 'missing';

const SIDELOAD_CHIP: Record<SideloadState, { color: string; label: string }> = {
  active: { color: 'var(--accent-success)', label: 'Complemento' },
  outdated: { color: 'var(--accent-warning)', label: 'Actualizar complemento' },
  missing: { color: 'var(--accent-danger)', label: 'Instalar complemento' },
};

export function UnifiedToolbar() {
  const {
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

  // ── T5: chip de estado del complemento de Word ──
  const [sideload, setSideload] = useState<SideloadStatus | null>(null);
  const [hbActive, setHbActive] = useState<boolean | null>(null);
  const chipLabel = hbActive === true ? 'Activo en Word' : 'Instalado — ábrelo desde Mis complementos';
  const refreshSideload = useCallback(() => {
    fetch('/api/addin/sideload-status').then(r=>r.json()).then((d:any)=>setHbActive(!!d?.active_in_word)).catch(()=>{});
    getSideloadStatus()
      .then(setSideload)
      .catch(() => setSideload(null)); // backend no listo → chip oculto
  }, []);
  useEffect(() => {
    refreshSideload();
    const t = setInterval(refreshSideload, 60000); // refetch cada 60s
    return () => clearInterval(t);
  }, [refreshSideload]);

  const sideloadState: SideloadState | null = !sideload
    ? null
    : sideload.installed
      ? (sideload.up_to_date ? 'active' : 'outdated')
      : 'missing';

  const handleRepairSideload = async () => {
    try {
      await repairSideload();
      useDocStore.getState().showToast('Complemento de Word reparado', 'success');
    } catch {
      useDocStore.getState().showToast('No se pudo reparar el complemento', 'error');
    } finally {
      refreshSideload();
    }
  };

  // Electron draws native window buttons (min/max/close) over the top-right corner
  const isElectron = !!(window as any).electronAPI;

  return (
    <div className="app-drag" style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      height: '48px',
      backgroundColor: 'var(--sidebar-bg)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: isElectron ? '0 150px 0 20px' : '0 16px 0 20px',
      position: 'relative',
      zIndex: 10,
      flexShrink: 0,
    }}>
      {/* Left: Logo (= menú Archivo) + Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
        <button type="button"
          onClick={() => useDocStore.getState().setShowFileMenu(!useDocStore.getState().showFileMenu)}
          aria-label="Menú"
          title="Archivo"
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
            background: 'none', border: 'none', padding: '2px 4px',
            cursor: 'pointer', borderRadius: 'var(--radius-sm)',
            transition: 'background 0.15s',
            ...noDragRegion,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="15" y2="17" />
          </svg>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>WordAPA7</span>
        </button>
      </div>

      {/* Center vacío: la navegación por pasos vive en el StepRail izquierdo */}

      {/* Right: action buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0, overflow: 'hidden' }}>
        {/* ── T5: estado del complemento de Word (independiente del doc) ── */}
        {sideloadState && (
          <button type="button"
            className="app-no-drag"
            onClick={handleRepairSideload}
            title={hbActive === true ? 'Activo en Word. Clic para reparar.' : 'Instalado — ábrelo desde Insertar → Mis complementos → Carpeta compartida. Clic para reparar.'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)', padding: '3px 10px',
              fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap',
              color: 'var(--text-secondary)', cursor: 'pointer',
              marginRight: '10px', flexShrink: 0,
              ...noDragRegion,
            }}
          >
            <span style={{
              width: '7px', height: '7px', borderRadius: 'var(--radius-full)',
              backgroundColor: SIDELOAD_CHIP[sideloadState].color, flexShrink: 0,
            }} />
            <span className="toolbar-btn-label">{chipLabel}</span>
          </button>
        )}

        {doc && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0, ...noDragRegion }}>
          {/* Save status chip (compact, passive) */}
          <span
            title={hasUnsavedChanges ? 'Hay cambios sin guardar. Se guardan automáticamente.' : 'Progreso guardado automáticamente.'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontSize: 'var(--text-xs)', fontWeight: 700, whiteSpace: 'nowrap',
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
                fontSize: 'var(--text-xs)', fontWeight: 700,
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
  fontSize: 'var(--text-xs)',
  padding: '4px 8px',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '4px',
  transition: 'background 0.15s',
};

const toolbarDivider = {
  width: '1px', height: '20px', backgroundColor: 'var(--border-subtle)', margin: '0 2px', flexShrink: 0,
} as React.CSSProperties;
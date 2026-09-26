/* WordAPA7 — toolbar: menu de desborde.
   La barra se quedo con titulo, guardado y avatar; aqui vive todo lo que
   antes saturaba la derecha. Las entradas con panel (Puntuacion, Modulos)
   montan su componente dentro del menu para que nadie tenga que sacarlos
   de la barra a mano.

   El estado del autoUpdater NO vive en useDocStore: sale de useUpdateStore,
   asi que la suscripcion al IPC y la condicion de "descargada" se leen de ahi. */

import React, { useEffect } from 'react';
import { Undo2, Redo2, Copy, Puzzle, Download, Settings, Sun, Moon } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { useUpdateStore } from '../../store/useUpdateStore';
import { APAScoreCard } from './APAScoreCard';
import { APAModuleToggles } from './APAModuleToggles';

const Separador = () => (
  <div aria-hidden style={{ height: 1, backgroundColor: 'var(--color-border-subtle)', margin: '4px 0' }} />
);

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  width: '100%',
  padding: '6px 10px',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--color-text-primary)',
  font: 'inherit',
  fontSize: 'var(--text-sm)',
  textAlign: 'left',
  cursor: 'pointer',
};

const Item = ({
  label, onClick, children, disabled,
}: { label: string; onClick: () => void; children?: React.ReactNode; disabled?: boolean }) => (
  <button
    type="button"
    role="menuitem"
    disabled={disabled}
    onClick={onClick}
    style={{ ...itemStyle, color: disabled ? 'var(--color-text-tertiary)' : undefined }}
  >
    {children}
    <span>{label}</span>
  </button>
);

// Fila con panel: no es un comando, es el hueco del menu donde vive un control.
// Lleva role="menuitem" y nombre accesible para que la lista de entradas sea
// leible con lector de pantalla y para que se pueda auditar que sigue existiendo.
const Panel = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div role="menuitem" aria-label={label} style={{ padding: '4px 6px' }}>
    {children}
  </div>
);

export function ToolbarOverflowMenu({ onClose }: { onClose: () => void }) {
  const st = useDocStore();
  const updateState = useUpdateStore((s) => s.state);
  const initUpdate = useUpdateStore((s) => s.init);
  const installUpdate = useUpdateStore((s) => s.install);

  // El menu es el unico consumidor del estado de actualizacion, asi que aqui se
  // inicializa la suscripcion al autoUpdater (una sola vez, el store se guarda).
  useEffect(() => { initUpdate(); }, [initUpdate]);

  const run = (fn: () => void) => () => { fn(); onClose(); };
  const canUndo = !!st.doc && st.historyIndex > 0;
  const canRedo = !!st.doc && st.historyIndex < st.history.length - 1;

  return (
    <div
      role="menu"
      aria-label="Más acciones"
      className="app-no-drag"
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        right: 0,
        minWidth: 260,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: 6,
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-card)',
        zIndex: 'var(--z-dropdown)',
      }}
    >
      <Item label="Deshacer" onClick={run(() => st.undo())} disabled={!canUndo}>
        <Undo2 size={14} strokeWidth={1.75} aria-hidden />
      </Item>
      <Item label="Rehacer" onClick={run(() => st.redo())} disabled={!canRedo}>
        <Redo2 size={14} strokeWidth={1.75} aria-hidden />
      </Item>

      <Separador />
      <Panel label="Puntuación APA"><APAScoreCard /></Panel>
      <Panel label="Módulos APA"><APAModuleToggles /></Panel>
      <Item label="Copiar PDF para WhatsApp" onClick={run(() => void st.copyPdfToClipboard())}>
        <Copy size={14} strokeWidth={1.75} aria-hidden />
      </Item>

      <Separador />
      <Item label="Complemento de Word" onClick={run(() => st.setSettingsStudioOpen(true, 'addin'))}>
        <Puzzle size={14} strokeWidth={1.75} aria-hidden />
      </Item>
      {updateState === 'downloaded' && (
        <Item label="Instalar actualización" onClick={run(() => installUpdate())}>
          <Download size={14} strokeWidth={1.75} aria-hidden />
        </Item>
      )}

      <Separador />
      <Item label="Tema" onClick={run(() => st.setTheme(st.theme === 'light' ? 'dark' : 'light'))}>
        {st.theme === 'light'
          ? <Moon size={14} strokeWidth={1.75} aria-hidden />
          : <Sun size={14} strokeWidth={1.75} aria-hidden />}
      </Item>
      <Item label="Ajustes" onClick={run(() => st.setSettingsStudioOpen(true))}>
        <Settings size={14} strokeWidth={1.75} aria-hidden />
      </Item>
    </div>
  );
}

/* WordAPA7 — shell: flyout de detalle del rail.
   Flota SOBRE el workbench y no lo empuja: el centro de Revisión no puede
   estrecharse porque el usuario quiera leer una etiqueta. El cierre lleva
   120ms de gracia para que el puntero cruce el hueco entre rail y panel. */

import React, { useEffect, useRef } from 'react';
import { Pin, Check, AlertCircle } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { OutlineTree } from '../wizard/OutlineTree';
import type { RailDestination } from './railItems';

export const FLYOUT_CLOSE_GRACE_MS = 120;

const STATUS_TEXT: Record<RailDestination['status'], string> = {
  done: 'Listo',
  pending: 'pendientes',
  idle: 'Sin pendientes',
};

const STATUS_COLOR: Record<RailDestination['status'], string> = {
  done: 'var(--color-success)',
  pending: 'var(--color-warning)',
  idle: 'var(--color-text-tertiary)',
};

export function RailFlyout({ item, onClose }: { item: RailDestination | null; onClose: () => void }): JSX.Element | null {
  const railPinned = useDocStore((s) => s.railPinned);
  const setRailPinned = useDocStore((s) => s.setRailPinned);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    if (railPinned) return;
    cancelClose();
    closeTimer.current = setTimeout(onClose, FLYOUT_CLOSE_GRACE_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRailPinned(false);
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setRailPinned, onClose]);

  // El timer de gracia no sobrevive al desmontaje: si no, cerraría un panel que
  // ya no existe (y en tests, llamaría onClose sobre un componente muerto).
  useEffect(() => cancelClose, []);

  if (!item) return null;

  const StatusIcon = item.status === 'done' ? Check : item.status === 'pending' ? AlertCircle : null;

  return (
    <aside
      data-testid="rail-flyout"
      aria-label={`Detalle de ${item.label}`}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
      style={{
        position: 'absolute',
        top: 12,
        left: 64,
        width: 240,
        maxHeight: 'calc(100% - 24px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1, 8px)',
        padding: '14px',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-card)',
        zIndex: 'var(--z-dropdown)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <item.Icon size={15} strokeWidth={1.75} aria-hidden style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {item.label}
          </span>
        </div>
        <button
          type="button"
          aria-label="Anclar panel"
          aria-pressed={railPinned}
          onClick={() => setRailPinned(!railPinned)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, border: 'none', borderRadius: 'var(--radius-sm)',
            background: railPinned ? 'var(--color-accent-soft)' : 'transparent',
            color: railPinned ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Pin size={13} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)' }}>
        {StatusIcon && <StatusIcon size={12} strokeWidth={1.75} aria-hidden style={{ color: STATUS_COLOR[item.status] }} />}
        <span style={{ color: STATUS_COLOR[item.status], fontWeight: 600 }}>
          {item.pending > 0 ? `${item.pending} ${STATUS_TEXT[item.status]}` : STATUS_TEXT[item.status]}
        </span>
      </div>

      {item.showOutline && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 8 }}>
          <OutlineTree />
        </div>
      )}
    </aside>
  );
}

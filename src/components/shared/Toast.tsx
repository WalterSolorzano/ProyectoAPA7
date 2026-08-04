/* WordAPA7 — Toast Container (4 tipos, bottom-right, nunca cortado)
   Per plan §1.7: posición bottom-right con --space-4, stack vertical, máx 3 visibles. */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS: Record<string, string> = {
  success: 'var(--color-success)',
  error: 'var(--color-danger)',
  info: 'var(--color-info)',
  warning: 'var(--color-warning)',
};

export const Toast: React.FC = () => {
  const { toasts, toastMessage, removeToast } = useDocStore();

  if (toasts.length === 0 && !toastMessage) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(var(--space-4) + 32px)',
      right: 'var(--space-4)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
      zIndex: 'var(--z-toast)',
      maxWidth: '360px',
      width: 'min(360px, calc(100vw - var(--space-8)))',
      pointerEvents: 'none',
    }}>
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type] || Info;
        const color = COLORS[toast.type] || COLORS.info;
        return (
          <div
            key={toast.id}
            role="status"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-3)',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderLeft: `4px solid ${color}`,
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)',
              boxShadow: 'var(--shadow-lg)',
              pointerEvents: 'auto',
              animation: 'toast-in 200ms ease-out',
            }}
          >
            <Icon size={16} strokeWidth={1.75} color={color} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', lineHeight: 1.45 }}>
              {toast.message}
            </span>
            {toast.action && (
              <button
                type="button"
                onClick={() => { toast.action!.onClick(); removeToast(toast.id); }}
                style={{
                  background: 'var(--color-accent-soft)',
                  border: '1px solid var(--accent-primary)',
                  cursor: 'pointer',
                  color: 'var(--accent-primary)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Cerrar notificación"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-tertiary)', padding: 'var(--space-1)',
                borderRadius: 'var(--radius-sm)', flexShrink: 0,
              }}
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
        );
      })}

      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default Toast;

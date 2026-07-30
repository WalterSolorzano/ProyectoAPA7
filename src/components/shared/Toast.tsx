/* WordAPA7 — Toast Notification (Auto-fading) */

import React, { useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

const TYPE_STYLES: Record<string, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
  success: {
    bg: '#f0fdf4',
    border: '#bbf7d0',
    color: '#15803d',
    icon: <CheckCircle size={16} />,
  },
  error: {
    bg: '#fef2f2',
    border: '#fecaca',
    color: '#dc2626',
    icon: <XCircle size={16} />,
  },
  info: {
    bg: '#eff6ff',
    border: '#bfdbfe',
    color: '#1d4ed8',
    icon: <AlertTriangle size={16} />,
  },
};

export const Toast: React.FC = () => {
  const { toastMessage, toastType, clearToast } = useDocStore();

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(clearToast, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, clearToast]);

  if (!toastMessage) return null;

  const style = TYPE_STYLES[toastType] || TYPE_STYLES.info;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '48px',
        right: '16px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        borderRadius: '8px',
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        fontSize: '13px',
        fontWeight: 500,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        maxWidth: '380px',
        transition: 'opacity 0.2s ease',
      }}
    >
      {style.icon}
      <span style={{ flex: 1 }}>{toastMessage}</span>
      <button
        onClick={clearToast}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: style.color,
          opacity: 0.6,
          padding: '2px',
          display: 'flex',
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
};

import React, { useState } from 'react';
import { Palette, ChevronDown, Check } from 'lucide-react';
import { PRESETS_TABLA } from '../../lib/tablaRender';
import type { TableStylePreset } from '../../types';

export interface TablaEstiloSelectorProps {
  valor?: TableStylePreset;
  onChange: (p: TableStylePreset) => void;
}

export const TablaEstiloSelector: React.FC<TablaEstiloSelectorProps> = ({ valor, onChange }) => {
  const [abierto, setAbierto] = useState(false);
  const activo = valor ?? 'apa';
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-label="Estilo de tabla"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          padding: '3px 8px',
          background: abierto ? 'var(--color-accent-soft)' : 'var(--surface-subtle)',
          color: abierto ? 'var(--accent-primary)' : 'var(--text-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xs)',
          cursor: 'pointer',
        }}
      >
        <Palette size={13} />
        <ChevronDown size={11} />
      </button>
      {abierto && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 40,
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '180px',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            padding: 'var(--space-1)',
          }}
        >
          {PRESETS_TABLA.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={activo === p.id}
              onClick={() => {
                onChange(p.id);
                setAbierto(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                width: '100%',
                padding: '6px 8px',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-xs)',
                cursor: 'pointer',
                color: 'var(--text-main)',
                fontSize: '11px',
                textAlign: 'left',
              }}
            >
              {activo === p.id ? (
                <Check size={12} style={{ color: 'var(--accent-primary)' }} />
              ) : (
                <span style={{ width: 12 }} />
              )}
              <span style={{ flex: 1 }}>{p.etiqueta}</span>
              {!p.esAPA && (
                <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)' }}>no APA</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TablaEstiloSelector;

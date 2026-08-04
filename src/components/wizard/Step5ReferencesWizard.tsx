import React, { useState } from 'react';
import { ReferenciasView } from '../referencias/ReferenciasView';
import { ValidatorView } from '../validator/ValidatorView';

export const Step5ReferencesWizard: React.FC = () => {
  const [mode, setMode] = useState<'list' | 'crosscheck'>('list');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden' }}>
      {/* Selector de modo (compacto) */}
      <div style={{
        padding: '6px 12px', flexShrink: 0,
        backgroundColor: 'var(--sidebar-bg)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onClick={() => setMode('list')}
            style={{
              padding: '4px 12px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', border: 'none',
              backgroundColor: mode === 'list' ? 'var(--color-accent-soft)' : 'transparent',
              color: mode === 'list' ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
            }}
          >
            Lista de referencias
          </button>
          <button
            type="button"
            onClick={() => setMode('crosscheck')}
            style={{
              padding: '4px 12px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', border: 'none',
              borderLeft: '1px solid var(--border-subtle)',
              backgroundColor: mode === 'crosscheck' ? 'var(--color-accent-soft)' : 'transparent',
              color: mode === 'crosscheck' ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
            }}
          >
            Cruce citas vs referencias
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {mode === 'list' ? <ReferenciasView /> : <ValidatorView />}
      </div>
    </div>
  );
};

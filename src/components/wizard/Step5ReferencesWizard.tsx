import React, { useState } from 'react';
import { ReferenciasView } from '../referencias/ReferenciasView';
import { ValidatorView } from '../validator/ValidatorView';

export const Step5ReferencesWizard: React.FC = () => {
  const [mode, setMode] = useState<'list' | 'crosscheck'>('list');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px', flexShrink: 0,
        backgroundColor: 'var(--sidebar-bg)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Referencias y validación APA 7
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            Gestioná las referencias y validá citas cruzadas con el texto
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onClick={() => setMode('list')}
            style={{
              padding: '5px 12px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: 'none',
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
              padding: '5px 12px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: 'none',
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

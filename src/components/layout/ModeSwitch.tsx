import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Edit3, Eye } from 'lucide-react';

export const ModeSwitch: React.FC = () => {
  const { viewMode, setViewMode } = useDocStore();

  return (
    <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '6px', padding: '2px', border: '1px solid #cbd5e1' }}>
      <button
        onClick={() => setViewMode('edit')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: viewMode === 'edit' ? 600 : 500,
          color: viewMode === 'edit' ? '#0f172a' : '#64748b',
          backgroundColor: viewMode === 'edit' ? '#ffffff' : 'transparent',
          border: 'none',
          boxShadow: viewMode === 'edit' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <Edit3 size={14} />
        Editar
      </button>
      <button
        onClick={() => setViewMode('result')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: viewMode === 'result' ? 600 : 500,
          color: viewMode === 'result' ? '#0f172a' : '#64748b',
          backgroundColor: viewMode === 'result' ? '#ffffff' : 'transparent',
          border: 'none',
          boxShadow: viewMode === 'result' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <Eye size={14} />
        Ver Resultado
      </button>
    </div>
  );
};

/* WordAPA7 — Referencias Bibliográficas Builder Component con Auto-Resolver de DOI sin Emojis */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Search } from 'lucide-react';

export const ReferenciasView: React.FC = () => {
  const { references, addReference, removeReference, resolveDoiReference, isLoading } = useDocStore();
  const [rawInput, setRawInput] = useState('');

  const handleAddManual = () => {
    if (!rawInput.trim()) return;

    addReference({
      id: Date.now().toString(),
      authors: ['Autor'],
      year: '2026',
      title: 'Título',
      source: 'Fuente',
      raw_text: rawInput.trim(),
      formatted_apa: rawInput.trim(),
    });

    setRawInput('');
  };

  const handleResolveDoi = () => {
    if (!rawInput.trim()) return;
    resolveDoiReference(rawInput.trim());
    setRawInput('');
  };

  return (
    <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Gestor de Referencias Bibliográficas APA 7</h2>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
          Agregar Nueva Referencia por Texto Libre o DOI
        </h3>
        <textarea
          className="form-textarea"
          rows={3}
          placeholder="Ingresa un DOI (ej: 10.1016/j.compedu.2023.104) o la cita cruda: García, A. (2023). Inteligencia Artificial..."
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleResolveDoi}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Search size={14} />
            <span>{isLoading ? 'Buscando DOI...' : 'Buscar & Formatear DOI (Auto)'}</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleAddManual}
          >
            Agregar Texto Manual
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
          Lista de Referencias Bibliográficas ({references.length})
        </h3>
        {references.length > 0 && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              if (confirm('¿Resolver automáticamente todos los DOIs y formatos pendientes en las referencias actuales?')) {
                useDocStore.getState().showToast('Resolviendo DOIs en lote...', 'info');
                fetch('/api/references/resolve-batch', { method: 'POST', body: JSON.stringify({ refs: references }) });
              }
            }}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#10b981', borderColor: '#059669', color: 'white' }}
          >
            <Search size={14} />
            Resolver DOIs automáticamente
          </button>
        )}
      </div>

      {references.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No hay referencias agregadas aún.</p>
      ) : (
        references.map((ref) => (
          <div key={ref.id} className="card" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '13px', paddingLeft: '24px', textIndent: '-24px', fontFamily: 'Times New Roman', lineHeight: '1.6' }}>
              {ref.formatted_apa || ref.raw_text}
            </p>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => removeReference(ref.id)}
              style={{ color: 'var(--status-error)', border: 'none', marginLeft: '12px' }}
            >
              Eliminar
            </button>
          </div>
        ))
      )}
    </div>
  );
};

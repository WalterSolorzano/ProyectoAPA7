/* WordAPA7 — Paso 4: Tables Wizard (Formato de Tablas APA 7) */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Table as TableIcon, CheckCircle2 } from 'lucide-react';
import { PaperCanvas } from '../layout/PaperCanvas';

export const Step4TablesWizard: React.FC = () => {
  const { doc, setSelectedElementId, selectedElementId } = useDocStore();

  if (!doc) return null;

  const tables = doc.elements.filter(e => e.type === 'table' && e.table_info);

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* Panel Izquierdo: Lista Guiada de Tablas Detectadas */}
      <div style={{
        width: '380px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--word-blue)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TableIcon size={16} /> Paso 4: Formato de Tablas ({tables.length})
          </h3>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Verifica el diseño APA 7 (líneas horizontales superior/inferior, sin bordes verticales).
          </span>
        </div>

        <div style={{ padding: '10px 16px', backgroundColor: '#eff6fc', borderBottom: '1px solid #dbeafe', fontSize: '11px', color: '#1e40af' }}>
          <strong>Estándar APA 7ma Edición para Tablas:</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li><strong>Bordes:</strong> Línea horizontal arriba, abajo y separando encabezados.</li>
            <li><strong>Cero Líneas Verticales:</strong> Eliminación de cuadrículas verticales internas.</li>
            <li><strong>Encabezado:</strong> "Tabla X" en Negrita, Título en Cursiva.</li>
          </ul>
        </div>

        {/* Lista de Tablas */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {tables.length === 0 ? (
            <div style={{ textIndent: 0, padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
              No se detectaron tablas numéricas en el cuerpo del documento.
            </div>
          ) : (
            tables.map((tbl, idx) => {
              const isSelected = selectedElementId === tbl.id;

              return (
                <div
                  key={tbl.id}
                  onClick={() => setSelectedElementId(tbl.id)}
                  style={{
                    padding: '10px',
                    marginBottom: '10px',
                    borderRadius: '6px',
                    border: `1px solid ${isSelected ? 'var(--word-blue)' : '#e2e8f0'}`,
                    backgroundColor: isSelected ? '#eff6fc' : '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--word-blue)' }}>
                      Tabla {tbl.table_info?.table_number || idx + 1}
                    </span>
                    <span style={{ fontSize: '10px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <CheckCircle2 size={12} /> Bordes APA 7
                    </span>
                  </div>

                  {tbl.table_info?.caption && (
                    <p style={{ fontSize: '11px', fontStyle: 'italic', color: '#475569', margin: '4px 0' }}>
                      {tbl.table_info.caption}
                    </p>
                  )}

                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                    Filas: {tbl.table_info?.rows.length || 0} | Columnas: {tbl.table_info?.headers?.length || 0}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Panel Derecho: Lienzo Sincronizado */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: '#f1f5f9' }}>
        <PaperCanvas />
      </div>
    </div>
  );
};

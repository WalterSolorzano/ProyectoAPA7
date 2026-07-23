/* WordAPA7 — Paso 6: Export & Final Download Wizard */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Download, CheckCircle2, ShieldCheck, Sparkles, FileText, ArrowRight } from 'lucide-react';

export const Step6ExportWizard: React.FC = () => {
  const { doc, rules, portada, references, exportDocx, isLoading } = useDocStore();

  if (!doc) return null;

  const totalHeadings = doc.elements.filter(e => e.type === 'heading').length;
  const totalFigures = doc.elements.filter(e => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0).length;
  const totalTables = doc.elements.filter(e => e.type === 'table').length;

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#f8fafc' }}>
      <div className="card" style={{ maxWidth: '680px', width: '100%', border: '2px solid #16a34a', padding: '32px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
        
        {/* Encabezado Éxito */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#dcfce7',
            color: '#16a34a',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <CheckCircle2 size={32} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
            ¡Documento Corregido y Listo para Descargar!
          </h2>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Se completaron los 7 pasos de acompañamiento y validación del estándar APA 7ma Edición.
          </span>
        </div>

        {/* Resumen de Ajustes Realizados */}
        <div style={{ backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', margin: '0 0 12px 0' }}>
            Resumen de Modificaciones Aprobadas:
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', color: '#334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} color="#16a34a" />
              <span><strong>Portada:</strong> {portada.use_original_cover !== false ? 'Original Preservada Intacta' : 'APA 7 Sintética'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} color="#16a34a" />
              <span><strong>Fuente:</strong> {rules.font_family} {rules.font_size_pt} pt</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} color="#16a34a" />
              <span><strong>Jerarquía Títulos:</strong> {totalHeadings} Niveles 1, 2, 3</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} color="#16a34a" />
              <span><strong>Rotulación Figuras:</strong> {totalFigures} Figuras APA 7</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} color="#16a34a" />
              <span><strong>Formato Tablas:</strong> {totalTables} Tablas APA 7</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} color="#16a34a" />
              <span><strong>Párrafos:</strong> Sangría 1.27 cm & Doble (2.0)</span>
            </div>
          </div>
        </div>

        {/* Botones Prominentes de Descarga Final */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            className="btn btn-primary"
            onClick={() => exportDocx(false)}
            disabled={isLoading}
            style={{
              padding: '14px',
              fontSize: '15px',
              fontWeight: 700,
              backgroundColor: '#15803d',
              borderColor: '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Download size={18} />
            {isLoading ? 'Generando archivo Word .DOCX...' : 'DESCARGAR DOCUMENTO FINAL ARREGLADO (.DOCX)'}
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => exportDocx(true)}
            disabled={isLoading}
            style={{
              padding: '10px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <FileText size={15} /> Descargar con Control de Cambios Marcados (.DOCX)
          </button>
        </div>
      </div>
    </div>
  );
};

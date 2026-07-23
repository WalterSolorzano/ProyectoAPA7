/* WordAPA7 — Paso 5: Body Formatting Wizard (Sangría, Interlineado y Listas) */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { AlignLeft, CheckCircle2, Sliders } from 'lucide-react';
import { PaperCanvas } from '../layout/PaperCanvas';

export const Step5BodyWizard: React.FC = () => {
  const { rules, setRules, doc } = useDocStore();

  if (!doc) return null;

  const totalParagraphs = doc.elements.filter(e => e.type === 'paragraph').length;
  const totalLists = doc.elements.filter(e => e.type === 'numbered_list' || e.type === 'bullet').length;

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* Panel Izquierdo: Controles de Formato de Párrafos y Listas */}
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
            <AlignLeft size={16} /> Paso 5: Párrafos, Interlineado y Listas
          </h3>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Verifica la sangría APA 7 (1.27 cm), el interlineado y la secuencia numérica de listas.
          </span>
        </div>

        <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
          
          {/* Card 1: Sangría de Primera Línea */}
          <div className="card" style={{ marginBottom: '14px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <strong style={{ fontSize: '12px', color: '#0f172a' }}>Sangría de Primera Línea</strong>
              <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700 }}>1.27 cm (0.5 in) ✓</span>
            </div>
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
              Aplicada automáticamente a los {totalParagraphs} párrafos del cuerpo del documento.
            </p>
          </div>

          {/* Card 2: Interlineado Doble */}
          <div className="card" style={{ marginBottom: '14px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <strong style={{ fontSize: '12px', color: '#0f172a' }}>Interlineado General</strong>
              <select
                className="form-select"
                style={{ padding: '2px 6px', fontSize: '11px', width: 'auto' }}
                value={rules.line_spacing}
                onChange={(e) => setRules({ line_spacing: parseFloat(e.target.value) })}
              >
                <option value={2.0}>Doble (2.0) — APA 7</option>
                <option value={1.5}>1.5 líneas</option>
                <option value={1.0}>Sencillo (1.0)</option>
              </select>
            </div>
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
              Control de espaciado entre líneas en todo el cuerpo.
            </p>
          </div>

          {/* Card 3: Enumeración Secuencial Continuada */}
          <div className="card" style={{ marginBottom: '14px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <strong style={{ fontSize: '12px', color: '#0f172a' }}>Enumeración de Listas</strong>
              <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700 }}>1., 2., 3., 4. ✓</span>
            </div>
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
              {totalLists} elementos de lista enumerados de forma continua sin reinicios falsos por párrafos intermedios.
            </p>
          </div>
        </div>
      </div>

      {/* Panel Derecho: Lienzo Sincronizado */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: '#f1f5f9' }}>
        <PaperCanvas />
      </div>
    </div>
  );
};

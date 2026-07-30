/* WordAPA7 — Paso 5: Body Formatting Wizard (Sangría, Interlineado y Listas) */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { AlignLeft, CheckCircle2, Sliders, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { PaperCanvas } from '../layout/PaperCanvas';

export const Step5BodyWizard: React.FC = () => {
  const { rules, setRules, doc } = useDocStore();
  const [isSpellingOpen, setIsSpellingOpen] = useState(false);
  const [selectedSpellingId, setSelectedSpellingId] = useState<string | null>(null);

  if (!doc) return null;

  const totalParagraphs = doc.elements.filter(e => e.type === 'paragraph').length;
  const totalLists = doc.elements.filter(e => e.type === 'numbered_list' || e.type === 'bullet').length;

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* Panel Izquierdo: Controles de Formato de Párrafos y Listas */}
      <div style={{
        width: '380px',
        backgroundColor: 'var(--canvas-bg)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'var(--canvas-bg)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlignLeft size={16} /> Paso 5: Párrafos, Interlineado y Listas
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Verifica la sangría APA 7 (1.27 cm), el interlineado y la secuencia numérica de listas.
          </span>
        </div>

        <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
          
          {/* Card 1: Sangría de Primera Línea */}
          <div className="card" style={{ marginBottom: '14px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <strong style={{ fontSize: '12px', color: 'var(--text-main)' }}>Sangría de Primera Línea</strong>
              <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700 }}>1.27 cm (0.5 in) — Aplicado</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
              Aplicada automáticamente a los {totalParagraphs} párrafos del cuerpo del documento.
            </p>
          </div>

          {/* Card 2: Interlineado Doble */}
          <div className="card" style={{ marginBottom: '14px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <strong style={{ fontSize: '12px', color: 'var(--text-main)' }}>Interlineado General</strong>
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
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
              Control de espaciado entre líneas en todo el cuerpo.
            </p>
          </div>

          {/* Card 3: Enumeración Secuencial Continuada */}
          <div className="card" style={{ marginBottom: '14px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <strong style={{ fontSize: '12px', color: 'var(--text-main)' }}>Enumeración de Listas</strong>
              <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700 }}>1., 2., 3., 4. — Secuencial</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
              {totalLists} elementos de lista enumerados de forma continua sin reinicios falsos por párrafos intermedios.
            </p>
          </div>

          {/* Card 4: Spell Checker y Gramática (Colapsable) */}
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', cursor: 'pointer', backgroundColor: isSpellingOpen ? '#f8fafc' : 'transparent' }}
              onClick={() => setIsSpellingOpen(!isSpellingOpen)}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ fontSize: '12px', color: 'var(--text-main)' }}>Calidad de Escritura (Ortografía)</strong>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Revisión ortográfica y de jerga académica</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', color: '#d97706', fontWeight: 600, backgroundColor: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>
                  2 Hallazgos
                </span>
                {isSpellingOpen ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
              </div>
            </div>
            
            {isSpellingOpen && (
              <div style={{ padding: '12px', borderTop: '1px solid #e2e8f0', backgroundColor: '#fafafa' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div 
                    onClick={() => setSelectedSpellingId('s1')}
                    style={{ 
                      padding: '8px', 
                      borderRadius: '6px', 
                      border: `1px solid ${selectedSpellingId === 's1' ? 'var(--word-blue)' : 'transparent'}`,
                      backgroundColor: selectedSpellingId === 's1' ? '#eff6fc' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ color: '#dc2626', fontWeight: 500, textDecoration: 'underline wavy #dc2626' }}>Neuroeducacion</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Error</span>
                  </div>

                  <div 
                    onClick={() => setSelectedSpellingId('s2')}
                    style={{ 
                      padding: '8px', 
                      borderRadius: '6px', 
                      border: `1px solid ${selectedSpellingId === 's2' ? 'var(--word-blue)' : 'transparent'}`,
                      backgroundColor: selectedSpellingId === 's2' ? '#eff6fc' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ color: '#dc2626', fontWeight: 500, textDecoration: 'underline wavy #dc2626' }}>ChatGPT</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Advertencia</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel Derecho: Lienzo Sincronizado y Slide-in Panel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: 'var(--canvas-bg)', position: 'relative' }}>
        <PaperCanvas />
        
        {/* Slide-in Panel para Detalles de Ortografía */}
        {selectedSpellingId && (
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '320px',
            backgroundColor: 'var(--canvas-bg)',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '16px',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-main)', fontWeight: 600 }}>Revisión Ortográfica</h4>
              <button 
                className="btn btn-sm" 
                onClick={() => setSelectedSpellingId(null)}
                style={{ padding: '2px 6px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px' }}
              >
                &times;
              </button>
            </div>
            
            {selectedSpellingId === 's1' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px' }}>
                  <strong style={{ color: '#dc2626', textDecoration: 'underline wavy #dc2626' }}>Neuroeducacion</strong>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <strong>Sugerencia Word:</strong> <span style={{ color: '#16a34a' }}>Neuroeducación</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                  <strong>Veredicto IA:</strong> Es un error real (falta tilde).
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button className="btn btn-sm btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <Check size={14} /> Corregir
                  </button>
                  <button className="btn btn-sm btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <X size={14} /> Ignorar
                  </button>
                </div>
              </div>
            )}

            {selectedSpellingId === 's2' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px' }}>
                  <strong style={{ color: '#dc2626', textDecoration: 'underline wavy #dc2626' }}>ChatGPT</strong>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <strong>Sugerencia Word:</strong> <span style={{ color: '#16a34a' }}>Chat GPT</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                  <strong>Veredicto IA:</strong> Término técnico válido.
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button className="btn btn-sm btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <Check size={14} /> Corregir
                  </button>
                  <button className="btn btn-sm btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <X size={14} /> Ignorar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

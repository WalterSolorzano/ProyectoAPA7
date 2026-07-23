/* WordAPA7 — Paso 0: Preferences Wizard Modal */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Sparkles, Type, ListOrdered, ShieldCheck, ChevronRight } from 'lucide-react';

export const Step0PreferencesModal: React.FC = () => {
  const { rules, setRules, portada, setPortada, setWizardStep } = useDocStore();

  const handleFontChange = (font: string) => {
    let size = 12;
    if (font === 'Georgia' || font === 'Calibri' || font === 'Arial') size = 11;
    setRules({ font_family: font, font_size_pt: size });
  };

  const handleListStyleChange = (numStyle: 'decimal' | 'lowerLetter' | 'none') => {
    setRules({ number_style_level1: numStyle });
  };

  return (
    <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="card" style={{ maxWidth: '640px', width: '100%', border: '1px solid var(--word-blue)', padding: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
        
        {/* Banner Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
          <div style={{ padding: '10px', backgroundColor: '#eff6fc', borderRadius: '8px', color: 'var(--word-blue)' }}>
            <Sparkles size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--word-blue)', margin: 0 }}>
              Paso 0: Preferencias de tu Documento APA 7
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Elige cómo deseas que el asistente aplique el estándar APA 7ma Edición a tu documento.
            </span>
          </div>
        </div>

        {/* 1. Selección de Tipografía */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Type size={15} color="var(--word-blue)" /> ¿Qué fuente oficial APA 7 deseas usar?
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { font: 'Times New Roman', size: '12 pt', desc: 'Serif Clásica Tradicional (Recomendado)' },
              { font: 'Georgia', size: '11 pt', desc: 'Serif Moderna Elegante' },
              { font: 'Calibri', size: '11 pt', desc: 'Sans-Serif Limpia Estándar' },
              { font: 'Arial', size: '11 pt', desc: 'Sans-Serif Alta Legibilidad' },
            ].map((f) => (
              <div
                key={f.font}
                onClick={() => handleFontChange(f.font)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: `2px solid ${rules.font_family === f.font ? 'var(--word-blue)' : '#e2e8f0'}`,
                  backgroundColor: rules.font_family === f.font ? '#eff6fc' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: f.font }}>
                  {f.font} ({f.size})
                </div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{f.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Estilo de Listas Numeradas */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <ListOrdered size={15} color="var(--word-blue)" /> ¿Cómo deseas enumerar las listas del cuerpo?
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {[
              { id: 'decimal', label: '1., 2., 3., 4.', desc: 'Arábigos Secuenciales' },
              { id: 'lowerLetter', label: 'a., b., c., d.', desc: 'Letras Minúsculas' },
              { id: 'lowerRoman', label: 'i., ii., iii., iv.', desc: 'Romanos Minúsculas' },
              { id: 'upperRoman', label: 'I., II., III., IV.', desc: 'Romanos Mayúsculas' },
              { id: 'none', label: '• Viñetas Puntos', desc: 'Viñetas Estándar' },
            ].map((lst) => (
              <div
                key={lst.id}
                onClick={() => handleListStyleChange(lst.id as any)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  border: `2px solid ${rules.number_style_level1 === lst.id ? 'var(--word-blue)' : '#e2e8f0'}`,
                  backgroundColor: rules.number_style_level1 === lst.id ? '#eff6fc' : '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700 }}>{lst.label}</div>
                <span style={{ fontSize: '10px', color: '#64748b' }}>{lst.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Estrategia de Portada */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <ShieldCheck size={15} color="var(--word-blue)" /> ¿Qué hacemos con tu Hoja de Portada?
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              onClick={() => setPortada({ use_original_cover: true })}
              style={{
                padding: '12px',
                borderRadius: '6px',
                border: `2px solid ${portada.use_original_cover !== false ? 'var(--word-blue)' : '#e2e8f0'}`,
                backgroundColor: portada.use_original_cover !== false ? '#eff6fc' : '#ffffff',
                cursor: 'pointer'
              }}
            >
              <strong style={{ fontSize: '13px', color: 'var(--word-blue)', display: 'block' }}>
                CONSERVAR PORTADA ORIGINAL INTACTA (RECOMENDADO)
              </strong>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Mantiene tus cuadros de texto de integrantes, tutores y logos de tu archivo de Word exactamente como están.
              </span>
            </div>

            <div
              onClick={() => setPortada({ use_original_cover: false })}
              style={{
                padding: '12px',
                borderRadius: '6px',
                border: `2px solid ${portada.use_original_cover === false ? 'var(--word-blue)' : '#e2e8f0'}`,
                backgroundColor: portada.use_original_cover === false ? '#eff6fc' : '#ffffff',
                cursor: 'pointer'
              }}
            >
              <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                GENERAR NUEVA PORTADA SINTÉTICA APA 7
              </strong>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Crea una portada limpia desde cero en formato Estudiante o Profesional.
              </span>
            </div>
          </div>
        </div>

        {/* Botón de Inicio de Asistencia */}
        <button
          className="btn btn-primary"
          onClick={() => setWizardStep(1)}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          Guardar Preferencias e Iniciar Revisión Guiada (Paso 1: Portada) <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

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
    <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="card" style={{ maxWidth: '640px', width: '100%', border: '1px solid rgba(255,255,255,0.1)', padding: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', backgroundColor: 'var(--sidebar-bg)', color: 'var(--text-main)' }}>
        
        {/* Banner Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
          <div style={{ padding: '10px', backgroundColor: '#eff6fc', borderRadius: '8px', color: 'var(--word-blue)' }}>
            <Sparkles size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Paso 0: Preferencias de tu Documento APA 7
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Elige cómo deseas que el asistente aplique el estándar APA 7ma Edición a tu documento.
            </span>
          </div>
        </div>

        {/* 1. Selección de Tipografía */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
            <Type size={15} color="var(--accent-primary)" /> ¿Qué fuente oficial APA 7 deseas usar?
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
                  border: rules.font_family === f.font ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.08)',
                  backgroundColor: rules.font_family === f.font ? 'rgba(124,92,252,0.1)' : 'rgba(255,255,255,0.04)',
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
          <label style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
            <ListOrdered size={15} color="var(--accent-primary)" /> ¿Cómo deseas enumerar las listas del cuerpo?
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
                  border: rules.number_style_level1 === lst.id ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.08)',
                  backgroundColor: rules.number_style_level1 === lst.id ? 'rgba(124,92,252,0.1)' : 'rgba(255,255,255,0.04)',
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
          <label style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
            <ShieldCheck size={15} color="var(--accent-primary)" /> ¿Qué hacemos con tu Hoja de Portada?
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              onClick={() => setPortada({ use_original_cover: true })}
              style={{
                padding: '12px',
                borderRadius: '6px',
                border: portada.use_original_cover !== false ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.08)',
                backgroundColor: portada.use_original_cover !== false ? 'rgba(124,92,252,0.1)' : 'rgba(255,255,255,0.04)',
                cursor: 'pointer'
              }}
            >
              <strong style={{ fontSize: '13px', color: 'var(--accent-primary)', display: 'block' }}>
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
                border: portada.use_original_cover === false ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.08)',
                backgroundColor: portada.use_original_cover === false ? 'rgba(124,92,252,0.1)' : 'rgba(255,255,255,0.04)',
                cursor: 'pointer'
              }}
            >
              <strong style={{ fontSize: '13px', color: 'var(--text-main)', display: 'block' }}>
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
            gap: '8px',
            background: 'linear-gradient(135deg, #7c5cfc, #9b79ff)',
            color: '#fff',
            border: 'none'
          }}
        >
          Guardar Preferencias e Iniciar Revisión Guiada (Paso 1: Portada) <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

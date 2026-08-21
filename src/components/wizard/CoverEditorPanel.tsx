/* WordAPA7 — CoverEditorPanel (Paso 4: Portada): editor de portada simplificado.
   Formulario limpio de 5 campos según APA 7 (student cover page):
   Título, Autor, Institución, Curso y Fecha.
   - Checkbox "Conservar portada original": al marcarlo, los campos se atenúan
     (opacity 0.45 + pointerEvents none) y se respetan los datos del documento.
   - Two-way binding real: cada input dispara un highlight azul de ~1s sobre el
     campo correspondiente en la hoja (PaperCanvas).
   Sigue la regla de tokens del design-system: sin hex duro. */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { School, FileText, Check, ChevronRight } from 'lucide-react';
import { requestCoverFieldHighlight } from '../../lib/portadaAuthors';

const blockTitle: React.CSSProperties = {
  fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
  letterSpacing: '0.5px', color: 'var(--text-muted)',
  display: 'flex', alignItems: 'center', gap: '6px',
};

const baseInput: React.CSSProperties = {
  width: '100%', fontFamily: 'inherit', fontSize: '13px', color: 'var(--text-main)',
  background: 'var(--color-bg-surface-alt)', border: '1px solid var(--border-subtle)',
  borderRadius: '10px', padding: '9px 12px', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};

const fieldLabel: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)',
  display: 'block', marginBottom: '5px',
};

export const CoverEditorPanel: React.FC = () => {
  const { portada, setPortada, setCoverSetupDone } = useDocStore();

  // El checkbox se deriva del estado de la portada (no hay estado local).
  const keepOriginal = portada.use_original_cover !== false;

  const toggleKeepOriginal = () => {
    setPortada({
      use_original_cover: !keepOriginal,
      force_skip_cover: false,
      cover_mode: '',
    });
  };

  // Dispara el highlight azul de ~1s sobre el campo en la hoja de portada.
  const focusHighlight = (field: string) => () => requestCoverFieldHighlight(field);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: 'var(--sidebar-bg)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
        padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <School size={15} color="var(--accent-primary)" />
        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Editor de portada</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Checkbox: conservar portada original */}
        <button
          type="button"
          onClick={toggleKeepOriginal}
          aria-pressed={keepOriginal}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left',
            padding: '11px 12px', cursor: 'pointer', fontFamily: 'inherit',
            background: keepOriginal ? 'var(--color-accent-soft)' : 'var(--surface-subtle)',
            border: `1.5px solid ${keepOriginal ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
            borderRadius: '12px',
            transition: 'border-color 0.15s ease, background 0.15s ease',
          }}
        >
          <span style={{
            width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
            border: `1.5px solid ${keepOriginal ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
            background: keepOriginal ? 'var(--accent-primary)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s ease, border-color 0.15s ease',
          }}>
            {keepOriginal && <Check size={12} color="#fff" strokeWidth={3} />}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>Conservar portada original</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Deja intacta la portada de tu documento</span>
          </span>
        </button>

        {/* Formulario de 5 campos (se atenúa si se conserva la portada original) */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '14px',
          opacity: keepOriginal ? 0.45 : 1,
          pointerEvents: keepOriginal ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}>
          <div style={blockTitle}><FileText size={12} /> Datos de la portada</div>

          {/* Título del trabajo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={fieldLabel}>Título del trabajo</label>
            <textarea
              value={portada.title || ''}
              onChange={(e) => setPortada({ title: e.target.value })}
              onFocus={focusHighlight('title')}
              placeholder="Escribe el título completo de tu trabajo..."
              rows={3}
              style={{ ...baseInput, resize: 'none', lineHeight: 1.45 }}
            />
          </div>

          {/* Nombre del autor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={fieldLabel}>Nombre del autor</label>
            <input
              type="text"
              value={portada.author || ''}
              onChange={(e) => setPortada({ author: e.target.value })}
              onFocus={focusHighlight('author')}
              placeholder="Nombre y apellido"
              style={baseInput}
            />
          </div>

          {/* Institución */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={fieldLabel}>Institución</label>
            <input
              type="text"
              value={portada.institution || ''}
              onChange={(e) => setPortada({ institution: e.target.value })}
              onFocus={focusHighlight('institution')}
              placeholder="Universidad o facultad"
              style={baseInput}
            />
          </div>

          {/* Curso */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={fieldLabel}>Curso</label>
            <input
              type="text"
              value={portada.course || ''}
              onChange={(e) => setPortada({ course: e.target.value })}
              onFocus={focusHighlight('course')}
              placeholder="Nombre del curso"
              style={baseInput}
            />
          </div>

          {/* Fecha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={fieldLabel}>Fecha</label>
            <input
              type="text"
              value={portada.date || ''}
              onChange={(e) => setPortada({ date: e.target.value })}
              onFocus={focusHighlight('date')}
              placeholder="DD de mes de YYYY"
              style={baseInput}
            />
          </div>
        </div>
      </div>

      {/* CTA fijo al pie */}
      <div style={{
        flexShrink: 0, padding: '12px 14px', borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--sidebar-bg)',
      }}>
        <button
          type="button"
          onClick={() => {
            useDocStore.getState().showToast('Cambios de portada aplicados', 'success');
            setCoverSetupDone(true);
          }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
            padding: '11px 14px', fontSize: '13px', fontWeight: 700,
            background: 'var(--accent-primary)', color: '#fff',
            border: 'none', borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Check size={15} strokeWidth={3} /> Actualizar portada
        </button>
        <button
          type="button"
          onClick={() => { setCoverSetupDone(true); useDocStore.getState().openExportTunnel(); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
            marginTop: '8px', padding: '10px 14px', fontSize: '12px', fontWeight: 700,
            background: 'transparent', color: 'var(--accent-primary)',
            border: '1px solid rgba(79,124,255,0.45)', borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Continuar a Exportación <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default CoverEditorPanel;

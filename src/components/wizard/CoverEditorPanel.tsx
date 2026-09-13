/* WordAPA7 — CoverEditorPanel (Paso 4: Portada): editor de portada refinado.
   Formulario de portada APA 7 (student cover page) con:
   - Título del trabajo
   - Integrantes: chips clicables del roster (se añaden al campo autor,
     separados por comas) + escritura libre del campo autor.
   - Institución, Curso
   - Fecha: date picker nativo con formato "DD de mes de YYYY" en español.
   - Docente/Profesor: chips clicables del roster + escritura libre.
   - Grupo: chips clicables del roster.
   - Checkbox "Conservar portada original": al marcarlo, los campos se atenúan
     (opacity 0.45 + pointerEvents none) y se respetan los datos del documento.
   - Two-way binding real: cada input dispara un highlight azul de ~1s sobre el
     campo correspondiente en la hoja (PaperCanvas).
   Sigue la regla de tokens del design-system: sin hex duro. */

import React, { useMemo } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { useRosterStore } from '../../store/useRosterStore';
import {
  School, FileText, Check, ChevronRight, Users, Calendar,
  GraduationCap, X, Hash, Layers,
} from 'lucide-react';
import { requestCoverFieldHighlight, parseAuthorEntries, serializeAuthorEntries } from '../../lib/portadaAuthors';

/* ── Helpers ────────────────────────────────────────────────────────────── */

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Convierte un valor de <input type="date"> (YYYY-MM-DD) a texto en español.
 *  Ej: "2026-03-15" → "15 de marzo de 2026". */
function formatFechaES(dateISO: string): string {
  if (!dateISO) return '';
  const parts = dateISO.split('-');
  if (parts.length !== 3) return dateISO;
  const [year, month, day] = parts;
  const idx = parseInt(month, 10) - 1;
  if (idx < 0 || idx > 11) return dateISO;
  return `${parseInt(day, 10)} de ${MESES_ES[idx]} de ${year}`;
}

/** Divide el campo author en una lista de nombres (separados por coma o
 *  salto de línea), eliminando duplicados y espacios. */
function parseAuthors(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((a) => a.trim())
    .filter(Boolean);
}

/** Vuelve a unir la lista de nombres en un solo string separado por comas. */
function joinAuthors(list: string[]): string {
  return list.join(', ');
}

/* ── Estilos compartidos (design tokens, sin hex duro) ─────────────────── */

const blockTitle: React.CSSProperties = {
  fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
  letterSpacing: '0.5px', color: 'var(--text-muted)',
  display: 'flex', alignItems: 'center', gap: '6px',
};

const sectionHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '7px',
  fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.4px',
  marginBottom: '2px',
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

/* Contenedor de chips: wrap flex con gap. */
const chipWrap: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px',
};

/* Estilo base de un chip. */
const chipBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '5px',
  fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)',
  background: 'var(--surface-subtle)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '999px', padding: '5px 10px',
  cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1,
  transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease, transform 0.1s ease',
  userSelect: 'none',
};

/* Estilo de chip seleccionado (accent). */
const chipSelected: React.CSSProperties = {
  background: 'var(--color-accent-soft)',
  borderColor: 'var(--accent-primary)',
  color: 'var(--accent-primary)',
};

/* Tag removible (integrante ya añadido al campo autor). */
const removableTag: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  fontSize: '11px', fontWeight: 600, color: 'var(--text-main)',
  background: 'var(--color-accent-soft)',
  border: '1px solid var(--accent-primary)',
  borderRadius: '999px', padding: '5px 4px 5px 10px',
  fontFamily: 'inherit', lineHeight: 1, maxWidth: '100%',
};

/* Botón X dentro de un tag removible. */
const removeBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '16px', height: '16px', borderRadius: '50%',
  border: 'none', background: 'rgba(0,0,0,0.08)', cursor: 'pointer',
  color: 'var(--text-secondary)', padding: 0, flexShrink: 0,
};

/* ── Sub-componente: Chip genérico ──────────────────────────────────────── */

interface ChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  title?: string;
  icon?: React.ReactNode;
}

const Chip: React.FC<ChipProps> = ({ label, selected, onClick, title, icon }) => (
  <button
    type="button"
    onClick={onClick}
    title={title || (selected ? 'Quitar' : 'Añadir')}
    style={{
      ...chipBase,
      ...(selected ? chipSelected : {}),
    }}
    onMouseEnter={(e) => {
      if (!selected) {
        e.currentTarget.style.borderColor = 'var(--accent-primary)';
        e.currentTarget.style.color = 'var(--accent-primary)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }
    }}
    onMouseLeave={(e) => {
      if (!selected) {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.color = 'var(--text-secondary)';
        e.currentTarget.style.transform = 'translateY(0)';
      }
    }}
  >
    {selected && <Check size={11} strokeWidth={3} />}
    {!selected && icon}
    <span>{label}</span>
  </button>
);

/* ── Componente principal ───────────────────────────────────────────────── */

export const CoverEditorPanel: React.FC = () => {
  const { portada, setPortada, updateCoverField, setCoverSetupDone } = useDocStore();
  const { integrantes, profesores, grupos } = useRosterStore();

  // Determinar modo actual
  const currentMode: 'original' | 'apa7' | 'uni' = useMemo(() => {
    if (portada.use_original_cover !== false) return 'original';
    if (portada.cover_mode === 'generate_uni_cover') return 'uni';
    return 'apa7';
  }, [portada.use_original_cover, portada.cover_mode]);

  const setCoverMode = (mode: 'original' | 'apa7' | 'uni') => {
    if (mode === 'original') {
      setPortada({
        use_original_cover: true,
        force_skip_cover: false,
        cover_mode: '',
      });
    } else if (mode === 'uni') {
      setPortada({
        use_original_cover: false,
        force_skip_cover: false,
        cover_mode: 'generate_uni_cover',
      });
    } else {
      setPortada({
        use_original_cover: false,
        force_skip_cover: false,
        cover_mode: '',
      });
    }
  };

  // Dispara el highlight azul sobre el campo en la hoja de portada
  const focusHighlight = (field: string) => () => requestCoverFieldHighlight(field);

  /* ── Integrantes / Autor ──────────────────────────────────────────────── */

  const authorEntries = useMemo(() => parseAuthorEntries(portada.author || ''), [portada.author]);
  const currentAuthors = useMemo(() => authorEntries.map((a) => a.nombre), [authorEntries]);

  const handleUpdateAuthorEntry = (index: number, field: 'nombre' | 'carnet', value: string) => {
    const updated = [...authorEntries];
    updated[index] = { ...updated[index], [field]: value };
    const serialized = serializeAuthorEntries(updated);
    updateCoverField('author', serialized);
    requestCoverFieldHighlight('author');
  };

  const handleAddAuthorEntry = () => {
    const updated = [...authorEntries, { nombre: 'Br. Nuevo Estudiante', carnet: '' }];
    const serialized = serializeAuthorEntries(updated);
    updateCoverField('author', serialized);
    requestCoverFieldHighlight('author');
  };

  const handleRemoveAuthorEntry = (index: number) => {
    const updated = authorEntries.filter((_, i) => i !== index);
    const serialized = serializeAuthorEntries(updated);
    updateCoverField('author', serialized);
    requestCoverFieldHighlight('author');
  };

  const isAuthorSelected = (nombre: string): boolean =>
    currentAuthors.some((a) => a.toLowerCase() === nombre.toLowerCase());

  const toggleIntegrante = (nombre: string) => {
    const exists = currentAuthors.some((a) => a.toLowerCase() === nombre.toLowerCase());
    const next = exists
      ? authorEntries.filter((a) => a.nombre.toLowerCase() !== nombre.toLowerCase())
      : [...authorEntries, { nombre, carnet: '' }];
    const serialized = serializeAuthorEntries(next);
    updateCoverField('author', serialized);
    requestCoverFieldHighlight('author');
  };

  /* ── Docente / Profesor ──────────────────────────────────────────────── */

  const setInstructor = (nombre: string) => {
    updateCoverField('instructor', nombre);
    requestCoverFieldHighlight('instructor');
  };

  /* ── Grupo ───────────────────────────────────────────────────────────── */

  const setGrupo = (valor: string) => {
    const isCurrent = (portada.grupo || '') === valor;
    updateCoverField('grupo', isCurrent ? '' : valor);
    requestCoverFieldHighlight('grupo');
  };

  /* ── Fecha ───────────────────────────────────────────────────────────── */

  const dateInputValue = useMemo(() => {
    const raw = portada.date || '';
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const m = raw.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
    if (m) {
      const day = m[1].padStart(2, '0');
      const monthIdx = MESES_ES.indexOf(m[2].toLowerCase());
      if (monthIdx >= 0) {
        const month = String(monthIdx + 1).padStart(2, '0');
        return `${m[3]}-${month}-${day}`;
      }
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${month}-${day}`;
    }
    return '';
  }, [portada.date]);

  const formattedDate = useMemo(() => formatFechaES(dateInputValue), [dateInputValue]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value;
    updateCoverField('date', iso ? formatFechaES(iso) : '');
    requestCoverFieldHighlight('date');
  };

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', height: '100%',
      overflow: 'hidden', backgroundColor: 'var(--sidebar-bg)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
        padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <School size={15} color="var(--accent-primary)" />
        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
          Editor de portada
        </span>
      </div>

      {/* Cuerpo scrollable */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '14px',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        {/* Formulario SIEMPRE activo y editable */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          <div style={blockTitle}><FileText size={12} /> Datos de la portada</div>

          {/* ── Título del trabajo ──────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={fieldLabel}>Título del trabajo</label>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Tab para ir a autores</span>
            </div>
            <textarea
              value={portada.title || ''}
              onChange={(e) => updateCoverField('title', e.target.value)}
              onFocus={focusHighlight('title')}
              placeholder="Escribe el título completo de tu trabajo..."
              rows={3}
              style={{ ...baseInput, resize: 'none', lineHeight: 1.45 }}
            />
            {/* Helper Badge (Contador de Caracteres y Palabras APA 7) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '3px 8px', borderRadius: '999px',
                backgroundColor: ((portada.title || '').trim().split(/\s+/).filter(Boolean).length > 12) ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
                color: ((portada.title || '').trim().split(/\s+/).filter(Boolean).length > 12) ? 'var(--accent-warning, #d97706)' : 'var(--accent-success, #16a34a)',
                fontSize: '10.5px', fontWeight: 700,
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
                <span>
                  {(portada.title || '').length} caracteres · {(portada.title || '').trim().split(/\s+/).filter(Boolean).length} palabras (APA recomienda máx 12)
                </span>
              </div>
            </div>
          </div>

          {/* ── Nombre del autor + Integrantes (Editor Estructurado) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={fieldLabel}>Integrantes / Autores ({authorEntries.length})</label>
              <button
                type="button"
                onClick={handleAddAuthorEntry}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--accent-primary)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                + Agregar Integrante
              </button>
            </div>

            {/* Lista de renglones estructurados */}
            {authorEntries.map((entry, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px',
                  backgroundColor: 'var(--surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <input
                    type="text"
                    value={entry.nombre}
                    onChange={(e) => handleUpdateAuthorEntry(idx, 'nombre', e.target.value)}
                    onFocus={focusHighlight('author')}
                    placeholder="Br. Nombre del Estudiante"
                    style={{ ...baseInput, padding: '5px 8px', fontSize: '12px' }}
                  />
                  <input
                    type="text"
                    value={entry.carnet}
                    onChange={(e) => handleUpdateAuthorEntry(idx, 'carnet', e.target.value)}
                    onFocus={focusHighlight('author')}
                    placeholder="Carnet: 202X-XXXXU"
                    style={{ ...baseInput, padding: '5px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAuthorEntry(idx)}
                  title="Eliminar integrante"
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--accent-danger, #ef4444)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </div>
            ))}

            {authorEntries.length === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                No hay integrantes agregados. Haz clic en "+ Agregar Integrante" o selecciona del roster.
              </div>
            )}

            {/* Roster de integrantes como chips rápidos */}
            {integrantes.length > 0 && (
              <div style={{ marginTop: '4px' }}>
                <div style={sectionHeader}>
                  <Users size={12} color="var(--accent-primary)" /> Integrantes del Roster
                </div>
                <div style={chipWrap}>
                  {integrantes.map((intg) => {
                    const selected = isAuthorSelected(intg.nombre);
                    return (
                      <Chip
                        key={intg.id}
                        label={intg.carnet ? `${intg.nombre} · ${intg.carnet}` : intg.nombre}
                        selected={selected}
                        onClick={() => toggleIntegrante(intg.nombre)}
                        title={selected ? 'Quitar de la portada' : 'Añadir a la portada'}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Institución ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={fieldLabel}>Institución / Universidad</label>
            <input
              type="text"
              value={portada.institution || ''}
              onChange={(e) => updateCoverField('institution', e.target.value)}
              onFocus={focusHighlight('institution')}
              placeholder="Universidad o facultad"
              style={baseInput}
            />
          </div>

          {/* ── Curso ───────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={fieldLabel}>Curso / Asignatura</label>
            <input
              type="text"
              value={portada.course || ''}
              onChange={(e) => updateCoverField('course', e.target.value)}
              onFocus={focusHighlight('course')}
              placeholder="Nombre del curso"
              style={baseInput}
            />
          </div>

          {/* ── Grupo ───────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={fieldLabel}>Grupo</label>
            <input
              type="text"
              value={portada.grupo || ''}
              onChange={(e) => updateCoverField('grupo', e.target.value)}
              onFocus={focusHighlight('grupo')}
              placeholder="Ej: 3T1 IND"
              style={baseInput}
            />
            {grupos.length > 0 && (
              <div style={{ marginTop: '4px' }}>
                <div style={{ ...sectionHeader, fontSize: '9px' }}>
                  <Hash size={11} color="var(--accent-primary)" /> Grupos guardados
                </div>
                <div style={chipWrap}>
                  {grupos.map((g) => {
                    const selected = (portada.grupo || '') === g;
                    return (
                      <Chip
                        key={g}
                        label={g}
                        selected={selected}
                        onClick={() => setGrupo(g)}
                        title={selected ? 'Quitar grupo' : 'Seleccionar grupo'}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Docente / Profesor ──────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={fieldLabel}>Docente / Profesor</label>
            <input
              type="text"
              value={portada.instructor || ''}
              onChange={(e) => updateCoverField('instructor', e.target.value)}
              onFocus={focusHighlight('instructor')}
              placeholder="Nombre y título del docente"
              style={baseInput}
            />
            {/* Tag del docente seleccionado (removible) */}
            {portada.instructor && (
              <div style={{ display: 'flex', marginTop: '6px' }}>
                <span style={removableTag}>
                  <GraduationCap size={12} color="var(--accent-primary)" />
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: '200px',
                  }}>
                    {portada.instructor}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateCoverField('instructor', '')}
                    title="Quitar docente"
                    style={removeBtn}
                  >
                    <X size={10} strokeWidth={3} />
                  </button>
                </span>
              </div>
            )}
            {/* Roster de profesores como chips */}
            {profesores.length > 0 && (
              <div style={{ marginTop: '4px' }}>
                <div style={{ ...sectionHeader, fontSize: '9px' }}>
                  <GraduationCap size={11} color="var(--accent-primary)" /> Profesores guardados
                </div>
                <div style={chipWrap}>
                  {profesores.map((prof) => {
                    const selected = (portada.instructor || '') === prof.nombre;
                    return (
                      <Chip
                        key={prof.id}
                        label={prof.nombre}
                        selected={selected}
                        onClick={() => setInstructor(prof.nombre)}
                        title={selected ? 'Quitar docente' : 'Asignar docente'}
                        icon={<GraduationCap size={11} />}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Fecha ───────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={fieldLabel}>Fecha</label>
            <div style={{ position: 'relative' }}>
              <Calendar
                size={14}
                color="var(--text-muted)"
                style={{
                  position: 'absolute', left: '12px', top: '50%',
                  transform: 'translateY(-50%)', pointerEvents: 'none',
                }}
              />
              <input
                type="date"
                value={dateInputValue}
                onChange={handleDateChange}
                onFocus={focusHighlight('date')}
                style={{
                  ...baseInput,
                  paddingLeft: '34px',
                  colorScheme: 'light',
                }}
              />
            </div>
            {/* Fecha formateada en español (preview) */}
            {formattedDate && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600,
                marginTop: '2px',
              }}>
                <Calendar size={11} /> {formattedDate}
              </div>
            )}
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
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '7px', padding: '11px 14px', fontSize: '13px', fontWeight: 700,
            background: 'var(--accent-primary)', color: '#fff',
            border: 'none', borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Check size={15} strokeWidth={3} /> Actualizar portada
        </button>
        <button
          type="button"
          onClick={() => {
            setCoverSetupDone(true);
            useDocStore.getState().setWizardStep(2);
          }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '7px', marginTop: '8px', padding: '10px 14px', fontSize: '12px', fontWeight: 700,
            background: 'transparent', color: 'var(--accent-primary)',
            border: '1px solid rgba(79,124,255,0.45)', borderRadius: '12px', cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Continuar a Estructura <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default CoverEditorPanel;

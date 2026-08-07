/* WordAPA7 — CoverEditorPanel (paso 1): editor de portada premium.
   Estilo SaaS (Notion/Linear), sin formularios de "ministerio":
   - Selector de estrategia visual: 3 tarjetas (Original / APA 7 / UNI).
     Si se elige "Original", el formulario se atenua y se deshabilita.
   - Chunking en 3 bloques: Sobre el documento / Autores y Docente / Institucion.
   - Gestor de integrantes dinamico: filas con grip (drag para reordenar) + X.
   - Two-way binding real: cada input dispara highlight azul de 1s sobre el
     campo correspondiente en la hoja (PaperCanvas).
   Sigue la regla de tokens del design-system: sin hex duro. */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { useRosterStore } from '../../store/useRosterStore';
import {
  ShieldCheck, BookOpen, GraduationCap, Users, GripVertical, X,
  Calendar, Building2, School, FileText, Plus, Check, ChevronDown,
} from 'lucide-react';
import {
  parseAuthorEntries, serializeAuthorEntries,
  requestAuthorHighlight, requestCoverFieldHighlight,
} from '../../lib/portadaAuthors';

type Strategy = 'original' | 'apa' | 'uni';

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

export const CoverEditorPanel: React.FC = () => {
  const { portada, setPortada, setCoverSetupDone } = useDocStore();
  const { profesores, grupos, addIntegrante, addGrupo } = useRosterStore();

  const [draftAutor, setDraftAutor] = useState('');
  const [draftDocente, setDraftDocente] = useState('');
  const [docenteOpen, setDocenteOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [grupoOpen, setGrupoOpen] = useState(false);
  const [nuevoGrupo, setNuevoGrupo] = useState('');

  const strategy: Strategy = portada.use_original_cover !== false
    ? 'original'
    : (portada as any).cover_mode === 'generate_uni_cover'
      ? 'uni'
      : 'apa';

  const autores = parseAuthorEntries(portada.author);
  const formDisabled = strategy === 'original';

  const selectStrategy = (s: Strategy) => {
    if (s === 'original') {
      setPortada({ use_original_cover: true, force_skip_cover: false, cover_mode: '' });
    } else if (s === 'apa') {
      setPortada({ use_original_cover: false, force_skip_cover: false, cover_mode: '' });
    } else {
      setPortada({ use_original_cover: false, force_skip_cover: false, cover_mode: 'generate_uni_cover' });
    }
    setCoverSetupDone(true);
  };

  const toggleAutor = (nombre: string, carnet = '') => {
    const entries = parseAuthorEntries(portada.author);
    const exists = entries.some((a) => a.nombre.toLowerCase() === nombre.toLowerCase());
    const nuevos = exists
      ? entries.filter((a) => a.nombre.toLowerCase() !== nombre.toLowerCase())
      : carnet && entries.some((a) => a.carnet && a.carnet.toLowerCase() === carnet.toLowerCase())
        ? entries
        : [...entries, { nombre, carnet }];
    setPortada({ author: serializeAuthorEntries(nuevos) });
  };

  const addAutorFromInput = () => {
    const raw = draftAutor.trim();
    if (!raw) return;
    const pipe = raw.split('|');
    const nombre = pipe[0].trim();
    const carnetPart = pipe[1] ? pipe[1].trim().replace(/^carnet:\s*/i, '') : '';
    addIntegrante(nombre, carnetPart || undefined);
    toggleAutor(nombre, carnetPart);
    setDraftAutor('');
  };

  const removeAutor = (nombre: string) => {
    setPortada({ author: serializeAuthorEntries(autores.filter((a) => a.nombre !== nombre)) });
  };

  const updateCarnet = (index: number, carnet: string) => {
    const entries = parseAuthorEntries(portada.author);
    if (!entries[index]) return;
    entries[index] = { ...entries[index], carnet: carnet.trim() };
    const dup = entries.some((a, i) => i !== index && a.carnet && a.carnet.toLowerCase() === entries[index].carnet.toLowerCase());
    if (dup) {
      useDocStore.getState().showToast('Ese carnet ya esta asignado a otro integrante', 'error');
      return;
    }
    setPortada({ author: serializeAuthorEntries(entries) });
  };

  const reorderAutor = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    const arr = [...autores];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(targetIdx, 0, moved);
    setPortada({ author: serializeAuthorEntries(arr) });
    setDragIdx(null);
  };

  const asignarDocente = (nombre: string) => {
    setPortada({ instructor: nombre });
    setDraftDocente('');
    setDocenteOpen(false);
  };

  const docentesFiltrados = draftDocente.trim()
    ? profesores.filter((p) => p.nombre.toLowerCase().includes(draftDocente.toLowerCase()))
    : profesores;

  const focusHighlight = (field: string) => () => requestCoverFieldHighlight(field);

  // ── Tarjetas de estrategia ──
  const StrategyCard = ({ s, label, sub, icon }: { s: Strategy; label: string; sub: string; icon: React.ReactNode }) => {
    const active = strategy === s;
    return (
      <button
        type="button"
        onClick={() => selectStrategy(s)}
        aria-pressed={active}
        title={sub}
        style={{
          flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
          padding: '10px 10px', position: 'relative',
          border: `1.5px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
          borderRadius: '12px',
          backgroundColor: active ? 'var(--color-accent-soft)' : 'var(--surface-subtle)',
          transition: 'border-color 0.15s ease, background 0.15s ease',
          display: 'flex', flexDirection: 'column', gap: '4px',
        }}
        onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(79,124,255,0.4)'; }}
        onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
      >
        {active && (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: '16px', height: '16px', borderRadius: '50%',
            backgroundColor: 'var(--accent-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Check size={10} color="#fff" strokeWidth={3} />
          </span>
        )}
        <span style={{ color: active ? 'var(--accent-primary)' : 'var(--text-secondary)', display: 'flex' }}>
          {icon}
        </span>
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>
          {label}
        </span>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
          {sub}
        </span>
      </button>
    );
  };

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
        {/* A. Selector de estrategia visual */}
        <div>
          <div style={{ ...blockTitle, marginBottom: '8px' }}>
            <ShieldCheck size={12} /> Estrategia de portada
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <StrategyCard s="original" label="Original" sub="Dejar mi portada intacta" icon={<ShieldCheck size={16} />} />
            <StrategyCard s="apa" label="APA 7" sub="Formato estricto APA" icon={<BookOpen size={16} />} />
            <StrategyCard s="uni" label="UNI" sub="Plantilla institucional" icon={<GraduationCap size={16} />} />
          </div>
        </div>

        {/* Formulario (se atenua si Original) */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '16px',
          opacity: formDisabled ? 0.45 : 1,
          pointerEvents: formDisabled ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}>
          {/* ── Bloque 1: Sobre el documento ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={blockTitle}><FileText size={12} /> Sobre el documento</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Titulo del trabajo</label>
              <textarea
                value={portada.title}
                onChange={(e) => setPortada({ title: e.target.value })}
                onFocus={focusHighlight('title')}
                placeholder="Escribi el titulo completo de tu trabajo..."
                rows={3}
                style={{ ...baseInput, resize: 'none', lineHeight: 1.45 }}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>Asignatura / Curso</label>
              <div style={{ position: 'relative' }}>
                <GraduationCap size={14} style={{ position: 'absolute', left: '11px', top: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={portada.course || ''}
                  onChange={(e) => setPortada({ course: e.target.value })}
                  onFocus={focusHighlight('course')}
                  placeholder="Nombre del curso"
                  style={{ ...baseInput, paddingLeft: '32px' }}
                />
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>Fecha</label>
              <div style={{ position: 'relative' }}>
                <Calendar size={14} style={{ position: 'absolute', left: '11px', top: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={portada.date || ''}
                  onChange={(e) => setPortada({ date: e.target.value })}
                  onFocus={focusHighlight('date')}
                  placeholder="DD de mes de YYYY"
                  style={{ ...baseInput, paddingLeft: '32px' }}
                />
              </div>
            </div>
          </div>

          {/* ── Bloque 2: Autores y Docente ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={blockTitle}><Users size={12} /> Autores y docente</div>

            {/* Gestor de integrantes dinamico */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {autores.length === 0 ? (
                <div style={{
                  fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic',
                  border: '1.5px dashed var(--border-subtle)', borderRadius: '10px',
                  padding: '12px', textAlign: 'center',
                }}>
                  Aun no hay autores. Agrega el primero abajo.
                </div>
              ) : (
                autores.map((a, i) => (
                  <div
                    key={`${a.nombre}-${i}`}
                    draggable
                    onDragStart={() => setDragIdx(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => reorderAutor(i)}
                    onMouseEnter={() => requestAuthorHighlight(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
                      borderRadius: '10px', padding: '7px 9px', cursor: 'grab',
                    }}
                    title="Arrastra para reordenar los autores"
                  >
                    <GripVertical size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.25 }}>{a.nombre}</span>
                      <input
                        type="text"
                        value={a.carnet}
                        placeholder="Carnet (ej: 2023-0451U)"
                        onChange={(e) => updateCarnet(i, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '100%', fontFamily: 'inherit', fontSize: '10px',
                          padding: '2px 6px', background: 'var(--color-bg-surface-alt)',
                          border: '1px solid var(--border-subtle)', borderRadius: '6px',
                          color: 'var(--text-secondary)', outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAutor(a.nombre)}
                      title="Quitar autor"
                      aria-label="Quitar autor"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '4px', flexShrink: 0, borderRadius: '6px',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-danger)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}

              {/* Input para agregar integrante */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Plus size={14} style={{ position: 'absolute', left: '11px', top: '9px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    value={draftAutor}
                    onChange={(e) => setDraftAutor(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAutorFromInput(); } }}
                    placeholder="Escribe un nombre y presiona Enter..."
                    style={{ ...baseInput, paddingLeft: '32px', fontSize: '12px' }}
                  />
                </div>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Podes escribir "Nombre | Carnet: 2023-XXXX" en una sola linea.
              </div>
            </div>

            {/* Docente */}
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>Docente / Tutor</label>
              <div style={{ position: 'relative' }}>
                <Users size={14} style={{ position: 'absolute', left: '11px', top: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={draftDocente}
                  onChange={(e) => { setDraftDocente(e.target.value); setDocenteOpen(true); }}
                  onFocus={() => setDocenteOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && draftDocente.trim()) { e.preventDefault(); asignarDocente(draftDocente.trim()); }
                  }}
                  placeholder={portada.instructor || 'Buscar docente o escribir uno nuevo...'}
                  style={{ ...baseInput, paddingLeft: '32px' }}
                />
              </div>
              {docenteOpen && (
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: '100%', marginTop: '4px', zIndex: 30,
                  background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)',
                  borderRadius: '10px', boxShadow: 'var(--shadow-md)', maxHeight: '180px', overflowY: 'auto',
                }}>
                  {docentesFiltrados.length === 0 && (
                    <div style={{ padding: '9px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Enter para usar "{draftDocente}"
                    </div>
                  )}
                  {docentesFiltrados.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => asignarDocente(p.nombre)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left',
                        padding: '8px 12px', cursor: 'pointer', border: 'none', borderBottom: '1px solid var(--border-subtle)',
                        background: portada.instructor === p.nombre ? 'var(--color-accent-soft)' : 'transparent',
                        fontFamily: 'inherit', fontSize: '12px', color: 'var(--text-main)',
                      }}
                    >
                      <GraduationCap size={13} color="var(--text-muted)" />
                      {p.nombre}
                      {portada.instructor === p.nombre && <Check size={12} color="var(--accent-primary)" style={{ marginLeft: 'auto' }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Bloque 3: Institucion ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={blockTitle}><Building2 size={12} /> Institucion</div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>Universidad</label>
              <div style={{ position: 'relative' }}>
                <Building2 size={14} style={{ position: 'absolute', left: '11px', top: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={portada.institution}
                  onChange={(e) => setPortada({ institution: e.target.value })}
                  onFocus={focusHighlight('institution')}
                  placeholder="Universidad o facultad"
                  style={{ ...baseInput, paddingLeft: '32px' }}
                />
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>Facultad / Grupo</label>
              <div style={{ position: 'relative' }}>
                <ChevronDown size={14} style={{ position: 'absolute', right: '11px', top: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  readOnly
                  value={portada.grupo || ''}
                  onClick={() => setGrupoOpen((o) => !o)}
                  placeholder="Selecciona un grupo"
                  style={{ ...baseInput, paddingRight: '32px', cursor: 'pointer' }}
                />
              </div>
              {grupoOpen && (
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: '100%', marginTop: '4px', zIndex: 30,
                  background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)',
                  borderRadius: '10px', boxShadow: 'var(--shadow-md)', maxHeight: '180px', overflowY: 'auto',
                }}>
                  {grupos.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => { setPortada({ grupo: g }); setGrupoOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left',
                        padding: '8px 12px', cursor: 'pointer', border: 'none', borderBottom: '1px solid var(--border-subtle)',
                        background: portada.grupo === g ? 'var(--color-accent-soft)' : 'transparent',
                        fontFamily: 'inherit', fontSize: '12px', color: 'var(--text-main)',
                      }}
                    >
                      {g}
                      {portada.grupo === g && <Check size={12} color="var(--accent-primary)" style={{ marginLeft: 'auto' }} />}
                    </button>
                  ))}
                  <div style={{ display: 'flex', gap: '6px', padding: '8px' }}>
                    <input
                      type="text"
                      value={nuevoGrupo}
                      onChange={(e) => setNuevoGrupo(e.target.value)}
                      placeholder="Grupo nuevo..."
                      style={{ ...baseInput, fontSize: '12px', flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (nuevoGrupo.trim()) {
                          addGrupo(nuevoGrupo.trim());
                          setPortada({ grupo: nuevoGrupo.trim() });
                          setNuevoGrupo('');
                          setGrupoOpen(false);
                        }
                      }}
                      style={{
                        border: 'none', borderRadius: '10px', cursor: 'pointer', padding: '0 12px',
                        background: 'var(--accent-primary)', color: '#fff', fontFamily: 'inherit',
                      }}
                      aria-label="Agregar grupo"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
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
      </div>
    </div>
  );
};

export default CoverEditorPanel;

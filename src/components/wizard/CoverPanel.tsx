/* WordAPA7 — Panel de Portada para el RightSidePanel (paso 1).
   Reune en un solo panel flotante:
   - CoverStrategyCard (Conservar / APA7 / UNI / Plantillas)
   - Inputs: titulo, institucion, curso, fecha
   - Integrantes (drag & drop desde la biblioteca)
   - Docente
   - Visor XML opcional
   El PaperCanvas queda siempre visible a la izquierda. */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { useRosterStore } from '../../store/useRosterStore';
import {
  Layout, Eye, X, Search, UserPlus, GraduationCap, Users,
  GripVertical, University, BadgeCheck, ShieldCheck,
} from 'lucide-react';
import { CoverStrategyCard } from './CoverStrategyCard';
import { parseAuthorEntries, serializeAuthorEntries } from '../../lib/portadaAuthors';
import { Badge, Panel } from '../ui/wordapa7';

const fieldRow: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '4px',
};

const fieldLabel: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: '13px', color: 'var(--text-main)',
  background: 'var(--color-bg-surface-alt)', border: '1px solid var(--border-subtle)',
  borderRadius: '8px', padding: '8px 10px', outline: 'none', width: '100%',
};

const FieldInput: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
  <div style={fieldRow}>
    <label style={fieldLabel}>{label}</label>
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={inputStyle}
    />
  </div>
);

export const CoverPanel: React.FC = () => {
  const { portada, setPortada, doc, coverSetupDone, setCoverSetupDone } = useDocStore();
  const { integrantes, profesores, grupos, addIntegrante, addProfesor } = useRosterStore();

  const [autoresQuery, setAutoresQuery] = useState('');
  const [docenteQuery, setDocenteQuery] = useState('');
  const [autoresOpen, setAutoresOpen] = useState(false);
  const [docenteOpen, setDocenteOpen] = useState(false);
  const [showXmlViewer, setShowXmlViewer] = useState(false);

  const useOriginal = portada.use_original_cover !== false;
  const isUniMode = (portada as any).cover_mode === 'generate_uni_cover';
  const portadaFields: Record<string, string> = (doc as any)?.portada?.fields || {};

  const autoresActuales: string[] = (portada.author || '').split('\n').map((a) => a.trim()).filter(Boolean);
  const autoresEntries = parseAuthorEntries(portada.author);

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

  const removeAutor = (nombre: string) => {
    setPortada({
      author: serializeAuthorEntries(parseAuthorEntries(portada.author).filter((a) => a.nombre !== nombre)),
    });
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

  const handleAddNuevoIntegrante = (raw: string) => {
    const pipe = raw.split('|');
    const nombre = pipe[0].trim();
    const carnetPart = pipe[1] ? pipe[1].trim().replace(/^carnet:\s*/i, '') : '';
    addIntegrante(nombre, carnetPart || undefined);
    toggleAutor(nombre, carnetPart);
    setAutoresQuery('');
  };

  const autoresFiltrados = autoresQuery.trim()
    ? integrantes.filter((i) => i.nombre.toLowerCase().includes(autoresQuery.toLowerCase()))
    : integrantes;

  const handleSetDocente = (nombre: string) => {
    setPortada({ instructor: nombre });
    setDocenteQuery('');
    setDocenteOpen(false);
  };

  const handleAddNuevoDocente = (raw: string) => {
    addProfesor(raw);
    handleSetDocente(raw);
  };

  const docentesFiltrados = docenteQuery.trim()
    ? profesores.filter((p) => p.nombre.toLowerCase().includes(docenteQuery.toLowerCase()))
    : profesores;

  const textboxTexts: string[] = (doc as any)?.portada?.textbox_texts || [];

  const handleApply = () => {
    useDocStore.getState().showToast('Cambios de portada aplicados', 'success');
    setCoverSetupDone(true);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {useOriginal ? (
          <Badge tone="accent"><ShieldCheck size={11} /> Portada original (intacta)</Badge>
        ) : isUniMode ? (
          <Badge tone="warning"><University size={11} /> Portada institucional UNI</Badge>
        ) : (
          <Badge tone="warning"><Layout size={11} /> Portada APA 7 generada</Badge>
        )}
        {!coverSetupDone && (
          <span style={{ fontSize: '10px', color: 'var(--accent-warning)', fontWeight: 600 }}>
            Estrategia sin confirmar
          </span>
        )}
      </div>

      {!coverSetupDone ? (
        <CoverStrategyCard />
      ) : (
        <button
          type="button"
          onClick={() => setCoverSetupDone(false)}
          style={{
            alignSelf: 'flex-start',
            fontSize: '11px', padding: '4px 8px', cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontFamily: 'inherit',
          }}
        >
          Cambiar estrategia de portada
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <FieldInput
          label="Titulo"
          value={portada.title}
          placeholder={portadaFields.title || 'Escribi el titulo de tu trabajo'}
          onChange={(v) => setPortada({ title: v })}
        />
        <FieldInput
          label="Institucion"
          value={portada.institution}
          placeholder={portadaFields.institution || 'Universidad o facultad'}
          onChange={(v) => setPortada({ institution: v })}
        />
        <FieldInput
          label="Asignatura / Curso"
          value={portada.course || ''}
          placeholder={portadaFields.course || 'Nombre del curso'}
          onChange={(v) => setPortada({ course: v })}
        />
        <FieldInput
          label="Fecha"
          value={portada.date || ''}
          placeholder={portadaFields.date || 'DD de mes de YYYY'}
          onChange={(v) => setPortada({ date: v })}
        />
      </div>

      {isUniMode && (
        <div style={{
          background: 'var(--color-accent-soft)', border: '1px solid rgba(79,124,255,0.3)',
          borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '11px',
          color: 'var(--text-main)', lineHeight: 1.5,
        }}>
          <strong>Portada universitaria:</strong> area de conocimiento, asignatura, titulo,
          autores con carnet, docente, grupo y lugar se generan con estructura institucional.
        </div>
      )}

      <div style={fieldRow}>
        <label style={{ ...fieldLabel, display: 'flex', alignItems: 'center', gap: '5px' }}>
          <BadgeCheck size={12} /> Grupo
        </label>
        <select
          value={portada.grupo || ''}
          onChange={(e) => setPortada({ grupo: e.target.value })}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="">— Sin grupo —</option>
          {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        {portada.grupo && (
          <span style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600 }}>
            OK Grupo {portada.grupo} guardado
          </span>
        )}
      </div>

      <div>
        <label style={{ ...fieldLabel, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={12} /> Integrantes
        </label>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const nombre = e.dataTransfer.getData('text/roster-nombre');
            const carnet = e.dataTransfer.getData('text/roster-carnet');
            if (nombre) toggleAutor(nombre, carnet);
          }}
          style={{
            marginTop: '6px', border: '2px dashed var(--border-subtle)', borderRadius: '10px',
            padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px',
            background: 'var(--color-bg-surface-alt)',
          }}
        >
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
            Arrastra integrantes aqui
          </div>
          {autoresEntries.length === 0 && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Sin integrantes seleccionados
            </div>
          )}
          {autoresEntries.map((autor, i) => (
            <div key={`${autor.nombre}-${i}`} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'var(--accent-soft)', color: 'var(--text-main)',
              border: '1px solid var(--border-subtle)', borderRadius: '8px',
              padding: '6px 8px', fontSize: '11px',
            }}>
              <GripVertical size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontWeight: 700, lineHeight: 1.25 }}>{autor.nombre}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Carnet</span>
                  <input
                    type="text"
                    value={autor.carnet}
                    placeholder="2023-XXXX"
                    onChange={(e) => updateCarnet(i, e.target.value)}
                    style={{ ...inputStyle, fontSize: '10px', padding: '2px 6px' }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeAutor(autor.nombre)} title="Quitar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, display: 'flex', flexShrink: 0 }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ position: 'relative', marginTop: '6px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={autoresQuery}
                onChange={(e) => { setAutoresQuery(e.target.value); setAutoresOpen(true); }}
                onFocus={() => setAutoresOpen(true)}
                placeholder="Buscar en biblioteca... (o arrastra)"
                style={{ ...inputStyle, padding: '7px 10px 7px 30px' }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const n = window.prompt('Nuevo integrante (ej: Br. Nombre Apellido | Carnet: 2023-XXXX):');
                if (n) handleAddNuevoIntegrante(n);
              }}
              title="Anadir nuevo integrante a la biblioteca"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px',
                fontSize: '12px', fontWeight: 600,
                background: 'var(--accent-primary)', color: '#fff', border: 'none',
                borderRadius: '8px', cursor: 'pointer',
              }}
            >
              <UserPlus size={13} /> Nuevo
            </button>
          </div>
          {autoresOpen && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: '100%', marginTop: '4px', zIndex: 30,
              background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)',
              borderRadius: '8px', boxShadow: 'var(--shadow-md)', maxHeight: '220px', overflowY: 'auto',
            }}>
              {autoresFiltrados.length === 0 && (
                <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  No hay coincidencias. Usa "Nuevo" o arrastra para agregar.
                </div>
              )}
              {autoresFiltrados.map((intg) => {
                const selected = autoresActuales.some((a) => a.toLowerCase() === intg.nombre.toLowerCase());
                return (
                  <div
                    key={intg.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/roster-nombre', intg.nombre);
                      e.dataTransfer.setData('text/roster-carnet', intg.carnet || '');
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => toggleAutor(intg.nombre, intg.carnet || '')}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                      padding: '8px 12px', cursor: 'pointer',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: selected ? 'var(--color-accent-soft)' : 'transparent',
                      fontSize: '13px', color: 'var(--text-main)',
                    }}
                    title={selected ? 'Quitar de la portada' : 'Arrastrar o hacer clic para anadir'}
                  >
                    <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <GripVertical size={12} color="var(--text-muted)" />
                      <span style={{ display: 'block' }}>
                        <span style={{ display: 'block' }}>{intg.nombre}</span>
                        {intg.carnet && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Carnet: {intg.carnet}</span>}
                      </span>
                    </span>
                    {selected && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-primary)' }}>OK En portada</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div>
        <label style={{ ...fieldLabel, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <GraduationCap size={12} /> Docente
        </label>
        <div style={{ position: 'relative', marginTop: '6px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={docenteQuery}
                onChange={(e) => { setDocenteQuery(e.target.value); setDocenteOpen(true); }}
                onFocus={() => setDocenteOpen(true)}
                placeholder="Buscar docente... (o arrastra)"
                style={{ ...inputStyle, padding: '7px 10px 7px 30px' }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const n = window.prompt('Nuevo docente (ej: Ing. Nombre):');
                if (n) handleAddNuevoDocente(n);
              }}
              title="Anadir nuevo docente a la biblioteca"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px',
                fontSize: '12px', fontWeight: 600,
                background: 'var(--accent-primary)', color: '#fff', border: 'none',
                borderRadius: '8px', cursor: 'pointer',
              }}
            >
              <UserPlus size={13} /> Nuevo
            </button>
          </div>
          {portada.instructor && (
            <div style={{
              marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px',
              background: 'var(--accent-soft)', color: 'var(--text-main)',
              border: '1px solid var(--border-subtle)', borderRadius: '8px',
              padding: '5px 8px', fontSize: '11px',
            }}>
              <GraduationCap size={12} color="var(--accent-primary)" /> {portada.instructor}
              <button
                type="button"
                onClick={() => setPortada({ instructor: '' })} title="Quitar docente"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', padding: 0,
                  display: 'flex', marginLeft: 'auto',
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}
          {docenteOpen && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: '100%', marginTop: '4px', zIndex: 30,
              background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)',
              borderRadius: '8px', boxShadow: 'var(--shadow-md)', maxHeight: '200px', overflowY: 'auto',
            }}>
              {docentesFiltrados.length === 0 && (
                <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  No hay coincidencias. Usa "Nuevo".
                </div>
              )}
              {docentesFiltrados.map((prof) => (
                <div
                  key={prof.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/roster-docente', prof.nombre);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => handleSetDocente(prof.nombre)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    padding: '8px 12px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: portada.instructor === prof.nombre ? 'var(--color-accent-soft)' : 'transparent',
                    fontSize: '13px', color: 'var(--text-main)',
                  }}
                  title="Arrastrar o hacer clic para asignar"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <GripVertical size={12} color="var(--text-muted)" />
                    {prof.nombre}
                  </span>
                  {portada.instructor === prof.nombre && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-primary)' }}>OK</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowXmlViewer((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px',
            padding: '5px 10px', cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontFamily: 'inherit',
          }}
        >
          <Eye size={12} /> {showXmlViewer ? 'Ocultar deteccion' : 'Ver campos detectados'}
        </button>
        {showXmlViewer && (
          <Panel style={{ padding: '12px', marginTop: '6px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Eye size={12} /> Portada detectada
            </h4>
            {Object.keys(portadaFields).length === 0 ? (
              <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '11px' }}>Sin campos detectados</span>
            ) : (
              <div style={{ display: 'grid', gap: '6px' }}>
                {Object.entries(portadaFields).map(([key, val]) => (
                  <div key={key} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-main)' }}>{key}:</strong> {String(val)}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}
      </div>

      <div style={{ position: 'sticky', bottom: 0, backgroundColor: 'var(--sidebar-bg)', padding: '8px 0 4px', marginTop: 'auto' }}>
        <button
          type="button"
          onClick={handleApply}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '10px 14px', fontSize: '13px', fontWeight: 700,
            background: 'var(--accent-primary)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <ShieldCheck size={13} /> Actualizar portada
        </button>
        {textboxTexts.length > 0 && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '5px' }}>
            {textboxTexts.length} cuadro(s) de texto en la portada
          </div>
        )}
      </div>
    </div>
  );
};

export default CoverPanel;

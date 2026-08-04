/* WordAPA7 — Paso 1: Portada Wizard (editor lateral izquierdo + lienzo)
   El editor de datos vive en el lateral izquierdo (siempre visible) y usa
   drag & drop desde la biblioteca de integrantes/profesores del roster.
   Cuando el modo es "generate_uni_cover" se muestran los campos institucionales. */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { useRosterStore } from '../../store/useRosterStore';
import {
  Layout, ShieldCheck, Eye, X, ChevronDown, ChevronUp, Search,
  UserPlus, GraduationCap, Users, Trash2, GripVertical, University, BadgeCheck,
} from 'lucide-react';
import { PaperCanvas } from '../layout/PaperCanvas';
import { Badge, Card, Panel } from '../ui/wordapa7';
import { CoverSetupDialog } from './CoverSetupDialog';
import { parseAuthorEntries, serializeAuthorEntries } from '../../lib/portadaAuthors';

export const Step1PortadaWizard: React.FC = () => {
  const { portada, setPortada, doc, coverSetupDone } = useDocStore();
  const [showXmlViewer, setShowXmlViewer] = useState(false);
  const [autoresQuery, setAutoresQuery] = useState('');
  const [docenteQuery, setDocenteQuery] = useState('');
  const [autoresOpen, setAutoresOpen] = useState(false);
  const [docenteOpen, setDocenteOpen] = useState(false);
  const [showLateral, setShowLateral] = useState(true);

  const useOriginal = portada.use_original_cover !== false;
  const isUniMode = (portada as any).cover_mode === 'generate_uni_cover';

  const portadaFields: Record<string, string> = (doc as any)?.portada?.fields || {};
  const textboxTexts: string[] = (doc as any)?.portada?.textbox_texts || [];

  const { integrantes, profesores, grupos, addIntegrante, addProfesor } = useRosterStore();

  const autoresActuales: string[] = (portada.author || '').split('\n').map(a => a.trim()).filter(Boolean);
  const autoresEntries = parseAuthorEntries(portada.author);

  // Cada persona tiene carnet único: dedupe por carnet al agregar.
  const toggleAutor = (nombre: string, carnet = '') => {
    const entries = parseAuthorEntries(portada.author);
    const exists = entries.some(a => a.nombre.toLowerCase() === nombre.toLowerCase());
    const nuevos = exists
      ? entries.filter(a => a.nombre.toLowerCase() !== nombre.toLowerCase())
      : carnet && entries.some(a => a.carnet && a.carnet.toLowerCase() === carnet.toLowerCase())
        ? entries
        : [...entries, { nombre, carnet }];
    setPortada({ author: serializeAuthorEntries(nuevos) });
  };

  const removeAutor = (nombre: string) => {
    setPortada({ author: serializeAuthorEntries(parseAuthorEntries(portada.author).filter(a => a.nombre !== nombre)) });
  };

  const updateCarnet = (index: number, carnet: string) => {
    const entries = parseAuthorEntries(portada.author);
    if (!entries[index]) return;
    entries[index] = { ...entries[index], carnet: carnet.trim() };
    // Carnet único: si otro integrante ya usa ese carnet, se descarta el cambio.
    const dup = entries.some((a, i) => i !== index && a.carnet && a.carnet.toLowerCase() === entries[index].carnet.toLowerCase());
    if (dup) {
      useDocStore.getState().showToast('Ese carnet ya está asignado a otro integrante', 'error');
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
    ? integrantes.filter(i => i.nombre.toLowerCase().includes(autoresQuery.toLowerCase()))
    : integrantes;

  const handleSetDocente = (nombre: string) => {
    setPortada({ instructor: nombre });
    setDocenteOpen(false);
    setDocenteQuery('');
  };

  const handleAddNuevoDocente = (nombre: string) => {
    addProfesor(nombre.trim());
    handleSetDocente(nombre.trim());
  };

  const docentesFiltrados = docenteQuery.trim()
    ? profesores.filter(p => p.nombre.toLowerCase().includes(docenteQuery.toLowerCase()))
    : profesores;

  // Drag & drop desde biblioteca → lista de autores de la portada
  const onDropIntegrante = (e: React.DragEvent) => {
    e.preventDefault();
    const nombre = e.dataTransfer.getData('text/roster-nombre');
    const carnet = e.dataTransfer.getData('text/roster-carnet');
    if (nombre) toggleAutor(nombre, carnet);
  };

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', backgroundColor: 'var(--canvas-bg)' }}>
      {!coverSetupDone && <CoverSetupDialog />}

      {/* ── PANEL LATERAL IZQUIERDO: editor de datos de la portada ── */}
      {showLateral && (
        <div style={{
          width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column',
          backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-subtle)',
          overflow: 'hidden', zIndex: 10,
        }}>
          {/* Cabecera del panel */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              {isUniMode
                ? <University size={16} color="var(--accent-primary)" />
                : <Layout size={16} color="var(--accent-primary)" />}
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                {isUniMode ? 'Editor de portada universitaria' : 'Editar datos de la portada'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Badge tone={useOriginal ? 'accent' : 'warning'}>
                {useOriginal ? 'Portada original (intacta)' : isUniMode ? 'Portada institucional UNI' : 'Portada APA 7 generada'}
              </Badge>
              <button
                type="button"
                onClick={() => useDocStore.setState({ coverSetupDone: false })}
                style={{
                  marginLeft: 'auto', fontSize: '11px', padding: '4px 8px', cursor: 'pointer',
                  background: 'transparent', border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontFamily: 'inherit',
                }}
              >
                Cambiar portada
              </button>
            </div>
          </div>

          {/* Contenido scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Campos básicos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <FieldInput label="Título" value={portada.title} placeholder={portadaFields.title || 'Título del documento'} onChange={(v) => setPortada({ title: v })} />
              <FieldInput label="Institución" value={portada.institution} placeholder={portadaFields.institution || 'Universidad...'} onChange={(v) => setPortada({ institution: v })} />
              <FieldInput label="Asignatura / Curso" value={portada.course || ''} placeholder={portadaFields.course || 'Nombre del curso'} onChange={(v) => setPortada({ course: v })} />
              <FieldInput label="Fecha" value={portada.date || ''} placeholder={portadaFields.date || 'DD de mes de YYYY'} onChange={(v) => setPortada({ date: v })} />
            </div>

            {isUniMode && (
              <div style={{
                background: 'var(--color-accent-soft)', border: '1px solid rgba(79,124,255,0.3)',
                borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '11px',
                color: 'var(--text-main)', lineHeight: 1.5,
              }}>
                <strong>Portada universitaria:</strong> área de conocimiento, asignatura, título,
                autores con carnet, docente, grupo y lugar se generan con estructura institucional.
              </div>
            )}

            {/* ── Grupo ── */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <BadgeCheck size={12} /> Grupo
              </label>
              <select
                value={portada.grupo || ''}
                onChange={(e) => setPortada({ grupo: e.target.value })}
                style={{
                  width: '100%', marginTop: '6px', padding: '8px 10px', fontSize: '13px', fontFamily: 'inherit',
                  background: 'var(--color-bg-surface-alt)', border: '1px solid var(--border-subtle)',
                  borderRadius: '8px', color: 'var(--text-main)', outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">— Sin grupo —</option>
                {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              {portada.grupo && (
                <span style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600, display: 'inline-block', marginTop: '4px' }}>
                  ✓ Grupo {portada.grupo} guardado
                </span>
              )}
            </div>

            {/* ── Integrantes: biblioteca + drag & drop ── */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={12} /> Integrantes
              </label>

              {/* Drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropIntegrante}
                style={{
                  marginTop: '6px', border: '2px dashed var(--border-subtle)', borderRadius: '10px',
                  padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px',
                  background: 'var(--color-bg-surface-alt)',
                }}
              >
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
                  Arrastrá integrantes aquí
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
                          style={{
                            flex: 1, minWidth: 0, fontSize: '10px', padding: '2px 6px', fontFamily: 'inherit',
                            background: 'var(--color-bg-surface-alt)', border: '1px solid var(--border-subtle)',
                            borderRadius: '5px', color: 'var(--text-main)', outline: 'none', width: '100%',
                          }}
                        />
                      </div>
                    </div>
                    <button type="button" onClick={() => removeAutor(autor.nombre)} title="Quitar"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0', display: 'flex', flexShrink: 0 }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Buscador de biblioteca */}
              <div style={{ position: 'relative', marginTop: '6px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={13} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={autoresQuery}
                      onChange={(e) => { setAutoresQuery(e.target.value); setAutoresOpen(true); }}
                      onFocus={() => setAutoresOpen(true)}
                      placeholder="Buscar en biblioteca... (o arrastrá)"
                      style={{
                        width: '100%', padding: '7px 10px 7px 30px', fontSize: '13px', fontFamily: 'inherit',
                        background: 'var(--color-bg-surface-alt)', border: '1px solid var(--border-subtle)',
                        borderRadius: '8px', color: 'var(--text-main)', outline: 'none',
                      }}
                    />
                  </div>
                  <button type="button" onClick={() => { const n = window.prompt('Nuevo integrante (ej: Br. Nombre Apellido | Carnet: 2023-XXXX):'); if (n) handleAddNuevoIntegrante(n); }}
                    title="Añadir nuevo integrante a la biblioteca"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', fontSize: '12px', fontWeight: 600,
                      background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer',
                    }}>
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
                      const selected = autoresActuales.some(a => a.toLowerCase() === intg.nombre.toLowerCase());
                      return (
                        <div key={intg.id}
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData('text/roster-nombre', intg.nombre); e.dataTransfer.setData('text/roster-carnet', intg.carnet || ''); e.dataTransfer.effectAllowed = 'copy'; }}
                          onClick={() => toggleAutor(intg.nombre, intg.carnet || '')}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                            padding: '8px 12px', cursor: 'pointer',
                            borderBottom: '1px solid var(--border-subtle)', background: selected ? 'var(--color-accent-soft)' : 'transparent',
                            fontSize: '13px', color: 'var(--text-main)',
                          }}
                          title={selected ? 'Quitar de la portada' : 'Arrastrar o hacer clic para añadir'}
                        >
                          <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <GripVertical size={12} color="var(--text-muted)" />
                            <span style={{ display: 'block' }}>
                              <span style={{ display: 'block' }}>{intg.nombre}</span>
                              {intg.carnet && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Carnet: {intg.carnet}</span>}
                            </span>
                          </span>
                          {selected && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-primary)' }}>✓ En portada</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Docente: biblioteca + drag & drop ── */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                      placeholder="Buscar docente... (o arrastrá)"
                      style={{
                        width: '100%', padding: '7px 10px 7px 30px', fontSize: '13px', fontFamily: 'inherit',
                        background: 'var(--color-bg-surface-alt)', border: '1px solid var(--border-subtle)',
                        borderRadius: '8px', color: 'var(--text-main)', outline: 'none',
                      }}
                    />
                  </div>
                  <button type="button" onClick={() => { const n = window.prompt('Nuevo docente (ej: Ing. Nombre):'); if (n) handleAddNuevoDocente(n); }}
                    title="Añadir nuevo docente a la biblioteca"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', fontSize: '12px', fontWeight: 600,
                      background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer',
                    }}>
                    <UserPlus size={13} /> Nuevo
                  </button>
                </div>
                {portada.instructor && (
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'var(--accent-soft)', color: 'var(--text-main)',
                    border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '5px 8px', fontSize: '11px' }}>
                    <GraduationCap size={12} color="var(--accent-primary)" /> {portada.instructor}
                    <button type="button" onClick={() => setPortada({ instructor: '' })} title="Quitar docente"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0', display: 'flex', marginLeft: 'auto' }}>
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
                      <div key={prof.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/roster-docente', prof.nombre); e.dataTransfer.effectAllowed = 'copy'; }}
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
                        {portada.instructor === prof.nombre && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-primary)' }}>✓</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Visor XML */}
            {showXmlViewer && textboxTexts.length > 0 && (
              <Panel style={{ padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Eye size={12} /> Portada detectada
                  </h4>
                  <button onClick={() => setShowXmlViewer(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px' }}>
                    <X size={12} />
                  </button>
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {Object.entries(portadaFields).map(([key, val]) => (
                    <div key={key} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--text-main)' }}>{key}:</strong> {String(val)}
                    </div>
                  ))}
                  {Object.keys(portadaFields).length === 0 && (
                    <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Sin campos detectados</span>
                  )}
                </div>
              </Panel>
            )}
          </div>
        </div>
      )}
      {/* Barra colapsada: siempre accesible para reabrir el editor */}
      {!showLateral && (
        <div style={{
          width: 40, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
          backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-subtle)', paddingTop: 8,
        }}>
          <button type="button" onClick={() => setShowLateral(true)}
            title="Mostrar editor de portada" aria-label="Mostrar editor de portada"
            style={{ width: 32, height: 32, borderRadius: 8, cursor: 'pointer', background: 'rgba(79,124,255,0.10)', border: '1px solid rgba(79,124,255,0.2)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layout size={14} />
          </button>
        </div>
      )}

      {/* ── ÁREA PRINCIPAL: lienzo ── */}
      <div style={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Barra superior del área principal */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
          padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--sidebar-bg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Badge tone="accent"><Layout size={13} /> Portada</Badge>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
              Verificación de la hoja de portada
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowXmlViewer((v) => !v)}
              title="Ver campos detectados de la portada"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', padding: '5px 10px', cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)', fontFamily: 'inherit',
              }}
            >
              <Eye size={12} /> {showXmlViewer ? 'Ocultar detección' : 'Ver detección'}
            </button>
            <button
              type="button"
              onClick={() => setShowLateral((v) => !v)}
              title={showLateral ? 'Ocultar editor lateral' : 'Mostrar editor lateral'}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', padding: '5px 10px', cursor: 'pointer',
                background: showLateral ? 'var(--color-accent-soft)' : 'transparent',
                border: `1px solid ${showLateral ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-sm)', color: showLateral ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontFamily: 'inherit',
              }}
            >
              <Layout size={12} /> {showLateral ? 'Editor visible' : 'Mostrar editor'}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 16px 16px' }}>
          <PaperCanvas />
        </div>
      </div>
    </div>
  );
};

export default Step1PortadaWizard;


const FieldInput: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontFamily: 'inherit', fontSize: '13px', color: 'var(--text-main)',
        background: 'var(--color-bg-surface-alt)', border: '1px solid var(--border-subtle)', borderRadius: '8px',
        padding: '8px 10px', outline: 'none',
      }}
    />
  </div>
);

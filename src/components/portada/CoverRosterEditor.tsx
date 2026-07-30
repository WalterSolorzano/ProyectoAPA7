/* WordAPA7 — Roster Biblioteca con Drag & Drop, Preview UNI y Acción Rápida */

import React, { useState, useCallback } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { useRosterStore, IntegranteItem } from '../../store/useRosterStore';
import {
  Users, UserPlus, Calendar, Trash2, ArrowRight,
  ShieldCheck, GripVertical, BookUser, School, Search,
  RefreshCcw, Copy, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import logoUni from '../../assets/logo_uni.png';

/* ─── Preview Visual de la Portada UNI ─────────────────────────────────── */
const UniCoverPreview: React.FC<{
  titulo: string; asignatura: string; autores: string;
  tutor: string; grupo: string; fecha: string;
}> = ({ titulo, asignatura, autores, tutor, grupo, fecha }) => {
  const lines = autores.split('\n').filter(Boolean);
  
  // Agrupar en columnas de 2
  const cols: string[][] = [];
  for (let i = 0; i < lines.length; i += 2) {
    cols.push(lines.slice(i, i + 2));
  }
  if (tutor) cols.push([`${tutor}`, `Grupo: ${grupo}`]);

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #cbd5e1',
      borderRadius: '6px',
      padding: '16px',
      fontFamily: 'Times New Roman, serif',
      fontSize: '10px',
      lineHeight: '1.4',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      minHeight: '200px'
    }}>
      {/* Header UNI */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1.5px solid #003366', paddingBottom: '6px', marginBottom: '6px' }}>
        <img src={logoUni} alt="UNI" style={{ height: '28px', objectFit: 'contain' }} />
      </div>

      {/* Departamento */}
      <p style={{ textAlign: 'center', fontWeight: 700, color: '#003366', margin: '2px 0', fontSize: '9px' }}>
        ÁREA DE CONOCIMIENTO DE INGENIERÍA Y AFINES
      </p>

      {/* Asignatura */}
      {asignatura && (
        <p style={{ textAlign: 'center', fontWeight: 700, margin: '6px 0 2px', fontSize: '10px' }}>
          {asignatura}
        </p>
      )}

      {/* Título */}
      {titulo && (
        <p style={{ textAlign: 'center', fontWeight: 700, margin: '2px 0 8px', fontSize: '10px' }}>
          {titulo}
        </p>
      )}

      {/* Autores en columnas */}
      {cols.length > 0 && (
        <>
          <p style={{ fontWeight: 700, margin: '4px 0 2px', fontSize: '9px' }}>Elaborado por:</p>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cols.length, 4)}, 1fr)`, gap: '4px', marginBottom: '6px' }}>
            {cols.map((col, ci) => (
              <div key={ci} style={{ fontSize: '9px' }}>
                {col.map((line, li) => (
                  <div key={li} style={{ color: li % 2 === 0 ? '#0f172a' : '#475569', fontStyle: li % 2 !== 0 && !line.startsWith('Grupo') ? 'normal' : 'normal' }}>
                    {line}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Fecha */}
      {fecha && (
        <p style={{ textAlign: 'center', margin: '4px 0 0', fontSize: '9px', color: '#334155' }}>
          {fecha}
        </p>
      )}
    </div>
  );
};

/* ─── Chip de Integrante Arrastrable ────────────────────────────────────── */
const IntegranteChip: React.FC<{
  item: IntegranteItem;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onQuickAdd: () => void;
}> = ({ item, onRemove, onDragStart, onQuickAdd }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = item.carnet ? `${item.nombre}\nCarnet: ${item.carnet}` : item.nombre;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        padding: '8px 10px',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        transition: 'all 0.15s ease',
        userSelect: 'none'
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e0f2fe')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
    >
      <GripVertical size={12} color="#94a3b8" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.nombre}
        </div>
        {item.carnet && (
          <div style={{ fontSize: '10px', color: '#64748b' }}>Carnet: {item.carnet}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
        <button
          title="Agregar a Portada"
          onClick={onQuickAdd}
          style={{ border: 'none', background: 'none', color: '#3b82f6', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px' }}
        >
          <ArrowRight size={12} />
        </button>
        <button
          title="Copiar texto"
          onClick={handleCopy}
          style={{ border: 'none', background: 'none', color: copied ? '#16a34a' : '#64748b', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px' }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
        <button
          title="Eliminar del roster"
          onClick={onRemove}
          style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px' }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

/* ─── Panel de Profesores ────────────────────────────────────────────────── */
const ProfesoresPanel: React.FC = () => {
  const { portada, setPortada } = useDocStore();
  const { profesores, addProfesor } = useRosterStore();
  const [newProf, setNewProf] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <School size={13} /> DOCENTES / TUTORES
      </label>
      {profesores.map((p) => (
        <div
          key={p.id}
          onClick={() => setPortada({ instructor: p.nombre })}
          style={{
            padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0',
            background: portada.instructor === p.nombre ? '#e0f2fe' : '#f8fafc',
            cursor: 'pointer', fontSize: '11px', fontWeight: 600,
            color: portada.instructor === p.nombre ? '#0369a1' : '#334155',
            transition: 'all 0.1s'
          }}
        >
          {p.nombre}
        </div>
      ))}
      <div style={{ display: 'flex', gap: '4px' }}>
        <input
          className="form-control"
          style={{ fontSize: '11px', padding: '4px 8px', flex: 1 }}
          placeholder="Ing. Nombre Apellido"
          value={newProf}
          onChange={e => setNewProf(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newProf.trim()) { addProfesor(newProf.trim()); setNewProf(''); } }}
        />
        <button
          className="btn btn-secondary btn-xs"
          onClick={() => { if (newProf.trim()) { addProfesor(newProf.trim()); setNewProf(''); } }}
          style={{ flexShrink: 0, padding: '4px 8px', fontSize: '11px' }}
        >
          <UserPlus size={12} />
        </button>
      </div>
    </div>
  );
};

/* ─── Panel de Grupos ────────────────────────────────────────────────────── */
const GruposPanel: React.FC = () => {
  const { portada, setPortada } = useDocStore();
  const { grupos, addGrupo } = useRosterStore();
  const [newGrupo, setNewGrupo] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>GRUPOS</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {grupos.map((g) => (
          <button
            key={g}
            onClick={() => setPortada({ course: g })}
            style={{
              padding: '3px 10px', borderRadius: '20px', border: '1px solid #cbd5e1',
              background: portada.course === g ? '#003366' : '#f1f5f9',
              color: portada.course === g ? '#ffffff' : '#334155',
              cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.1s'
            }}
          >
            {g}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <input
          className="form-control"
          style={{ fontSize: '11px', padding: '4px 8px', flex: 1 }}
          placeholder="Ej: 3T1 IND"
          value={newGrupo}
          onChange={e => setNewGrupo(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newGrupo.trim()) { addGrupo(newGrupo.trim()); setNewGrupo(''); } }}
        />
        <button
          className="btn btn-secondary btn-xs"
          onClick={() => { if (newGrupo.trim()) { addGrupo(newGrupo.trim()); setNewGrupo(''); } }}
          style={{ flexShrink: 0, padding: '4px 8px', fontSize: '11px' }}
        >+</button>
      </div>
    </div>
  );
};

/* ─── Componente Principal ────────────────────────────────────────────────── */
export const CoverRosterEditor: React.FC = () => {
  const { portada, setPortada } = useDocStore();
  const { integrantes, addIntegrante, removeIntegrante } = useRosterStore();

  const [newNombre, setNewNombre] = useState('');
  const [newCarnet, setNewCarnet] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [dropActive, setDropActive] = useState(false);

  const filtered = integrantes.filter(i =>
    i.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.carnet || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSetTodayDate = () => {
    const today = new Date();
    const months = ['enero','febrero','marzo','abril','mayo','junio',
      'julio','agosto','septiembre','octubre','noviembre','diciembre'];
    setPortada({ date: `${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}, Managua, Nicaragua` });
  };

  const handleAddCustomIntegrante = () => {
    if (newNombre.trim()) {
      addIntegrante(newNombre.trim(), newCarnet.trim());
      setNewNombre('');
      setNewCarnet('');
    }
  };

  const handleSelectAll = () => {
    const formatted = integrantes.map(i =>
      i.carnet ? `${i.nombre}\nCarnet: ${i.carnet}` : i.nombre
    ).join('\n\n');
    setPortada({ author: formatted });
  };

  const handleClearAuthors = () => setPortada({ author: '' });

  const handleDragStart = useCallback((e: React.DragEvent, item: IntegranteItem) => {
    const str = item.carnet ? `${item.nombre}\nCarnet: ${item.carnet}` : item.nombre;
    e.dataTransfer.setData('text/plain', str);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleQuickAdd = useCallback((item: IntegranteItem) => {
    const str = item.carnet ? `${item.nombre}\nCarnet: ${item.carnet}` : item.nombre;
    const current = portada.author || '';
    setPortada({ author: current ? `${current}\n\n${str}` : str });
  }, [portada.author, setPortada]);

  const handleDropOnAuthors = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const droppedText = e.dataTransfer.getData('text/plain');
    if (droppedText) {
      const current = portada.author || '';
      setPortada({ author: current ? `${current}\n\n${droppedText}` : droppedText });
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '12px', height: '100%', padding: '12px', overflow: 'hidden' }}>

      {/* ── Panel Izquierdo: Biblioteca ──────────────────────────────────── */}
      <div style={{
        backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px',
        padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden'
      }}>

        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
          <BookUser size={16} color="#003366" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#003366' }}>BIBLIOTECA DE INTEGRANTES</span>
        </div>

        {/* Buscador */}
        <div style={{ position: 'relative' }}>
          <Search size={12} color="#94a3b8" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            className="form-control"
            style={{ fontSize: '11px', paddingLeft: '26px', padding: '5px 8px 5px 26px' }}
            placeholder="Buscar integrante..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Botón Seleccionar Todo */}
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSelectAll}
          style={{ width: '100%', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#003366' }}
        >
          <Users size={13} />
          Agregar Todo el Grupo
          <ArrowRight size={12} />
        </button>

        {/* Lista de Chips */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: '11px' }}>
              {searchQuery ? 'Sin resultados' : 'Agrega integrantes abajo ↓'}
            </div>
          )}
          {filtered.map(item => (
            <IntegranteChip
              key={item.id}
              item={item}
              onRemove={() => removeIntegrante(item.id)}
              onDragStart={(e) => handleDragStart(e, item)}
              onQuickAdd={() => handleQuickAdd(item)}
            />
          ))}
        </div>

        {/* Formulario Agregar */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>+ Nuevo Integrante</span>
          <input
            className="form-control"
            style={{ fontSize: '11px', padding: '5px 8px' }}
            placeholder="Nombre (ej: Br. Juan Pérez)"
            value={newNombre}
            onChange={e => setNewNombre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCustomIntegrante()}
          />
          <input
            className="form-control"
            style={{ fontSize: '11px', padding: '5px 8px' }}
            placeholder="Carnet (ej: 2023-0432U)"
            value={newCarnet}
            onChange={e => setNewCarnet(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCustomIntegrante()}
          />
          <button
            className="btn btn-secondary btn-xs"
            onClick={handleAddCustomIntegrante}
            style={{ width: '100%', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          >
            <UserPlus size={12} /> Guardar en Biblioteca
          </button>
        </div>
      </div>

      {/* ── Panel Derecho: Editor + Preview ─────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'auto' }}>

        {/* Preview UNI Toggle */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
          <button
            onClick={() => setShowPreview(!showPreview)}
            style={{
              width: '100%', padding: '10px 14px', background: 'none', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', borderBottom: showPreview ? '1px solid #e2e8f0' : 'none'
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#003366', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="#16a34a" /> Vista Previa de Portada UNI
            </span>
            {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showPreview && (
            <div style={{ padding: '12px' }}>
              <UniCoverPreview
                titulo={portada.title || ''}
                asignatura={portada.course || ''}
                autores={portada.author || ''}
                tutor={portada.instructor || ''}
                grupo={''}
                fecha={portada.date || ''}
              />
            </div>
          )}
        </div>

        {/* Formulario Principal */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Título */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>TÍTULO DEL TRABAJO</label>
            <input
              className="form-control"
              style={{ fontSize: '12px', fontWeight: 600 }}
              value={portada.title || ''}
              onChange={e => setPortada({ title: e.target.value })}
              placeholder="Ej: Optimización del Proceso Redonditas mediante Estudio de Métodos"
            />
          </div>

          {/* Asignatura / Evaluación */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>ASIGNATURA / EVALUACIÓN</label>
            <input
              className="form-control"
              style={{ fontSize: '12px' }}
              value={portada.course || ''}
              onChange={e => setPortada({ course: e.target.value })}
              placeholder="Ej: Proyecto de Estudio del Trabajo 1 — 10ma Evaluación"
            />
          </div>

          {/* Zona Drop de Autores */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', margin: 0 }}>
                ELABORADO POR — (Arrastra integrantes aquí)
              </label>
              <button
                onClick={handleClearAuthors}
                title="Limpiar autores"
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                <RefreshCcw size={11} /> Limpiar
              </button>
            </div>
            <div
              onDragOver={e => { e.preventDefault(); setDropActive(true); }}
              onDragLeave={() => setDropActive(false)}
              onDrop={handleDropOnAuthors}
              style={{
                borderRadius: '8px',
                border: `2px dashed ${dropActive ? '#003366' : '#93c5fd'}`,
                backgroundColor: dropActive ? '#eff6ff' : '#f8fafc',
                padding: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <textarea
                className="form-control"
                rows={6}
                style={{ fontSize: '11px', backgroundColor: 'transparent', border: 'none', resize: 'vertical', fontFamily: 'monospace' }}
                value={portada.author || ''}
                onChange={e => setPortada({ author: e.target.value })}
                placeholder={'Ej:\nBr. María del Pilar Bermúdez\nCarnet: 2023-0451U\n\nBr. Walter Solórzano Gaitán\nCarnet: 2023-0432U'}
              />
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>
              Un nombre + carnet por par de líneas. Arrastra chips desde la biblioteca izquierda.
            </div>
          </div>

          {/* Profesor y Grupo en fila */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <ProfesoresPanel />
            <GruposPanel />
          </div>

          {/* Fecha */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', margin: 0 }}>FECHA Y LUGAR</label>
              <button
                className="btn btn-secondary btn-xs"
                onClick={handleSetTodayDate}
                style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                <Calendar size={11} /> Hoy
              </button>
            </div>
            <input
              className="form-control"
              style={{ fontSize: '12px' }}
              value={portada.date || ''}
              onChange={e => setPortada({ date: e.target.value })}
              placeholder="Ej: 25 de junio del año 2025, Managua, Nicaragua"
            />
          </div>

        </div>
      </div>
    </div>
  );
};

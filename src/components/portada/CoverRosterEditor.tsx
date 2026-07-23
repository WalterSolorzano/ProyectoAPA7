/* WordAPA7 — Editor Dedicado de Portada con Roster de Integrantes Arrastrable (Drag & Drop) */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { useRosterStore, IntegranteItem } from '../../store/useRosterStore';
import { Users, UserPlus, Calendar, Save, Trash2, ArrowRight, ShieldCheck } from 'lucide-react';

export const CoverRosterEditor: React.FC = () => {
  const { portada, setPortada } = useDocStore();
  const {
    integrantes,
    profesores,
    grupos,
    addIntegrante,
    removeIntegrante,
    addProfesor,
    addGrupo
  } = useRosterStore();

  const [newNombre, setNewNombre] = useState('');
  const [newCarnet, setNewCarnet] = useState('');

  const handleSelectAllGroup = () => {
    const formattedAuthors = integrantes
      .map((i) => (i.carnet ? `${i.nombre} Carnet: ${i.carnet}` : i.nombre))
      .join('\n');
    setPortada({ author: formattedAuthors });
  };

  const handleSetTodayDate = () => {
    const today = new Date();
    const months = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const dateStr = `${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}, Managua, Nicaragua`;
    setPortada({ date: dateStr });
  };

  const handleAddCustomIntegrante = () => {
    if (newNombre.trim()) {
      addIntegrante(newNombre.trim(), newCarnet.trim());
      setNewNombre('');
      setNewCarnet('');
    }
  };

  const handleDragStart = (e: React.DragEvent, item: IntegranteItem) => {
    const str = item.carnet ? `${item.nombre} Carnet: ${item.carnet}` : item.nombre;
    e.dataTransfer.setData('text/plain', str);
  };

  const handleDropOnAuthors = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedText = e.dataTransfer.getData('text/plain');
    if (droppedText) {
      const current = portada.author || '';
      const updated = current ? `${current}\n${droppedText}` : droppedText;
      setPortada({ author: updated });
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', height: '100%', padding: '16px' }}>
      
      {/* Panel Izquierdo: Roster Persistente de Integrantes */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--word-blue)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={16} /> MIS INTEGRANTES (Arrastrables)
          </h3>
        </div>

        {/* Botón Acción Rápida: Seleccionar Todo el Grupo */}
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSelectAllGroup}
          style={{ width: '100%', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: 'var(--word-blue)' }}
        >
          <span>Seleccionar Todo el Grupo</span>
          <ArrowRight size={13} />
        </button>

        {/* Lista de Chips Arrastrables de Integrantes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
          {integrantes.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                transition: 'all 0.15s ease'
              }}
            >
              <div>
                <strong style={{ display: 'block', color: '#0f172a' }}>{item.nombre}</strong>
                {item.carnet && <span style={{ fontSize: '10px', color: '#64748b' }}>Carnet: {item.carnet}</span>}
              </div>
              <button
                style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                onClick={() => removeIntegrante(item.id)}
                title="Eliminar de mis integrantes"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Formulario para Agregar Nuevo Integrante al Roster */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>+ Agregar Nuevo Integrante</span>
          <input
            type="text"
            className="form-control"
            style={{ fontSize: '11px', padding: '4px 8px' }}
            placeholder="Nombre completo (ej: Br. Juan Pérez)"
            value={newNombre}
            onChange={(e) => setNewNombre(e.target.value)}
          />
          <input
            type="text"
            className="form-control"
            style={{ fontSize: '11px', padding: '4px 8px' }}
            placeholder="Carnet (opcional)"
            value={newCarnet}
            onChange={(e) => setNewCarnet(e.target.value)}
          />
          <button
            className="btn btn-secondary btn-xs"
            onClick={handleAddCustomIntegrante}
            style={{ width: '100%', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          >
            <UserPlus size={12} /> Guardar en Roster
          </button>
        </div>
      </div>

      {/* Lienzo Derecho: Formulario Interactivo de Portada con Slots Drop Targets */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Editor Personalizado de Datos de Portada
          </h3>
          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={14} /> Preserva Layout Institucional
          </span>
        </div>

        {/* Campo Tema / Título */}
        <div>
          <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Título del Trabajo / Tema</label>
          <input
            type="text"
            className="form-control"
            style={{ fontSize: '12px', fontWeight: 600 }}
            value={portada.title || ''}
            onChange={(e) => setPortada({ title: e.target.value })}
            placeholder="Ej: Análisis de Sistemas Académicos en APA 7"
          />
        </div>

        {/* Campo Autores con Drop Target Zone */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>
              Elaborado por (Autores / Integrantes)
            </label>
            <span style={{ fontSize: '10px', color: 'var(--word-blue)' }}>Arrastra chips aquí</span>
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropOnAuthors}
            style={{
              borderRadius: '6px',
              border: '2px dashed var(--word-blue)',
              backgroundColor: '#f0f9ff',
              padding: '6px'
            }}
          >
            <textarea
              className="form-control"
              rows={5}
              style={{ fontSize: '12px', backgroundColor: '#ffffff' }}
              value={portada.author || ''}
              onChange={(e) => setPortada({ author: e.target.value })}
              placeholder="Ej:\nBr. Wilmary Díaz Carnet: 2023-0802I\nBr. Walter Solórzano Carnet: 2023-0432U"
            />
          </div>
        </div>

        {/* Campo Tutor */}
        <div>
          <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Docente / Tutor</label>
          <input
            type="text"
            className="form-control"
            style={{ fontSize: '12px' }}
            value={portada.instructor || ''}
            onChange={(e) => setPortada({ instructor: e.target.value })}
            placeholder="Ej: Ing. Hason Enoc Vivas Pavón"
          />
        </div>

        {/* Campo Fecha y Lugar con Botón Rápido [Hoy] */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>
              Fecha y Lugar
            </label>
            <button
              className="btn btn-secondary btn-xs"
              onClick={handleSetTodayDate}
              style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Calendar size={11} /> Usar Fecha [Hoy]
            </button>
          </div>
          <input
            type="text"
            className="form-control"
            style={{ fontSize: '12px' }}
            value={portada.date || ''}
            onChange={(e) => setPortada({ date: e.target.value })}
            placeholder="Ej: 15 de junio de 2026, Managua, Nicaragua"
          />
        </div>

      </div>
    </div>
  );
};

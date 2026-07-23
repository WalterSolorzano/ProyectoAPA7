/* WordAPA7 — Portada Configurator Component con Opción de Exclusión de Portada Original sin Emojis */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Save } from 'lucide-react';

export const PortadaView: React.FC = () => {
  const { portada, setPortada, savePortadaProfile, loadPortadaProfile, portadaProfiles } = useDocStore();
  const [profileName, setProfileName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const useOriginal = portada.use_original_cover !== false;

  const handleToggleMode = (useOrig: boolean) => {
    setPortada({ use_original_cover: useOrig });
  };

  const handleSaveProfile = () => {
    if (!profileName.trim()) return;
    savePortadaProfile(profileName.trim());
    setProfileName('');
    setShowSaveDialog(false);
  };

  return (
    <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Configuración de Portada</h2>

        <div style={{ display: 'flex', gap: '6px' }}>
          {portadaProfiles.length > 0 && (
            <select
              className="form-select"
              style={{ padding: '4px 8px', fontSize: '12px', width: 'auto' }}
              value=""
              onChange={(e) => {
                if (e.target.value) loadPortadaProfile(e.target.value);
              }}
            >
              <option value="">Cargar perfil...</option>
              {portadaProfiles.map((p: any, idx: number) => (
                <option key={idx} value={p.title || p.profile_name}>
                  {p.title || p.profile_name}
                </option>
              ))}
            </select>
          )}
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setShowSaveDialog(true)}
            title="Guardar configuración de portada como perfil"
          >
            <Save size={14} style={{ marginRight: '4px' }} />
            Guardar Perfil
          </button>
        </div>
      </div>

      {showSaveDialog && (
        <div className="card" style={{ marginBottom: '16px', border: '1px solid var(--word-blue)' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Guardar Perfil de Portada</h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Nombre del perfil (ej: Mi Universidad - Grupo A)"
              className="form-control"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
            <button className="btn btn-primary btn-sm" onClick={handleSaveProfile}>
              Guardar
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowSaveDialog(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Opción Destacada: Excluir la Portada Original de todos los Ajustes */}
      <div className="card" style={{ marginBottom: '24px', backgroundColor: useOriginal ? '#eff6fc' : '#ffffff', borderColor: useOriginal ? 'var(--word-blue)' : 'var(--border-color)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--word-blue)', marginBottom: '12px' }}>
          Estrategia de Portada del Documento
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="cover_strategy"
              checked={useOriginal}
              onChange={() => handleToggleMode(true)}
              style={{ marginTop: '3px' }}
            />
            <div>
              <strong style={{ fontSize: '13px', display: 'block', color: 'var(--text-main)' }}>
                CONSERVAR PORTADA ORIGINAL INTACTA (RECOMENDADO)
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Excluye la portada original (logos, cuadros de texto de integrantes, tutores y grupo) de todos los ajustes APA 7. Tu portada se mantendrá 100% idéntica a tu archivo de Word sin modificar nada.
              </span>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="cover_strategy"
              checked={!useOriginal}
              onChange={() => handleToggleMode(false)}
              style={{ marginTop: '3px' }}
            />
            <div>
              <strong style={{ fontSize: '13px', display: 'block', color: 'var(--text-main)' }}>
                GENERAR NUEVA PORTADA SINTÉTICA APA 7
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Reemplaza la portada del archivo por una portada nueva en formato APA 7 estándar usando el formulario de abajo.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Formulario de Portada Sintética (Solo activo si useOriginal es false) */}
      {!useOriginal && (
        <>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Modalidad de Portada APA 7</h3>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="apa_format"
                  checked={portada.apa_format === 'student'}
                  onChange={() => setPortada({ apa_format: 'student' })}
                />
                <span style={{ fontSize: '13px' }}>Formato Estudiante</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="apa_format"
                  checked={portada.apa_format === 'professional'}
                  onChange={() => setPortada({ apa_format: 'professional' })}
                />
                <span style={{ fontSize: '13px' }}>Formato Profesional</span>
              </label>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Campos de la Portada</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label">Título del Trabajo</label>
                <input
                  type="text"
                  className="form-control"
                  value={portada.title}
                  onChange={(e) => setPortada({ title: e.target.value })}
                  placeholder="Ej: Análisis de Razones Financieras"
                />
              </div>

              <div>
                <label className="form-label">Autor(es) / Integrantes</label>
                <input
                  type="text"
                  className="form-control"
                  value={portada.author}
                  onChange={(e) => setPortada({ author: e.target.value })}
                  placeholder="Ej: Wilmary Díaz, Walter Solórzano, Alexa Doña"
                />
              </div>

              <div>
                <label className="form-label">Institución / Universidad</label>
                <input
                  type="text"
                  className="form-control"
                  value={portada.institution}
                  onChange={(e) => setPortada({ institution: e.target.value })}
                  placeholder="Ej: Universidad Nacional de Ingeniería"
                />
              </div>

              {portada.apa_format === 'student' && (
                <>
                  <div>
                    <label className="form-label">Curso / Asignatura</label>
                    <input
                      type="text"
                      className="form-control"
                      value={portada.course || ''}
                      onChange={(e) => setPortada({ course: e.target.value })}
                      placeholder="Ej: Contabilidad Gerencial (4M6-IND)"
                    />
                  </div>

                  <div>
                    <label className="form-label">Docente / Instructor / Tutor</label>
                    <input
                      type="text"
                      className="form-control"
                      value={portada.instructor || ''}
                      onChange={(e) => setPortada({ instructor: e.target.value })}
                      placeholder="Ej: Ing. Hason Enoc Vivas Pavón"
                    />
                  </div>

                  <div>
                    <label className="form-label">Fecha</label>
                    <input
                      type="text"
                      className="form-control"
                      value={portada.date || ''}
                      onChange={(e) => setPortada({ date: e.target.value })}
                      placeholder="Ej: 15 de junio de 2026"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

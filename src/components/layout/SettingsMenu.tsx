/* WordAPA7 — Panel "Configuraciones" fullscreen estilo apps modernas.
 * Overlay a pantalla completa con navegación por secciones (2 columnas):
 * lista izquierda fija + contenido scrolleable derecha.
 * Migra todas las opciones del antiguo popover Notion-style:
 * ajustes de formato/vista previa, IA, sugerencias proactivas,
 * marcas visibles, tema, complemento de Word, acerca de / legal / privacidad.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Modal } from '../ui/wordapa7';
import { getSideloadStatus, repairSideload, SideloadStatus } from '../../api/backend';
import {
  Settings2, Info, Scale, FileText, Bug, X, Cpu, ExternalLink, MessageSquare,
  Palette, Puzzle, Sun, Moon, RefreshCw,
} from 'lucide-react';

type SettingsSectionId = 'general' | 'asistente' | 'apariencia' | 'complemento' | 'acerca';
type ModalPage = 'about' | 'legal' | 'privacy' | null;

const SECTIONS: { id: SettingsSectionId; label: string; icon: React.ReactNode; title: string }[] = [
  { id: 'general', label: 'General', icon: <Settings2 size={18} />, title: 'General' },
  { id: 'asistente', label: 'Asistente', icon: <Cpu size={18} />, title: 'Asistente' },
  { id: 'apariencia', label: 'Apariencia', icon: <Palette size={18} />, title: 'Apariencia' },
  { id: 'complemento', label: 'Complemento Word', icon: <Puzzle size={18} />, title: 'Complemento de Word' },
  { id: 'acerca', label: 'Acerca de', icon: <Info size={18} />, title: 'Acerca de WordAPA7' },
];

const VERSION = '1.0.0';

export const SettingsMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<SettingsSectionId>('general');
  const [modalPage, setModalPage] = useState<ModalPage>(null);

  // Estado reactivo del store (solo lectura; setters vía getState() imperativo)
  const sugerenciasProactivas = useDocStore((s) => s.sugerenciasProactivas !== false);
  const marcasVisibles = useDocStore((s) => s.marcasVisibles !== false);
  const theme = useDocStore((s) => s.theme);

  // ── T6: estado del complemento de Word (misma API que el chip del toolbar) ──
  const [sideload, setSideload] = useState<SideloadStatus | null>(null);
  const refreshSideload = React.useCallback(() => {
    getSideloadStatus().then(setSideload).catch(() => setSideload(null));
  }, []);
  useEffect(() => {
    if (section === 'complemento') refreshSideload();
  }, [section, refreshSideload]);

  // Esc cierra · click fuera del shell cierra
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    if (shellRef.current && !shellRef.current.contains(e.target as Node)) onClose();
  };

  const sideloadState: 'active' | 'outdated' | 'missing' | null = !sideload
    ? null
    : sideload.installed
      ? (sideload.up_to_date ? 'active' : 'outdated')
      : 'missing';

  const handleRepairSideload = async () => {
    try {
      await repairSideload();
      useDocStore.getState().showToast('Complemento de Word reparado', 'success');
    } catch {
      useDocStore.getState().showToast('No se pudo reparar el complemento', 'error');
    } finally {
      refreshSideload();
    }
  };

  const openStudio = (tab: 'format' | 'ai') => {
    useDocStore.getState().setSettingsStudioOpen(true, tab);
    onClose();
  };

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        backgroundColor: 'var(--app-bg)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'center',
        padding: 'var(--space-6)',
      }}
    >
      <div ref={shellRef} style={{
        display: 'flex', flexDirection: 'column',
        width: '100%', maxWidth: '960px',
        backgroundColor: 'var(--sidebar-bg)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: 'var(--radius-md)',
            background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Settings2 size={15} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-main)' }}>Configuraciones</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginLeft: '8px' }}>WordAPA7 · v{VERSION}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar configuraciones"
            title="Cerrar (Esc)"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-sm)', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body: nav izquierda + contenido derecha */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Nav */}
          <nav style={{
            width: '260px', flexShrink: 0,
            borderRight: '1px solid var(--border-subtle)',
            padding: 'var(--space-3)',
            display: 'flex', flexDirection: 'column', gap: '2px',
            overflowY: 'auto',
          }}>
            {SECTIONS.map((s) => {
              const active = section === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  aria-current={active ? 'true' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px',
                    background: active ? 'var(--color-accent-soft)' : 'transparent',
                    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    border: 'none',
                    borderLeft: active ? '3px solid var(--accent-primary)' : '3px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-sm)', fontWeight: active ? 700 : 500,
                    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-subtle)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  {s.icon}
                  {s.label}
                </button>
              );
            })}
          </nav>

          {/* Contenido */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 'var(--space-6)' }}>
            {section === 'general' && (
              <>
                <h2 style={sectionTitle}>General</h2>
                <SettingRow
                  icon={<MessageSquare size={16} color="var(--accent-primary)" />}
                  label="Sugerencias proactivas"
                  hint="Globos con mejoras mientras editás"
                >
                  <Switch on={sugerenciasProactivas} onChange={(v) => useDocStore.getState().setSugerenciasProactivas(v)} />
                </SettingRow>
                <SettingRow
                  icon={<FileText size={16} color="var(--accent-primary)" />}
                  label="Marcas visibles"
                  hint="Resaltado de marcas y comentarios en la vista previa"
                >
                  <Switch on={marcasVisibles} onChange={(v) => useDocStore.getState().setMarcasVisibles(v)} />
                </SettingRow>
                <SettingRow
                  icon={<Bug size={16} color="var(--accent-danger)" />}
                  label="Reportar un problema"
                  hint="Abrí un correo con los detalles del error"
                >
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => window.open('mailto:wordapa7@example.com?subject=Reporte%20de%20problema%20WordAPA7', '_blank')}
                  >
                    Reportar <ExternalLink size={12} />
                  </button>
                </SettingRow>
              </>
            )}

            {section === 'asistente' && (
              <>
                <h2 style={sectionTitle}>Asistente</h2>
                <p style={sectionText}>
                  Configurá proveedores y claves de inteligencia artificial para el
                  reclasificado fino de elementos y las sugerencias de escritura.
                </p>
                <button type="button" className="btn btn-primary" onClick={() => openStudio('ai')}>
                  <Cpu size={15} /> Configurar inteligencia artificial
                </button>
              </>
            )}

            {section === 'apariencia' && (
              <>
                <h2 style={sectionTitle}>Apariencia</h2>
                <SettingRow
                  icon={theme === 'dark' ? <Moon size={16} color="var(--accent-primary)" /> : <Sun size={16} color="var(--accent-warning)" />}
                  label="Tema"
                  hint="Claro u oscuro"
                >
                  <div style={{ display: 'inline-flex', gap: '4px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', padding: '3px' }}>
                    {(['light', 'dark'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => useDocStore.getState().setTheme(t)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 'var(--text-xs)', fontWeight: 700,
                          background: theme === t ? 'var(--sidebar-bg)' : 'transparent',
                          color: theme === t ? 'var(--text-main)' : 'var(--text-muted)',
                          boxShadow: theme === t ? 'var(--shadow-sm)' : 'none',
                        }}
                      >
                        {t === 'light' ? <Sun size={13} /> : <Moon size={13} />}
                        {t === 'light' ? 'Claro' : 'Oscuro'}
                      </button>
                    ))}
                  </div>
                </SettingRow>
                <SettingRow
                  icon={<Palette size={16} color="var(--accent-primary)" />}
                  label="Ajustes de formato y vista previa"
                  hint="Tipografía, márgenes, portada"
                >
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openStudio('format')}>
                    Abrir <ExternalLink size={12} />
                  </button>
                </SettingRow>
              </>
            )}

            {section === 'complemento' && (
              <>
                <h2 style={sectionTitle}>Complemento de Word</h2>
                <p style={sectionText}>
                  El complemento permite formatear en vivo sin salir de Microsoft Word.
                  Si no aparece en la cinta, instalalo o reparalo desde acá.
                </p>
                {sideloadState && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '14px 16px', marginBottom: 'var(--space-4)',
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                  }}>
                    <span style={{
                      width: '9px', height: '9px', borderRadius: 'var(--radius-full)', flexShrink: 0,
                      backgroundColor: sideloadState === 'active'
                        ? 'var(--accent-success)'
                        : sideloadState === 'outdated'
                          ? 'var(--accent-warning)'
                          : 'var(--accent-danger)',
                    }} />
                    <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-main)' }}>
                      {sideloadState === 'active' && 'Complemento activo'}
                      {sideloadState === 'outdated' && 'Actualizar complemento'}
                      {sideloadState === 'missing' && 'Instalar complemento'}
                    </span>
                    {sideloadState !== 'active' && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleRepairSideload}>
                        <RefreshCw size={13} /> {sideloadState === 'missing' ? 'Instalar' : 'Reparar'}
                      </button>
                    )}
                  </div>
                )}
                {sideload?.installed_at && (
                  <p style={{ ...sectionText, marginTop: '-6px', fontSize: 'var(--text-xs)' }}>
                    Instalado en System Feed: {new Date(sideload.installed_at).toLocaleString()}
                  </p>
                )}
                <p style={{ ...sectionText, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary, var(--text-secondary))' }}>
                  ¿Sigue sin aparecer? 1) Cerrá Word COMPLETO (revisá la bandeja del reloj). 2) Abrí Word de nuevo y mirá la pestaña del complemento. Si persiste, usá "Reparar instalación" con Word cerrado.
                </p>
                <button type="button" className="btn btn-secondary" onClick={handleRepairSideload}>
                  <RefreshCw size={14} /> Reparar instalación
                </button>
              </>
            )}

            {section === 'acerca' && (
              <>
                <h2 style={sectionTitle}>Acerca de WordAPA7</h2>
                <SettingRow
                  icon={<Info size={16} color="var(--accent-success)" />}
                  label="Acerca de WordAPA7"
                  hint={`Versión ${VERSION}`}
                >
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalPage('about')}>
                    Ver
                  </button>
                </SettingRow>
                <SettingRow
                  icon={<Scale size={16} color="var(--text-secondary)" />}
                  label="Cuestiones legales"
                  hint="Términos de uso y avisos"
                >
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalPage('legal')}>
                    Ver
                  </button>
                </SettingRow>
                <SettingRow
                  icon={<FileText size={16} color="var(--accent-primary)" />}
                  label="Privacidad de datos"
                  hint="Qué se sube y qué se guarda"
                >
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalPage('privacy')}>
                    Ver
                  </button>
                </SettingRow>
                <p style={{ ...sectionText, marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
                  Ayuda a formatear, no garantiza la aprobación de un docente.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modales internos */}
      <AboutModal open={modalPage === 'about'} onClose={() => setModalPage(null)} />
      <LegalModal open={modalPage === 'legal'} onClose={() => setModalPage(null)} title="Cuestiones legales" />
      <LegalModal open={modalPage === 'privacy'} onClose={() => setModalPage(null)} title="Privacidad de datos" privacy />
    </div>
  );
};

const sectionTitle: React.CSSProperties = {
  fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-main)',
  margin: '0 0 var(--space-5)',
};

const sectionText: React.CSSProperties = {
  fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6,
  margin: '0 0 var(--space-4)', maxWidth: '520px',
};

const SettingRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  hint?: string;
  children?: React.ReactNode;
}> = ({ icon, label, hint, children }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 0', borderBottom: '1px solid var(--border-subtle)',
  }}>
    <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-main)' }}>{label}</span>
      {hint && (
        <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>{hint}</span>
      )}
    </span>
    {children}
  </div>
);

const Switch: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    style={{
      position: 'relative', width: '38px', height: '22px', flexShrink: 0,
      borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer', padding: 0,
      background: on ? 'var(--accent-primary)' : 'var(--border-strong)',
      transition: 'background 0.15s ease',
    }}
  >
    <span style={{
      position: 'absolute', top: '3px', left: on ? '19px' : '3px',
      width: '16px', height: '16px', borderRadius: 'var(--radius-full)',
      backgroundColor: '#fff',
      boxShadow: 'var(--shadow-sm)',
      transition: 'left 0.15s ease',
    }} />
  </button>
);

const AboutModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <Modal open={open} onClose={onClose} style={{ maxWidth: '480px' }}>
    <div style={{ padding: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-4)' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: 'var(--radius-lg)',
          background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FileText size={22} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-main)' }}>WordAPA7</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Versión {VERSION}</div>
        </div>
      </div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 var(--space-4)' }}>
        WordAPA7 convierte documentos de Microsoft Word (.docx) al formato APA 7ª edición:
        clasifica títulos, párrafos, tablas, figuras y citas; arma la portada y las
        referencias; y exporta el documento final ya formateado.
      </p>
      <button type="button" className="btn btn-primary" onClick={onClose} style={{ alignSelf: 'flex-end' }}>
        Cerrar
      </button>
    </div>
  </Modal>
);

const LegalModal: React.FC<{ open: boolean; onClose: () => void; title: string; privacy?: boolean }> = ({ open, onClose, title, privacy }) => (
  <Modal open={open} onClose={onClose} style={{ maxWidth: '520px' }}>
    <div style={{ padding: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 var(--space-3)' }}>{title}</h2>
      {privacy ? (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 var(--space-4)' }}>
          <p style={{ margin: '0 0 10px' }}>
            El documento que subís se procesa localmente en tu computadora. El análisis de
            formato (clasificación de elementos) puede enviar fragmentos de texto a un proveedor
            de IA solo si activás una API key y lo aceptás explícitamente.
          </p>
          <p style={{ margin: '0 0 10px' }}>
            Las sesiones se guardan localmente en la carpeta <code style={{ fontSize: 'var(--text-xs)', background: 'var(--surface-subtle)', padding: '1px 4px', borderRadius: 'var(--radius-sm)' }}>storage/sessions</code> de tu máquina para poder recuperar documentos recientes.
          </p>
          <p style={{ margin: 0 }}>No se venden ni comparten datos personales con terceros.</p>
        </div>
      ) : (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 var(--space-4)' }}>
          <p style={{ margin: '0 0 10px' }}>
            WordAPA7 es una herramienta de asistencia de formato académico. No sustituye el
            criterio de un docente, institución o comité evaluador.
          </p>
          <p style={{ margin: '0 0 10px' }}>
            Las plantillas descargables y las correcciones automáticas se ofrecen "tal cual",
            sin garantías de aprobación o de cumplimiento específico de tu institución.
          </p>
          <p style={{ margin: 0 }}>Todas las marcas mencionadas (Word, APA, LibreOffice) pertenecen a sus respectivos dueños.</p>
        </div>
      )}
      <button type="button" className="btn btn-primary" onClick={onClose} style={{ alignSelf: 'flex-end' }}>
        Cerrar
      </button>
    </div>
  </Modal>
);

export default SettingsMenu;

/* WordAPA7 — Menú "Configuraciones" (estilo Notion).
 * Popover elegante que reemplaza el bloque "Ayuda a formatear" de la
 * pantalla de inicio. Incluye: ajustes de formato, preferencias de IA,
 * acerca de WordAPA7, privacidad / cuestiones legales y reportar un problema.
 */

import React, { useEffect, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Modal } from '../ui/wordapa7';
import {
  Settings2, Info, Scale, FileText, Bug, X, ChevronRight, Cpu, ExternalLink,
} from 'lucide-react';

type MenuPage = 'root' | 'about' | 'legal' | 'privacy';

interface Section {
  title?: string;
  items: { id: string; icon: React.ReactNode; label: string; hint?: string }[];
}

const SECTIONS: Section[] = [
  {
    title: 'Preferencias',
    items: [
      { id: 'settings', icon: <Settings2 size={15} color="var(--accent-primary)" />, label: 'Ajustes de formato y vista previa', hint: 'Tipografía, márgenes, portada' },
      { id: 'ai', icon: <Cpu size={15} color="var(--accent-primary)" />, label: 'Inteligencia artificial', hint: 'Claves y proveedores de IA' },
    ],
  },
  {
    title: 'Sobre WordAPA7',
    items: [
      { id: 'about', icon: <Info size={15} color="var(--accent-success)" />, label: 'Acerca de WordAPA7', hint: 'Versión, equipo y agradecimientos' },
      { id: 'legal', icon: <Scale size={15} color="var(--text-secondary)" />, label: 'Cuestiones legales', hint: 'Términos de uso y avisos' },
      { id: 'privacy', icon: <FileText size={15} color="var(--text-secondary)" />, label: 'Privacidad de datos', hint: 'Qué se sube y qué se guarda' },
    ],
  },
];

const VERSION = '1.0.0';

export const SettingsMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [page, setPage] = React.useState<MenuPage>('root');

  useEffect(() => {
    const closeOnOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [onClose]);

  const handleItem = (id: string) => {
    if (id === 'settings') {
      useDocStore.getState().setSettingsStudioOpen(true);
      onClose();
      return;
    }
    if (id === 'ai') {
      useDocStore.getState().setSettingsStudioOpen(true);
      onClose();
      return;
    }
    setPage(id as MenuPage);
  };

  const closeModal = () => { setPage('root'); onClose(); };

  return (
    <>
      {/* Popover principal */}
      <div
        ref={ref}
        className="settings-menu-pop"
        style={{
          position: 'fixed',
          left: '12px',
          bottom: '76px',
          width: '320px',
          maxHeight: 'min(560px, calc(100vh - 110px))',
          overflowY: 'auto',
          backgroundColor: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 400,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(79,124,255,0.06)',
        }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '7px',
            background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Settings2 size={14} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Configuraciones</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>WordAPA7 · v{VERSION}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '10px', overflowY: 'auto' }}>
          {SECTIONS.map((section) => (
            <React.Fragment key={section.title}>
              {section.title && (
                <div style={{
                  fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px',
                  color: 'var(--text-muted)', padding: '8px 10px 4px',
                }}>
                  {section.title}
                </div>
              )}
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="settings-menu-item"
                  onClick={() => handleItem(item.id)}
                >
                  <span style={{ flexShrink: 0, display: 'flex' }}>{item.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block' }}>{item.label}</span>
                    {item.hint && (
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                        {item.hint}
                      </span>
                    )}
                  </span>
                  <ChevronRight size={13} className="settings-menu-chevron" style={{ color: 'var(--text-muted)' }} />
                </button>
              ))}
            </React.Fragment>
          ))}

          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '8px', paddingTop: '8px' }}>
            <button
              type="button"
              className="settings-menu-item"
              onClick={() => window.open('mailto:wordapa7@example.com?subject=Reporte%20de%20problema%20WordAPA7', '_blank')}
            >
              <Bug size={15} color="var(--accent-danger)" />
              <span style={{ flex: 1 }}>Reportar un problema</span>
              <ExternalLink size={12} className="settings-menu-chevron" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 16px', borderTop: '1px solid var(--border-subtle)',
          fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.5,
          background: 'var(--surface-subtle)',
        }}>
          Ayuda a formatear, no garantiza la aprobación de un docente.
        </div>
      </div>

      {/* Modales internos */}
      <AboutModal open={page === 'about'} onClose={closeModal} />
      <LegalModal open={page === 'legal'} onClose={closeModal} title="Cuestiones legales" />
      <LegalModal open={page === 'privacy'} onClose={closeModal} title="Privacidad de datos" privacy />
    </>
  );
};

const AboutModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <Modal open={open} onClose={onClose} style={{ maxWidth: '480px' }}>
    <div style={{ padding: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-4)' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FileText size={22} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>WordAPA7</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Versión {VERSION}</div>
        </div>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 var(--space-4)' }}>
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
      <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 var(--space-3)' }}>{title}</h2>
      {privacy ? (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 var(--space-4)' }}>
          <p style={{ margin: '0 0 10px' }}>
            El documento que subís se procesa localmente en tu computadora. El análisis de
            formato (clasificación de elementos) puede enviar fragmentos de texto a un proveedor
            de IA solo si activás una API key y lo aceptás explícitamente.
          </p>
          <p style={{ margin: '0 0 10px' }}>
            Las sesiones se guardan localmente en la carpeta <code style={{ fontSize: '11px', background: 'var(--surface-subtle)', padding: '1px 4px', borderRadius: '4px' }}>storage/sessions</code> de tu máquina para poder recuperar documentos recientes.
          </p>
          <p style={{ margin: 0 }}>No se venden ni comparten datos personales con terceros.</p>
        </div>
      ) : (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 var(--space-4)' }}>
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

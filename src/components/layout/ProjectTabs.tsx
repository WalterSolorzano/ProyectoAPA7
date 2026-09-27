/* WordAPA7 — Multi-Project Tabs Avanzado (Fluent Design) */

import React, { useRef, useState, useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { parseDocumentVersion } from '../../lib/projectUtils';
import { MergeDocumentsModal } from '../project/MergeDocumentsModal';
import { ProjectImagesDrawer } from '../project/ProjectImagesDrawer';
import { ProjectFolderModal } from '../project/ProjectFolderModal';

export const ProjectTabs: React.FC = () => {
  const {
    tabs, activeTabIndex,
    switchToTab, removeTab, uploadFile, isLoading, projectImages
  } = useDocStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [imagesDrawerOpen, setImagesDrawerOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Cerrar el overflow al click afuera
  useEffect(() => {
    if (!overflowOpen) return;
    const onDown = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [overflowOpen]);

  /* Con una sola pestaña el STRIP solo sirve para navegar entre proyectos, y el
     nombre del proyecto ya vive en la topbar: con un documento abierto no se
     dibuja la lista.

     El overflow NO se cuelga de ese guard. "Carpeta" (el Explorador de
     Proyecto, `AGENTS.md` §5) y "Imágenes" son de un documento, no de dos, y
     estos tres modales solo se montan acá: con el guard antes de todo el
     return, quedaban inalcanzables en el estado más común de la app. El guard
     va donde corresponde — sobre el strip —, no sobre la pantalla entera. */
  const showStrip = tabs.length >= 2;
  // Cero documentos: no hay proyecto al que abrirle la carpeta, así que la
  // barra entera no se dibuja. El caso de UNO sí se dibuja, porque el Explorador
  // y el cajón de imágenes son de un documento, no de dos.
  if (tabs.length === 0) return null;

  const handleNewTab = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
      e.target.value = '';
    }
  };

  // Extraer el nombre de proyecto dominante del tab activo
  const activeTab = tabs[activeTabIndex];
  const activeParsed = activeTab ? parseDocumentVersion(activeTab.file_name) : null;

  return (
    <>
      {/* Con un solo documento la barra es solo el botón de desborde: es el que
          abre el Explorador y el cajón de imágenes, y ninguno tiene otro
          camino. */}
      <div className="project-tabs-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '8px' }}>
        {showStrip && (
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {/* Chip de Proyecto Dominante */}
          {activeParsed && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                marginRight: '6px',
                marginLeft: '4px',
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--accent-primary)',
                flexShrink: 0,
              }}
              title="Proyecto activo agrupado"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>{activeParsed.projectName}</span>
            </div>
          )}

          {/* Lista de Pestañas con versión */}
          <div className="project-tabs-list">
            {tabs.map((tab, index) => {
              const isActive = index === activeTabIndex;
              const parsed = parseDocumentVersion(tab.file_name);
              return (
                <button
                  key={tab.session_id}
                  className={`project-tab${isActive ? ' active' : ''}`}
                  onClick={() => switchToTab(index)}
                  title={tab.file_name}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span className="project-tab-label">{tab.file_name}</span>
                  {/* Badge de versión */}
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--surface-alt)',
                      color: isActive ? '#ffffff' : 'var(--text-secondary)',
                      lineHeight: 1.2,
                    }}
                  >
                    {parsed.versionLabel}
                  </span>

                  {tabs.length > 1 && (
                    <span
                      className="project-tab-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTab(index);
                      }}
                      title="Cerrar pestaña"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            className="project-tab-new"
            onClick={handleNewTab}
            disabled={isLoading}
            title="Abrir otra versión (.docx)"
            style={{ marginLeft: '4px' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
        )}

        {/* Acciones de Colaboración de Proyecto — agrupadas en overflow para
            no ocupar la barra cuando no son relevantes */}
        <div ref={overflowRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setOverflowOpen(!overflowOpen)}
            aria-label="Más acciones del proyecto"
            aria-expanded={overflowOpen}
            title="Carpeta, imágenes y combinación del proyecto"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '3px 6px',
              background: overflowOpen ? 'var(--color-accent-soft)' : 'var(--surface-subtle)',
              border: `1px solid ${overflowOpen ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-sm)',
              color: overflowOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <circle cx="5" cy="12" r="1"></circle>
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
            </svg>
          </button>

          {overflowOpen && (
            <div
              style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60,
                minWidth: '210px', backgroundColor: 'var(--sidebar-bg)',
                border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)', padding: '6px',
                display: 'flex', flexDirection: 'column', gap: '2px',
              }}
            >
              <OverflowItem
                label={`Carpeta (${tabs.length})`}
                title="Explorador de archivos y carpeta del proyecto"
                onClick={() => { setOverflowOpen(false); setFolderModalOpen(true); }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
              </OverflowItem>

              <OverflowItem
                label={`Imágenes (${projectImages.length})`}
                title="Abrir carpeta de imágenes del proyecto"
                onClick={() => { setOverflowOpen(false); setImagesDrawerOpen(!imagesDrawerOpen); }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </OverflowItem>

              {tabs.length > 1 && (
                <OverflowItem
                  label="Combinar Retazos"
                  title="Combinar partes de otros .docx de tus compañeros"
                  onClick={() => { setOverflowOpen(false); setMergeModalOpen(true); }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="18" cy="18" r="3"></circle>
                    <circle cx="6" cy="6" r="3"></circle>
                    <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
                    <line x1="6" y1="9" x2="6" y2="21"></line>
                  </svg>
                </OverflowItem>
              )}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.doc"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
      </div>

      <MergeDocumentsModal
        isOpen={mergeModalOpen}
        onClose={() => setMergeModalOpen(false)}
      />

      <ProjectImagesDrawer
        isOpen={imagesDrawerOpen}
        onClose={() => setImagesDrawerOpen(false)}
      />

      <ProjectFolderModal
        isOpen={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        onOpenMerge={() => setMergeModalOpen(true)}
      />
    </>
  );
};

/** Ítem del menú overflow de proyecto (icono + etiqueta). */
const OverflowItem: React.FC<{
  label: string; title: string; onClick: () => void; children: React.ReactNode;
}> = ({ label, title, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '7px 10px', fontSize: '12px', fontWeight: 600,
      background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)',
      color: 'var(--text-main)', cursor: 'pointer', fontFamily: 'inherit',
      textAlign: 'left', width: '100%',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-subtle)')}
    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
  >
    <span style={{ color: 'var(--text-secondary)', display: 'flex', flexShrink: 0 }}>{children}</span>
    <span>{label}</span>
  </button>
);


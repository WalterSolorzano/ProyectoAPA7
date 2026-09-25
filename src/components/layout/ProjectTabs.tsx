/* WordAPA7 — Multi-Project Tabs Avanzado (Fluent Design) */

import React, { useRef, useState } from 'react';
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
      <div className="project-tabs-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '8px' }}>
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

        {/* Acciones de Colaboración de Proyecto */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {tabs.length > 1 && (
            <button
              type="button"
              onClick={() => setMergeModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 600,
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              title="Combinar partes de otros .docx de tus compañeros"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="18" r="3"></circle>
                <circle cx="6" cy="6" r="3"></circle>
                <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
                <line x1="6" y1="9" x2="6" y2="21"></line>
              </svg>
              <span>Combinar Retazos</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setFolderModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 600,
              background: folderModalOpen ? 'var(--color-accent-soft)' : 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: folderModalOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title="Explorador de archivos y carpeta del proyecto"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Carpeta ({tabs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setImagesDrawerOpen(!imagesDrawerOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 600,
              background: imagesDrawerOpen ? 'var(--color-accent-soft)' : 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: imagesDrawerOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title="Abrir carpeta de imágenes del proyecto"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>Imágenes ({projectImages.length})</span>
          </button>
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


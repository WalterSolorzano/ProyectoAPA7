import React, { useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { parseDocumentVersion } from '../../lib/projectUtils';
import { Folder, FolderSearch, FileText, Image as ImageIcon, Plus, ExternalLink, X, Check, Layers } from 'lucide-react';

interface ProjectFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMerge?: () => void;
}

export const ProjectFolderModal: React.FC<ProjectFolderModalProps> = ({
  isOpen,
  onClose,
  onOpenMerge,
}) => {
  const {
    tabs,
    activeTabIndex,
    switchToTab,
    removeTab,
    uploadFile,
    isLoading,
    projectImages,
    addProjectImage,
    activeFilePath,
    showToast,
  } = useDocStore();

  const fileDocxRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const activeTab = tabs[activeTabIndex];
  const activeParsed = activeTab ? parseDocumentVersion(activeTab.file_name) : null;
  const projectName = activeParsed?.projectName || 'Proyecto APA 7';

  const handleSelectFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const docxFiles = files.filter((f) => f.name.toLowerCase().endsWith('.docx'));
    const imgFiles = files.filter((f) => /\.(png|jpe?g|webp|svg)$/i.test(f.name));

    // Cargar imágenes detectadas en la carpeta
    for (const img of imgFiles) {
      addProjectImage(img);
    }

    if (docxFiles.length > 0) {
      showToast(`Cargando ${docxFiles.length} documento(s) de la carpeta...`, 'info');
      // Subir el primer archivo como principal
      await uploadFile(docxFiles[0]);
      // Los demás se pueden agregar secuencialmente
      for (let i = 1; i < docxFiles.length; i++) {
        await uploadFile(docxFiles[i]);
      }
      showToast(`Carpeta vinculada: ${docxFiles.length} docx y ${imgFiles.length} imágenes`, 'success');
    } else {
      showToast(`Carpeta escaneada: ${imgFiles.length} imágenes añadidas`, 'info');
    }

    e.target.value = '';
  };

  const handleAddDocx = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
      showToast(`Documento "${file.name}" agregado al proyecto`, 'success');
      e.target.value = '';
    }
  };

  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      addProjectImage(f);
    }
    if (files.length > 0) {
      showToast(`${files.length} imagen(es) agregada(s) al proyecto`, 'success');
    }
    e.target.value = '';
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '560px',
          maxHeight: '85vh',
          backgroundColor: 'var(--surface-bg, #ffffff)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--surface-elevated)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-accent-soft)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Folder size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectName}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                {activeFilePath ? (
                  <>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {activeFilePath}
                    </span>
                    {(window as any).electronAPI?.showItemInFolder && (
                      <button
                        type="button"
                        onClick={() => (window as any).electronAPI.showItemInFolder(activeFilePath)}
                        title="Abrir ubicación en el Explorador de Windows"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-primary)',
                          cursor: 'pointer',
                          padding: '1px 4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '10.5px',
                          fontWeight: 600,
                        }}
                      >
                        <ExternalLink size={11} /> Abrir carpeta
                      </button>
                    )}
                  </>
                ) : (
                  <span>Carpeta de trabajo y recursos del proyecto</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              marginLeft: '8px',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Sección de Documentos */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                Documentos en este proyecto ({tabs.length})
              </span>
              <button
                type="button"
                onClick={() => fileDocxRef.current?.click()}
                disabled={isLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} />
                <span>Agregar .docx</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tabs.map((tab, idx) => {
                const isActive = idx === activeTabIndex;
                const parsed = parseDocumentVersion(tab.file_name);
                return (
                  <div
                    key={tab.session_id}
                    onClick={() => switchToTab(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      backgroundColor: isActive ? 'var(--color-accent-soft)' : 'var(--surface-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <FileText size={15} color={isActive ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: isActive ? 700 : 500,
                          color: 'var(--text-main)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tab.file_name}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '999px',
                          backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--border-subtle)',
                          color: isActive ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        {parsed.versionLabel}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isActive && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Check size={12} /> Activo
                        </span>
                      )}
                      {tabs.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTab(idx);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '2px',
                          }}
                          title="Cerrar versión"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sección de Recursos e Imágenes */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                Imágenes y Anexos vinculados ({projectImages.length})
              </span>
              <button
                type="button"
                onClick={() => imgInputRef.current?.click()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} />
                <span>Subir imágenes</span>
              </button>
            </div>

            {projectImages.length === 0 ? (
              <div
                style={{
                  padding: '16px',
                  textAlign: 'center',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                }}
              >
                No hay imágenes registradas aún en este proyecto. Puedes subir figuras o vincular una carpeta completa.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {projectImages.slice(0, 8).map((img) => (
                  <div
                    key={img.id}
                    style={{
                      height: '60px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      overflow: 'hidden',
                      position: 'relative',
                      backgroundColor: 'var(--surface-subtle)',
                    }}
                    title={img.name}
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pie con acciones de carpeta */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--surface-elevated)',
              color: 'var(--text-main)',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Folder size={13} />
            <span>Vincular carpeta completa...</span>
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {tabs.length > 1 && onOpenMerge && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMerge();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--surface-elevated)',
                  color: 'var(--text-main)',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Layers size={13} />
                <span>Combinar</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '11.5px', fontWeight: 700 }}
            >
              Listo
            </button>
          </div>
        </div>

        {/* Inputs ocultos */}
        <input
          ref={fileDocxRef}
          type="file"
          accept=".docx"
          style={{ display: 'none' }}
          onChange={handleAddDocx}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error atributo no estandar webkitdirectory fuera de los tipos de React
          webkitdirectory="true"
          directory=""
          multiple
          style={{ display: 'none' }}
          onChange={handleSelectFolder}
        />
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleAddImages}
        />
      </div>
    </div>
  );
};

/* WordAPA7 — File Menu (Word-style Backstage, Fluent Design) */

import React, { useState, useEffect, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { listSessions, recoverSession } from '../../api/backend';
import { SessionRecovery } from '../../types';
import {
  FileText, FilePlus, FolderOpen, Save, Download, X, ArrowLeft,
  Upload, File, Clock, Plus, HardDrive, RefreshCw,
} from 'lucide-react';

type FileMenuPage = 'home' | 'new' | 'open' | 'save' | 'export';

interface SidebarItem {
  id: FileMenuPage;
  label: string;
  icon: React.ReactNode;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: 'home', label: 'Inicio', icon: <FileText size={18} /> },
  { id: 'new', label: 'Nuevo', icon: <FilePlus size={18} /> },
  { id: 'open', label: 'Abrir', icon: <FolderOpen size={18} /> },
  { id: 'save', label: 'Guardar', icon: <Save size={18} /> },
  { id: 'export', label: 'Exportar', icon: <Download size={18} /> },
];

export const FileMenu: React.FC = () => {
  const {
    doc, tabs, activeTabIndex,
    setShowFileMenu, uploadFile, exportDocx,
    isLoading,
  } = useDocStore();
  const [page, setPage] = useState<FileMenuPage>('home');
  const [sessions, setSessions] = useState<SessionRecovery[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openFileInputRef = useRef<HTMLInputElement>(null);

  // Load sessions for "Open" page
  useEffect(() => {
    if (page === 'open') {
      setSessionsLoading(true);
      listSessions()
        .then(setSessions)
        .catch(() => setSessions([]))
        .finally(() => setSessionsLoading(false));
    }
  }, [page]);

  const handleFileSelect = (file: File) => {
    uploadFile(file);
    setPage('home');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.docx') || file.name.endsWith('.doc'))) {
      handleFileSelect(file);
    }
  };

  const handleClose = () => {
    setShowFileMenu(false);
    setPage('home');
  };

  const handleExportStandard = () => {
    exportDocx();
    handleClose();
  };

  const handleExportTracked = () => {
    // Track Changes export — delegates to standard export with track_changes enabled
    exportDocx(true);
    handleClose();
  };

  const handleOpenSession = async (sessionId: string) => {
    try {
      const recovered = await recoverSession(sessionId);
      useDocStore.setState({
        doc: recovered,
        showFileMenu: false,
        activeTab: 'classifier',
        wizardComplete: true,
        wizardStep: 1,
      });
      setPage('home');
    } catch {
      // Session recovery failed
    }
  };

  // ── Render page content ──────────────────────────────────────────────────
  const renderPageContent = () => {
    switch (page) {
      case 'home':
        return (
          <div className="filemenu-content">
            <h2 className="filemenu-heading">Informacion</h2>
            {doc ? (
              <div className="filemenu-info-card">
                <div className="filemenu-info-row">
                  <span className="filemenu-info-label">Documento:</span>
                  <span className="filemenu-info-value">{doc.file_name}</span>
                </div>
                <div className="filemenu-info-row">
                  <span className="filemenu-info-label">Sesion:</span>
                  <span className="filemenu-info-value filemenu-mono">{doc.session_id.slice(0, 8)}...</span>
                </div>
                <div className="filemenu-info-row">
                  <span className="filemenu-info-label">Formato:</span>
                  <span className="filemenu-info-value">APA 7 ({doc.apa_format === 'student' ? 'Estudiante' : 'Profesional'})</span>
                </div>
                <div className="filemenu-info-row">
                  <span className="filemenu-info-label">Elementos:</span>
                  <span className="filemenu-info-value">{doc.elements.length}</span>
                </div>
                <div className="filemenu-info-row">
                  <span className="filemenu-info-label">Pestanas abiertas:</span>
                  <span className="filemenu-info-value">{tabs.length}</span>
                </div>
              </div>
            ) : (
              <p className="filemenu-empty-text">No hay ningun documento abierto.</p>
            )}
          </div>
        );

      case 'new':
        return (
          <div className="filemenu-content">
            <h2 className="filemenu-heading">Nuevo documento</h2>
            <div className="filemenu-new-options">
              <button
                className="filemenu-new-card"
                onClick={() => {
                  if (useDocStore.getState().hasUnsavedChanges) {
                    const confirmDiscard = window.confirm("Tienes cambios sin guardar. ¿Estás seguro de que quieres crear un nuevo documento y descartarlos?");
                    if (!confirmDiscard) return;
                  }
                  
                  // Reset to wizard so user picks format before returning to Welcome
                  useDocStore.setState({
                    doc: null,
                    showFileMenu: false,
                    wizardComplete: false,
                    wizardAnswers: null,
                    activeTab: 'classifier',
                    selectedElementId: null,
                    tabs: [],
                    activeTabIndex: 0,
                    tabDocs: {},
                    references: [],
                    validationIssues: [],
                    history: [],
                    historyIndex: -1,
                    hasUnsavedChanges: false,
                  });
                  setPage('home');
                }}
              >
                <div className="filemenu-new-card-icon">
                  <File size={28} />
                </div>
                <div className="filemenu-new-card-title">Documento en blanco</div>
                <div className="filemenu-new-card-desc">Comienza con un documento vacio con formato APA 7</div>
              </button>

              <div
                className={`filemenu-dropzone${dragOver ? ' dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="filemenu-dropzone-icon">
                  <Upload size={24} />
                </div>
                <div className="filemenu-dropzone-title">Subir archivo .docx</div>
                <div className="filemenu-dropzone-subtitle">
                  Arrastra un archivo aqui o haz clic para seleccionarlo
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.doc"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
            </div>
          </div>
        );

      case 'open':
        return (
          <div className="filemenu-content">
            <h2 className="filemenu-heading">Abrir</h2>

            {/* ── Primary action: open a file from disk (like Word's File → Open) ── */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '16px 20px', borderRadius: '10px',
                border: '2px dashed #185ABD', backgroundColor: '#eff6ff',
                cursor: 'pointer', marginBottom: '24px',
                transition: 'background 0.2s',
              }}
              onClick={() => openFileInputRef.current?.click()}
            >
              <HardDrive size={28} color="#185ABD" />
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#185ABD' }}>Abrir archivo desde tu computadora</div>
                <div style={{ fontSize: '12px', color: '#475569' }}>Selecciona un .docx para cargarlo y formatearlo en APA 7</div>
              </div>
              <input
                ref={openFileInputRef}
                type="file"
                accept=".docx,.doc"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
            </div>

            {/* ── Sessions from server (recent docs) ── */}
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sesiones recientes</h3>
            {sessionsLoading ? (
              <div className="filemenu-loading">
                <div className="loading-spinner" />
                <span>Cargando sesiones...</span>
              </div>
            ) : sessions.length === 0 ? (
              <p className="filemenu-empty-text">No hay sesiones recientes disponibles.</p>
            ) : (
              <div className="filemenu-sessions-list">
                {sessions.map((session) => (
                  <button
                    key={session.session.session_id}
                    className="filemenu-session-item"
                    onClick={() => handleOpenSession(session.session.session_id)}
                  >
                    <div className="filemenu-session-icon">
                      <Clock size={18} />
                    </div>
                    <div className="filemenu-session-info">
                      <div className="filemenu-session-name">
                        {session.session.file_name}
                      </div>
                      <div className="filemenu-session-meta">
                        {session.session.element_count} elementos
                        {session.session.validation_score != null && (
                          <> — Puntuacion: {session.session.validation_score}</>
                        )}
                      </div>
                    </div>
                    <div className="filemenu-session-date">
                      {new Date(session.session.last_saved || session.session.parsed_at).toLocaleDateString('es-MX', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 'save':
        return (
          <div className="filemenu-content">
            <h2 className="filemenu-heading">Guardar documento</h2>
            <p className="filemenu-description">
              El documento se guarda automaticamente en el servidor. Usa "Exportar" para descargar el archivo .docx formateado.
            </p>
            <div className="filemenu-actions">
              <button
                className="btn btn-primary"
                onClick={handleExportStandard}
                disabled={isLoading || !doc}
              >
                <Download size={16} />
                Exportar .DOCX APA 7
              </button>
            </div>
          </div>
        );

      case 'export':
        return (
          <div className="filemenu-content">
            <h2 className="filemenu-heading">Exportar documento</h2>
            <p className="filemenu-description">
              Descarga el documento formateado segun las normas APA 7ma edicion.
            </p>
            <div className="filemenu-export-cards">
              <button
                className="filemenu-export-card"
                onClick={handleExportStandard}
                disabled={isLoading || !doc}
              >
                <div className="filemenu-export-card-icon">
                  <FileText size={24} />
                </div>
                <div className="filemenu-export-card-title">APA 7 .DOCX</div>
                <div className="filemenu-export-card-desc">
                  Documento formateado con margenes, interlineado, portada, encabezados y referencias segun APA 7
                </div>
              </button>

              <button
                className="filemenu-export-card"
                onClick={handleExportTracked}
                disabled={isLoading || !doc}
              >
                <div className="filemenu-export-card-icon">
                  <FileText size={24} />
                </div>
                <div className="filemenu-export-card-title">Control de Cambios</div>
                <div className="filemenu-export-card-desc">
                  Documento con marcas de revision (Track Changes) mostrando diferencias con el original
                </div>
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="filemenu-backstage">
      {/* Back button */}
      <div className="filemenu-topbar">
        <button className="filemenu-back-btn" onClick={handleClose} title="Volver al editor">
          <ArrowLeft size={18} />
        </button>
        <span className="filemenu-topbar-title">Archivo</span>
      </div>

      <div className="filemenu-body">
        {/* Left sidebar */}
        <div className="filemenu-sidebar">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`filemenu-sidebar-btn${page === item.id ? ' active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="filemenu-sidebar-icon">{item.icon}</span>
              <span className="filemenu-sidebar-label">{item.label}</span>
            </button>
          ))}

          <div className="filemenu-sidebar-spacer" />

          <button
            className="filemenu-sidebar-btn filemenu-sidebar-close"
            onClick={handleClose}
          >
            <span className="filemenu-sidebar-icon"><X size={18} /></span>
            <span className="filemenu-sidebar-label">Cerrar</span>
          </button>
        </div>

        {/* Right content area */}
        <div className="filemenu-main">
          {renderPageContent()}
        </div>
      </div>
    </div>
  );
};

/* WordAPA7 — Welcome Screen (Fluent Design, two-card layout) */

import React, { useState, useRef } from 'react';
import { useDocStore } from '../store/useDocStore';
import { Upload, FileText, BookOpen, GraduationCap, ArrowRight } from 'lucide-react';

export const Welcome: React.FC = () => {
  const { uploadFile, isLoading, error, setPortada } = useDocStore();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'student' | 'professional'>('student');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.docx')) {
        uploadFile(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const handleModeSelect = (mode: 'student' | 'professional') => {
    setSelectedMode(mode);
    setPortada({ apa_format: mode });
  };

  return (
    <div className="welcome-layout" style={{ backgroundColor: 'var(--app-bg)' }}>
      <style>{`
        .welcome-mode-card:hover { background-color: rgba(124,92,252,0.1) !important; }
        .welcome-mode-card.selected { border-color: var(--accent-primary) !important; }
        .welcome-dropzone { 
          background-color: rgba(255,255,255,0.03) !important; 
          border: 2px dashed rgba(255,255,255,0.12) !important; 
        }
        .welcome-dropzone.dragging { border-color: var(--accent-primary) !important; }
        .welcome-dropzone-title, .welcome-dropzone-subtitle { color: var(--text-secondary) !important; }
        .welcome-heading { color: var(--text-main) !important; }
        .welcome-step-number { background-color: var(--accent-primary) !important; color: #fff !important; border-color: var(--accent-primary) !important; }
      `}</style>
      {/* ── Left Sidebar ─────────────────────────────────────────── */}
      <div className="welcome-sidebar" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
        <div>
          <div className="welcome-brand">
            <div className="welcome-brand-icon">
              <FileText size={22} strokeWidth={2} />
            </div>
            <div>
              <div className="welcome-brand-name">WordAPA7</div>
              <div className="welcome-brand-version">Desktop Edition v1.0</div>
            </div>
          </div>

          <nav className="welcome-nav">
            <button className="welcome-nav-btn active">
              <FileText size={18} />
              Inicio
            </button>
          </nav>
        </div>

        <div className="welcome-info-card">
          <div className="text-xs font-semibold text-secondary">Norma Oficial</div>
          <div className="text-sm" style={{ marginTop: '2px' }}>
            APA 7a Edicion (2026)
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="welcome-main">
        <h2 className="welcome-heading">Bienvenido a WordAPA7</h2>
        <p className="welcome-subheading">
          Convierte tus documentos .docx de Microsoft Word al formato APA 7a edicion.
        </p>

        {/* ── 3-Step Workflow Explanation ─────────────────────────── */}
        <div className="welcome-steps">
          <div className="welcome-step">
            <div className="welcome-step-number">1</div>
            <div className="welcome-step-content">
              <h3 className="welcome-step-title">Sube tu archivo .docx</h3>
              <p className="welcome-step-desc">Importa tu documento de Word existente. El sistema analiza automaticamente su estructura.</p>
            </div>
          </div>
          <div className="welcome-step-arrow">
            <ArrowRight size={18} strokeWidth={2} />
          </div>
          <div className="welcome-step">
            <div className="welcome-step-number">2</div>
            <div className="welcome-step-content">
              <h3 className="welcome-step-title">Revisa y Edita</h3>
              <p className="welcome-step-desc">Clasifica elementos, corrige titulos, completa portada y referencias. Todo en una interfaz clara.</p>
            </div>
          </div>
          <div className="welcome-step-arrow">
            <ArrowRight size={18} strokeWidth={2} />
          </div>
          <div className="welcome-step">
            <div className="welcome-step-number">3</div>
            <div className="welcome-step-content">
              <h3 className="welcome-step-title">Exporta APA 7</h3>
              <p className="welcome-step-desc">Descarga tu documento formateado profesionalmente segun el estandar APA 7a edicion.</p>
            </div>
          </div>
        </div>

        {/* ── Mode Selection Cards ────────────────────────────────── */}
        <div className="welcome-mode-cards">
          {/* Mode A — Upload DOCX */}
          <div
            className={`welcome-mode-card${selectedMode === 'student' ? ' selected' : ''}`}
            onClick={() => handleModeSelect('student')}
          >
            <div className="welcome-mode-card-icon">
              <GraduationCap size={26} strokeWidth={2} />
            </div>
            <h3 className="welcome-mode-card-title">Formato Estudiante</h3>
            <p className="welcome-mode-card-desc">
              Para tareas universitarias, ensayos y trabajos de grado.
              Incluye pagina de titulo centrada, numero de pagina y datos del curso.
            </p>
          </div>

          {/* Mode B — Professional */}
          <div
            className={`welcome-mode-card${selectedMode === 'professional' ? ' selected' : ''}`}
            onClick={() => handleModeSelect('professional')}
          >
            <div className="welcome-mode-card-icon">
              <BookOpen size={26} strokeWidth={2} />
            </div>
            <h3 className="welcome-mode-card-title">Formato Profesional</h3>
            <p className="welcome-mode-card-desc">
              Para articulos de investigacion y publicaciones cientificas.
              Incluye Running Head, Nota de Autor y formato de revista academica.
            </p>
          </div>
        </div>

        {/* ── Dropzone ────────────────────────────────────────────── */}
        <div
          className={`welcome-dropzone${isDragging ? ' dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="welcome-dropzone-icon">
            <Upload size={28} strokeWidth={2} />
          </div>

          <p className="welcome-dropzone-title">
            Arrastra tu archivo .docx de Word aqui
          </p>
          <p className="welcome-dropzone-subtitle">
            o haz clic para explorar en tu equipo
          </p>

          <input
            ref={fileInputRef}
            id="welcome-file-input"
            type="file"
            accept=".docx"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* ── Loading State ───────────────────────────────────────── */}
        {isLoading && (
          <div style={{ marginTop: '24px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <span className="loading-spinner" />
            <span style={{ color: 'var(--accent)', fontWeight: 500, fontSize: '14px' }}>
              Cargando y clasificando elementos del documento...
            </span>
          </div>
        )}

        {/* ── Error State ─────────────────────────────────────────── */}
        {error && (
          <div style={{ marginTop: '24px', textAlign: 'center', color: 'var(--status-red)', fontWeight: 600, fontSize: '14px' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

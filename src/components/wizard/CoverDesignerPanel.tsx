/* WordAPA7 — Cover Designer Panel (Disenador de Portadas) */

import React, { useState, useEffect, useCallback } from 'react';
import { useDocStore } from '../../store/useDocStore';
import {
  Layout,
  Image,
  FileText,
  Trash2,
  Plus,
  Check,
  Upload,
  X,
  Sparkles,
} from 'lucide-react';
import * as api from '../../api/backend';
import type { CoverTemplateInfo } from '../../api/backend';

/* ─── Estilos locales (glassmorphism + Word colores) ──────────────────────── */

const theme = {
  bg: '#f0f2f5',
  cardBg: '#ffffff',
  border: '#e0e4e8',
  primary: '#2563eb',
  primaryHover: '#1d4ed8',
  primaryLight: '#eff6ff',
  text: '#1e293b',
  textMuted: '#64748b',
  success: '#16a34a',
  danger: '#dc2626',
  dangerHover: '#b91c1c',
  radius: '10px',
  shadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
};

/* ─── Componente Principal ────────────────────────────────────────────────── */

export const CoverDesignerPanel: React.FC = () => {
  const { doc, portada, setPortada, isLoading, showToast } = useDocStore();

  const [templates, setTemplates] = useState<CoverTemplateInfo[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [showUploadImage, setShowUploadImage] = useState(false);
  const [showUploadDocx, setShowUploadDocx] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /* ─── Cargar plantillas ─────────────────────────────────────────────────── */
  const loadTemplates = useCallback(async () => {
    try {
      const list = await api.fetchCoverTemplates();
      setTemplates(list);
    } catch (err) {
      console.warn('Error loading cover templates:', err);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  /* ─── Seleccionar y aplicar plantilla ──────────────────────────────────── */
  const handleSelect = async (name: string) => {
    if (!doc) return;

    setSelectedTemplate(name);
    setApplying(true);
    setSuccessMessage(null);

    try {
      const result = await api.applyCover({
        session_id: doc.session_id,
        cover_template_name: name,
        title: portada.title || '',
        author: portada.author || '',
        institution: portada.institution || '',
        course: portada.course || '',
        instructor: portada.instructor || '',
        date: portada.date || '',
      });

      // Reload session from server to get updated doc + portada with cover_template_id
      if (result.document) {
        useDocStore.getState().pushHistory(result.document);
        useDocStore.setState((s) => ({
          doc: result.document,
          portada: {
            ...s.portada,
            use_original_cover: false,
            force_skip_cover: true,
            cover_template_id: name,
          },
        }));
      } else {
        setPortada({ use_original_cover: false, force_skip_cover: true });
      }

      // Trigger preview regeneration after cover change (with updated state)
      setTimeout(() => {
        useDocStore.getState().generatePreview();
      }, 300);

      setSuccessMessage(`Portada "${name}" aplicada correctamente`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Error applying cover:', err);
      useDocStore.getState().showToast(
        err.message || `Error al aplicar portada "${name}"`, 'error'
      );
      setSuccessMessage(null);
    } finally {
      setApplying(false);
    }
  };

  /* ─── Subir imagen ─────────────────────────────────────────────────────── */
  const handleUploadImage = async () => {
    if (!uploadFile || !uploadName.trim()) return;
    setUploading(true);
    try {
      await api.uploadCoverImage(uploadFile, uploadName.trim());
      setShowUploadImage(false);
      setUploadFile(null);
      setUploadName('');
      setImagePreviewUrl(null);
      await loadTemplates();
      showToast('Portada subida correctamente', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al subir imagen de portada', 'error');
    } finally {
      setUploading(false);
    }
  };

  /* ─── Subir DOCX ───────────────────────────────────────────────────────── */
  const handleUploadDocx = async () => {
    if (!uploadFile || !uploadName.trim()) return;
    setUploading(true);
    try {
      await api.uploadCoverDocx(uploadFile, uploadName.trim());
      setShowUploadDocx(false);
      setUploadFile(null);
      setUploadName('');
      await loadTemplates();
      showToast('Portada subida correctamente', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al subir documento de portada', 'error');
    } finally {
      setUploading(false);
    }
  };

  /* ─── Eliminar plantilla ────────────────────────────────────────────────── */
  const handleDelete = async (name: string) => {
    try {
      await api.deleteCoverTemplate(name);
      setTemplates((prev) => prev.filter((t) => t.name !== name));
      if (selectedTemplate === name) setSelectedTemplate(null);
      showToast(`Plantilla "${name}" eliminada`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar plantilla', 'error');
    }
  };

  /* ─── Upload file picker helper ────────────────────────────────────────── */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setUploadFile(file);
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreviewUrl(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreviewUrl(null);
    }
  };

  /* ─── Group templates by type ──────────────────────────────────────────── */
  const builtinTemplates = templates.filter((t) => t.is_builtin);
  const userTemplates = templates.filter((t) => !t.is_builtin);

  /* ─── Determinar icono segun tipo ──────────────────────────────────────── */
  const getTemplateIcon = (t: CoverTemplateInfo) => {
    if (t.source_type === 'image') return <Image size={28} />;
    if (t.source_type === 'docx') return <FileText size={28} />;
    return <Layout size={28} />;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: theme.bg }}>

      {/* Banner Superior */}
      <div style={{
        backgroundColor: '#ffffff',
        borderBottom: `1px solid ${theme.border}`,
        padding: '14px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: theme.primary, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={18} /> Disenador de Portadas
          </h3>
          <span style={{ fontSize: '12px', color: theme.textMuted }}>
            Elige una plantilla o sube tu propia portada como imagen o documento Word
          </span>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => { setShowUploadImage(true); setShowUploadDocx(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px' }}
          >
            <Upload size={14} /> Subir Imagen
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => { setShowUploadDocx(true); setShowUploadImage(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px' }}
          >
            <FileText size={14} /> Subir Word
          </button>
        </div>
      </div>

      {/* Mensaje de exito */}
      {successMessage && (
        <div style={{
          backgroundColor: '#f0fdf4',
          borderBottom: '1px solid #bbf7d0',
          padding: '8px 24px',
          fontSize: '13px',
          color: theme.success,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <Check size={14} /> {successMessage}
        </div>
      )}

      {/* Contenido principal: scroll */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* ─── Seccion: Plantillas Integradas ─────────────────────────────── */}
        {builtinTemplates.length > 0 && (
          <>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: theme.textMuted, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Plantillas Integradas
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px', marginBottom: '28px' }}>
              {builtinTemplates.map((t) => (
                <TemplateCard
                  key={t.name}
                  template={t}
                  isSelected={selectedTemplate === t.name}
                  applying={applying && selectedTemplate === t.name}
                  onSelect={handleSelect}
                  onDelete={null}
                  icon={getTemplateIcon(t)}
                />
              ))}
            </div>
          </>
        )}

        {/* ─── Seccion: Mis Plantillas ────────────────────────────────────── */}
        {userTemplates.length > 0 && (
          <>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: theme.textMuted, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Mis Plantillas
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px', marginBottom: '28px' }}>
              {userTemplates.map((t) => (
                <TemplateCard
                  key={t.name}
                  template={t}
                  isSelected={selectedTemplate === t.name}
                  applying={applying && selectedTemplate === t.name}
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                  icon={getTemplateIcon(t)}
                />
              ))}
            </div>
          </>
        )}

        {/* ─── Mensaje vacio ─────────────────────────────────────────────── */}
        {templates.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: theme.textMuted }}>
            <Layout size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ fontSize: '14px', margin: '0 0 6px 0' }}>No hay plantillas de portada disponibles</p>
            <p style={{ fontSize: '12px', margin: 0 }}>Sube una imagen o documento Word para crear tu primera portada</p>
          </div>
        )}

        {/* ─── Estado sin documento cargado ───────────────────────────────── */}
        {!doc && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: theme.textMuted }}>
            <FileText size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ fontSize: '14px', margin: 0 }}>Sube un documento primero para aplicar portadas</p>
          </div>
        )}
      </div>

      {/* ─── Modal: Subir Imagen ─────────────────────────────────────────── */}
      {showUploadImage && (
        <UploadModal
          title="Subir Imagen como Portada"
          accept="image/*"
          uploadName={uploadName}
          setUploadName={setUploadName}
          uploadFile={uploadFile}
          uploading={uploading}
          imagePreviewUrl={imagePreviewUrl}
          onFileChange={handleFileChange}
          onUpload={handleUploadImage}
          onClose={() => { setShowUploadImage(false); setUploadFile(null); setUploadName(''); setImagePreviewUrl(null); }}
        />
      )}

      {/* ─── Modal: Subir DOCX ───────────────────────────────────────────── */}
      {showUploadDocx && (
        <UploadModal
          title="Subir Documento Word como Portada"
          accept=".docx"
          uploadName={uploadName}
          setUploadName={setUploadName}
          uploadFile={uploadFile}
          uploading={uploading}
          imagePreviewUrl={null}
          onFileChange={handleFileChange}
          onUpload={handleUploadDocx}
          onClose={() => { setShowUploadDocx(false); setUploadFile(null); setUploadName(''); setImagePreviewUrl(null); }}
        />
      )}
    </div>
  );
};

export default CoverDesignerPanel;


/* ═══════════════════════════════════════════════════════════════════════════
   Subcomponentes
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Template Card ──────────────────────────────────────────────────────── */

interface TemplateCardProps {
  template: CoverTemplateInfo;
  isSelected: boolean;
  applying: boolean;
  onSelect: (name: string) => void;
  onDelete: ((name: string) => void) | null;
  icon: React.ReactNode;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, isSelected, applying, onSelect, onDelete, icon }) => {
  const isBuiltin = template.is_builtin;
  const sourceLabel = template.source_type === 'image' ? 'Imagen'
    : template.source_type === 'docx' ? 'Documento Word'
    : 'Plantilla APA';

  return (
    <div style={{
      backgroundColor: theme.cardBg,
      borderRadius: theme.radius,
      border: `1px solid ${isSelected ? theme.primary : theme.border}`,
      boxShadow: isSelected ? `0 0 0 2px ${theme.primary}33` : theme.shadow,
      overflow: 'hidden',
      transition: 'all 0.15s ease',
      position: 'relative',
      cursor: 'pointer',
    }}
      onClick={() => onSelect(template.name)}
    >
      {/* Preview */}
      <div style={{
        height: '140px',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: `1px solid ${theme.border}`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {template.preview_path ? (
          <img
            src={api.getCoverPreviewUrl(template.name) + '?t=' + Date.now()}
            alt={template.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.style.display = 'flex';
            }}
          />
        ) : (
          <div style={{ color: theme.textMuted, opacity: 0.5 }}>
            {icon}
          </div>
        )}

        {/* Badge de tipo */}
        <span style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          backgroundColor: template.is_builtin ? theme.primaryLight : '#fef3c7',
          color: template.is_builtin ? theme.primary : '#92400e',
          fontSize: '10px',
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.3px',
        }}>
          {sourceLabel}
        </span>

        {/* Check de seleccion */}
        {isSelected && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            backgroundColor: theme.primary,
            borderRadius: '50%',
            width: '22px',
            height: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Check size={14} color="#fff" />
          </div>
        )}

        {/* Boton eliminar (solo plantillas del usuario) */}
        {!isBuiltin && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(template.name); }}
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              backgroundColor: 'rgba(255,255,255,0.9)',
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              padding: '4px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: theme.danger,
            }}
            title="Eliminar plantilla"
          >
            <Trash2 size={12} /> Eliminar
          </button>
        )}
      </div>

      {/* Informacion */}
      <div style={{ padding: '12px' }}>
        <h5 style={{ fontSize: '13px', fontWeight: 600, color: theme.text, margin: '0 0 4px 0', lineHeight: '1.3' }}>
          {template.name}
        </h5>
        <p style={{ fontSize: '11px', color: theme.textMuted, margin: 0, lineHeight: '1.4' }}>
          {template.description}
        </p>
      </div>

      {/* Boton aplicar (al seleccionar) */}
      {isSelected && (
        <div style={{ padding: '0 12px 12px 12px' }}>
          <button
            className="btn btn-primary btn-sm"
            disabled={applying}
            style={{ width: '100%', fontSize: '12px', padding: '6px 12px' }}
          >
            {applying ? 'Aplicando...' : 'Portada Seleccionada'}
          </button>
        </div>
      )}
    </div>
  );
};


/* ─── Upload Modal ───────────────────────────────────────────────────────── */

interface UploadModalProps {
  title: string;
  accept: string;
  uploadName: string;
  setUploadName: (name: string) => void;
  uploadFile: File | null;
  uploading: boolean;
  imagePreviewUrl: string | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onClose: () => void;
}

const UploadModal: React.FC<UploadModalProps> = ({
  title, accept, uploadName, setUploadName, uploadFile, uploading,
  imagePreviewUrl, onFileChange, onUpload, onClose,
}) => {
  const isValid = uploadName.trim().length > 0 && uploadFile !== null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        width: '420px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: theme.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={16} /> {title}
          </h4>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, padding: '4px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          {/* Nombre */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: theme.text, marginBottom: '4px' }}>
              Nombre de la portada
            </label>
            <input
              className="form-input"
              type="text"
              placeholder="Mi Portada Personalizada"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              style={{ width: '100%', fontSize: '13px', padding: '8px 10px' }}
            />
          </div>

          {/* Archivo */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: theme.text, marginBottom: '4px' }}>
              Archivo
            </label>
            <input
              type="file"
              accept={accept}
              onChange={onFileChange}
              style={{ fontSize: '12px', width: '100%' }}
            />
          </div>

          {/* Preview */}
          {imagePreviewUrl && (
            <div style={{ marginBottom: '14px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${theme.border}` }}>
              <img src={imagePreviewUrl} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }} />
            </div>
          )}

          {/* Nombre del archivo seleccionado */}
          {uploadFile && !imagePreviewUrl && (
            <div style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '14px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <FileText size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
        }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={onClose}
            style={{ fontSize: '12px' }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-sm btn-primary"
            disabled={!isValid || uploading}
            onClick={onUpload}
            style={{ fontSize: '12px' }}
          >
            {uploading ? 'Subiendo...' : 'Subir Portada'}
          </button>
        </div>
      </div>
    </div>
  );
};

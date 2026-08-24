import React, { useState, useEffect, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import * as api from '../../api/backend';
import { SessionRecovery, FormatProfile, APARuleSet } from '../../types';
import {
  FileText, BookOpen, GraduationCap, Loader2, Clock, FolderOpen, Settings2, ArrowLeft,
  Download, FileUp, Home, Menu, Lock, AlertTriangle, MousePointerClick, BadgeCheck, ShieldCheck, FileCheck, Plug
} from 'lucide-react';
import { UploadDropzone } from '../upload/UploadDropzone';
import { Card } from '../ui/wordapa7';
import { HomeHero } from '../layout/HomeHero';
import { SettingsMenu } from '../layout/SettingsMenu';
import { DocumentMascot, getMascotExpression } from '../layout/DocumentMascot';

type ChromeStyle = React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };
const dragRegion = { WebkitAppRegion: 'drag' } as ChromeStyle;
const noDragRegion = { WebkitAppRegion: 'no-drag' } as ChromeStyle;

/** SVG brand icon — clean document icon in the accent color. */
const BrandIcon: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="15" y2="17" />
  </svg>
);

// ── PLANTILLAS DE ESTRUCTURA DESCARGABLES (variantes dentro del perfil) ──────
const TEMPLATES = [
  {
    id: 'essay',
    name: 'Ensayo',
    description: 'Introducción, desarrollo, conclusiones y referencias',
    icon: <FileText size={22} color="var(--accent-success)" />,
    iconBg: 'rgba(56, 160, 23, 0.12)',
  },
  {
    id: 'report',
    name: 'Informe Técnico',
    description: 'Resumen ejecutivo, metodología, resultados y anexos',
    icon: <BookOpen size={22} color="var(--accent-primary)" />,
    iconBg: 'rgba(79, 124, 255, 0.12)',
  },
  {
    id: 'thesis',
    name: 'Tesis / Monografía',
    description: 'Marco teórico, metodología, resultados y conclusiones',
    icon: <GraduationCap size={22} color="var(--accent-primary)" />,
    iconBg: 'rgba(79, 124, 255, 0.12)',
  },
  {
    id: 'math_book',
    name: 'Libro de Matemáticas',
    description: 'Diseño tipo libro universitario: cajas de colores, fórmulas numeradas (PDF)',
    icon: <BookOpen size={22} color="#E67E22" />,
    iconBg: 'rgba(230, 126, 34, 0.12)',
    thumbnail: '/assets/math_book_thumbnail.jpg'
  },
];

// Fallback mientras /api/profiles aún no respondió (el campo rules nunca se usa acá)
const FALLBACK_PROFILES: FormatProfile[] = [{
  profile_id: 'apa7',
  display_name: 'APA 7ª edición',
  description: 'Norma APA 7 por defecto',
  cover_required_fields: ['title', 'author', 'institution'],
  latex_documentclass: 'apa7',
  latex_options: 'stu, 12pt',
  cover_apa_format: 'student',
  rules: {} as APARuleSet,
}];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** DEV: diagnóstico del complemento de Word (sideload System Feed). */
const AddinDiagnosticCard: React.FC = () => {
  const [status, setStatus] = useState<api.SideloadStatus | null>(null);
  const [repairing, setRepairing] = useState(false);

  const refresh = () => {
    if (typeof api.getSideloadStatus !== 'function') return;
    api.getSideloadStatus().then(setStatus).catch(() => setStatus(null));
  };
  useEffect(() => { refresh(); }, []);

  const installed = !!status?.installed;
  let installedAt = '';
  try {
    if (installed && status?.installed_at) installedAt = new Date(status.installed_at).toLocaleString();
  } catch { /* noop */ }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px',
      padding: '12px 16px', borderRadius: 'var(--radius-lg)',
      background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)',
      marginBottom: '20px', maxWidth: '620px', marginInline: 'auto',
    }}>
      <Plug size={18} color={installed ? 'var(--color-success)' : 'var(--color-danger)'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-main)' }}>
          Complemento de Word: {installed ? 'instalado' : 'no instalado'}
          {installed && status?.up_to_date === false ? ' (desactualizado)' : ''}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {installed
            ? (installedAt ? `System Feed · ${installedAt}` : 'Instalado en System Feed')
            : 'Ejecutá "Reintentar" y luego cerrá Word completo (revisá la bandeja) y abrilo de nuevo.'}
        </div>
      </div>
      <button
        type="button"
        disabled={repairing}
        onClick={() => {
          setRepairing(true);
          api.repairSideload()
            .then(() => useDocStore.getState().showToast('Complemento reinstalado. Cerrá Word y volvé a abrirlo.', 'success'))
            .catch((e) => useDocStore.getState().showToast(`Fallo reparación: ${String(e)}`, 'error'))
            .finally(() => { setRepairing(false); refresh(); });
        }}
        style={{
          fontSize: 'var(--text-xs)', fontWeight: 700, fontFamily: 'inherit',
          padding: '5px 12px', cursor: repairing ? 'wait' : 'pointer',
          borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-primary)',
          background: 'transparent', color: 'var(--accent-primary)',
        }}
      >
        Reintentar instalación
      </button>
    </div>
  );
};

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} minutos`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} horas`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return 'Ayer';
  return `Hace ${days} días`;
}

export const Step0QuickStart: React.FC = () => {
  const {
    uploadFile, setActiveProfile, isLoading, isBackendReady, error, openSession,
    profiles, activeProfileId,
  } = useDocStore();
  const [activeTab, setActiveTab] = useState<'inicio' | 'abrir' | 'recientes'>('inicio');
  const [greeting] = useState(getGreeting());
  const [dragging, setDragging] = useState(false);
  const [recentSessions, setRecentSessions] = useState<SessionRecovery[]>([]);
  const [loadingRecents, setLoadingRecents] = useState(false);
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load real sessions from backend when it's ready
  useEffect(() => {
    if (!isBackendReady) return;
    setLoadingRecents(true);
    api.listSessions()
      .then(sessions => setRecentSessions(sessions || []))
      .catch(() => setRecentSessions([]))
      .finally(() => setLoadingRecents(false));
  }, [isBackendReady]);

  // ── Subida inmediata: al soltar o elegir un archivo arranca el proceso ──
  // No hay paso intermedio de previsualización. Siempre Modo Guiado (review).
  // CRITICAL: dar feedback al usuario cuando el backend no está listo en lugar
  // de retornar silenciosamente — antes "no hace nada" al arrastrar un archivo.
  const [scopeFilterOpen, setScopeFilterOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);

  const doUpload = (file: File) => {
    uploadFile(file, { profileId: activeProfileId, mode: 'review' });
  };

  const handleUploadFile = (file: File) => {
    if (isLoading) return;
    if (!isBackendReady) {
      useDocStore.getState().showToast(
        'El motor está iniciando. Aguardá unos segundos e intentá de nuevo.',
        'warning'
      );
      return;
    }
    if (!file.name.toLowerCase().endsWith('.docx')) {
      useDocStore.getState().showToast('Solo se aceptan archivos .docx', 'warning');
      return;
    }
    // Filtro de alcances: decidir ANTES de subir qué se tocará.
    setPendingFile(file);
    setScopeFilterOpen(true);
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    handleUploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (isLoading) return;
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.docx')) {
      handleUploadFile(file);
    } else if (file) {
      useDocStore.getState().showToast('Solo se aceptan archivos .docx', 'warning');
    }
  };

  const triggerFilePicker = () => {
    if (isLoading) return;    if (!isBackendReady) {
      useDocStore.getState().showToast(
        'El motor está iniciando. Aguardá unos segundos e intentá de nuevo.',
        'warning'
      );
      return;
    }
    fileInputRef.current?.click();
  };

  const handleRecoverSession = async (sessionId: string, _fileName: string) => {
    setRecoveringId(sessionId);
    try {
      await openSession(sessionId);
    } catch (e) {
      console.error('Error recovering session:', e);
    } finally {
      setRecoveringId(null);
    }
  };

  const busy = isLoading || !isBackendReady;
  const isElectron = !!(window as any).electronAPI;

  return (
    <div style={{
      display: 'flex', width: '100%', height: '100vh',
      backgroundColor: 'var(--canvas-bg)', fontFamily: 'var(--font-sans)',
      position: 'relative', flexDirection: 'column',
    }}>
      {/* ── Franja superior de arrastre (ventana) ──
          Simplificada: solo branding + Archivo. El botón "Ajustes y vista
          previa" fue eliminado porque duplica "Configuraciones" del sidebar. */}
      <div style={{
        height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center',
        gap: '8px', padding: '0 16px 0 20px',
        backgroundColor: 'var(--sidebar-bg)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'relative', zIndex: 20,
        ...dragRegion,
      }}>
        {/* Branding: SVG icon + nombre (sin repetir "APA 7") */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <BrandIcon size={20} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>WordAPA7</span>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-subtle)', margin: '0 4px', flexShrink: 0 }} />

        {/* Botón: Archivo (menú de carga / backstage) */}
        <button
          type="button"
          onClick={() => useDocStore.getState().setShowFileMenu(true)}
          title="Archivo: nuevo, abrir, guardar, exportar y sesiones"
          style={{
            background: 'var(--surface-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-main)',
            fontSize: 'var(--text-sm)',
            padding: '4px 10px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: 'inherit',
            ...noDragRegion,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-surface-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
        >
          <Menu size={12} /> Archivo
        </button>

        <div style={{ flex: 1 }} />

        {/* Botón: Volver al documento abierto */}
        {(() => {
          const s = useDocStore.getState();
          if (s.atHome && s.tabs && s.tabs.length > 0) {
            return (
              <button
                type="button"
                onClick={() => useDocStore.getState().switchToTab(s.activeTabIndex || 0)}
                title="Volver al documento abierto"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '4px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  backgroundColor: 'var(--color-accent-soft)', color: 'var(--accent-primary)',
                  border: '1px solid var(--accent-primary)', fontFamily: 'inherit',
                  fontSize: 'var(--text-xs)', fontWeight: 700,
                  marginRight: isElectron ? 140 : 0, // reserva para botones nativos
                  ...noDragRegion,
                }}
              >
                <ArrowLeft size={13} /> Volver a {s.tabs[s.activeTabIndex || 0]?.file_name || 'documento'}
              </button>
            );
          }
          // Spacer para reservar espacio de los botones nativos de la ventana
          return isElectron ? <div style={{ width: '140px', flexShrink: 0, ...noDragRegion }} /> : null;
        })()}
      </div>

      {/* Hidden file input */}
      <input type="file" ref={fileInputRef} onChange={handleFilePicked} accept=".docx" style={{ display: 'none' }} />

      {/* ── CONTENIDO (sidebar + principal) ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* ── SIDEBAR IZQUIERDA (estilo Word) ─── */}
      <div style={{
        width: '64px', backgroundColor: 'var(--sidebar-bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: '24px', gap: '4px', zIndex: 10, flexShrink: 0,
        borderRight: '1px solid var(--border-subtle)'
      }}>
        <NavItem icon={<Home size={22} />} label="Inicio" active={activeTab === 'inicio'} onClick={() => setActiveTab('inicio')} />
        <NavItem icon={<FolderOpen size={22} />} label="Abrir" active={activeTab === 'abrir'} onClick={() => setActiveTab('abrir')} />
        <NavItem icon={<Clock size={22} />} label="Recientes" active={activeTab === 'recientes'} onClick={() => setActiveTab('recientes')} />

        {/* Configuraciones — único punto de acceso a ajustes (el botón
            duplicado del top bar fue eliminado por redundante) */}
        <div style={{ marginTop: 'auto', paddingBottom: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
            aria-expanded={settingsMenuOpen}
            title="Configuraciones"
            style={{
              background: settingsMenuOpen ? 'var(--color-accent-soft)' : 'none',
              border: '1px solid ' + (settingsMenuOpen ? 'var(--accent-primary)' : 'var(--border-subtle)'),
              borderRadius: '8px',
              color: settingsMenuOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', padding: '7px', display: 'flex',
            }}
          >
            <Settings2 size={18} />
          </button>
          <span style={{ fontSize: '8px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3, fontWeight: 600 }}>
            Configuraciones
          </span>
        </div>
      </div>

      {/* Menú "Configuraciones" estilo Notion */}
        {settingsMenuOpen && <SettingsMenu onClose={() => setSettingsMenuOpen(false)} />}

        {/* ── Filtro de alcances: ¿qué se toca de este Word? ── */}
        {scopeFilterOpen && pendingFile && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 500, backgroundColor: 'rgba(10,12,24,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}>
            <div style={{
              width: '100%', maxWidth: 460, backgroundColor: 'var(--sidebar-bg)',
              border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-card)', padding: '22px 24px',
            }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px' }}>
                ¿Qué modificamos de "{pendingFile.name}"?
              </h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
                Solo se toca lo que elijas. Lo demás queda EXACTAMENTE igual.
              </p>
              {[
                { id: 'texto', label: 'Texto', desc: 'Tipografía, interlineado y sangría' },
                { id: 'tablas_imagenes', label: 'Tablas e imágenes', desc: 'Numeración Tabla N / Figura N + bordes APA' },
                { id: 'bibliografia', label: 'Bibliografía', desc: 'Sangría francesa y espaciado APA' },
              ].map((s) => {
                const on = selectedScopes.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedScopes((prev) => on ? prev.filter((x) => x !== s.id) : [...prev, s.id])}
                    style={{
                      width: '100%', textAlign: 'left', marginBottom: 8, cursor: 'pointer',
                      fontFamily: 'inherit', padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${on ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      background: on ? 'var(--accent-soft)' : 'var(--surface-elevated)',
                    }}
                  >
                    <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 700, color: on ? 'var(--accent-primary)' : 'var(--text-main)' }}>
                      {s.label} {on ? '✓' : ''}
                    </span>
                    <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{s.desc}</span>
                  </button>
                );
              })}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  disabled={selectedScopes.length === 0}
                  onClick={() => {
                    useDocStore.getState().setSessionScopes(selectedScopes);
                    setScopeFilterOpen(false);
                    doUpload(pendingFile);
                    useDocStore.getState().showToast(`Se aplicará solo: ${selectedScopes.join(', ')}`, 'info');
                  }}
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 'var(--radius-md)', cursor: selectedScopes.length ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontWeight: 700, background: 'var(--accent-primary)', color: '#fff', border: 'none', opacity: selectedScopes.length ? 1 : 0.5 }}
                >
                  Aplicar solo lo elegido
                </button>
                <button
                  type="button"
                  onClick={() => {
                    useDocStore.getState().setSessionScopes([]);
                    setScopeFilterOpen(false);
                    doUpload(pendingFile);
                  }}
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                >
                  Formato completo APA
                </button>
              </div>
            </div>
          </div>
        )}

      {/* ── ÁREA PRINCIPAL ─── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 60px 56px' }}>

        {/* Error global */}
        {error && (
          <div role="alert" style={{
            padding: '12px 20px',
            marginBottom: '20px',
            backgroundColor: 'rgba(255,77,79,0.14)', border: '1px solid rgba(255,77,79,0.4)',
            color: 'var(--accent-danger)', borderRadius: '8px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{error}</span>
            <button
              type="button"
              aria-label="Cerrar error"
              onClick={() => useDocStore.setState({ error: null })}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 'var(--text-lg)', padding: '2px' }}
            >
              ×
            </button>
          </div>
        )}

        {/* ── INICIO ── */}
        {activeTab === 'inicio' && (
          <div style={{ maxWidth: '820px', margin: '0 auto' }}>
            {/* Hero: mascota + H1 rotatorio (frases cambiantes) + subtítulo */}
            <HomeHero />

            {/* Mascota asomándose sobre el dropzone (hero) + globo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '-14px', position: 'relative', zIndex: 5 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                <div className="doc-mascot-alive" style={{ lineHeight: 0 }}>
                  <DocumentMascot size={86} expression={getMascotExpression()} />
                </div>
                <div style={{
                  position: 'relative',
                  backgroundColor: 'var(--surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderTopLeftRadius: '4px',
                  borderRadius: '14px',
                  padding: '10px 14px',
                  fontSize: 'var(--text-sm)', fontWeight: 600,
                  color: 'var(--text-main)',
                  boxShadow: 'var(--shadow-md)',
                  maxWidth: '320px',
                  lineHeight: 1.4,
                }}>
                  ¡{greeting}! Tirame ese Word desordenado, yo me encargo.
                </div>
              </div>
            </div>

            {/* ── ACCIÓN PRIMARIA: Dropzone premium + perfil + Convertir ── */}
            <div style={{ marginBottom: '40px' }}>
              <div style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xl)',
                padding: '32px',
                boxShadow: 'var(--shadow-card)',
              }}>
                {/* Zona interactiva: arrastrar o hacer clic */}
                <div
                  onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={triggerFilePicker}
                  role="button"
                  tabIndex={0}
                  aria-label="Seleccionar o arrastrar documento .docx"
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !busy) { e.preventDefault(); triggerFilePicker(); } }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    minHeight: '200px', cursor: busy ? 'wait' : 'pointer',
                    border: dragging ? '2px dashed var(--accent-primary)' : '2px dashed var(--border-strong)',
                    borderRadius: 'var(--radius-lg)', transition: 'all 0.2s ease',
                    backgroundColor: dragging ? 'var(--color-accent-soft)' : 'var(--surface-subtle)',
                    transform: dragging ? 'scale(1.01)' : 'scale(1)',
                    pointerEvents: busy ? 'none' : 'auto',
                  }}
                >
                  <div style={{
                    width: '64px', height: '64px', borderRadius: 'var(--radius-full)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: dragging ? 'var(--accent-primary)' : 'var(--color-accent-soft)',
                    marginBottom: '18px', transition: 'all 0.2s ease',
                  }}>
                    <FileUp size={30} color={dragging ? '#fff' : 'var(--accent-primary)'} style={{ transition: 'color 0.2s ease' }} />
                  </div>
                  <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', letterSpacing: '-0.01em' }}>
                    {isLoading ? 'Procesando tu documento…' : 'Arrastrá tu documento .docx aquí'}
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                    o hacé clic para seleccionar un archivo
                  </span>
                </div>

                {/* Selector de perfil de formato (siempre visible, antes de subir) */}
                <div style={{ marginTop: '22px' }}>
                  <label style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', letterSpacing: '0.02em' }}>
                    Perfil de formato
                  </label>
                  <select
                    value={activeProfileId}
                    onChange={(e) => setActiveProfile(e.target.value)}
                    disabled={isLoading}
                    style={{
                      width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)', backgroundColor: 'var(--canvas-bg)',
                      color: 'var(--text-main)', fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: 500,
                      cursor: isLoading ? 'wait' : 'pointer', transition: 'border-color 0.15s ease',
                    }}
                  >
                    {(profiles.length > 0 ? profiles : FALLBACK_PROFILES).map((p) => (
                      <option key={p.profile_id} value={p.profile_id}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Botón Convertir — CTA principal, ancho completo, color de acento */}
                <button
                  type="button"
                  onClick={triggerFilePicker}
                  disabled={busy}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    width: '100%', marginTop: '16px', padding: '14px 20px',
                    borderRadius: 'var(--radius-md)', border: 'none', cursor: busy ? 'wait' : 'pointer',
                    backgroundColor: 'var(--accent-primary)', color: '#fff',
                    fontFamily: 'inherit', fontSize: 'var(--text-base)', fontWeight: 700, letterSpacing: '0.01em',
                    boxShadow: 'var(--shadow-lg)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
                    opacity: busy ? 0.8 : 1,
                  }}
                  onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = 'var(--accent-primary-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-card)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-primary)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      Procesando…
                    </>
                  ) : !isBackendReady ? (
                    <>
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      Conectando…
                    </>
                  ) : (
                    <>
                      <FileUp size={18} />
                      Convertir a APA 7
                    </>
                  )}
                </button>

                {/* Mensaje de garantía */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  marginTop: '20px', paddingTop: '18px', borderTop: '1px solid var(--border-subtle)',
                }}>
                  <Lock size={14} color="var(--accent-success)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Tu contenido no se modifica ni se pierde. Garantizado.
                  </span>
                </div>
              </div>
            </div>

            {/* ── T7: Consejos compactos bajo el dropzone ── */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '10px',
              padding: '14px 18px',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '40px',
            }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                Consejos
              </span>
              {[
                { icon: <MousePointerClick size={14} color="var(--accent-primary)" />, text: 'Arrastra tu .docx aquí o haz clic para buscar' },
                { icon: <BadgeCheck size={14} color="var(--accent-success)" />, text: 'Funciona con documentos de Word 2010 en adelante' },
                { icon: <ShieldCheck size={14} color="var(--accent-primary)" />, text: 'Tu archivo original nunca se modifica' },
              ].map((tip, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'flex', flexShrink: 0 }}>{tip.icon}</span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{tip.text}</span>
                </div>
              ))}
            </div>

            {/* ── ACCIÓN SECUNDARIA: Plantillas descargables ──
                Rediseñado: tarjetas limpias con fondo elevado, iconos con
                color de fondo sutil, tipografía refinada. */}
            <div style={{
              marginLeft: '-60px', marginRight: '-60px',
              padding: '32px 60px 36px',
              backgroundColor: 'var(--sidebar-bg)',
              borderTop: '1px solid var(--border-subtle)',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '36px',
            }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                ¿Todavía no escribiste nada? Descargá una plantilla
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                Un .docx con portada y secciones listas: lo abrís en Word y solo completás el contenido.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {TEMPLATES.map(tpl => {
                  const activeDoc = useDocStore.getState().doc;
                  const canApply = !!activeDoc;
                  return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      if (canApply && activeDoc) {
                        // Contextual: con documento cargado aplica la estructura.
                        api.applyTemplate(activeDoc.session_id, tpl.id)
                          .then(() => useDocStore.getState().showToast(`Estructura "${tpl.name}" aplicada a tu documento`, 'success'))
                          .catch((e) => useDocStore.getState().showToast(`No se pudo aplicar: ${String(e)}`, 'error'));
                      } else {
                        api.downloadTemplate(activeProfileId, tpl.id);
                      }
                    }}
                    title={canApply ? `Aplicar estructura ${tpl.name} a tu documento` : `Descargar plantilla ${tpl.name}`}
                    aria-label={canApply ? `Aplicar estructura ${tpl.name}` : `Descargar plantilla ${tpl.name}`}
                    style={{
                      flex: '1 1 220px', maxWidth: '280px', cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left',
                      padding: '16px', borderRadius: 'var(--radius-lg)',
                      background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)',
                      transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-primary)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.transform = 'none';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                    }}
                  >
                    {tpl.thumbnail ? (
                        <div style={{
                          width: '100%', height: '120px', borderRadius: 'var(--radius-md)',
                          backgroundImage: `url(${tpl.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'top',
                          border: '1px solid var(--border-subtle)', marginBottom: '4px'
                        }} />
                      ) : (
                        <div style={{
                          width: '40px', height: '40px', borderRadius: 'var(--radius-md)', flexShrink: 0,
                          background: tpl.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {tpl.icon}
                        </div>
                      )}
                    {/* Nombre + descripción */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                        {tpl.name}
                      </div>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {tpl.description}
                      </div>
                    </div>
                    {/* Indicador contextual */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent-primary)', marginTop: 'auto' }}>
                      {canApply ? (
                        <><FileCheck size={13} /> Aplicar a mi documento</>
                      ) : (
                        <><Download size={13} /> Descargar .docx</>
                      )}
                    </div>
                  </button>
                  );
                })}
              </div>
            </div>

            {/* Recientes (preview) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Recientes</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('recientes')}
                  style={{
                    fontSize: 'var(--text-sm)', color: 'var(--accent-primary)', cursor: 'pointer',
                    background: 'none', border: 'none', padding: 0, fontFamily: 'inherit',
                  }}
                >
                  Ver todos →
                </button>
              </div>
              <RecentsList
                sessions={recentSessions.slice(0, 5)}
                loading={loadingRecents}
                backendReady={isBackendReady}
                recoveringId={recoveringId}
                onOpen={handleRecoverSession}
              />
            </div>
          </div>
        )}

        {/* ── ABRIR ── */}
        {activeTab === 'abrir' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-main)', marginBottom: '24px', marginTop: 0 }}>
              Abrir Documento Existente
            </h1>
            <UploadDropzone onFileSelected={(file) => uploadFile(file, { profileId: activeProfileId, mode: 'review' })} isLoading={isLoading || !isBackendReady} />
          </div>
        )}

        {/* ── RECIENTES ── */}
        {activeTab === 'recientes' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-main)', marginBottom: '24px', marginTop: 0 }}>
              Documentos Recientes
            </h1>
            <RecentsList
              sessions={recentSessions}
              loading={loadingRecents}
              backendReady={isBackendReady}
              recoveringId={recoveringId}
              onOpen={handleRecoverSession}
              showEmpty
            />
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

// ── SUB-COMPONENTES ──────────────────────────────────────────────────────────

const NavItem: React.FC<{
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    title={label}
    style={{
      width: '100%', padding: '12px 0', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '4px', cursor: 'pointer',
      background: 'none', border: 'none', fontFamily: 'inherit',
      backgroundColor: active ? 'var(--color-accent-soft)' : 'transparent',
      borderLeft: active ? '3px solid var(--accent-primary)' : '3px solid transparent',
      transition: 'background 0.15s',
    }}
    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-subtle)'; }}
    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
  >
    <div style={{ color: active ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>{icon}</div>
    <span style={{ color: active ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: '9px', fontWeight: active ? 600 : 500, letterSpacing: '0.3px' }}>
      {label}
    </span>
  </button>
);

const RecentsList: React.FC<{
  sessions: any[];
  loading: boolean;
  backendReady: boolean;
  recoveringId: string | null;
  onOpen: (id: string, name: string) => void;
  showEmpty?: boolean;
}> = ({ sessions, loading, backendReady, recoveringId, onOpen, showEmpty }) => {
  if (!backendReady) {
    return (
      <Card style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)' }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <span style={{ verticalAlign: 'middle' }}>Conectando...</span>
      </Card>
    );
  }
  if (loading) {
    return <Card style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)' }}>Cargando documentos recientes...</Card>;
  }
  if (sessions.length === 0) {
    if (!showEmpty) return <Card style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)' }}>Sin documentos recientes.</Card>;
    return (
      <Card style={{ textAlign: 'center', padding: '36px 24px', color: 'var(--text-secondary)' }}>
        <Clock size={48} style={{ marginBottom: '16px', opacity: 0.4 }} />
        <p style={{ fontSize: 'var(--text-lg)', margin: '0 0 8px', fontWeight: 600 }}>Sin documentos recientes</p>
        <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>Los documentos que abras o proceses aparecerán aquí.</p>
      </Card>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ flex: 2 }}>Nombre</div>
        <div style={{ flex: 1 }}>Modificado</div>
      </div>
      {sessions.map((item: SessionRecovery) => {
        const session = item.session;
        const isRecovering = recoveringId === session.session_id;
        return (
          <button
            type="button"
            key={session.session_id}
            disabled={isRecovering}
            onClick={() => !isRecovering && onOpen(session.session_id, session.file_name)}
            style={{
              display: 'flex', padding: '12px', alignItems: 'center', width: '100%',
              border: 'none', borderBottom: '1px solid var(--border-subtle)',
              cursor: isRecovering ? 'wait' : 'pointer', background: 'none',
              transition: 'background 0.15s', opacity: isRecovering ? 0.7 : 1,
              fontFamily: 'inherit', textAlign: 'left',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-subtle)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isRecovering
                ? <Loader2 size={20} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                : <FileText size={20} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
              }
              <div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-main)' }}>
                  {session.file_name || 'Documento sin nombre'}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {session.element_count} elementos · APA {session.apa_format}
                </div>
              </div>
            </div>
            <div style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              {session.last_saved ? timeAgo(session.last_saved) : '—'}
            </div>
          </button>
        );
      })}
    </>
  );
};

export default Step0QuickStart;

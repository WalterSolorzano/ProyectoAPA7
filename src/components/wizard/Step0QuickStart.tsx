import React, { useState, useEffect, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import * as api from '../../api/backend';
import { SessionRecovery } from '../../types';
import {
  FileText, BookOpen, GraduationCap, Upload, X, Loader2, Clock, FolderOpen, Settings2, ArrowLeft
} from 'lucide-react';
import { UploadDropzone } from '../upload/UploadDropzone';
import { Card } from '../ui/wordapa7';

type ChromeStyle = React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };
const dragRegion = { WebkitAppRegion: 'drag' } as ChromeStyle;
const noDragRegion = { WebkitAppRegion: 'no-drag' } as ChromeStyle;

// ── PLANTILLAS APA 7 DISPONIBLES ────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'essay',
    apaFormat: 'student' as const,
    name: 'Ensayo APA 7',
    description: 'Estructura clásica para ensayos académicos bajo normas APA 7ma edición. Incluye introducción, desarrollo, conclusión y sección de referencias. Ideal para trabajos universitarios de pregrado y posgrado.',
    icon: <FileText size={48} color="var(--accent-success)" />,
    gradient: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    size: '~155 KB',
  },
  {
    id: 'report',
    apaFormat: 'professional' as const,
    name: 'Informe Técnico',
    description: 'Formato profesional para informes técnicos y reportes organizacionales. Incluye secciones predefinidas para resumen ejecutivo, metodología, resultados y anexos, todo bajo los estándares APA 7.',
    icon: <BookOpen size={48} color="var(--accent-primary)" />,
    gradient: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
    size: '~210 KB',
  },
  {
    id: 'thesis',
    apaFormat: 'student' as const,
    name: 'Tesis / Monografía',
    description: 'Estructura completa para trabajos de grado: marco teórico, metodología, análisis de resultados y conclusiones. Configura automáticamente los niveles de título APA 7 para máxima fidelidad académica.',
    icon: <GraduationCap size={48} color="var(--accent-primary)" />,
    gradient: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
    size: '~340 KB',
  },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

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
  const { uploadFile, setPortada, isLoading, isBackendReady, error, openSession } = useDocStore();
  const [activeTab, setActiveTab] = useState<'inicio' | 'abrir' | 'recientes'>('inicio');
  const [greeting] = useState(getGreeting());
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<SessionRecovery[]>([]);
  const [loadingRecents, setLoadingRecents] = useState(false);
  const [recoveringId, setRecoveringId] = useState<string | null>(null);

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

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      uploadFile(e.target.files[0]);
      setPendingTemplate(null);
    }
  };

  const handleRecoverSession = async (sessionId: string, fileName: string) => {
    setRecoveringId(sessionId);
    try {
      await openSession(sessionId);
    } catch (e) {
      console.error('Error recovering session:', e);
    } finally {
      setRecoveringId(null);
    }
  };
  const confirmTemplateAndUpload = async () => {
    if (!pendingTemplate) return;
    const tpl = TEMPLATES.find(t => t.id === pendingTemplate);
    if (tpl) {
      setPortada({ apa_format: tpl.apaFormat });
    }
    // Set pendingTemplate to null to close any overlays
    setPendingTemplate(null);
    // Start blank document
    useDocStore.getState().startBlankDocument();
  };

  const activeTemplateObj = TEMPLATES.find(t => t.id === pendingTemplate);

  return (
    <div style={{
      display: 'flex', width: '100%', height: '100vh',
      backgroundColor: 'var(--canvas-bg)', fontFamily: 'var(--font-sans)',
      position: 'relative', flexDirection: 'column',
    }}>
      {/* ── Franja superior de arrastre (ventana) ── */}
      <div style={{
        height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center',
        gap: '8px', padding: '0 16px 0 20px',
        backgroundColor: 'var(--sidebar-bg)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'relative', zIndex: 20,
        ...dragRegion,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div style={{
            width: '22px', height: '22px', borderRadius: '6px',
            background: 'var(--accent-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FileText size={12} color="white" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>WordAPA7</span>
        </div>

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
                  backgroundColor: 'var(--color-accent-soft, rgba(79,124,255,0.14))', color: 'var(--accent-primary)',
                  border: '1px solid rgba(79,124,255,0.4)', fontFamily: 'inherit',
                  fontSize: '11px', fontWeight: 700,
                  ...noDragRegion,
                }}
              >
                <ArrowLeft size={13} /> Volver a {s.tabs[s.activeTabIndex || 0]?.file_name || 'documento'}
              </button>
            );
          }
          return null;
        })()}

        {/* Botón: Estudio de ajustes (previsualizador) */}
        <button
          type="button"
          onClick={() => useDocStore.setState({ settingsStudioOpen: true })}
          title="Abrir estudio de ajustes con vista previa en vivo"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-main)',
            border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'inherit',
            fontSize: '11px', fontWeight: 600,
            marginRight: '140px', // reserva para botones nativos de la ventana
            ...noDragRegion,
          }}
        >
          <Settings2 size={13} color="var(--accent-primary)" />
          Ajustes y vista previa
        </button>
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
        <NavItem icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>} label="Inicio" active={activeTab === 'inicio'} onClick={() => setActiveTab('inicio')} />
        <NavItem icon={<FolderOpen size={22} />} label="Abrir" active={activeTab === 'abrir'} onClick={() => setActiveTab('abrir')} />
        <NavItem icon={<Clock size={22} />} label="Recientes" active={activeTab === 'recientes'} onClick={() => setActiveTab('recientes')} />

        {/* Reportar problema + privacidad */}
        <div style={{ marginTop: 'auto', paddingBottom: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={() => window.open('mailto:wordapa7@example.com?subject=Reporte%20de%20problema%20WordAPA7', '_blank')}
            title="Reportar un problema"
            style={{
              background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '8px',
              color: 'var(--text-secondary)', cursor: 'pointer', padding: '7px', display: 'flex',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
          <span style={{ fontSize: '8px', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.3 }}>
            Ayuda a formatear,<br />no garantiza aprobación
          </span>
        </div>
      </div>

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
            <span>⚠️</span>
            <span style={{ flex: 1 }}>{error}</span>
            <button
              type="button"
              aria-label="Cerrar error"
              onClick={() => useDocStore.setState({ error: null })}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px', padding: '2px' }}
            >
              ×
            </button>
          </div>
        )}

        {/* ── MODAL DE PLANTILLA (estilo Office) ── */}
        {pendingTemplate && activeTemplateObj && (
          <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 9999
          }}>
            <div style={{
              backgroundColor: 'var(--sidebar-bg)', color: 'var(--text-main)', borderRadius: '8px',
              width: '900px', maxWidth: '95vw', height: '600px', maxHeight: '90vh',
              display: 'flex', gap: '0', position: 'relative',
              boxShadow: '0 24px 60px rgba(0,0,0,0.4)', overflow: 'hidden'
            }}>
              {/* Botón cerrar */}
              <button onClick={() => setPendingTemplate(null)} style={{
                position: 'absolute', top: '16px', right: '16px', background: 'none',
                border: 'none', color: 'var(--color-text-primary)', cursor: 'pointer', zIndex: 10, padding: '4px', borderRadius: 'var(--radius-sm)',
              }}><X size={24} /></button>

              {/* Previsualización izquierda */}
              <div style={{
                width: '40%', background: 'var(--color-bg-surface-alt)', borderRight: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <div style={{
                  width: '75%', height: '75%', backgroundColor: 'var(--canvas-bg)', borderRadius: '8px', border: '1px solid var(--border-subtle)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: '16px'
                }}>
                  {activeTemplateObj.icon}
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Vista Previa</span>
                </div>
              </div>

              {/* Información derecha */}
              <div style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', paddingTop: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 300, margin: '0 0 12px', color: 'var(--text-main)' }}>
                  {activeTemplateObj.name}
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--accent-secondary)', margin: '0 0 20px' }}>
                  Proporcionado por: WordAPA7 Framework
                </p>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 auto' }}>
                  {activeTemplateObj.description}
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '24px 0 24px' }}>
                  Tamaño estimado: <span style={{ color: 'var(--text-main)' }}>{activeTemplateObj.size}</span>
                </p>

                {!isBackendReady ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent-primary)' }}>
                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    Cargando motor de IA...
                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                  </div>
                ) : (
                  <button
                    onClick={confirmTemplateAndUpload}
                    disabled={isLoading}
                    style={{
                      width: '120px', height: '120px', background: 'var(--accent-primary)',
                      border: 'none', borderRadius: '12px', color: 'white',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: '10px', cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? 0.7 : 1, transition: 'transform 0.2s',
                    }}
                    onMouseEnter={e => { if (!isLoading) { (e.target as HTMLElement).closest('button')!.style.transform = 'scale(1.05)'; (e.target as HTMLElement).closest('button')!.style.backgroundColor = 'var(--accent-primary-hover)'; } }}
                    onMouseLeave={e => { if (!isLoading) { (e.target as HTMLElement).closest('button')!.style.transform = 'scale(1)'; (e.target as HTMLElement).closest('button')!.style.backgroundColor = 'var(--accent-primary)'; } }}
                  >
                    <Upload size={36} />
                    <span style={{ fontSize: '16px' }}>{isLoading ? 'Cargando...' : 'Crear'}</span>
                  </button>
                )}
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px' }}>
                  {isBackendReady ? 'Selecciona el documento .docx que deseas formatear con esta plantilla.' : 'Espera a que el motor de procesamiento termine de iniciar.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── INICIO ── */}
        {activeTab === 'inicio' && (
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px', marginBottom: '28px', flexWrap: 'wrap' }}>
              <div style={{ maxWidth: '640px' }}>
                <h1 style={{ fontSize: '34px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '12px', marginTop: '12px' }}>
                  {greeting}
                </h1>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  Empieza con una plantilla, abre un documento existente o recupera sesiones recientes desde un solo lugar.
                </p>
              </div>
            </div>

            {/* Plantillas */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px' }}>
                Nuevo formato APA 7
              </h2>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {TEMPLATES.map(tpl => (
                  <TemplateCard key={tpl.id} tpl={tpl} onClick={() => setPendingTemplate(tpl.id)} />
                ))}
              </div>
            </div>

            {/* Dropzone de Carga Rápida */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px' }}>
                O abrir documento existente
              </h2>
              {!isBackendReady ? (
                <Card style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', color: 'var(--text-secondary)', fontSize: '16px' }}>
                  <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                  Cargando motor de procesamiento...
                </Card>
              ) : (
                <UploadDropzone onFileSelected={(file) => uploadFile(file)} isLoading={isLoading} />
              )}
            </div>

            {/* Recientes (preview) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Recientes</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('recientes')}
                  style={{
                    fontSize: '13px', color: 'var(--accent-primary)', cursor: 'pointer',
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
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '24px', marginTop: 0 }}>
              Abrir Documento Existente
            </h1>
            {!isBackendReady ? (
              <Card style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', color: 'var(--text-secondary)', fontSize: '16px' }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                Cargando motor de procesamiento...
              </Card>
            ) : (
              <UploadDropzone onFileSelected={(file) => uploadFile(file)} isLoading={isLoading} />
            )}
          </div>
        )}

        {/* ── RECIENTES ── */}
        {activeTab === 'recientes' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '24px', marginTop: 0 }}>
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
    <div style={{ color: active ? 'var(--accent-primary)' : 'var(--color-text-secondary)' }}>{icon}</div>
    <span style={{ color: active ? 'var(--accent-primary)' : 'var(--color-text-tertiary)', fontSize: '9px', fontWeight: active ? 600 : 500, letterSpacing: '0.3px' }}>
      {label}
    </span>
  </button>
);

const TemplateCard: React.FC<{ tpl: typeof TEMPLATES[0]; onClick: () => void }> = ({ tpl, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={`Crear ${tpl.name}`}
    aria-label={`Crear ${tpl.name}`}
    style={{ width: '160px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit' }}
  >
    <div
      style={{
        height: '220px', borderRadius: '8px', background: 'var(--color-bg-surface-alt)',
        border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; }}
    >
      {tpl.icon}
    </div>
    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.3, textAlign: 'center' }}>{tpl.name}</span>
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
      <Card style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        Cargando motor de IA...
      </Card>
    );
  }
  if (loading) {
    return <Card style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Cargando documentos recientes...</Card>;
  }
  if (sessions.length === 0) {
    if (!showEmpty) return <Card style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Sin documentos recientes.</Card>;
    return (
      <Card style={{ textAlign: 'center', padding: '36px 24px', color: 'var(--text-secondary)' }}>
        <Clock size={48} style={{ marginBottom: '16px', opacity: 0.4 }} />
        <p style={{ fontSize: '16px', margin: '0 0 8px', fontWeight: 600 }}>Sin documentos recientes</p>
        <p style={{ fontSize: '13px', margin: 0 }}>Los documentos que abras o proceses aparecerán aquí.</p>
      </Card>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-subtle)' }}>
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
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                  {session.file_name || 'Documento sin nombre'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {session.element_count} elementos · APA {session.apa_format}
                </div>
              </div>
            </div>
            <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)' }}>
              {session.last_saved ? timeAgo(session.last_saved) : '—'}
            </div>
          </button>
        );
      })}
    </>
  );
};

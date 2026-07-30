import React, { useState, useEffect, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import * as api from '../../api/backend';
import { SessionRecovery } from '../../types';
import {
  FileText, BookOpen, GraduationCap, Upload, X, Loader2, Clock, FolderOpen
} from 'lucide-react';
import { UploadDropzone } from '../upload/UploadDropzone';

// ── PLANTILLAS APA 7 DISPONIBLES ────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'essay',
    apaFormat: 'student' as const,
    name: 'Ensayo APA 7',
    description: 'Estructura clásica para ensayos académicos bajo normas APA 7ma edición. Incluye introducción, desarrollo, conclusión y sección de referencias. Ideal para trabajos universitarios de pregrado y posgrado.',
    icon: <FileText size={48} color="#059669" />,
    gradient: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    size: '~155 KB',
  },
  {
    id: 'report',
    apaFormat: 'professional' as const,
    name: 'Informe Técnico',
    description: 'Formato profesional para informes técnicos y reportes organizacionales. Incluye secciones predefinidas para resumen ejecutivo, metodología, resultados y anexos, todo bajo los estándares APA 7.',
    icon: <BookOpen size={48} color="#2563eb" />,
    gradient: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
    size: '~210 KB',
  },
  {
    id: 'thesis',
    apaFormat: 'student' as const,
    name: 'Tesis / Monografía',
    description: 'Estructura completa para trabajos de grado: marco teórico, metodología, análisis de resultados y conclusiones. Configura automáticamente los niveles de título APA 7 para máxima fidelidad académica.',
    icon: <GraduationCap size={48} color="#7c3aed" />,
    gradient: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
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
  const { uploadFile, setPortada, isLoading, isBackendReady, error } = useDocStore();
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
      const recovered = await api.recoverSession(sessionId);
      if (recovered) {
        useDocStore.setState({ doc: recovered, wizardComplete: true, wizardStep: 1 });
      }
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
      backgroundColor: 'var(--canvas-bg)', fontFamily: '"Segoe UI", system-ui, sans-serif',
      position: 'relative'
    }}>
      {/* Hidden file input */}
      <input type="file" ref={fileInputRef} onChange={handleFilePicked} accept=".docx" style={{ display: 'none' }} />

      {/* ── SIDEBAR IZQUIERDA (estilo Word) ─── */}
      <div style={{
        width: '64px', backgroundColor: 'var(--sidebar-bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: '48px', gap: '4px', zIndex: 10, flexShrink: 0
      }}>
        <NavItem icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>} label="Inicio" active={activeTab === 'inicio'} onClick={() => setActiveTab('inicio')} />
        <NavItem icon={<FolderOpen size={22} />} label="Abrir" active={activeTab === 'abrir'} onClick={() => setActiveTab('abrir')} />
        <NavItem icon={<Clock size={22} />} label="Recientes" active={activeTab === 'recientes'} onClick={() => setActiveTab('recientes')} />
      </div>

      {/* ── ÁREA PRINCIPAL ─── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 60px', marginTop: '30px' }}>

        {/* Error global */}
        {error && (
          <div style={{
            position: 'fixed', top: '40px', left: '50%', transform: 'translateX(-50%)',
            padding: '12px 24px', backgroundColor: '#fde7e9', border: '1px solid #e38289',
            color: '#a80000', borderRadius: '4px', fontWeight: 600, zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── MODAL DE PLANTILLA (estilo Office) ── */}
        {pendingTemplate && activeTemplateObj && (
          <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
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
                border: 'none', color: 'white', cursor: 'pointer', zIndex: 10, padding: '4px'
              }}><X size={24} /></button>

              {/* Previsualización izquierda */}
              <div style={{
                width: '40%', background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <div style={{
                  width: '75%', height: '75%', backgroundColor: 'var(--canvas-bg)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)',
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
                <p style={{ fontSize: '13px', color: '#c8c6c4', margin: '24px 0 24px' }}>
                  Tamaño estimado: <span style={{ color: 'var(--text-main)' }}>{activeTemplateObj.size}</span>
                </p>

                {!isBackendReady ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#6cb8f6' }}>
                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    Cargando motor de IA...
                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                  </div>
                ) : (
                  <button
                    onClick={confirmTemplateAndUpload}
                    disabled={isLoading}
                    style={{
                      width: '120px', height: '120px', background: 'linear-gradient(135deg, #7c5cfc, #9b79ff)',
                      border: 'none', borderRadius: '12px', color: 'white',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: '10px', cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? 0.7 : 1, transition: 'transform 0.2s, box-shadow 0.2s',
                      boxShadow: '0 4px 15px rgba(124,92,252,0.4)'
                    }}
                    onMouseEnter={e => { if (!isLoading) { (e.target as HTMLElement).closest('button')!.style.transform = 'scale(1.05)'; (e.target as HTMLElement).closest('button')!.style.boxShadow = '0 6px 20px rgba(124,92,252,0.6)'; } }}
                    onMouseLeave={e => { if (!isLoading) { (e.target as HTMLElement).closest('button')!.style.transform = 'scale(1)'; (e.target as HTMLElement).closest('button')!.style.boxShadow = '0 4px 15px rgba(124,92,252,0.4)'; } }}
                  >
                    <Upload size={36} />
                    <span style={{ fontSize: '16px' }}>{isLoading ? 'Cargando...' : 'Crear'}</span>
                  </button>
                )}
                <p style={{ fontSize: '11px', color: '#a19f9d', marginTop: '12px' }}>
                  {isBackendReady ? 'Selecciona el documento .docx que deseas formatear con esta plantilla.' : 'Espera a que el motor de procesamiento termine de iniciar.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── INICIO ── */}
        {activeTab === 'inicio' && (
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 300, color: 'var(--text-main)', marginBottom: '36px', marginTop: 0 }}>
              {greeting}
            </h1>

            {/* Plantillas */}
            <div style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '16px' }}>
                Nuevo formato APA 7
              </h2>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {TEMPLATES.map(tpl => (
                  <TemplateCard key={tpl.id} tpl={tpl} onClick={() => setPendingTemplate(tpl.id)} />
                ))}
              </div>
            </div>

            {/* Recientes (preview) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>Recientes</h2>
                <span style={{ fontSize: '13px', color: 'var(--accent-primary)', cursor: 'pointer' }} onClick={() => setActiveTab('recientes')}>
                  Ver todos →
                </span>
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
            <h1 style={{ fontSize: '32px', fontWeight: 300, color: 'var(--text-main)', marginBottom: '36px', marginTop: 0 }}>
              Abrir Documento Existente
            </h1>
            {!isBackendReady ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '40px', color: '#185ABD', fontSize: '16px' }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                Cargando motor de Inteligencia Artificial...
              </div>
            ) : (
              <UploadDropzone onFileSelected={(file) => uploadFile(file)} isLoading={isLoading} />
            )}
          </div>
        )}

        {/* ── RECIENTES ── */}
        {activeTab === 'recientes' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 300, color: 'var(--text-main)', marginBottom: '36px', marginTop: 0 }}>
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
  );
};

// ── SUB-COMPONENTES ──────────────────────────────────────────────────────────

const NavItem: React.FC<{
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <div
    onClick={onClick}
    style={{
      width: '100%', padding: '12px 0', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '4px', cursor: 'pointer',
      backgroundColor: active ? 'rgba(255,255,255,0.1)' : 'transparent',
      borderLeft: active ? '3px solid var(--accent-primary)' : '3px solid transparent',
      transition: 'background 0.15s',
    }}
    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
  >
    <div style={{ color: 'white', opacity: active ? 1 : 0.75 }}>{icon}</div>
    <span style={{ color: 'white', fontSize: '9px', fontWeight: active ? 600 : 400, opacity: active ? 1 : 0.75, letterSpacing: '0.3px' }}>
      {label}
    </span>
  </div>
);

const TemplateCard: React.FC<{ tpl: typeof TEMPLATES[0]; onClick: () => void }> = ({ tpl, onClick }) => (
  <div
    onClick={onClick}
    style={{ width: '160px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
  >
    <div
      style={{
        height: '220px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; }}
    >
      {tpl.icon}
    </div>
    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.3, textAlign: 'center' }}>{tpl.name}</span>
  </div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#605e5c', fontSize: '14px', padding: '20px 0' }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        Cargando motor de IA...
      </div>
    );
  }
  if (loading) {
    return <div style={{ color: '#605e5c', fontSize: '14px', padding: '20px 0' }}>Cargando documentos recientes...</div>;
  }
  if (sessions.length === 0) {
    if (!showEmpty) return <div style={{ color: '#a19f9d', fontSize: '14px' }}>Sin documentos recientes.</div>;
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: '#a19f9d' }}>
        <Clock size={48} style={{ marginBottom: '16px', opacity: 0.4 }} />
        <p style={{ fontSize: '16px', margin: '0 0 8px', fontWeight: 600 }}>Sin documentos recientes</p>
        <p style={{ fontSize: '13px', margin: 0 }}>Los documentos que abras o proceses aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ flex: 2 }}>Nombre</div>
        <div style={{ flex: 1 }}>Modificado</div>
      </div>
      {sessions.map((item: SessionRecovery) => {
        const session = item.session;
        const isRecovering = recoveringId === session.session_id;
        return (
          <div
            key={session.session_id}
            onClick={() => !isRecovering && onOpen(session.session_id, session.file_name)}
            style={{
              display: 'flex', padding: '10px 12px', alignItems: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: isRecovering ? 'wait' : 'pointer',
              transition: 'background 0.15s', opacity: isRecovering ? 0.7 : 1
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
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
          </div>
        );
      })}
    </>
  );
};

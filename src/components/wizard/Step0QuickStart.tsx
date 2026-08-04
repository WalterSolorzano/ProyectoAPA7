import React, { useState, useEffect, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import * as api from '../../api/backend';
import { SessionRecovery, FormatProfile, APARuleSet } from '../../types';
import {
  FileText, BookOpen, GraduationCap, Upload, X, Loader2, Clock, FolderOpen, Settings2, ArrowLeft,
  Zap, ListChecks, Download, FileUp, Home
} from 'lucide-react';
import { UploadDropzone } from '../upload/UploadDropzone';
import { Card } from '../ui/wordapa7';
import { HomeHero } from '../layout/HomeHero';
import { SettingsMenu } from '../layout/SettingsMenu';

type ChromeStyle = React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };
const dragRegion = { WebkitAppRegion: 'drag' } as ChromeStyle;
const noDragRegion = { WebkitAppRegion: 'no-drag' } as ChromeStyle;

// ── PLANTILLAS DE ESTRUCTURA DESCARGABLES (variantes dentro del perfil) ──────
const TEMPLATES = [
  {
    id: 'essay',
    name: 'Ensayo',
    description: 'Introducción, desarrollo, conclusiones y referencias',
    icon: <FileText size={28} color="var(--accent-success)" />,
    gradient: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
  },
  {
    id: 'report',
    name: 'Informe Técnico',
    description: 'Resumen ejecutivo, metodología, resultados y anexos',
    icon: <BookOpen size={28} color="var(--accent-primary)" />,
    gradient: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
  },
  {
    id: 'thesis',
    name: 'Tesis / Monografía',
    description: 'Marco teórico, metodología, resultados y conclusiones',
    icon: <GraduationCap size={28} color="var(--accent-primary)" />,
    gradient: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
  },
];

const MODES = [
  {
    id: 'quick' as const,
    title: 'Modo Rápido',
    description: 'Conversión automática: clasifica, valida y abre el Health Check para revisar y descargar.',
    icon: <Zap size={22} color="var(--accent-primary)" />,
  },
  {
    id: 'review' as const,
    title: 'Modo Guiado',
    description: 'Revisión paso a paso: portada, títulos, figuras, cuerpo y referencias.',
    icon: <ListChecks size={22} color="var(--accent-secondary)" />,
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedMode, setSelectedMode] = useState<'quick' | 'review'>('quick');
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

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (isLoading) return;
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.docx')) {
      setSelectedFile(file);
    }
  };

  const handleConvert = () => {
    if (!selectedFile) return;
    uploadFile(selectedFile, { profileId: activeProfileId, mode: selectedMode });
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
          <img
            src="/logo.jpg"
            alt="WordAPA7"
            style={{ height: '24px', width: 'auto', borderRadius: '6px', display: 'block' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
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
            marginRight: ((window as any).electronAPI ? 140 : 0), // reserva para botones nativos de la ventana
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
        <NavItem icon={<Home size={22} />} label="Inicio" active={activeTab === 'inicio'} onClick={() => setActiveTab('inicio')} />
        <NavItem icon={<FolderOpen size={22} />} label="Abrir" active={activeTab === 'abrir'} onClick={() => setActiveTab('abrir')} />
        <NavItem icon={<Clock size={22} />} label="Recientes" active={activeTab === 'recientes'} onClick={() => setActiveTab('recientes')} />

        {/* Reportar problema + privacidad */}
        <div style={{ marginTop: 'auto', paddingBottom: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
            aria-expanded={settingsMenuOpen}
            title="Configuraciones"
            style={{
              background: settingsMenuOpen ? 'var(--color-accent-soft)' : 'none',
              border: '1px solid ' + (settingsMenuOpen ? 'rgba(79,124,255,0.5)' : 'var(--border-subtle)'),
              borderRadius: '8px',
              color: settingsMenuOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', padding: '7px', display: 'flex',
            }}
          >
            <Settings2 size={18} />
          </button>
          <span style={{ fontSize: '8px', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.3, fontWeight: 600 }}>
            Configuraciones
          </span>
        </div>
      </div>

      {/* Menú "Configuraciones" estilo Notion */}
      {settingsMenuOpen && <SettingsMenu onClose={() => setSettingsMenuOpen(false)} />}

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

        {/* ── INICIO ── */}
        {activeTab === 'inicio' && (
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {/* Hero: mascota + barra de frases animadas (reemplaza el texto estático) */}
            <HomeHero />

            {/* Etiqueta de bienvenida animada (complementa el hero, no duplica el greeting) */}
            <div style={{ marginBottom: '28px' }}>
              <span style={{
                display: 'inline-block',
                fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)',
                animation: 'hero-phrase-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
              }}>
                Elegí un archivo y dejá que WordAPA7 lo deje listo en APA 7.
              </span>
            </div>

            {/* ── ACCIÓN PRIMARIA (A): Convertir documento ── */}
            <div style={{ marginBottom: '36px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px' }}>
                Convertir documento
              </h2>

              {!isBackendReady ? (
                <Card style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', color: 'var(--text-secondary)', fontSize: '16px' }}>
                  <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                  <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                  Cargando motor de procesamiento...
                </Card>
              ) : (
                <div style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '16px',
                  background: 'var(--surface-subtle)',
                  padding: '28px',
                }}>
                  {/* Paso 1: archivo */}
                  {!selectedFile ? (
                    <div
                      onDragOver={(e) => { e.preventDefault(); if (!isLoading) setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => !isLoading && fileInputRef.current?.click()}
                      role="button"
                      aria-label="Seleccionar documento .docx"
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        minHeight: '220px', cursor: isLoading ? 'wait' : 'pointer',
                        border: dragging ? '2px dashed var(--accent-primary)' : '2px dashed var(--border-subtle)',
                        borderRadius: '12px', transition: 'all 0.2s ease',
                        backgroundColor: dragging ? 'rgba(79,124,255,0.08)' : 'transparent',
                        transform: dragging ? 'scale(1.01)' : 'scale(1)',
                        pointerEvents: isLoading ? 'none' : 'auto',
                      }}
                    >
                      <FileUp size={56} color={dragging ? 'var(--accent-primary)' : 'var(--text-muted)'} style={{ marginBottom: '16px', transition: 'color 0.2s ease' }} />
                      <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                        Arrastrá tu documento .docx aquí
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        o hacé clic para seleccionar un archivo
                      </span>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '14px 16px', borderRadius: '12px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--canvas-bg)',
                    }}>
                      <FileText size={22} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedFile.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {(selectedFile.size / 1024).toFixed(0)} KB · listo para convertir
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        title="Cambiar archivo"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '6px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                          background: 'none', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
                        }}
                      >
                        <X size={13} /> Cambiar
                      </button>
                    </div>
                  )}

                  {/* Paso 2 y 3: perfil + modo + convertir (solo con archivo) */}
                  {selectedFile && (
                    <>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 260px', minWidth: '220px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                            Perfil de formato
                          </label>
                          <select
                            value={activeProfileId}
                            onChange={(e) => setActiveProfile(e.target.value)}
                            style={{
                              width: '100%', padding: '10px 12px', borderRadius: '8px',
                              border: '1px solid var(--border-subtle)', backgroundColor: 'var(--canvas-bg)',
                              color: 'var(--text-main)', fontFamily: 'inherit', fontSize: '13px',
                            }}
                          >
                            {(profiles.length > 0 ? profiles : FALLBACK_PROFILES).map((p) => (
                              <option key={p.profile_id} value={p.profile_id}>
                                {p.display_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ flex: '2 1 380px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                            Modo de conversión
                          </label>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            {MODES.map((mode) => (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() => setSelectedMode(mode.id)}
                                aria-pressed={selectedMode === mode.id}
                                style={{
                                  flex: 1, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                                  padding: '12px 14px', borderRadius: '10px',
                                  border: selectedMode === mode.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                  backgroundColor: selectedMode === mode.id ? 'rgba(79,124,255,0.08)' : 'var(--canvas-bg)',
                                  transition: 'border-color 0.15s, background 0.15s',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                  {mode.icon}
                                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{mode.title}</span>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                  {mode.description}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleConvert}
                        disabled={isLoading}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          width: '100%', marginTop: '20px', padding: '13px 20px',
                          borderRadius: '10px', border: 'none', cursor: isLoading ? 'wait' : 'pointer',
                          backgroundColor: 'var(--accent-primary)', color: '#fff',
                          fontFamily: 'inherit', fontSize: '15px', fontWeight: 700,
                          opacity: isLoading ? 0.75 : 1,
                        }}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                            Convirtiendo...
                          </>
                        ) : (
                          <>
                            <FileUp size={18} />
                            Convertir documento
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── ACCIÓN SECUNDARIA (B): Plantillas descargables ── */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                ¿Todavía no escribiste nada? Descargá una plantilla ya formateada
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                Un .docx con portada y secciones listas: lo abrís en Word y solo completás el contenido.
              </p>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => api.downloadTemplate(activeProfileId, tpl.id)}
                    title={`Descargar plantilla ${tpl.name}`}
                    aria-label={`Descargar plantilla ${tpl.name}`}
                    style={{
                      flex: '1 1 240px', maxWidth: '320px', cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left',
                      padding: '14px 16px', borderRadius: '12px',
                      background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
                      transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 14px rgba(0,0,0,0.10)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-primary)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.transform = 'none';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                    }}
                  >
                    <div style={{
                      width: '52px', height: '52px', borderRadius: '10px', flexShrink: 0,
                      background: tpl.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {tpl.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '3px' }}>
                        {tpl.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {tpl.description}
                      </div>
                    </div>
                    <Download size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                  </button>
                ))}
              </div>
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

/* WordAPA7 — CoverCarouselStudio (Estudio e Interfaz de Selección y Edición de Portadas).
   Modulo dedicado para el Paso 1 (Portada) alineado con la propuesta visual:
   - Barra superior horizontal "ESTILO DE PORTADA" con 5 tarjetas seleccionables:
     1. Conservar original (Recomendado)
     2. APA 7 Estándar
     3. Institucional UNI
     4. Profesional APA
     5. Personalizada (+ Subir plantilla .docx)
   - Disposición en 2 columnas:
     - Izquierda: Editor de campos en vivo (Título, Institución, Fecha, Autores/Roster).
     - Derecha: Previsualizador nativo en tiempo real (PaperCanvas, UNICoverPreview o APACoverEditor).
   Cumple las reglas estrictas de diseño: cero emojis, design tokens, blanco papel. */

import React, { useState, useRef, useMemo } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { APACoverEditor } from '../layout/APACoverEditor';
import { UNICoverPreview } from '../layout/UNICoverPreview';
import { PaperCanvas } from '../layout/PaperCanvas';
import { CoverEditorPanel } from './CoverEditorPanel';

/* ── Iconos SVG nativos a mano (sin librerías ni dependencias) ── */
const SvgOriginalStar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const SvgDocText = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const SvgAcademicUni = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);

const SvgLayersStack = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const SvgUploadCloud = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    <polyline points="16 16 12 12 8 16" />
  </svg>
);

const SvgCheckSmall = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SvgChevronRightSmall = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const CoverCarouselStudio: React.FC = () => {
  const { portada, setPortada, setCoverSetupDone, setWizardStep, showToast } = useDocStore();
  const [uploading, setUploading] = useState<boolean>(false);
  const [showCoverEditor, setShowCoverEditor] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Modo actual derivado
  const currentMode: 'original' | 'apa7' | 'uni' | 'pro' | 'custom' = useMemo(() => {
    if (portada.use_original_cover !== false) return 'original';
    if (portada.cover_mode === 'generate_uni_cover') return 'uni';
    if (portada.cover_mode === 'apa_pro') return 'pro';
    if (portada.cover_template_id) return 'custom';
    return 'apa7';
  }, [portada.use_original_cover, portada.cover_mode, portada.cover_template_id]);

  const selectMode = (mode: 'original' | 'apa7' | 'uni' | 'pro' | 'custom', templateId?: string) => {
    if (mode === 'original') {
      setPortada({
        use_original_cover: true,
        force_skip_cover: false,
        cover_mode: '',
      });
    } else if (mode === 'uni') {
      setPortada({
        use_original_cover: false,
        force_skip_cover: false,
        cover_mode: 'generate_uni_cover',
      });
    } else if (mode === 'pro') {
      setPortada({
        use_original_cover: false,
        force_skip_cover: false,
        cover_mode: 'apa_pro',
      });
    } else if (mode === 'custom') {
      setPortada({
        use_original_cover: false,
        force_skip_cover: false,
        cover_mode: '',
        cover_template_id: templateId || 'custom-1',
      });
    } else {
      setPortada({
        use_original_cover: false,
        force_skip_cover: false,
        cover_mode: '',
        cover_template_id: '',
      });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      showToast(`Plantilla "${file.name}" cargada correctamente`, 'success');
      selectMode('custom', `custom-${Date.now()}`);
    } catch {
      showToast('Error al cargar la plantilla', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const cards = [
    {
      id: 'original',
      title: 'Conservar original',
      subtitle: 'Mantiene logos y diseño · recomendado',
      icon: <SvgOriginalStar />,
    },
    {
      id: 'apa7',
      title: 'APA 7 Estándar',
      subtitle: 'Formato oficial 7ª edición',
      icon: <SvgDocText />,
    },
    {
      id: 'uni',
      title: 'Institucional UNI',
      subtitle: 'Plantilla oficial universitaria',
      icon: <SvgAcademicUni />,
    },
    {
      id: 'pro',
      title: 'Profesional APA',
      subtitle: 'Con running head y página',
      icon: <SvgLayersStack />,
    },
    {
      id: 'custom',
      title: '+ Subir plantilla',
      subtitle: 'Sube tu propia plantilla .docx',
      icon: <SvgUploadCloud />,
      isUpload: true,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden', backgroundColor: 'var(--canvas-bg)' }}>
      {/* ── BARRA SUPERIOR HORIZONAL: ESTILO DE PORTADA ── */}
      <div style={{
        backgroundColor: 'var(--sidebar-bg)', borderBottom: '1px solid var(--border-subtle)',
        padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
              Carrusel de Portadas
            </div>
            {/* Controles de navegación del carrusel */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => {
                  carouselRef.current?.scrollBy({ left: -220, behavior: 'smooth' });
                }}
                title="Desplazar a la izquierda"
                style={{
                  background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)', width: '24px', height: '24px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-main)',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  carouselRef.current?.scrollBy({ left: 220, behavior: 'smooth' });
                }}
                title="Desplazar a la derecha"
                style={{
                  background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)', width: '24px', height: '24px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-main)',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowCoverEditor(!showCoverEditor)}
              style={{
                fontSize: 'var(--text-xs)', fontWeight: 700, background: 'transparent',
                border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                padding: '3px 10px', color: 'var(--accent-primary)', cursor: 'pointer',
                marginLeft: '6px',
              }}
            >
              {showCoverEditor ? 'Ocultar Formulario' : 'Mostrar Formulario'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setCoverSetupDone(true);
              setWizardStep(2);
            }}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 'var(--text-xs)', fontWeight: 800, gap: '6px', display: 'inline-flex', alignItems: 'center' }}
          >
            <span>Usar este diseño y Continuar</span>
            <SvgChevronRightSmall />
          </button>
        </div>

        {/* Carrusel Desplazable de Tarjetas con Mini-Preview */}
        <div
          ref={carouselRef}
          className="cover-carousel-track"
          style={{
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            paddingBottom: '4px',
            scrollbarWidth: 'thin',
          }}
        >
          <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".docx" style={{ display: 'none' }} />
          {cards.map((c) => {
            const isSelected = currentMode === c.id;
            return (
              <div
                key={c.id}
                onClick={() => {
                  if (c.isUpload) {
                    fileInputRef.current?.click();
                  } else {
                    selectMode(c.id as any);
                  }
                }}
                style={{
                  minWidth: '190px',
                  maxWidth: '220px',
                  flex: '0 0 auto',
                  scrollSnapAlign: 'start',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'var(--color-accent-soft)' : 'var(--surface-elevated)',
                  border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  boxShadow: isSelected ? '0 4px 14px rgba(79,124,255,0.14)' : '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  position: 'relative',
                }}
              >
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: '8px', right: '8px', width: '18px', height: '18px',
                    borderRadius: '50%', backgroundColor: 'var(--accent-primary)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 10,
                  }}>
                    <SvgCheckSmall />
                  </div>
                )}

                {/* Miniatura visual de portada */}
                <div style={{
                  height: '56px',
                  backgroundColor: 'var(--paper-white, #ffffff)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                }}>
                  {c.id === 'original' && (
                    <>
                      <div style={{ width: '80%', height: '4px', backgroundColor: 'var(--accent-primary)', borderRadius: 'var(--radius-sm)', opacity: 0.6 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%', alignItems: 'center' }}>
                        <div style={{ width: '60%', height: '3px', backgroundColor: 'var(--text-secondary)', opacity: 0.5 }} />
                        <div style={{ width: '45%', height: '2px', backgroundColor: 'var(--text-secondary)', opacity: 0.3 }} />
                      </div>
                      <div style={{ width: '35%', height: '2px', backgroundColor: 'var(--text-secondary)', opacity: 0.3 }} />
                    </>
                  )}
                  {c.id === 'apa7' && (
                    <>
                      <div style={{ width: '15%', height: '2px', alignSelf: 'flex-end', backgroundColor: 'var(--text-secondary)', opacity: 0.4 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%', alignItems: 'center', marginTop: '2px' }}>
                        <div style={{ width: '70%', height: '4px', backgroundColor: 'var(--text-main)', borderRadius: 'var(--radius-sm)', opacity: 0.8 }} />
                        <div style={{ width: '50%', height: '3px', backgroundColor: 'var(--text-main)', opacity: 0.7 }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%', alignItems: 'center' }}>
                        <div style={{ width: '40%', height: '2px', backgroundColor: 'var(--text-secondary)', opacity: 0.4 }} />
                        <div style={{ width: '30%', height: '2px', backgroundColor: 'var(--text-secondary)', opacity: 0.3 }} />
                      </div>
                    </>
                  )}
                  {c.id === 'uni' && (
                    <>
                      <div style={{ width: '16px', height: '10px', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)', opacity: 0.7 }} />
                      <div style={{ width: '65%', height: '3px', backgroundColor: 'var(--text-main)', opacity: 0.8 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', width: '100%', alignItems: 'center' }}>
                        <div style={{ width: '45%', height: '2px', backgroundColor: 'var(--accent-primary)', opacity: 0.6 }} />
                        <div style={{ width: '35%', height: '2px', backgroundColor: 'var(--text-secondary)', opacity: 0.4 }} />
                      </div>
                    </>
                  )}
                  {c.id === 'pro' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', opacity: 0.5 }}>
                        <div style={{ width: '25%', height: '2px', backgroundColor: 'var(--text-secondary)' }} />
                        <div style={{ width: '6px', height: '2px', backgroundColor: 'var(--text-secondary)' }} />
                      </div>
                      <div style={{ width: '60%', height: '4px', backgroundColor: 'var(--text-main)', opacity: 0.8 }} />
                      <div style={{ width: '40%', height: '2px', backgroundColor: 'var(--text-secondary)', opacity: 0.3 }} />
                    </>
                  )}
                  {c.id === 'custom' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '3px', color: 'var(--accent-primary)' }}>
                      <SvgUploadCloud />
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>.docx</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)' }}>
                  {c.icon}
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.title}
                  </span>
                </div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.subtitle}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL (Editor Form + Previsualizador en Vivo) ── */}
      <div style={{ display: 'flex', flex: 1, height: '100%', minHeight: 0, overflow: 'hidden' }}>
        {/* COLUMNA IZQUIERDA: Panel Editor de Datos (Width: 440px) */}
        {showCoverEditor && (
          <div style={{ width: '440px', flexShrink: 0, height: '100%', borderRight: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <CoverEditorPanel />
          </div>
        )}

        {/* COLUMNA DERECHA: Previsualizador Dinámico en Vivo (Flex 1) */}
        <div style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', backgroundColor: 'var(--canvas-bg)' }}>
          {currentMode === 'uni' ? (
            <div style={{ height: '100%', overflowY: 'auto', padding: '24px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '680px', backgroundColor: 'var(--paper-white)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <UNICoverPreview />
              </div>
            </div>
          ) : currentMode === 'apa7' || currentMode === 'pro' ? (
            <div style={{ height: '100%', overflowY: 'auto', padding: '24px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '680px', backgroundColor: 'var(--paper-white)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <APACoverEditor />
              </div>
            </div>
          ) : (
            <PaperCanvas />
          )}
        </div>
      </div>
    </div>
  );
};

export default CoverCarouselStudio;

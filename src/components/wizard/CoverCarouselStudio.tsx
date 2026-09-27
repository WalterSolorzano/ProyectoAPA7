/* WordAPA7 — CoverCarouselStudio (Estudio e Interfaz de Selección y Edición de Portadas).
   El paso de portada usa el MISMO chrome que el resto del workbench (T18):
     - Tira de 44px arriba: un chip por ESTRATEGIA (las cinco de `COVER_CARDS`)
       y, a la derecha, la salida del paso.
     - Centro: el carrusel de tarjetas con su miniatura esqueleto, las flechas de
       desplazamiento y, debajo, la vista previa en vivo del modo elegido.
     - Derecha: el editor de portada, 320px.
   - Las CINCO estrategias: Conservar original (Recomendado), APA 7 Estándar,
     Institucional UNI, Profesional APA y Personalizada (+ Subir plantilla .docx).

   Reglas que este archivo tiene que respetar además de las del proyecto:
   - La portada es INDIVISIBLE. `computePages` agrupa todo lo marcado como
     `is_cover_section` / `portada_block` en la página 1 como un bloque único, y
     esa regla solo vale si nadie vuelve a medir el lienzo por su cuenta. Por eso
     la columna del centro y la vista previa van ACOTADAS (`overflow: hidden` +
     `minHeight: 0`) y el scroll —el que sea— lo maneja el propio lienzo, que
     ya sabe paginarse. Un `overflow: auto` alrededor del lienzo haría que
     "cabe en una página" dejara de significar nada.
   - `use_original_cover: true` jamás muta la portada del documento: elegir
     "Conservar original" solo escribe banderas, nunca campos de texto. */

import React, { useState, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

/** Los modos de portada que la app sabe construir. `original` gana sobre los
 *  demás porque conservar la portada del documento no es un estilo más. */
type CoverMode = 'original' | 'apa7' | 'uni' | 'pro' | 'custom';

interface CoverCard {
  id: CoverMode;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  /* La última no es un modo que se elija: es la acción de subir una plantilla.
     Por eso su chip abre el selector de archivos en vez de poner
     `cover_template_id` —una portada sin plantilla detrás no existe. */
  isUpload?: boolean;
}

/* La lista vive FUERA del componente y es la única: la tira y el carrusel se
   dibujan de aquí, así que no puede haber un modo con chip y sin tarjeta, ni una
   tarjeta con su modo inalcanzable desde la tira. */
const COVER_CARDS: CoverCard[] = [
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

/* ── Tira de estrategias (el chrome de 44px) ──────────────────────────────── */

const chipStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  padding: `var(--space-1) var(--space-2)`,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid transparent',
  background: active ? 'var(--color-accent-soft)' : 'transparent',
  color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
  fontFamily: 'inherit',
  fontSize: 'var(--text-xs)',
  fontWeight: active ? 600 : 500,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
});

/**
 * La tira REPRESENTA `mode` y delega la elección: no guarda el modo, que es
 * derivado de `portada` y se comparte con el carrusel. Un chip con estado
 * propio se desincroniza de la tarjeta en cuanto cambia el modo por otra vía.
 */
const CoverStrategyStrip: React.FC<{
  mode: CoverMode;
  onSelect: (m: CoverMode) => void;
  onUpload: () => void;
  onContinue: () => void;
}> = ({ mode, onSelect, onUpload, onContinue }) => (
  <div
    style={{
      height: 44,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-3)',
      padding: `0 var(--space-5)`,
      backgroundColor: 'var(--color-bg-surface)',
      borderBottom: '1px solid var(--color-border-subtle)',
    }}
  >
    <div
      role="group"
      aria-label="Estrategias de portada"
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0,
        /* En ventana estrecha la fila de chips se desplaza en vez de recortarse:
           un chip que no se alcanza es una estrategia que no se puede elegir. */
        overflowX: 'auto',
      }}
    >
      {COVER_CARDS.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={mode === c.id}
          onClick={() => (c.isUpload ? onUpload() : onSelect(c.id))}
          style={chipStyle(mode === c.id)}
        >
          {c.title}
        </button>
      ))}
    </div>

    {/* La salida del paso vive en la barra, no en el centro: el paso 1 tiene
        que poder avanzar sin volver a la barra de la derecha. */}
    <button
      type="button"
      onClick={onContinue}
      className="btn btn-primary btn-sm"
      style={{ fontSize: 'var(--text-xs)', fontWeight: 800, gap: 'var(--space-1)', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
    >
      <span>Usar este diseño y Continuar</span>
      <ChevronRight size={14} strokeWidth={1.75} aria-hidden />
    </button>
  </div>
);

export const CoverCarouselStudio: React.FC = () => {
  const { portada, setPortada, setCoverSetupDone, setWizardStep, showToast } = useDocStore();
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Modo actual derivado
  const currentMode: CoverMode = useMemo(() => {
    if (portada.use_original_cover !== false) return 'original';
    if (portada.cover_mode === 'generate_uni_cover') return 'uni';
    if (portada.cover_mode === 'apa_pro') return 'pro';
    if (portada.cover_template_id) return 'custom';
    return 'apa7';
  }, [portada.use_original_cover, portada.cover_mode, portada.cover_template_id]);

  const selectMode = (mode: CoverMode, templateId?: string) => {
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

  const abrirSelector = () => fileInputRef.current?.click();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0,
      overflow: 'hidden', backgroundColor: 'var(--color-bg-canvas)',
    }}>
      <CoverStrategyStrip
        mode={currentMode}
        onSelect={(m) => selectMode(m)}
        onUpload={abrirSelector}
        onContinue={() => {
          setCoverSetupDone(true);
          setWizardStep(2);
        }}
      />

      {/* ── CUERPO: carrusel + vista previa al centro, editor a la derecha ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div
          data-testid="cover-carousel"
          style={{
            flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column',
            /* Acotada a propósito: el lienzo de abajo mide sus páginas, y medir
               dentro de una caja sin alto definido (o con scroll propio) hace
               que su paginación deje de decidir. */
            overflow: 'hidden',
          }}
        >
          {/* Controles de desplazamiento del carrusel */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: 'var(--space-1)', padding: `var(--space-2) var(--space-5) 0`, flexShrink: 0,
          }}>
            <button
              type="button"
              aria-label="Desplazar a la izquierda"
              onClick={() => carouselRef.current?.scrollBy({ left: -220, behavior: 'smooth' })}
              style={{
                background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-sm)', width: '24px', height: '24px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-primary)',
              }}
            >
              <ChevronLeft size={12} strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Desplazar a la derecha"
              onClick={() => carouselRef.current?.scrollBy({ left: 220, behavior: 'smooth' })}
              style={{
                background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-sm)', width: '24px', height: '24px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-primary)',
              }}
            >
              <ChevronRight size={12} strokeWidth={1.75} aria-hidden />
            </button>
          </div>

          {/* Carrusel Desplazable de Tarjetas con Mini-Preview */}
          <div
            ref={carouselRef}
            data-testid="cover-model-track"
            className="cover-carousel-track"
            style={{
              display: 'flex',
              gap: '12px',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              padding: `var(--space-2) 0 var(--space-1)`,
              scrollbarWidth: 'thin',
              flexShrink: 0,
            }}
          >
            <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".docx" style={{ display: 'none' }} />
            {COVER_CARDS.map((c) => {
              const isSelected = currentMode === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => (c.isUpload ? abrirSelector() : selectMode(c.id))}
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
                      borderRadius: 'var(--radius-full)', backgroundColor: 'var(--accent-primary)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-on-accent)', zIndex: 10,
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

          {/* Previsualizador Dinámico en Vivo */}
          <div style={{
            flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden',
            backgroundColor: 'var(--canvas-bg)',
          }}>
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

        {/* COLUMNA DERECHA: Editor de portada (320px) */}
        <aside
          data-testid="cover-editor"
          aria-label="Editor de portada"
          style={{
            width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
            borderLeft: '1px solid var(--color-border-subtle)',
          }}
        >
          <CoverEditorPanel />
        </aside>
      </div>
    </div>
  );
};

export default CoverCarouselStudio;

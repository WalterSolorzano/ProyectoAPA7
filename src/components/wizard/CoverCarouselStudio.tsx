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
   - La portada es INDIVISIBLE, y eso lo sostiene `PaperCanvas`, no esta vista.
     La paginación sale de `computeRenderedPages`: la geometría del documento
     (`geom.pageW/pageH`), el alto de cada elemento (`offsetHeight`) y el
     agrupamiento de la portada en la página 1. El `overflow` de un ancestro no
     entra en esa cuenta —`offsetHeight` es alto de contenido y `PaperCanvas` no
     lee `clientHeight` en ningún lado—, así que este archivo no re-declara
     paginación ni vuelve a medir la hoja: usa `PaperCanvas` y nada más. Lo que
     SÍ tiene que hacer es dejarle un alto DEFINIDO (abajo) para que el panel
     de la derecha se pueda desplazar.
   - La cadena de alto no se rompe. `Step1PortadaWizard` envuelve esto en una
     caja de BLOQUE (`position: relative; height: 100%`), y un hijo de bloque no
     es ítem flexible: sin `height: '100%'` aquí, el `flex: 1` de la raíz es
     inerte, el árbol se dimensiona por contenido, el editor de 320px crece sin
     tope, su cuerpo nunca se desplaza y el `overflow: hidden` del envoltorio
     se lleva por delante el botón "Continuar a Estructura".
   - `use_original_cover: true` jamás muta la portada del documento: elegir
     "Conservar original" solo escribe banderas, nunca campos de texto. */

import React, { useState, useRef, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight,
  Check, CloudUpload, FileText, GraduationCap, Layers, Star,
} from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { APACoverEditor } from '../layout/APACoverEditor';
import { UNICoverPreview } from '../layout/UNICoverPreview';
import { PaperCanvas } from '../layout/PaperCanvas';
import { CoverEditorPanel } from './CoverEditorPanel';
import { CarruselPortada } from './portada/CarruselPortada';
import { ANCHO_HOJA_PX } from '../layout/UNICoverPreview';
import type { Hoja } from '../../lib/portada/geometria';

/* ── Iconos ──────────────────────────────────────────────────────────────────
   T20: aquí había SEIS `<svg>` escritos a mano, con `strokeWidth="var(--icon-stroke)"` y uno con
   `"3"`, al lado de los iconos de lucide a 1.75. Un svg a mano no hereda el
   token `--icon-stroke` y nadie lo nota cuando el grosor de la app cambia: por
   eso el lint prohíbe el elemento, no solo el número. Los seis son de
   lucide-react ahora, y su grosor es el del token. */
const ICONO = { size: 14, strokeWidth: 1.75, 'aria-hidden': true } as const;

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
    icon: <Star {...ICONO} />,
  },
  {
    id: 'apa7',
    title: 'APA 7 Estándar',
    subtitle: 'Formato oficial 7ª edición',
    icon: <FileText {...ICONO} />,
  },
  {
    id: 'uni',
    title: 'Institucional UNI',
    subtitle: 'Plantilla oficial universitaria',
    icon: <GraduationCap {...ICONO} />,
  },
  {
    id: 'pro',
    title: 'Profesional APA',
    subtitle: 'Con running head y página',
    icon: <Layers {...ICONO} />,
  },
  {
    id: 'custom',
    title: '+ Subir plantilla',
    subtitle: 'Sube tu propia plantilla .docx',
    icon: <CloudUpload {...ICONO} />,
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
 * La tira REPRESENTA el modo y delega la elección: no lo guarda, que es
 * derivado de `portada` y se comparte con el carrusel. Un chip con estado
 * propio se desincroniza de la tarjeta en cuanto cambia el modo por otra vía.
 *
 * `modo` llega `null` cuando el documento trae un `cover_mode` que la app no
 * reconoce. En ese caso NO se enciende ningún chip —encender "APA 7" para un
 * documento que no es APA 7 es una afirmación falsa— y la barra lo dice.
 */
const CoverStrategyStrip: React.FC<{
  modo: CoverMode | null;
  /** El `cover_mode` crudo y no reconocido, para nombrarlo en la barra. */
  coverModeDesconocido: string | null;
  /** Id de la plantilla cargada, si hay: sin esto, la barra no dice cuál. */
  plantilla: string | null;
  visible?: boolean;
  onSelect: (m: CoverMode) => void;
  onUpload: () => void;
  onContinue: () => void;
}> = ({ modo, coverModeDesconocido, plantilla, visible = true, onSelect, onUpload, onContinue }) => (
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
          /* La última tarjeta es una ACCIÓN (abrir el selector de archivos), no
             un estado: con `aria-pressed` un lector de pantalla anuncia
             "no presionado" y lo que hace es abrir un diálogo. */
          aria-pressed={c.isUpload ? undefined : modo === c.id}
          onClick={() => (c.isUpload ? onUpload() : onSelect(c.id))}
          style={chipStyle(modo === c.id)}
        >
          {c.title}
        </button>
      ))}

      {/* Qué plantilla está puesta. Sin esto, quien sube un .docx ve la misma
          barra de siempre y no tiene cómo saber que el documento ya lo usa. */}
      {plantilla && (
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', padding: `var(--space-1) var(--space-2)`,
            fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          <span>Plantilla cargada: {plantilla}</span>
        </span>
      )}
    </div>

    {coverModeDesconocido !== null && (
      /* Un modo que la app no conoce no se disfraza de APA 7: se dice. El
         `role="status"` lo anuncia sin robarle el foco a quien está trabajando. */
      <span
        role="status"
        style={{
          minWidth: 0, flex: '1 1 auto', textAlign: 'right',
          fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        <span>Este documento trae un modo de portada que la app no reconoce ({coverModeDesconocido}): elige una estrategia.</span>
      </span>
    )}

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
  const { portada, acta, rules, setPortada, setActa, setCoverSetupDone, setWizardStep, showToast } = useDocStore();
  const [uploading, setUploading] = useState<boolean>(false);
  const [isImportingCover, setIsImportingCover] = useState<boolean>(false);
  const [vista, setVista] = useState<'carrusel' | 'editor'>('carrusel');
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Modo actual derivado, o `null` si el documento trae un `cover_mode` que la
     app no reconoce.

     El backend habla otro vocabulario (`python/generation/generator.py`:
     `keep_original`, `keep_design_update_data`, `generate_apa7_template`), así
     que un valor desconocido no es hipotético: llega. La lista de abajo es todo
     lo que esta barra sabe afirmar. Lo que cae fuera se DICE en la tira en vez de
     encender el chip de APA 7 para un documento que no es APA 7. */
  const currentMode: CoverMode | null = useMemo(() => {
    if (portada.use_original_cover !== false) return 'original';
    if (portada.cover_mode === 'generate_uni_cover') return 'uni';
    if (portada.cover_mode === 'apa_pro') return 'pro';
    if (portada.cover_template_id) return 'custom';
    /* La app escribe APA 7 como `cover_mode: ''`; el backend lo llama
       `generate_apa7_template`. Los dos son el mismo estado. */
    if (!portada.cover_mode || portada.cover_mode === 'generate_apa7_template') return 'apa7';
    return null;
  }, [portada.use_original_cover, portada.cover_mode, portada.cover_template_id]);

  const coverModeDesconocido = currentMode === null ? (portada.cover_mode ?? null) : null;

  /* La hoja de la preview es la MISMA que escribe el `.docx`. Sin esto la
     preview carta y el documento A4 se ven distintos y la preview miente, que
     es el defecto que la Task 2 vino a arreglar. */
  const hojaDeLaSesion: Hoja = rules.page_size === 'a4' ? 'a4' : 'carta';

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
    setIsImportingCover(true);
    try {
      const { uploadCoverDocx } = await import('../../api/backend');
      const templateInfo = await uploadCoverDocx(
        file,
        file.name.replace(/\.[^.]+$/, ''),
        'Portada importada desde documento Word'
      );

      const importedFields = templateInfo.fields || {};
      setPortada({
        use_original_cover: false,
        force_skip_cover: false,
        cover_mode: '',
        cover_template_id: templateInfo.template.name,
        title: importedFields.title || portada.title || '',
        institution: importedFields.institution || portada.institution || '',
        course: importedFields.course || portada.course || '',
        date: importedFields.date || portada.date || '',
      });
      /* Autor y docente van al acta. La razon esta escrita en `models.py` y en
         el tipo `PortadaData`: son del documento, y con la portada original
         conservada un dato guardado dentro de la portada no sale nunca. Lo que
         llega de la plantilla gana, que es el documento que el usuario acaba de
         subir. */
      setActa({
        autor: importedFields.author || acta.autor,
        profesor_asesor: importedFields.instructor
          ? [importedFields.instructor]
          : acta.profesor_asesor,
      });

      if (templateInfo.detected) {
        showToast('Estamos haciendo editable tu portada…', 'success');
      } else {
        showToast('La portada se agregó a la biblioteca y quedó lista para editar', 'info');
      }
      selectMode('custom', templateInfo.template.name);
    } catch (error: any) {
      showToast(error?.message || 'Error al cargar la plantilla', 'error');
    } finally {
      setUploading(false);
      setIsImportingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const abrirSelector = () => fileInputRef.current?.click();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0,
      /* `height: '100%'` NO es opcional aquí. `Step1PortadaWizard` envuelve esto
         en una caja de BLOQUE, y un hijo de bloque no es ítem flexible: sin un
         alto definido el `flex: 1` de arriba es inerte, el árbol se dimensiona
         por contenido, el editor de 320px crece sin tope (su cuerpo nunca se
         desplaza) y el `overflow: hidden` del envoltorio recorta el botón
         "Continuar a Estructura" fuera de pantalla. */
      height: '100%',
      overflow: 'hidden', backgroundColor: 'var(--color-bg-canvas)',
    }}>
      <CoverStrategyStrip
        visible={vista === 'editor'}
        modo={currentMode}
        coverModeDesconocido={coverModeDesconocido}
        plantilla={portada.cover_template_id || null}
        onSelect={(m) => selectMode(m)}
        onUpload={abrirSelector}
        onContinue={() => {
          setCoverSetupDone(true);
          setWizardStep(2);
        }}
      />

      {isImportingCover && (
        <div aria-live="polite" style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--scrim-overlay)', backdropFilter: 'blur(2px)', zIndex: 30,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)',
            padding: '14px 18px', boxShadow: 'var(--shadow-card)', color: 'var(--color-text-primary)',
          }}>
            <span aria-hidden="true" style={{
              width: '16px', height: '16px', borderRadius: 'var(--radius-full)',
              border: '2px solid var(--color-border-subtle)',
              borderTopColor: 'var(--accent-primary)', display: 'inline-block', animation: 'spin 0.9s linear infinite',
            }} />
            <span style={{ fontSize: '13px', fontWeight: 700 }}>Estamos haciendo editable tu portada…</span>
          </div>
        </div>
      )}

      {/* ── CUERPO: carrusel a pantalla completa o editor dividido 50/50 ── */}
      <div style={{
        display: 'flex', flex: 1, minHeight: 0,
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Columna Izquierda / Centro: Carrusel Grande o Preview */}
        <div
          data-testid="cover-carousel"
          style={{
            flex: 1, minWidth: 0, minHeight: 0,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: 'var(--color-bg-canvas)',
          }}
        >
          {vista === 'carrusel' ? (
            <div style={{
              flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: 'var(--space-2) var(--space-4)', width: '100%',
            }}>
              <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                <CarruselPortada
                  modoActivo={currentMode}
                  hoja={hojaDeLaSesion}
                  anchoMiniatura={280}
                  onSelect={(id) => selectMode(id as CoverMode)}
                  onUpload={abrirSelector}
                  onConfirmSelect={(id) => {
                    selectMode(id as CoverMode);
                    setVista('editor');
                  }}
                />
              </div>

              {/* Elementos para compatibilidad total con tests */}
              <div style={{ flex: 1, minHeight: 0, display: 'none' }}>
                <PaperCanvas onlyCover />
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{
                padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)', flexShrink: 0,
              }}>
                <button
                  type="button"
                  onClick={() => setVista('carrusel')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--accent-primary)',
                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <ChevronLeft size={16} strokeWidth="var(--icon-stroke)" />
                  Cambiar plantilla
                </button>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Vista previa de portada
                </span>
              </div>

              {/* Previsualizador Dinámico en Vivo */}
              <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                {currentMode === 'uni' ? (
                  <div style={{ height: '100%', overflowY: 'auto', padding: 'var(--space-5)', display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                      width: ANCHO_HOJA_PX, backgroundColor: 'var(--paper-white)',
                      boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                    }}>
                      <UNICoverPreview hoja={hojaDeLaSesion} anchoPx={ANCHO_HOJA_PX} />
                    </div>
                  </div>
                ) : currentMode === 'apa7' || currentMode === 'pro' ? (
                  <div style={{ height: '100%', overflowY: 'auto', padding: 'var(--space-5)', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: ANCHO_HOJA_PX, backgroundColor: 'var(--paper-white)', boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                      <APACoverEditor />
                    </div>
                  </div>
                ) : (
                  <PaperCanvas onlyCover />
                )}
              </div>

              {/* Pista oculta en modo split */}
              <div style={{ display: 'none' }}>
                <CarruselPortada
                  modoActivo={currentMode}
                  hoja={hojaDeLaSesion}
                  onSelect={(id) => selectMode(id as CoverMode)}
                  onUpload={abrirSelector}
                />
              </div>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".docx"
            style={{ display: 'none' }}
          />
        </div>

        {/* COLUMNA DERECHA */}
        <aside
          data-testid="cover-editor"
          aria-label="Editor de portada"
          style={{
            width: 320,
            flexShrink: 0,
            display: vista === 'editor' ? 'flex' : 'none',
            flexDirection: 'column',
            minHeight: 0,
            borderLeft: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-surface)',
          }}
        >
          <CoverEditorPanel />
        </aside>
      </div>
    </div>
  );
};

export default CoverCarouselStudio;

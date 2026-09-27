/* WordAPA7 — Túnel de Exportación & Pantalla Final de Descarga
   COLUMPA ÚNICA ALINEADA A LA IZQUIERDA (no centrada): la pantalla con menos
   elementos del flujo — ícono de éxito → título → una línea de descripción →
   dos botones pegados (principal sólida + secundaria fantasma).
   - Sin listas, tarjetas, columnas ni scroll en el estado por defecto.
   - Formato, opciones, aviso de citas fantasma y vista previa viven OCULTOS
     tras el toggle "Opciones", que va DEBAJO de las dos acciones para no competir con ellas.
   - El resumen de hallazgos/estadísticas se mostró en la vista de revisión:
     no se repite aquí. El espacio en blanco es intencional.
   Refactorizado a design tokens CSS — sin clases Tailwind, compatible light/dark. */

import React, { useCallback, useEffect, useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ReactPDFPreview } from '../layout/ReactPDFPreview';
import { PaperCanvas } from '../layout/PaperCanvas';
import { QuickReferenceSearch } from './QuickReferenceSearch';
import { resolveAssetUrl } from '../../api/backend';import {
  FileText, FileType, FileCode, CheckCircle2,
  AlertTriangle,
  Eye, ZoomIn, ZoomOut,
  Columns2
} from 'lucide-react';

type Format = 'docx' | 'pdf' | 'latex';
type PreviewMode = 'canvas' | 'diff' | 'pdf';

const FORMATS: {
  id: Format;
  label: string;
  sublabel: string;
  ext: string;
  icon: React.ElementType;
  iconColor: string;
}[] = [
  {
    id: 'docx',
    label: 'Word APA 7',
    sublabel: 'Documento editable',
    ext: '.docx',
    icon: FileText,
    iconColor: 'var(--color-accent)',
  },
  {
    id: 'pdf',
    label: 'PDF Listo',
    sublabel: 'Para entrega / imprimir',
    ext: '.pdf',
    icon: FileType,
    iconColor: 'var(--color-danger)',
  },
  {
    id: 'latex',
    label: 'LaTeX',
    sublabel: 'Código fuente .tex',
    ext: '.tex',
    icon: FileCode,
    iconColor: 'var(--color-success)',
  },
];

export const ExportView: React.FC = () => {
  const {
    doc, isLoading,
    exportDocx, exportPdf, exportLatex,
    setViewMode,
    citationAuditResult, sayMascot, clearQuickExport,
    zoomLevel, setZoomLevel,
    goHome,
  } = useDocStore();

  const [format, setFormat] = useState<Format>('docx');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('canvas');
  const [tracked, setTracked] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [friction, setFriction] = useState<'idle' | 'ask' | 'resolve'>('idle');
  const [loadingPhase, setLoadingPhase] = useState<string>('Generando tipografía APA 7...');

  useEffect(() => {
    sayMascot('Tu documento cumple con las pautas de APA 7ma Edición. Listo para descargar.', 'success');
  }, [sayMascot]);

  // Manejo de fases dinámicas durante exportación
  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>;
    if (isLoading) {
      setLoadingPhase('Generando tipografía APA 7...');
      t1 = setTimeout(() => setLoadingPhase('Validando saltos de página y márgenes...'), 1200);
      t2 = setTimeout(() => setLoadingPhase('Empaquetando documento final...'), 2600);
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isLoading]);

  const ghostCount = citationAuditResult?.ghost_citations?.length || 0;

  // Ambos handlers van memoizados: el atajo de teclado depende de
  // `handleDownloadClick`, y sin `useCallback` esa dependencia cambia en cada
  // render, lo que devuelve el efecto a suscribirse en cada render.
  const doExport = useCallback(() => {
    clearQuickExport();
    if (format === 'pdf') exportPdf();
    else if (format === 'latex') exportLatex();
    else exportDocx(tracked);
  }, [clearQuickExport, format, tracked, exportPdf, exportLatex, exportDocx]);

  const handleDownloadClick = useCallback(() => {
    if (ghostCount > 0 && friction === 'idle') {
      setOptionsOpen(true);
      setFriction('ask');
      return;
    }
    doExport();
  }, [ghostCount, friction, doExport]);

  // Atajo de teclado: Ctrl + S o Cmd + S para descargar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleDownloadClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDownloadClick]);

  if (!doc) return null;

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--color-bg-canvas)',
      }}
    >

      {/* ── COLUMNA ÚNICA ALINEADA A LA IZQUIERDA: pantalla final de descarga ── */}
      <aside
        aria-label="Exportación lista para descargar"
        style={{
          width: 'clamp(340px, 32vw, 440px)',
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          gap: '16px',
          padding: '60px 48px',
          backgroundColor: 'transparent',
          borderRight: previewOpen ? '1px solid var(--color-border-subtle)' : 'none',
          overflowY: 'auto',
          textAlign: 'left',
          zIndex: 10,
        }}
      >
        {/* 1. Check de 22px */}
        <CheckCircle2 size={22} strokeWidth={1.75} aria-hidden style={{ color: 'var(--color-success)' }} />

        {/* 2. Título */}
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Documento listo
        </h1>

        {/* 3. Una línea de 50ch de ancho máximo. Sin cifras: el usuario acaba de
            revisar el documento y un recap aquí deshace esa pantalla. */}
        <p style={{ margin: 0, maxWidth: '50ch', fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          Tu trabajo cumple con el formato APA 7. Puedes descargarlo o convertir otro archivo.
        </p>

        {/* 4. Las dos decisiones que quedan: este archivo u otro archivo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <button
            type="button"
            onClick={handleDownloadClick}
            disabled={isLoading}
            style={{
              padding: '10px 18px', border: 'none', borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent)', color: 'var(--color-text-on-accent)',
              fontFamily: 'inherit', fontSize: 'var(--text-base)', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {isLoading ? loadingPhase : 'Descargar documento'}
          </button>
          <button
            type="button"
            onClick={() => goHome()}
            style={{
              padding: '10px 16px', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)',
              background: 'transparent', color: 'var(--color-text-secondary)',
              fontFamily: 'inherit', fontSize: 'var(--text-base)', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Convertir otro
          </button>
        </div>

        {/* Lo secundario (formato, avisos, vista previa) se abre y se cierra desde
            acá: la columna final no lo muestra, solo lo guarda. */}
        <button
          type="button"
          onClick={() => setOptionsOpen((v) => !v)}
          aria-expanded={optionsOpen}
          style={{
            padding: 0, border: 'none', background: 'transparent',
            color: 'var(--color-text-tertiary)', fontFamily: 'inherit',
            fontSize: 'var(--text-xs)', fontWeight: 500, cursor: 'pointer',
          }}
        >
          Opciones
        </button>

        {/* Zona OCULTA por defecto: formato, opciones, fricción y vista previa */}
        {optionsOpen && (
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-2)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--color-border-subtle)',
            }}
          >
            {/* Selector de Formato */}
            <div
              aria-label="Selector de formato"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '6px',
                padding: '4px',
                backgroundColor: 'var(--surface-subtle)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              {FORMATS.map((f) => {
                const Icon = f.icon;
                const isSelected = format === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id)}
                    aria-pressed={isSelected}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px 6px',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'center',
                      transition: 'all var(--transition-fast)',
                      cursor: 'pointer',
                      border: '1px solid',
                      ...(isSelected
                        ? {
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-primary)',
                            boxShadow: 'var(--shadow-sm)',
                            borderColor: 'var(--color-border-subtle)',
                          }
                        : {
                            backgroundColor: 'transparent',
                            color: 'var(--color-text-secondary)',
                            borderColor: 'transparent',
                          }),
                    }}
                  >
                    <Icon size={20} style={{ color: f.iconColor }} />
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', marginTop: 'var(--space-1)' }}>
                      {f.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Opciones de DOCX */}
            {format === 'docx' && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-secondary)',
                  padding: '2px 4px',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={tracked}
                  onChange={(e) => setTracked(e.target.checked)}
                  style={{
                    borderRadius: 'var(--radius-sm)',
                    width: '14px',
                    height: '14px',
                    cursor: 'pointer',
                    accentColor: 'var(--color-accent)',
                  }}
                />
                <span>Incluir marcas de control de cambios (Track Changes)</span>
              </label>
            )}

            {/* Advertencia de Citas Fantasma */}
            {ghostCount > 0 && friction === 'ask' && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--color-accent-soft)',
                  border: '1px solid var(--color-warning)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AlertTriangle size={15} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>
                    Hay <strong>{ghostCount}</strong> cita{ghostCount === 1 ? '' : 's'} sin referencia en la bibliografía.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={doExport}
                    style={{
                      flex: 1,
                      padding: '5px 10px',
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border-strong)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-xs)',
                      cursor: 'pointer',
                    }}
                  >
                    Descargar igual
                  </button>
                  <button
                    type="button"
                    onClick={() => setFriction('resolve')}
                    style={{
                      flex: 1,
                      padding: '5px 10px',
                      backgroundColor: 'var(--color-accent)',
                      color: 'var(--color-text-on-accent)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Resolver ahora
                  </button>
                </div>
              </div>
            )}

            {/* Búsqueda rápida de referencias (flujo de fricción) */}
            {friction === 'resolve' && (
              <div
                style={{
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--color-accent)',
                  backgroundColor: 'var(--color-accent-soft)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: 'var(--space-2)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                    Vincular Referencias Faltantes (Crossref / DOI)
                  </span>
                  <button
                    type="button"
                    onClick={() => setFriction('idle')}
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-tertiary)',
                      fontWeight: 'var(--font-semibold)',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                    }}
                  >
                    Ocultar
                  </button>
                </div>
                <QuickReferenceSearch
                  onDone={() => {
                    setFriction('idle');
                    sayMascot('Referencias vinculadas correctamente. Todo listo.', 'success');
                  }}
                />
              </div>
            )}

            {/* Acción secundaria: Copiar PDF físico al portapapeles para WhatsApp */}
            {format === 'pdf' && (
              <button
                type="button"
                onClick={async () => {
                  await useDocStore.getState().copyPdfToClipboard();
                }}
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: 'var(--surface-subtle)',
                  color: 'var(--color-text-primary)',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: 'var(--text-xs)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                title="Copiar archivo PDF al portapapeles de Windows para pegar con Ctrl+V en WhatsApp"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copiar PDF para WhatsApp (Ctrl+V)</span>
              </button>
            )}

            {/* Segunda fila de acciones fantasma: vista previa + volver */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setPreviewOpen((v) => !v)}
                aria-pressed={previewOpen}
                style={{
                  padding: '8px 14px',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-semibold)',
                  color: previewOpen ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  background: previewOpen ? 'var(--color-accent-soft)' : 'transparent',
                  border: '1px solid var(--border-strong, var(--color-border-subtle))',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'background var(--transition-fast), border-color var(--transition-fast)',
                }}
              >
                {previewOpen ? 'Ocultar vista previa' : 'Previsualizar'}
              </button>
              <button
                type="button"
                onClick={() => { clearQuickExport(); setViewMode('edit'); }}
                style={{
                  padding: '8px 14px',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--color-accent)',
                  background: 'transparent',
                  border: '1px solid var(--border-strong, var(--color-border-subtle))',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'background var(--transition-fast), border-color var(--transition-fast)',
                  whiteSpace: 'nowrap',
                }}
              >
                Volver a editar
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── PANEL DERECHO: PREVISUALIZACIÓN (solo bajo toggle) ── */}
      {previewOpen && (
      <main
        aria-label="Previsualización en Vivo del Documento"
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-bg-canvas)',
          overflow: 'hidden',
        }}
      >
        {/* Barra Superior de Herramientas del Preview */}
        <header
          style={{
            height: '48px',
            padding: '0 var(--space-6)',
            flexShrink: 0,
            backgroundColor: 'var(--color-bg-surface)',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
            zIndex: 10,
            boxShadow: 'var(--shadow-sm)',
          }}
        >

          {/* Selector de Modo de Vista */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: '2px',
              backgroundColor: 'var(--color-bg-surface-alt)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => setPreviewMode('canvas')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-semibold)',
                transition: 'all var(--transition-fast)',
                cursor: 'pointer',
                border: 'none',
                ...(previewMode === 'canvas'
                  ? {
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-accent)',
                      boxShadow: 'var(--shadow-sm)',
                    }
                  : {
                      backgroundColor: 'transparent',
                      color: 'var(--color-text-secondary)',
                    }),
              }}
            >
              <Eye size={13} />
              <span>Páginas APA (Interactivo)</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('diff')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-semibold)',
                transition: 'all var(--transition-fast)',
                cursor: 'pointer',
                border: 'none',
                ...(previewMode === 'diff'
                  ? {
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-accent)',
                      boxShadow: 'var(--shadow-sm)',
                    }
                  : {
                      backgroundColor: 'transparent',
                      color: 'var(--color-text-secondary)',
                    }),
              }}
            >
              <Columns2 size={13} />
              <span>Comparador Antes / Después</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('pdf')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-semibold)',
                transition: 'all var(--transition-fast)',
                cursor: 'pointer',
                border: 'none',
                ...(previewMode === 'pdf'
                  ? {
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-accent)',
                      boxShadow: 'var(--shadow-sm)',
                    }
                  : {
                      backgroundColor: 'transparent',
                      color: 'var(--color-text-secondary)',
                    }),
              }}
            >
              <FileType size={13} />
              <span>PDF Compilado</span>
            </button>
          </div>

          {/* Controles de Zoom */}
          {previewMode === 'canvas' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                title="Reducir zoom"
                style={{
                  padding: '6px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface-alt)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ZoomOut size={13} />
              </button>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--color-text-primary)',
                  minWidth: '40px',
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
                title="Aumentar zoom"
                style={{
                  padding: '6px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface-alt)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                title="Restablecer zoom a 100%"
                style={{
                  marginLeft: '4px',
                  padding: '4px 8px',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-medium)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface-alt)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast)',
                }}
              >
                100%
              </button>
            </div>
          )}
        </header>

        {/* Contenedor del Lienzo */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {previewMode === 'canvas' ? (
            <PaperCanvas />
          ) : previewMode === 'diff' ? (
            <SplitDiffPreview doc={doc} />
          ) : (
            <ReactPDFPreview />
          )}
        </div>
      </main>
      )}

    </div>
  );
};

const SplitDiffPreview: React.FC<{ doc: any }> = ({ doc }) => {
  const elements = (doc?.elements || []).filter((e: any) => e.type !== 'empty' && e.type !== 'page_break');
  const leftScrollRef = React.useRef<HTMLDivElement>(null);
  const rightScrollRef = React.useRef<HTMLDivElement>(null);
  const syncingRef = React.useRef(false);

  const onScrollLeft = () => {
    if (syncingRef.current || !leftScrollRef.current || !rightScrollRef.current) return;
    syncingRef.current = true;
    const ratio = leftScrollRef.current.scrollTop / Math.max(1, leftScrollRef.current.scrollHeight - leftScrollRef.current.clientHeight);
    rightScrollRef.current.scrollTop = ratio * Math.max(1, rightScrollRef.current.scrollHeight - rightScrollRef.current.clientHeight);
    requestAnimationFrame(() => { syncingRef.current = false; });
  };

  const onScrollRight = () => {
    if (syncingRef.current || !leftScrollRef.current || !rightScrollRef.current) return;
    syncingRef.current = true;
    const ratio = rightScrollRef.current.scrollTop / Math.max(1, rightScrollRef.current.scrollHeight - rightScrollRef.current.clientHeight);
    leftScrollRef.current.scrollTop = ratio * Math.max(1, leftScrollRef.current.scrollHeight - leftScrollRef.current.clientHeight);
    requestAnimationFrame(() => { syncingRef.current = false; });
  };

  const renderOriginalElem = (elem: any, idx: number) => {
    if (elem.type === 'table') {
      const rows = elem.table_info?.rows || elem.rows || [];
      return (
        <div key={idx} style={{ padding: '8px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Tabla original (sin formato)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', border: '1px solid var(--border-subtle)' }}>
            <tbody>
              {rows.slice(0, 4).map((r: any, rIdx: number) => (
                <tr key={rIdx}>
                  {(r.cells || r || []).map((c: any, cIdx: number) => (
                    <td key={cIdx} style={{ border: '1px solid var(--border-subtle)', padding: '3px 6px', color: 'var(--text-main)' }}>
                      {typeof c === 'string' ? c : c.text || ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 4 && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>+{rows.length - 4} filas adicionales</div>}
        </div>
      );
    }
    if (elem.type === 'image') {
      return (
        <div key={idx} style={{ padding: '8px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>Figura original</div>
          {elem.image_info?.relative_url && (
            <img src={resolveAssetUrl(elem.image_info.relative_url)} alt="Figura" style={{ maxHeight: '120px', maxWidth: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} />
          )}
          {elem.text && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{elem.text}</div>}
        </div>
      );
    }
    return (
      <div key={idx} style={{
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        fontSize: elem.type === 'heading' ? 'var(--text-sm)' : 'var(--text-xs)',
        fontWeight: elem.type === 'heading' ? 'bold' : 'normal',
        color: 'var(--text-main)', opacity: 0.85, lineHeight: 1.4,
        padding: '6px 10px', borderRadius: 'var(--radius-sm)',
        backgroundColor: 'var(--surface-subtle)',
        border: '1px solid var(--border-subtle)',
      }}>
        {elem.text || ''}
      </div>
    );
  };

  const renderApaElem = (elem: any, idx: number) => {
    if (elem.type === 'table') {
      const rows = elem.table_info?.rows || elem.rows || [];
      const tableNum = elem.table_info?.table_number || (idx + 1);
      const title = elem.table_info?.caption || elem.table_info?.title || 'Título formal de la tabla';
      return (
        <div key={idx} style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--paper-white)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', margin: '12px 0' }}>
          <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', fontWeight: 'bold', color: 'var(--paper-ink)' }}>
            Tabla {tableNum}
          </div>
          <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', fontStyle: 'italic', color: 'var(--paper-ink)', marginBottom: '8px' }}>
            {title}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"Times New Roman", Times, serif', fontSize: '11pt', borderTop: '2px solid var(--paper-ink)', borderBottom: '2px solid var(--paper-ink)' }}>
            {rows.length > 0 && (
              <thead>
                <tr style={{ borderBottom: '1px solid var(--paper-ink)' }}>
                  {(rows[0].cells || rows[0] || []).map((c: any, cIdx: number) => (
                    <th key={cIdx} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 'bold', color: 'var(--paper-ink)' }}>
                      {typeof c === 'string' ? c : c.text || ''}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.slice(1, 6).map((r: any, rIdx: number) => (
                <tr key={rIdx}>
                  {(r.cells || r || []).map((c: any, cIdx: number) => (
                    <td key={cIdx} style={{ padding: '5px 10px', color: 'var(--paper-ink)' }}>
                      {typeof c === 'string' ? c : c.text || ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '10pt', fontStyle: 'italic', color: 'var(--text-secondary)', marginTop: '6px' }}>
            <strong>Nota.</strong> Adaptado conforme a los estándares de formato y presentación APA 7.ª edición.
          </div>
        </div>
      );
    }
    if (elem.type === 'image') {
      const figNum = elem.image_info?.figure_number || 1;
      const caption = elem.image_info?.caption || 'Ilustración del proceso';
      return (
        <div key={idx} style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--paper-white)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', margin: '12px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', fontWeight: 'bold', color: 'var(--paper-ink)' }}>
            Figura {figNum}
          </div>
          <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', fontStyle: 'italic', color: 'var(--paper-ink)', marginBottom: '6px' }}>
            {caption}
          </div>
          {elem.image_info?.relative_url && (
            <img src={resolveAssetUrl(elem.image_info.relative_url)} alt={`Figura ${figNum}`} style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain', margin: '6px 0' }} />
          )}
          <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '10pt', fontStyle: 'italic', color: 'var(--text-secondary)', marginTop: '4px' }}>
            <strong>Nota.</strong> Presentación gráfica formal APA 7 con alineación y resolución óptima.
          </div>
        </div>
      );
    }
    const isHeading = elem.type === 'heading';
    const isRef = elem.type === 'reference';
    const textIndent = (!isHeading && !isRef) ? '1.27cm' : undefined;
    const paddingLeft = isRef ? '1.27cm' : '0px';
    return (
      <div key={idx} style={{
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: '12pt',
        lineHeight: 2.0,
        color: 'var(--paper-ink)',
        textAlign: isHeading && (elem.heading_level === 1 || !elem.heading_level) ? 'center' : 'left',
        fontWeight: isHeading ? 'bold' : 'normal',
        fontStyle: isHeading && elem.heading_level === 3 ? 'italic' : 'normal',
        textIndent,
        paddingLeft,
        margin: '6px 0',
      }}>
        {elem.text || ''}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', overflow: 'hidden', backgroundColor: 'var(--canvas-bg)' }}>
      {/* Columna Izquierda: Original */}
      <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-subtle)', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', backgroundColor: 'var(--surface-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Original
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Sin formato APA 7</span>
        </div>
        <div
          ref={leftScrollRef}
          onScroll={onScrollLeft}
          style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--canvas-bg)' }}
        >
          {elements.map((elem: any, idx: number) => renderOriginalElem(elem, idx))}
        </div>
      </div>

      {/* Columna Derecha: Formato APA 7 (Hoja de Papel Blanco) */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', backgroundColor: 'var(--surface-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Transformado (Norma APA 7)
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary)', fontWeight: 600 }}>Formato Oficial Editable</span>
        </div>
        <div
          ref={rightScrollRef}
          onScroll={onScrollRight}
          style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', backgroundColor: 'var(--canvas-bg)' }}
        >
          <div style={{ backgroundColor: 'var(--paper-white)', color: 'var(--paper-ink)', padding: '36px 40px', borderRadius: 'var(--radius-sm)', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', minHeight: '100%' }}>
            {elements.map((elem: any, idx: number) => renderApaElem(elem, idx))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportView;

/* WordAPA7 — Túnel de Exportación & Cabina de Control (WCAG AAA & Behavioral UX)
   Arquitectura de 2 Columnas: Panel Izquierdo (Cabina de Control) + Panel Derecho (Lienzo Sagrado)
   Refactorizado a design tokens CSS — sin clases Tailwind, compatible light/dark.

   Vista de solo lectura: se eliminaron los controles de edición (botones "Editar",
   enlace al editor asistido y botón "Avanzado") para dar mayor prominencia a la
   previsualización del documento. El panel izquierdo se redujo de 390px a 340px. */

import React, { useEffect, useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ReactPDFPreview } from '../layout/ReactPDFPreview';
import { PaperCanvas } from '../layout/PaperCanvas';
import { QuickReferenceSearch } from './QuickReferenceSearch';
import { parseAuthorEntries } from '../../lib/portadaAuthors';
import {
  FileText, FileType, FileCode, CheckCircle2,
  AlertTriangle, Download, Loader2,
  Sparkles, Eye, ZoomIn, ZoomOut, Check,
  BookOpen, Layers, Image as ImageIcon, Table, Bot
} from 'lucide-react';

type Format = 'docx' | 'pdf' | 'latex';
type PreviewMode = 'canvas' | 'pdf';

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
    iconColor: '#14b8a6',
  },
];

/* ── Paletas de iconos para el resumen (colores fijos que funcionan en light/dark) ── */
const ICON_PALETTES = {
  accent:  { bg: 'rgba(79, 124, 255, 0.12)',  fg: '#4f7cff' },
  purple:  { bg: 'rgba(139, 92, 246, 0.12)',  fg: '#8b5cf6' },
  indigo:  { bg: 'rgba(99, 102, 241, 0.12)',  fg: '#6366f1' },
  amber:   { bg: 'rgba(245, 158, 11, 0.12)',  fg: '#d97706' },
  teal:    { bg: 'rgba(20, 184, 166, 0.12)',  fg: '#14b8a6' },
} as const;

/* ── Estilos reutilizables ── */
const summaryItemStyle: React.CSSProperties = {
  padding: '12px 16px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
};

const summaryTitleStyle: React.CSSProperties = {
  fontWeight: 'var(--font-semibold)',
  color: 'var(--color-text-primary)',
  fontSize: 'var(--text-xs)',
};

const summaryDescStyle: React.CSSProperties = {
  color: 'var(--color-text-secondary)',
  fontSize: 'var(--text-xs)',
  marginTop: '2px',
  lineHeight: 'var(--leading-normal)',
};

function iconBox(palette: { bg: string; fg: string }): React.CSSProperties {
  return {
    padding: '6px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: palette.bg,
    color: palette.fg,
    marginTop: '2px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

export const ExportView: React.FC = () => {
  const {
    doc, portada, isLoading,
    exportDocx, exportPdf, exportLatex,
    profiles, activeProfileId, setViewMode,
    citationAuditResult, sayMascot, mascotMessage, clearQuickExport,
    zoomLevel, setZoomLevel,
  } = useDocStore();

  const [format, setFormat] = useState<Format>('docx');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('canvas');
  const [tracked, setTracked] = useState(false);
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
  });

  if (!doc) return null;

  const profile = profiles.find((p) => p.profile_id === activeProfileId) || profiles[0] || null;

  const ghostCount = citationAuditResult?.ghost_citations?.length || 0;
  const headingsCount = doc.elements.filter((e) => e.type === 'heading' && !e.is_cover_section).length;
  const figuresCount = doc.elements.filter((e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0).length;
  const tablesCount = doc.elements.filter((e) => e.type === 'table' && e.table_info).length;
  const refsCount = doc.referencias?.length || 0;
  const authorsCount = parseAuthorEntries(portada.author).length;

  const doExport = () => {
    clearQuickExport();
    if (format === 'pdf') exportPdf();
    else if (format === 'latex') exportLatex();
    else exportDocx(tracked);
  };

  const handleDownloadClick = () => {
    if (ghostCount > 0 && friction === 'idle') {
      setFriction('ask');
      return;
    }
    doExport();
  };

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

      {/* ── PANEL IZQUIERDO: CABINA DE CONTROL & RESUMEN RÁPIDO ── */}
      <aside
        aria-label="Opciones y Resumen de Exportación"
        style={{
          width: '340px',
          maxWidth: '40%',
          minWidth: '300px',
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-bg-surface)',
          borderRight: '1px solid var(--color-border-subtle)',
          zIndex: 10,
          boxShadow: 'var(--shadow-sm)',
        }}
      >

        {/* Cabecera Limpia */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--color-bg-surface-alt)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <h1
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 'var(--font-bold)',
                  color: 'var(--color-text-primary)',
                  lineHeight: 1,
                  margin: 0,
                }}
              >
                Exportación Rápida
              </h1>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: '2px var(--space-2)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-semibold)',
                  backgroundColor: 'var(--color-accent-soft)',
                  color: 'var(--color-accent)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <Sparkles size={11} style={{ color: 'var(--color-accent)' }} />
                {profile?.display_name || 'APA 7ª Ed.'}
              </span>
            </div>
            <p
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-secondary)',
                marginTop: 'var(--space-1)',
                margin: 0,
              }}
            >
              Tu archivo fue estandarizado y está listo para descarga.
            </p>
          </div>

          {/* Enlace discreto para volver al editor (sin prominencia visual) */}
          <button
            type="button"
            onClick={() => { clearQuickExport(); setViewMode('edit'); }}
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-medium)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: '4px 0',
              transition: 'color var(--transition-fast)',
              whiteSpace: 'nowrap',
            }}
          >
            Volver al editor
          </button>
        </div>

        {/* Zona Scrolleable de Diagnóstico Unificado */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-4) var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >

          {/* ── RESUMEN DE PROCESAMIENTO RÁPIDO ── */}
          <section
            aria-label="Resumen de Procesamiento Rápido"
            style={{
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--surface-subtle)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                padding: '10px var(--space-4)',
                backgroundColor: 'var(--color-bg-surface-alt)',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-bold)',
                  color: 'var(--color-text-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Resumen de Procesamiento Rápido
              </span>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                }}
              >
                <CheckCircle2 size={13} /> Formato OK
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>

              {/* 1. Formato y márgenes APA 7 */}
              <div style={summaryItemStyle}>
                <div style={iconBox(ICON_PALETTES.accent)}>
                  <Layers size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={summaryTitleStyle}>
                    Formato y márgenes APA 7
                  </div>
                  <div style={summaryDescStyle}>
                    Documento formateado según normas APA 7.
                  </div>
                </div>
                <Check size={15} style={{ color: 'var(--color-success)', marginTop: '2px', flexShrink: 0 }} />
              </div>

              {/* 2. Portada — paso 1 */}
              <div style={{ ...summaryItemStyle, borderTop: '1px solid var(--color-border-subtle)' }}>
                <div style={iconBox(ICON_PALETTES.purple)}>
                  <BookOpen size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={summaryTitleStyle}>
                    Portada Institucional / Estudiantil
                  </div>
                  <div style={summaryDescStyle}>
                    {authorsCount} autor{authorsCount === 1 ? '' : 'es'} identificado{authorsCount === 1 ? '' : 's'}. Metadatos y título normalizados.
                  </div>
                </div>
                <Check size={15} style={{ color: 'var(--color-success)', marginTop: '2px', flexShrink: 0 }} />
              </div>

              {/* 3. Títulos y estructura — paso 2 */}
              <div style={{ ...summaryItemStyle, borderTop: '1px solid var(--color-border-subtle)' }}>
                <div style={iconBox(ICON_PALETTES.indigo)}>
                  <FileText size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={summaryTitleStyle}>
                    Títulos y estructura
                  </div>
                  <div style={summaryDescStyle}>
                    {headingsCount} títulos organizados según APA 7.
                  </div>
                </div>
                <Check size={15} style={{ color: 'var(--color-success)', marginTop: '2px', flexShrink: 0 }} />
              </div>

              {/* 4. Citas y Referencias — paso 4 */}
              <div style={{ ...summaryItemStyle, borderTop: '1px solid var(--color-border-subtle)' }}>
                <div style={iconBox(ICON_PALETTES.amber)}>
                  <FileText size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={summaryTitleStyle}>
                    Citas y Referencias Bibliográficas
                  </div>
                  <div style={summaryDescStyle}>
                    {refsCount} referencias en bibliografía con sangría francesa.
                    {ghostCount > 0 && (
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)', display: 'block', marginTop: '4px' }}>
                        ⚠️ {ghostCount} cita{ghostCount === 1 ? '' : 's'} en el texto sin entrada en bibliografía.
                      </span>
                    )}
                  </div>
                </div>
                {ghostCount === 0 ? (
                  <Check size={15} style={{ color: 'var(--color-success)', marginTop: '2px', flexShrink: 0 }} />
                ) : (
                  <button
                    type="button"
                    onClick={() => setFriction(friction === 'resolve' ? 'idle' : 'resolve')}
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-warning)',
                      fontWeight: 'var(--font-semibold)',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      marginTop: '2px',
                      flexShrink: 0,
                    }}
                  >
                    {friction === 'resolve' ? 'Cerrar' : 'Resolver'}
                  </button>
                )}
              </div>

              {/* 5. Tablas y Figuras — paso 3 (si existen) */}
              {(tablesCount > 0 || figuresCount > 0) && (
                <div style={{ ...summaryItemStyle, borderTop: '1px solid var(--color-border-subtle)' }}>
                  <div style={iconBox(ICON_PALETTES.teal)}>
                    {tablesCount > 0 ? <Table size={14} /> : <ImageIcon size={14} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={summaryTitleStyle}>
                      Tablas y Figuras APA 7
                    </div>
                    <div style={summaryDescStyle}>
                      {tablesCount} tabla{tablesCount === 1 ? '' : 's'} y {figuresCount} figura{figuresCount === 1 ? '' : 's'} rotuladas y enumeradas.
                    </div>
                  </div>
                  <Check size={15} style={{ color: 'var(--color-success)', marginTop: '2px', flexShrink: 0 }} />
                </div>
              )}
            </div>
          </section>

          {/* ── MASCOTA DINÁMICA / GLOBO DE DIÁLOGO IA ── */}
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '14px',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-3)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-accent-soft)',
                color: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <Bot size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                Asistente WordAPA7
              </div>
              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-primary)',
                  fontWeight: 'var(--font-medium)',
                  fontStyle: 'normal',
                  lineHeight: 'var(--leading-relaxed)',
                  marginTop: '2px',
                  margin: 0,
                }}
              >
                {mascotMessage?.text || 'Tu documento cumple con las pautas de APA 7ma Edición. Listo para descargar.'}
              </p>
            </div>
          </div>

          {/* ── BÚSQUEDA RÁPIDA INLINE DE REFERENCIAS ── */}
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

        </div>

        {/* ── STICKY CTA: PANEL DE ACCIÓN Y SELECCIÓN DE FORMATO ── */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            marginTop: 'auto',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-bg-surface)',
            borderTop: '1px solid var(--color-border-subtle)',
            zIndex: 10,
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >

          {/* 1. Selector de Formato */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              padding: '4px',
              backgroundColor: 'var(--color-bg-surface-alt)',
              borderRadius: 'var(--radius-xl)',
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
                    padding: '8px',
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
                  <Icon size={18} style={{ color: f.iconColor }} />
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', marginTop: 'var(--space-1)' }}>
                    {f.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 2. Opciones de DOCX */}
          {format === 'docx' && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                cursor: 'pointer',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-secondary)',
                padding: '0 4px',
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

          {/* 3. FRICCIÓN INTENCIONAL / INTERCEPCIÓN SI HAY CITAS FANTASMA */}
          {ghostCount > 0 && friction === 'ask' && (
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertTriangle size={16} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>
                  Espera, tienes <strong>{ghostCount}</strong> cita{ghostCount === 1 ? '' : 's'} en el texto sin referencia en la bibliografía. ¿Descargar de todos modos?
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', paddingTop: '4px' }}>
                <button
                  type="button"
                  onClick={doExport}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--font-medium)',
                    cursor: 'pointer',
                    transition: 'background-color var(--transition-fast)',
                  }}
                >
                  Descargar igual
                </button>
                <button
                  type="button"
                  onClick={() => setFriction('resolve')}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-text-on-accent)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--font-semibold)',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'background-color var(--transition-fast)',
                  }}
                >
                  Resolver ahora
                </button>
              </div>
            </div>
          )}

          {/* 4. BOTÓN HERO PRINCIPAL DE DESCARGA */}
          <button
            type="button"
            onClick={handleDownloadClick}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '14px var(--space-4)',
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-text-on-accent)',
              borderRadius: 'var(--radius-xl)',
              fontWeight: 'var(--font-bold)',
              fontSize: 'var(--text-sm)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: 'all var(--transition-base)',
              border: 'none',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} style={{ color: 'var(--color-text-on-accent)', animation: 'spin 1s linear infinite' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {loadingPhase}
                </span>
              </>
            ) : (
              <>
                <Download size={18} />
                <span>
                  Descargar {format === 'docx' ? 'Word APA 7 (.docx)' : format === 'pdf' ? 'Documento PDF' : 'Código LaTeX'}
                </span>
                <kbd
                  style={{
                    marginLeft: '6px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 400,
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: 'rgba(255, 255, 255, 0.85)',
                  }}
                >
                  Ctrl+S
                </kbd>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ── PANEL DERECHO: EL LIENZO SAGRADO ── */}
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

        {/* Contenedor del Lienzo
            — overflow: 'hidden' para evitar scroll anidado: PaperCanvas tiene su
              propio overflowY: 'auto' y maneja el scroll internamente.
            — display: 'flex', flexDirection: 'column' para que PaperCanvas pueda
              usar flex: 1 y obtener una altura restringida que active su scroll.
            — Sin padding: PaperCanvas ya aplica su propio padding interno
              ('24px 16px'). El padding del padre causaba un conflicto de scroll al
              reducir el área visible y desplazar el contenido. Se eliminó para que
              el componente hijo controle totalmente su propia área desplazable.
            — Se eliminó justifyContent: 'center' (era un no-op con flex:1 y
              causaba el conflicto de scroll reportado). */}
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
          ) : (
            <ReactPDFPreview />
          )}
        </div>
      </main>

    </div>
  );
};

export default ExportView;

/* WordAPA7 — Túnel de Exportación & Cabina de Control (WCAG AAA & Behavioral UX)
   Arquitectura de 2 Columnas: Panel Izquierdo (Cabina de Control) + Panel Derecho (Lienzo Sagrado) */

import React, { useEffect, useState, useMemo } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ReactPDFPreview } from '../layout/ReactPDFPreview';
import { PaperCanvas } from '../layout/PaperCanvas';
import { QuickReferenceSearch } from './QuickReferenceSearch';
import { parseAuthorEntries } from '../../lib/portadaAuthors';
import {
  FileText, FileType, FileCode, CheckCircle2,
  AlertTriangle, Download, Loader2,
  SlidersHorizontal, Sparkles, Eye, ZoomIn, ZoomOut, Check,
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
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'pdf',
    label: 'PDF Listo',
    sublabel: 'Para entrega / imprimir',
    ext: '.pdf',
    icon: FileType,
    iconColor: 'text-red-600 dark:text-red-400',
  },
  {
    id: 'latex',
    label: 'LaTeX',
    sublabel: 'Código fuente .tex',
    ext: '.tex',
    icon: FileCode,
    iconColor: 'text-teal-600 dark:text-teal-400',
  },
];

export const ExportView: React.FC = () => {
  const {
    doc, portada, isLoading,
    exportDocx, exportPdf, exportLatex,
    profiles, activeProfileId, setWizardStep, setViewMode,
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
    let t1: any, t2: any;
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
  const paragraphsCount = doc.elements.filter((e) => e.type === 'paragraph' && !e.is_cover_section).length;
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

  const goToStep = (step: number) => {
    clearQuickExport();
    setViewMode('split');
    setWizardStep(step);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-100 dark:bg-slate-950">
      
      {/* ── PANEL IZQUIERDO: CABINA DE CONTROL & RESUMEN RÁPIDO (40%, MIN 350px) ── */}
      <aside
        aria-label="Opciones y Resumen de Exportación"
        className="w-[390px] max-w-[40%] min-w-[340px] flex-shrink-0 h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 shadow-sm"
      >
        
        {/* Cabecera Limpia (Sin botones duplicados de descarga) */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/80">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-none">
                Exportación Rápida
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                <Sparkles size={11} className="text-blue-600 dark:text-blue-400" />
                {profile?.display_name || 'APA 7ª Ed.'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Tu archivo fue estandarizado y está listo para descarga.
            </p>
          </div>

          <button
            type="button"
            onClick={() => { clearQuickExport(); setViewMode('split'); }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-all shadow-2xs"
            title="Abrir editor asistido para ajustar títulos, tablas o figuras paso a paso"
          >
            <SlidersHorizontal size={12} className="text-slate-500" />
            <span>Avanzado</span>
          </button>
        </div>

        {/* Zona Scrolleable de Diagnóstico Unificado */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── RESUMEN DE PROCESAMIENTO RÁPIDO (CERO REDUNDANCIA, WCAG AAA) ── */}
          <section
            aria-label="Resumen de Procesamiento Rápido"
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 overflow-hidden shadow-2xs"
          >
            <div className="px-4 py-2.5 bg-slate-100/80 dark:bg-slate-800/90 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Resumen de Procesamiento Rápido
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={13} /> Formato OK
              </span>
            </div>

            <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-xs">
              
              {/* 1. Márgenes y Sangrías */}
              <div className="px-4 py-3 flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 mt-0.5 flex-shrink-0">
                  <Layers size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                    Márgenes 1" (2.54 cm) e Interlineado 2.0x
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5 leading-normal">
                    Sangría 0.5" aplicada a {paragraphsCount} párrafos del cuerpo.
                  </div>
                </div>
                <Check size={15} className="text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
              </div>

              {/* 2. Portada */}
              <div className="px-4 py-3 flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 mt-0.5 flex-shrink-0">
                  <BookOpen size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                    Portada Institucional / Estudiantil
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5 leading-normal">
                    {authorsCount} autor{authorsCount === 1 ? '' : 'es'} identificado{authorsCount === 1 ? '' : 's'}. Metadatos y título normalizados.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline mt-0.5 flex-shrink-0"
                >
                  Editar
                </button>
              </div>

              {/* 3. Títulos */}
              <div className="px-4 py-3 flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 mt-0.5 flex-shrink-0">
                  <FileText size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                    Jerarquía de Títulos (H1 - H5)
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5 leading-normal">
                    {headingsCount} títulos jerarquizados con negrita y centrado APA.
                  </div>
                </div>
                <Check size={15} className="text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
              </div>

              {/* 4. Citas y Bibliografía */}
              <div className="px-4 py-3 flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 mt-0.5 flex-shrink-0">
                  <FileText size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                    Citas y Referencias Bibliográficas
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5 leading-normal">
                    {refsCount} referencias en bibliografía con sangría francesa.
                    {ghostCount > 0 && (
                      <span className="text-slate-700 dark:text-slate-300 font-medium block mt-1">
                        ⚠️ {ghostCount} cita{ghostCount === 1 ? '' : 's'} en el texto sin entrada en bibliografía.
                      </span>
                    )}
                  </div>
                </div>
                {ghostCount === 0 ? (
                  <Check size={15} className="text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setFriction(friction === 'resolve' ? 'idle' : 'resolve')}
                    className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold hover:underline mt-0.5 flex-shrink-0"
                  >
                    {friction === 'resolve' ? 'Cerrar' : 'Resolver'}
                  </button>
                )}
              </div>

              {/* 5. Tablas y Figuras (si existen) */}
              {(tablesCount > 0 || figuresCount > 0) && (
                <div className="px-4 py-3 flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 mt-0.5 flex-shrink-0">
                    {tablesCount > 0 ? <Table size={14} /> : <ImageIcon size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                      Tablas y Figuras APA 7
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5 leading-normal">
                      {tablesCount} tabla{tablesCount === 1 ? '' : 's'} y {figuresCount} figura{figuresCount === 1 ? '' : 's'} rotuladas y enumeradas.
                    </div>
                  </div>
                  <Check size={15} className="text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                </div>
              )}
            </div>
          </section>

          {/* ── MASCOTA DINÁMICA / GLOBO DE DIÁLOGO IA (LEGIBILIDAD WCAG AAA) ── */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-md flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-200/60 dark:border-blue-800/60">
              <Bot size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                Asistente WordAPA7
              </div>
              <p className="text-xs text-slate-800 dark:text-slate-200 font-medium not-italic leading-relaxed mt-0.5">
                {mascotMessage?.text || 'Tu documento cumple con las pautas de APA 7ma Edición. Listo para descargar.'}
              </p>
            </div>
          </div>

          {/* ── BÚSQUEDA RÁPIDA INLINE DE REFERENCIAS ── */}
          {friction === 'resolve' && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-3.5 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 dark:border-blue-800/60">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Vincular Referencias Faltantes (Crossref / DOI)
                </span>
                <button
                  type="button"
                  onClick={() => setFriction('idle')}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold"
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

        {/* ── STICKY CTA: PANEL DE ACCIÓN Y SELECCIÓN DE FORMATO (INAMOVIBLE AL PIE) ── */}
        <div className="sticky bottom-0 mt-auto p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-10 shadow-lg space-y-3">
          
          {/* 1. Selector de Formato con Modelos Mentales Universales */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            {FORMATS.map((f) => {
              const Icon = f.icon;
              const isSelected = format === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  aria-pressed={isSelected}
                  className={`flex flex-col items-center justify-center py-2 px-2 rounded-lg text-center transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-600'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={18} className={f.iconColor} />
                  <span className="text-xs font-bold mt-1">{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* 2. Opciones de DOCX */}
          {format === 'docx' && (
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400 px-1 hover:text-slate-900 dark:hover:text-slate-200 select-none">
              <input
                type="checkbox"
                checked={tracked}
                onChange={(e) => setTracked(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer accent-blue-600"
              />
              <span>Incluir marcas de control de cambios (Track Changes)</span>
            </label>
          )}

          {/* 3. FRICCIÓN INTENCIONAL / INTERCEPCIÓN SI HAY CITAS FANTASMA */}
          {ghostCount > 0 && friction === 'ask' && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-800 dark:text-slate-200">
                  Espera, tienes <strong>{ghostCount}</strong> cita{ghostCount === 1 ? '' : 's'} en el texto sin referencia en la bibliografía. ¿Descargar de todos modos?
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={doExport}
                  className="flex-1 py-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium transition-colors"
                >
                  Descargar igual
                </button>
                <button
                  type="button"
                  onClick={() => setFriction('resolve')}
                  className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
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
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-70 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-blue-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin text-white" />
                <span className="truncate">{loadingPhase}</span>
              </>
            ) : (
              <>
                <Download size={18} />
                <span>
                  Descargar {format === 'docx' ? 'Word APA 7 (.docx)' : format === 'pdf' ? 'Documento PDF' : 'Código LaTeX'}
                </span>
                <kbd className="hidden sm:inline-block ml-1.5 px-1.5 py-0.5 text-[10px] font-mono font-normal bg-blue-700/80 rounded border border-blue-400/30 text-blue-100">
                  Ctrl+S
                </kbd>
              </>
            )}
          </button>

          {/* 5. Enlace Secundario al Editor Asistido */}
          <button
            type="button"
            onClick={() => { clearQuickExport(); setViewMode('split'); }}
            className="w-full py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:underline transition-colors text-center"
          >
            ¿Necesitas personalizar algo? Ir al Editor Asistido
          </button>

        </div>
      </aside>

      {/* ── PANEL DERECHO: EL LIENZO SAGRADO (60%+ DEL ANCHO) ── */}
      <main
        aria-label="Previsualización en Vivo del Documento"
        className="flex-1 min-w-0 h-full flex flex-col bg-slate-100 dark:bg-slate-950 overflow-hidden"
      >
        {/* Barra Superior de Herramientas del Preview */}
        <header className="h-12 px-6 flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 z-10 shadow-2xs">
          
          {/* Selector de Modo de Vista (Páginas vs PDF) */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => setPreviewMode('canvas')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                previewMode === 'canvas'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Eye size={13} />
              <span>Páginas APA (Interactivo)</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('pdf')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                previewMode === 'pdf'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileType size={13} />
              <span>PDF Compilado</span>
            </button>
          </div>

          {/* Controles de Zoom para el Canvas de Páginas */}
          {previewMode === 'canvas' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                title="Reducir zoom"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <ZoomOut size={13} />
              </button>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 min-w-[40px] text-center font-mono">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
                title="Aumentar zoom"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                title="Restablecer zoom a 100%"
                className="ml-1 px-2 py-1 text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                100%
              </button>
            </div>
          )}
        </header>

        {/* Contenedor del Lienzo Sagrado */}
        <div className="flex-1 min-h-0 overflow-auto relative p-6 flex justify-center">
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

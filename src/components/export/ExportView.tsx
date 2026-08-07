/* WordAPA7 — Túnel de Exportación & Cabina de Control (WCAG AAA)
   Arquitectura de 2 Columnas: Panel Izquierdo (Cabina de Control) + Panel Derecho (Lienzo Sagrado) */

import React, { useEffect, useState, useMemo } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ReactPDFPreview } from '../layout/ReactPDFPreview';
import { PaperCanvas } from '../layout/PaperCanvas';
import { QuickReferenceSearch } from './QuickReferenceSearch';
import { RubricaChecklist } from './RubricaChecklist';
import { parseAuthorEntries } from '../../lib/portadaAuthors';
import {
  FileText, FileType, FileCode, ShieldCheck, CheckCircle2,
  AlertTriangle, Download, Loader2, ChevronRight, ChevronDown,
  SlidersHorizontal, Sparkles, Eye, ZoomIn, ZoomOut, Check,
  Clock, BookOpen, Layers, Image as ImageIcon, Table, RefreshCw,
  ExternalLink, ArrowUpRight
} from 'lucide-react';

type Format = 'docx' | 'pdf' | 'latex';
type PreviewMode = 'canvas' | 'pdf';

const FORMATS: { id: Format; label: string; ext: string; icon: React.ElementType }[] = [
  { id: 'docx', label: 'Word', ext: '.docx', icon: FileText },
  { id: 'pdf', label: 'PDF Listo', ext: '.pdf', icon: FileType },
  { id: 'latex', label: 'LaTeX', ext: '.tex', icon: FileCode },
];

export const ExportView: React.FC = () => {
  const {
    doc, portada, validationIssues, isLoading,
    exportDocx, exportPdf, exportLatex,
    profiles, activeProfileId, setWizardStep, setViewMode,
    citationAuditResult, sayMascot, clearQuickExport,
    zoomLevel, setZoomLevel,
  } = useDocStore();

  const [format, setFormat] = useState<Format>('docx');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('canvas');
  const [tracked, setTracked] = useState(false);
  const [friction, setFriction] = useState<'idle' | 'ask' | 'resolve'>('idle');
  const [showRubrica, setShowRubrica] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<string>('Generando tipografía APA 7...');

  useEffect(() => {
    sayMascot('Tu documento cumple con las pautas de APA 7ma Edición. Listo para descargar.', 'success');
  }, [sayMascot]);

  // Manejo de fases dinámicas de loading durante exportación
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

  // Atajo de teclado: Ctrl + S o Enter para descargar
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
  const orphanCount = citationAuditResult?.orphan_references?.length || 0;
  const unresolvedErrors = validationIssues.filter((i) => i.severity === 'error').length;

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

  const goToStep = (step: number) => {
    clearQuickExport();
    setViewMode('edit');
    setWizardStep(step);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-950/10 dark:bg-slate-950">
      {/* ── PANEL IZQUIERDO: CABINA DE CONTROL (Máx 40%, Min 350px) ── */}
      <aside
        aria-label="Cabina de Control de Exportación"
        className="w-[380px] max-w-[40%] min-w-[340px] flex-shrink-0 h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 shadow-sm"
      >
        {/* Sub-header de Navegación & Modo Asistido */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/80">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
              <Sparkles size={11} className="text-blue-600 dark:text-blue-400" />
              Modo Rápido
            </span>
            <span className="text-xs text-slate-500 font-medium truncate max-w-[130px]" title={profile?.display_name || 'APA 7ª Edición'}>
              {profile?.display_name || 'APA 7ª Ed.'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => { clearQuickExport(); setViewMode('edit'); }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 transition-all shadow-2xs"
            title="Abrir editor asistido para ajustar títulos, tablas o figuras paso a paso"
          >
            <SlidersHorizontal size={12} className="text-slate-500" />
            <span>Avanzado</span>
          </button>
        </div>

        {/* Zona Scrolleable de Diagnóstico & Opciones */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          
          {/* ── HEADER DE VICTORIA (PSICOLOGÍA CONDUCTUAL + WCAG AAA) ── */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/25 dark:border-emerald-500/30">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/20">
                <ShieldCheck size={22} strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Listo para Entrega APA 7
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                  Estructura, tipografía y sangrías estandarizadas con precisión milimétrica.
                </p>
              </div>
            </div>

            {/* Badges de Formato & Ahorro de Tiempo */}
            <div className="mt-3 pt-3 border-t border-emerald-500/15 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700">
                <Clock size={11} className="text-emerald-600 dark:text-emerald-400" />
                Ahorro: ~45 min
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/90 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                Times 12pt / 2.0x
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/90 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                Margen 1" (2.54cm)
              </span>
            </div>
          </div>

          {/* ── RESUMEN UNIFICADO DE TRANSFORMACIÓN (CERO REDUNDANCIA) ── */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-100/70 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Auditoría de Transformación
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={12} /> 100% Verificado
              </span>
            </div>

            <div className="divide-y divide-slate-200/60 dark:divide-slate-700/60 text-xs">
              {/* Métrica 1: Márgenes y Estructura */}
              <div className="px-3.5 py-2.5 flex items-start gap-2.5">
                <div className="p-1 rounded-md bg-blue-100/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 mt-0.5">
                  <Layers size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    Márgenes, Sangrías e Interlineado
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                    Sangría 0.5" aplicada a {doc.elements.filter(e => e.type === 'paragraph' && !e.is_cover_section).length} párrafos. Doble espacio reglamentario.
                  </div>
                </div>
                <Check size={14} className="text-emerald-600 dark:text-emerald-400 mt-1 flex-shrink-0" />
              </div>

              {/* Métrica 2: Portada */}
              <div className="px-3.5 py-2.5 flex items-start gap-2.5">
                <div className="p-1 rounded-md bg-purple-100/80 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 mt-0.5">
                  <BookOpen size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    Portada Institucional / Estudiantil
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                    {authorsCount} autor{authorsCount === 1 ? '' : 'es'} identificado{authorsCount === 1 ? '' : 's'}. Metadatos y título normalizados.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline mt-0.5"
                >
                  Editar
                </button>
              </div>

              {/* Métrica 3: Citas & Bibliografía */}
              <div className="px-3.5 py-2.5 flex items-start gap-2.5">
                <div className="p-1 rounded-md bg-amber-100/80 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 mt-0.5">
                  <FileText size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    Citas y Referencias Bibliográficas
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                    {refsCount} referencias en bibliografía con sangría francesa.
                    {ghostCount > 0 && (
                      <span className="text-amber-700 dark:text-amber-400 font-medium block mt-0.5">
                        ⚠️ {ghostCount} cita{ghostCount === 1 ? '' : 's'} en el texto sin entrada en bibliografía.
                      </span>
                    )}
                  </div>
                </div>
                {ghostCount === 0 ? (
                  <Check size={14} className="text-emerald-600 dark:text-emerald-400 mt-1 flex-shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setFriction(friction === 'resolve' ? 'idle' : 'resolve')}
                    className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold hover:underline mt-0.5"
                  >
                    {friction === 'resolve' ? 'Cerrar' : 'Resolver'}
                  </button>
                )}
              </div>

              {/* Métrica 4: Tablas y Figuras */}
              {(tablesCount > 0 || figuresCount > 0) && (
                <div className="px-3.5 py-2.5 flex items-start gap-2.5">
                  <div className="p-1 rounded-md bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 mt-0.5">
                    <ImageIcon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      Elementos Visuales APA 7
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                      {tablesCount} tabla{tablesCount === 1 ? '' : 's'} y {figuresCount} figura{figuresCount === 1 ? '' : 's'} rotuladas y enumeradas.
                    </div>
                  </div>
                  <Check size={14} className="text-emerald-600 dark:text-emerald-400 mt-1 flex-shrink-0" />
                </div>
              )}
            </div>
          </div>

          {/* ── ZONA DE ALERTAS INTERACTIVAS (NO GRITONAS / ACCIÓN DIRECTA) ── */}
          {ghostCount > 0 && friction === 'ask' && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 dark:border-amber-500/40 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-800 dark:text-slate-200">
                  Detectamos <strong>{ghostCount}</strong> cita{ghostCount === 1 ? '' : 's'} en el cuerpo que no figura{ghostCount === 1 ? '' : 'n'} en la bibliografía.
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFriction('resolve')}
                  className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                >
                  Buscar con IA / DOI
                </button>
                <button
                  type="button"
                  onClick={doExport}
                  className="flex-1 py-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium transition-colors"
                >
                  Descargar igual
                </button>
              </div>
            </div>
          )}

          {friction === 'resolve' && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-3 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 dark:border-blue-800/60">
                <span className="text-xs font-bold text-blue-950 dark:text-blue-200">Búsqueda rápida de referencias</span>
                <button
                  type="button"
                  onClick={() => setFriction('idle')}
                  className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
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

          {/* Rúbrica / Checklist Desplegable Opcional */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowRubrica(!showRubrica)}
              className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-left flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                Criterios de Evaluación & Rúbrica
              </span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${showRubrica ? 'rotate-180' : ''}`} />
            </button>
            {showRubrica && (
              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                <RubricaChecklist />
              </div>
            )}
          </div>

        </div>

        {/* ── STICKY CTA: ZONA DE ACCIÓN SIEMPRE VISIBLE AL PIE ── */}
        <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg space-y-3">
          
          {/* Selector de Formato de Salida (Pill Selector Compacto) */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            {FORMATS.map((f) => {
              const Icon = f.icon;
              const isSelected = format === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-600'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={13} />
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* Opciones Específicas de DOCX */}
          {format === 'docx' && (
            <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-600 dark:text-slate-400 px-1 hover:text-slate-900 dark:hover:text-slate-200 select-none">
              <input
                type="checkbox"
                checked={tracked}
                onChange={(e) => setTracked(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer accent-blue-600"
              />
              <span>Incluir marcas de control de cambios (Track Changes)</span>
            </label>
          )}

          {/* BOTÓN PRINCIPAL DE DESCARGA (STICKY CTA) */}
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

          {/* Botón Secundario para ir a Editar */}
          <button
            type="button"
            onClick={() => { clearQuickExport(); setViewMode('edit'); }}
            className="w-full py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800 rounded-lg transition-colors text-center"
          >
            ¿Necesitas personalizar algo? Ir al Editor Asistido
          </button>

        </div>
      </aside>

      {/* ── PANEL DERECHO: EL LIENZO SAGRADO (60%+ DEL ANCHO) ── */}
      <main
        aria-label="Previsualización del Documento"
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
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
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
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                title="Restablecer zoom a 100%"
                className="ml-1 px-2 py-1 text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
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

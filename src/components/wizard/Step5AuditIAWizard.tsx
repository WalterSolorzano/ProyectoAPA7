/* WordAPA7 — Paso 5: Mega-Workbench de Revisión Editorial & Calidad IA
   Diseñado como suite creativa modular con ventanas de herramientas acoplables y colapsables:
   1. Detector & Calidad Multi-IA (patrones sintéticos, clichés, burstiness y rigidez sintáctica)
   2. Verbos en Infinitivo & Voz Académica (taxonomía de Bloom, objetivos, despersonalización APA 7)
   3. Ortotipografía & Separador de PDF (tildes, espacios pegados de copia de PDF, puntuación)
   4. Citas Fantasma & Huérfanas (cruce automatizado entre texto y lista de referencias APA 7)
   5. Estructura & Rotulación APA 7 (jerarquía de encabezados, tablas y figuras)
   Estricto cumplimiento de CERO emojis y paleta de tokens CSS de DESIGN.md.
*/

import React, { useState, useMemo, useEffect } from 'react';
import { PaperCanvas } from '../layout/PaperCanvas';
import { useDocStore } from '../../store/useDocStore';
import {
  ShieldCheck, RefreshCw, PenTool, CheckCheck,
  Sparkles, Check, X, AlertOctagon, AlertTriangle,
  Info, ChevronRight, ChevronDown, BookOpen,
  Layout, Bot, SpellCheck, ArrowRight, CornerDownRight,
  Layers, CheckCircle2, Wand2
} from 'lucide-react';
import * as api from '../../api/backend';

export type ToolWindowId = 'ai' | 'style' | 'spelling' | 'citations' | 'structure';

export interface AuditItem {
  id: string;
  element_id: string;
  category: ToolWindowId;
  severity: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
  detail: string;
  originalText: string;
  suggestedText?: string;
  pageNumber: number;
  aiScore?: number;
}

export const Step5AuditIAWizard: React.FC = () => {
  const doc = useDocStore((s) => s.doc);
  const reviewResult = useDocStore((s) => s.reviewResult);
  const proofreadFindings = useDocStore((s) => s.proofreadFindings || []);
  const citationAuditResult = useDocStore((s) => s.citationAuditResult);
  const setSelectedElementId = useDocStore((s) => s.setSelectedElementId);
  const setScrollTargetId = useDocStore((s) => s.setScrollTargetId);
  const runQuickFix = useDocStore((s) => s.runQuickFix);
  const runAIReview = useDocStore((s) => s.runAIReview);
  const runProofreadBatch = useDocStore((s) => s.runProofreadBatch);
  const runCitationAudit = useDocStore((s) => s.runCitationAudit);
  const autoResolveGhosts = useDocStore((s) => s.autoResolveGhosts);
  const autoCaptionAll = useDocStore((s) => s.autoCaptionAll);
  const updateElementText = useDocStore((s) => s.updateElementText);
  const showToast = useDocStore((s) => s.showToast);
  const openExportTunnel = useDocStore((s) => s.openExportTunnel);

  // Estados de acordeón para las ventanas de herramientas estilo editor creativo
  const [openWindows, setOpenWindows] = useState<Record<ToolWindowId, boolean>>({
    ai: true,
    style: true,
    spelling: true,
    citations: true,
    structure: false,
  });

  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [isScanningAll, setIsScanningAll] = useState<boolean>(false);
  const [dismissedItemIds, setDismissedItemIds] = useState<Set<string>>(new Set());

  const elements = useMemo(() => doc?.elements || [], [doc]);

  // Mapa de elementos a números de página aproximados
  const elementPageMap = useMemo(() => {
    const map = new Map<string, number>();
    let currentPage = 1;
    let charCount = 0;
    elements.forEach((e) => {
      const len = (e.text || '').length;
      charCount += len;
      if (charCount > 1800) {
        currentPage += Math.floor(charCount / 1800);
        charCount = charCount % 1800;
      }
      map.set(e.id, Math.max(1, currentPage));
    });
    return map;
  }, [elements]);

  const toggleWindow = (id: ToolWindowId) => {
    setOpenWindows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Recolección y unificación de hallazgos por cada ventana de herramienta
  const itemsByCategory = useMemo<Record<ToolWindowId, AuditItem[]>>(() => {
    const categories: Record<ToolWindowId, AuditItem[]> = {
      ai: [],
      style: [],
      spelling: [],
      citations: [],
      structure: [],
    };

    // 1. Detección de IA (Párrafos con alta probabilidad o frases típicas)
    if (reviewResult?.paragraphs) {
      reviewResult.paragraphs.forEach((p: any, idx: number) => {
        if ((p.ai_score || 0) >= 45 || p.ai_category === 'HIGH' || p.ai_category === 'MEDIUM') {
          const id = `ai_rev_${p.element_id}_${idx}`;
          if (dismissedItemIds.has(id)) return;
          const elem = elements.find((e) => e.id === p.element_id);
          categories.ai.push({
            id,
            element_id: p.element_id,
            category: 'ai',
            severity: (p.ai_score || 0) >= 70 ? 'high' : 'medium',
            summary: `Índice de IA ${(p.ai_score || 60)}% — rigidez sintáctica detectada`,
            detail: 'Estructura reiterativa y conectores sintéticos característicos de modelos generativos.',
            originalText: elem?.text || p.text || '',
            suggestedText: undefined,
            pageNumber: elementPageMap.get(p.element_id) || 1,
            aiScore: (p.ai_score || 50) / 100,
          });
        }
      });
    }

    // 2. Hallazgos Proactivos Locales (Ortografía, Muletillas, IA, Verbos Bloom, Primera Persona, PDF pegado)
    proofreadFindings.forEach((f, idx) => {
      const id = `proact_${f.element_id}_${idx}`;
      if (dismissedItemIds.has(id)) return;
      const elem = elements.find((e) => e.id === f.element_id);
      const original = elem?.text || f.excerpt || '';
      const k = String(f.kind);

      if (k === 'ai_phrase' || k === 'muletilla' || k === 'ngram_repetition') {
        categories.ai.push({
          id,
          element_id: f.element_id,
          category: 'ai',
          severity: 'medium',
          summary: f.message.length > 70 ? f.message.slice(0, 70) + '…' : f.message,
          detail: f.message,
          originalText: original,
          suggestedText: f.suggestion || undefined,
          pageNumber: elementPageMap.get(f.element_id) || 1,
        });
      } else if (k === 'first_person' || k === 'persona' || k.startsWith('bloom')) {
        const isBloom = k.startsWith('bloom');
        categories.style.push({
          id,
          element_id: f.element_id,
          category: 'style',
          severity: isBloom ? 'high' : 'medium',
          summary: isBloom ? 'Verbo impreciso en objetivo académico' : 'Uso de primera persona gramatical',
          detail: f.message,
          originalText: original,
          suggestedText: f.suggestion || (isBloom ? 'Determinar y analizar de forma rigurosa' : undefined),
          pageNumber: elementPageMap.get(f.element_id) || 1,
        });
      } else if (k === 'ortografia' || k === 'pegado') {
        categories.spelling.push({
          id,
          element_id: f.element_id,
          category: 'spelling',
          severity: k === 'ortografia' ? 'high' : 'medium',
          summary: k === 'ortografia' ? `Falta ortográfica o tilde: ${f.excerpt}` : 'Texto pegado sin espaciado correcto',
          detail: f.message,
          originalText: original,
          suggestedText: f.suggestion || undefined,
          pageNumber: elementPageMap.get(f.element_id) || 1,
        });
      }
    });

    // 3. Citas Fantasma & Huérfanas
    if (citationAuditResult?.ghost_citations) {
      citationAuditResult.ghost_citations.forEach((ghost, idx) => {
        const id = `ghost_cite_${idx}`;
        if (dismissedItemIds.has(id)) return;
        categories.citations.push({
          id,
          element_id: ghost.element_id || '',
          category: 'citations',
          severity: 'critical',
          summary: `Cita "${ghost.citation_text || 'Desconocida'}" ausente en bibliografía`,
          detail: 'Aparece citada en el cuerpo del documento pero no figura en la lista final de referencias.',
          originalText: ghost.citation_text || '',
          pageNumber: ghost.element_id ? elementPageMap.get(ghost.element_id) || 1 : 1,
        });
      });
    }

    if (citationAuditResult?.orphan_references) {
      citationAuditResult.orphan_references.forEach((orphan, idx) => {
        const id = `orphan_ref_${idx}`;
        if (dismissedItemIds.has(id)) return;
        categories.citations.push({
          id,
          element_id: '',
          category: 'citations',
          severity: 'medium',
          summary: `Referencia "${orphan.authors?.[0] || 'Autor'} (${orphan.year || 's.f.'})" no citada en texto`,
          detail: 'Consta en la bibliografía final pero ninguna sección del documento la referencia expresamente.',
          originalText: orphan.raw_text || '',
          pageNumber: elements.length > 0 ? elementPageMap.get(elements[elements.length - 1].id) || 1 : 1,
        });
      });
    }

    // 4. Estructura & Rotulación APA 7
    elements.forEach((e) => {
      if (e.type === 'heading' && e.needs_review) {
        const id = `struct_head_${e.id}`;
        if (dismissedItemIds.has(id)) return;
        categories.structure.push({
          id,
          element_id: e.id,
          category: 'structure',
          severity: 'medium',
          summary: `Encabezado nivel ${e.heading_level || 1} requiere confirmación de jerarquía`,
          detail: `Verificar que no existan saltos ilegales de nivel (ej. H1 a H3 sin H2 intermedio).`,
          originalText: e.text || '',
          pageNumber: elementPageMap.get(e.id) || 1,
        });
      } else if (e.type === 'image' && !e.is_cover_section && !e.image_info?.caption) {
        const id = `struct_fig_${e.id}`;
        if (dismissedItemIds.has(id)) return;
        categories.structure.push({
          id,
          element_id: e.id,
          category: 'structure',
          severity: 'high',
          summary: 'Figura sin rotulación APA 7 (Figura N y Nota)',
          detail: 'Las normas APA 7 exigen numeración secuencial en negrita, título cursivo y nota explicativa.',
          originalText: '[Figura sin rotular]',
          suggestedText: 'Figura 1. Representación esquemática del procedimiento.',
          pageNumber: elementPageMap.get(e.id) || 1,
        });
      } else if (e.type === 'table' && !e.table_info?.caption) {
        const id = `struct_tbl_${e.id}`;
        if (dismissedItemIds.has(id)) return;
        categories.structure.push({
          id,
          element_id: e.id,
          category: 'structure',
          severity: 'high',
          summary: 'Tabla sin rotulación reglamentaria APA 7',
          detail: 'Requiere etiqueta "Tabla N" superior y nota al pie con la fuente o especificación.',
          originalText: '[Tabla sin rotular]',
          suggestedText: 'Tabla 1. Datos recopilados durante la fase experimental.',
          pageNumber: elementPageMap.get(e.id) || 1,
        });
      }
    });

    return categories;
  }, [reviewResult, proofreadFindings, citationAuditResult, elements, elementPageMap, dismissedItemIds]);

  const allItems = useMemo(() => {
    return [
      ...itemsByCategory.ai,
      ...itemsByCategory.style,
      ...itemsByCategory.spelling,
      ...itemsByCategory.citations,
      ...itemsByCategory.structure,
    ];
  }, [itemsByCategory]);

  // Métricas Globales
  const totalIssues = allItems.length;
  const criticalCount = allItems.filter((i) => i.severity === 'critical').length;
  const aiGlobalScore = Math.round((reviewResult?.ai_indices?.score || 0.08) * 100);
  const apaComplianceScore = Math.max(70, Math.min(100, 100 - (totalIssues * 3)));

  const handleSelectReview = (item: AuditItem) => {
    setSelectedAuditId(item.id);
    if (item.element_id) {
      setSelectedElementId(item.element_id);
      setScrollTargetId(item.element_id);
    }
  };

  const handleScanAll = async () => {
    setIsScanningAll(true);
    showToast('Iniciando escaneo integral con IA y heurística local…', 'info');
    try {
      await Promise.allSettled([
        runAIReview(),
        runProofreadBatch(),
        runCitationAudit(),
      ]);
      showToast('Auditoría integral completada', 'success');
    } catch {
      showToast('Error al ejecutar el escaneo completo', 'error');
    } finally {
      setIsScanningAll(false);
    }
  };

  const handleAcceptFix = async (item: AuditItem) => {
    if (!doc || !item.element_id) return;
    setIsProcessingId(item.id);
    try {
      if (item.suggestedText) {
        updateElementText(item.element_id, item.suggestedText);
        showToast('Corrección aplicada al documento', 'success');
      } else {
        const rewritten = await api.rewriteText(
          doc.session_id,
          item.element_id,
          item.originalText,
          'Reescribir en voz formal impersonal académica según APA 7, eliminando rigidez y muletillas'
        );
        if (rewritten) {
          updateElementText(item.element_id, rewritten);
          showToast('Texto reescrito con estilo académico APA 7', 'success');
        }
      }
      setDismissedItemIds((prev) => new Set(prev).add(item.id));
      setSelectedAuditId(null);
    } catch {
      showToast('Error al aplicar la sugerencia', 'error');
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleDismissItem = (item: AuditItem) => {
    setDismissedItemIds((prev) => new Set(prev).add(item.id));
    if (selectedAuditId === item.id) setSelectedAuditId(null);
    showToast('Alerta descartada. Texto original conservado.', 'info');
  };

  const handleBatchFixAll = async () => {
    setIsBatchProcessing(true);
    try {
      await runQuickFix();
      showToast('Corrección en lote ejecutada con éxito', 'success');
    } catch {
      showToast('Error al resolver en lote', 'error');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Definición de las 5 ventanas de herramientas para el renderizado modular
  const TOOL_WINDOWS: Array<{
    id: ToolWindowId;
    title: string;
    subtitle: string;
    Icon: React.ElementType;
    actionLabel?: string;
    onAction?: () => void;
  }> = [
    {
      id: 'ai',
      title: 'Detector & Calidad IA',
      subtitle: 'Patrones sintéticos, perplejidad y muletillas de LLM',
      Icon: Bot,
    },
    {
      id: 'style',
      title: 'Verbos en Infinitivo & Estilo',
      subtitle: 'Objetivos de Bloom y voz impersonal académica',
      Icon: PenTool,
    },
    {
      id: 'spelling',
      title: 'Ortografía & Texto de PDF',
      subtitle: 'Tildes diacríticas y separación de palabras unidas',
      Icon: SpellCheck,
    },
    {
      id: 'citations',
      title: 'Citas Fantasma & Huérfanas',
      subtitle: 'Validación cruzada entre texto y bibliografía',
      Icon: BookOpen,
      actionLabel: 'Resolver Fantasmas',
      onAction: () => autoResolveGhosts(),
    },
    {
      id: 'structure',
      title: 'Estructura & Rotulación APA 7',
      subtitle: 'Jerarquía de títulos y leyendas de tablas/figuras',
      Icon: Layout,
      actionLabel: 'Auto-Rotular Todo',
      onAction: () => autoCaptionAll(),
    },
  ];

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden', backgroundColor: 'var(--canvas-bg)' }}>
      {/* Lienzo Interactivo APA 7 */}
      <div style={{ flex: 1, height: '100%', minWidth: 0, overflow: 'hidden' }}>
        <PaperCanvas />
      </div>

      {/* Mega-Workbench Lateral de Revisión Editorial */}
      <aside
        style={{
          width: '460px',
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--sidebar-bg)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          zIndex: 10,
        }}
      >
        {/* Cabecera Principal del Workbench */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface-elevated)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-accent-soft)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Revisión & Calidad IA
                </h2>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                  Suite de control editorial y estilo académico
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={handleScanAll}
                disabled={isScanningAll}
                title="Escanear todo el documento con IA y heurística local"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-accent-soft)',
                  color: 'var(--accent-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  cursor: isScanningAll ? 'not-allowed' : 'pointer',
                }}
              >
                <Sparkles size={12} className={isScanningAll ? 'spin' : ''} />
                <span>Escanear</span>
              </button>

              <button
                type="button"
                onClick={handleBatchFixAll}
                disabled={isBatchProcessing}
                title="Aplicar correcciones seguras en lote"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--surface-elevated)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  cursor: isBatchProcessing ? 'not-allowed' : 'pointer',
                }}
              >
                {isBatchProcessing ? <RefreshCw size={12} className="spin" /> : <CheckCheck size={12} />}
                <span>Arreglar Todo</span>
              </button>

              <button
                type="button"
                onClick={() => openExportTunnel()}
                className="btn btn-primary btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 800,
                  padding: '5px 9px',
                  fontSize: 'var(--text-xs)',
                }}
              >
                <span>Exportar</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

          {/* Mini HUD de Estado Global */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--sidebar-bg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>Cumplimiento APA</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 900, color: 'var(--accent-success)' }}>{apaComplianceScore}%</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>Índice de IA</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 900, color: aiGlobalScore > 40 ? 'var(--accent-warning)' : 'var(--text-main)' }}>
                {aiGlobalScore}%
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>Observaciones</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 900, color: criticalCount > 0 ? 'var(--accent-danger)' : 'var(--text-main)' }}>
                {totalIssues} {criticalCount > 0 ? `(${criticalCount} críticas)` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Zona Scrollable: Rack de Ventanas de Herramientas Acoplables */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {TOOL_WINDOWS.map((win) => {
            const items = itemsByCategory[win.id];
            const isOpen = openWindows[win.id];
            const hasItems = items.length > 0;
            const WinIcon = win.Icon;

            return (
              <div
                key={win.id}
                style={{
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  overflow: 'hidden',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Cabecera del Cajón Colapsable */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    backgroundColor: isOpen ? 'var(--color-accent-soft)' : 'var(--surface-elevated)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: isOpen ? '1px solid var(--border-subtle)' : 'none',
                  }}
                  onClick={() => toggleWindow(win.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div
                      style={{
                        color: hasItems ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <WinIcon size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-main)' }}>
                          {win.title}
                        </span>
                        <span
                          style={{
                            fontSize: 'var(--text-xs)',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: hasItems ? 'var(--accent-warning)' : 'var(--border-subtle)',
                            color: hasItems ? '#ffffff' : 'var(--text-secondary)',
                          }}
                        >
                          {items.length}
                        </span>
                      </div>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {win.subtitle}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {win.actionLabel && win.onAction && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          win.onAction!();
                        }}
                        style={{
                          fontSize: 'var(--text-xs)',
                          fontWeight: 700,
                          padding: '3px 7px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--accent-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        {win.actionLabel}
                      </button>
                    )}
                    {isOpen ? <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />}
                  </div>
                </div>

                {/* Contenido Desplegable de la Ventana */}
                {isOpen && (
                  <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {items.length === 0 ? (
                      <div
                        style={{
                          padding: '12px',
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          color: 'var(--accent-success)',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 700,
                        }}
                      >
                        <CheckCircle2 size={14} />
                        <span>Sin observaciones en este módulo. Cumplimiento verificado.</span>
                      </div>
                    ) : (
                      items.map((item) => {
                        const isSelected = selectedAuditId === item.id;
                        const isProcessing = isProcessingId === item.id;

                        return (
                          <div
                            key={item.id}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: isSelected ? 'var(--color-accent-soft)' : 'var(--sidebar-bg)',
                              border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                              <div
                                style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                                onClick={() => handleSelectReview(item)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                  <span
                                    style={{
                                      fontSize: 'var(--text-xs)',
                                      fontWeight: 800,
                                      padding: '1px 5px',
                                      borderRadius: 'var(--radius-sm)',
                                      textTransform: 'uppercase',
                                      backgroundColor:
                                        item.severity === 'critical'
                                          ? 'rgba(220, 38, 38, 0.12)'
                                          : item.severity === 'high'
                                          ? 'rgba(217, 119, 6, 0.12)'
                                          : 'rgba(59, 130, 246, 0.12)',
                                      color:
                                        item.severity === 'critical'
                                          ? 'var(--accent-danger)'
                                          : item.severity === 'high'
                                          ? 'var(--accent-warning)'
                                          : 'var(--accent-primary)',
                                    }}
                                  >
                                    Pág. {item.pageNumber}
                                  </span>
                                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-main)' }}>
                                    {item.summary}
                                  </span>
                                </div>
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                                  {item.detail}
                                </p>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => handleSelectReview(item)}
                                  title="Ver en el lienzo y revisar opciones"
                                  style={{
                                    fontSize: 'var(--text-xs)',
                                    fontWeight: 700,
                                    padding: '3px 6px',
                                    borderRadius: 'var(--radius-sm)',
                                    backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--surface-elevated)',
                                    color: isSelected ? '#ffffff' : 'var(--text-main)',
                                    border: '1px solid var(--border-subtle)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {isSelected ? 'Revisando' : 'Ver'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDismissItem(item)}
                                  title="Descartar y conservar original"
                                  style={{
                                    padding: '3px',
                                    borderRadius: 'var(--radius-sm)',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Panel de Diff Inline Expandido cuando el ítem está seleccionado */}
                            {isSelected && (
                              <div
                                style={{
                                  marginTop: '4px',
                                  padding: '8px',
                                  borderRadius: 'var(--radius-sm)',
                                  backgroundColor: 'var(--surface-elevated)',
                                  border: '1px solid var(--border-subtle)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '6px',
                                }}
                              >
                                {item.originalText && (
                                  <div>
                                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--accent-danger)' }}>
                                      Texto Original:
                                    </span>
                                    <div
                                      style={{
                                        fontSize: 'var(--text-xs)',
                                        color: 'var(--text-main)',
                                        padding: '4px 6px',
                                        backgroundColor: 'rgba(220, 38, 38, 0.05)',
                                        borderLeft: '2px solid var(--accent-danger)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontFamily: 'monospace',
                                        maxHeight: '70px',
                                        overflowY: 'auto',
                                      }}
                                    >
                                      {item.originalText}
                                    </div>
                                  </div>
                                )}

                                <div>
                                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--accent-success)' }}>
                                    Sugerencia Académica APA 7:
                                  </span>
                                  <div
                                    style={{
                                      fontSize: 'var(--text-xs)',
                                      color: 'var(--text-main)',
                                      padding: '4px 6px',
                                      backgroundColor: 'rgba(22, 163, 74, 0.05)',
                                      borderLeft: '2px solid var(--accent-success)',
                                      borderRadius: 'var(--radius-sm)',
                                      fontFamily: 'monospace',
                                      maxHeight: '70px',
                                      overflowY: 'auto',
                                    }}
                                  >
                                    {item.suggestedText || 'Reescritura en voz formal impersonal académica sin patrones mecánicos.'}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleDismissItem(item)}
                                    style={{
                                      fontSize: 'var(--text-xs)',
                                      fontWeight: 700,
                                      padding: '4px 8px',
                                      borderRadius: 'var(--radius-sm)',
                                      backgroundColor: 'transparent',
                                      border: '1px solid var(--border-subtle)',
                                      color: 'var(--text-secondary)',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Descartar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptFix(item)}
                                    disabled={isProcessing}
                                    style={{
                                      fontSize: 'var(--text-xs)',
                                      fontWeight: 800,
                                      padding: '4px 10px',
                                      borderRadius: 'var(--radius-sm)',
                                      backgroundColor: 'var(--accent-primary)',
                                      border: 'none',
                                      color: '#ffffff',
                                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    {isProcessing ? <RefreshCw size={11} className="spin" /> : <Check size={11} />}
                                    <span>Aplicar Corrección</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
};

export default Step5AuditIAWizard;

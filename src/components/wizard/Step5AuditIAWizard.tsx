/* WordAPA7 — Paso 5: Mega-Workbench de Revisión Editorial & Calidad IA
   LAYOUT DE TRES COLUMNAS (solo reorganización espacial, misma paleta/estilo):
   1. Minimapa angosto izquierdo: una marca por página, coloreada por motor,
      página actual resaltada — ubicación en documentos de cientos de páginas.
   2. Columna central: documento (PaperCanvas) con hallazgos resaltados inline.
   3. Columna derecha: hallazgos AGRUPADOS por motor -> subtipo (nunca una fila
      por aparición: contador "x N" + acción masiva).

   Barra superior con dos zonas: chips de filtro por motor (izq) y navegación
   "Página X de N" + "Siguiente hallazgo" (der).

   Acciones según certeza del motor:
   - Motores con corrección objetiva (estilo, ortografía, citas, estructura):
     "Aceptar" / "Aceptar todas".
   - Motor probabilístico (detector de IA): SOLO "Marcar para revisar".

   Estricto cumplimiento de CERO emojis y paleta de tokens CSS de DESIGN.md.
*/

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PaperCanvas, computePages } from '../layout/PaperCanvas';
import { ReviewMinimap, MinimapMark } from './ReviewMinimap';
import { useDocStore } from '../../store/useDocStore';
import {
  ShieldCheck, RefreshCw, PenTool, CheckCheck,
  Sparkles, Check, X,
  ChevronRight, ChevronDown, ChevronLeft, BookOpen,
  Layout, Bot, SpellCheck, CheckCircle2
} from 'lucide-react';
import * as api from '../../api/backend';

export type ToolWindowId = 'ai' | 'style' | 'spelling' | 'citations' | 'structure';

export interface AuditItem {
  id: string;
  element_id: string;
  category: ToolWindowId;
  /** Subtipo para agrupar: una fila por subtipo, no una por aparición */
  subtype: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
  detail: string;
  originalText: string;
  suggestedText?: string;
  pageNumber: number;
  aiScore?: number;
}

/* Orden de motores para grupos, chips y minimapa */
const ENGINE_ORDER: ToolWindowId[] = ['ai', 'style', 'spelling', 'citations', 'structure'];

const ENGINE_META: Record<ToolWindowId, {
  title: string;
  chip: string;
  subtitle: string;
  Icon: React.ElementType;
}> = {
  ai: { title: 'Detector & Calidad IA', chip: 'IA', subtitle: 'Patrones sintéticos, perplejidad y muletillas de LLM', Icon: Bot },
  style: { title: 'Verbos en Infinitivo & Estilo', chip: 'Estilo', subtitle: 'Objetivos de Bloom y voz impersonal académica', Icon: PenTool },
  spelling: { title: 'Ortografía & Texto de PDF', chip: 'Ortografía', subtitle: 'Tildes diacríticas y separación de palabras unidas', Icon: SpellCheck },
  citations: { title: 'Citas Fantasma & Huérfanas', chip: 'Citas', subtitle: 'Validación cruzada entre texto y bibliografía', Icon: BookOpen },
  structure: { title: 'Estructura & Rotulación APA 7', chip: 'Estructura', subtitle: 'Jerarquía de títulos y leyendas de tablas/figuras', Icon: Layout },
};

/* Color de marca en el minimapa por motor (solo tokens CSS existentes) */
const ENGINE_COLORS: Record<ToolWindowId, string> = {
  ai: 'var(--color-danger)',
  style: 'var(--color-warning)',
  spelling: 'var(--accent-primary)',
  citations: 'var(--color-success)',
  structure: 'var(--text-secondary)',
};

const SUBTYPE_LABELS: Record<string, string> = {
  parrafo_ia: 'Párrafo con índice IA alto',
  frase_ia: 'Frase típica de IA',
  muletilla: 'Muletilla o repetición',
  repeticion: 'Repetición de n-gramas',
  primera_persona: 'Primera persona gramatical',
  verbo_bloom: 'Verbo impreciso en objetivo (Bloom)',
  ortografia: 'Falta ortográfica o tilde',
  texto_pegado: 'Texto pegado sin espaciado',
  cita_fantasma: 'Cita ausente en bibliografía',
  referencia_huerfana: 'Referencia nunca citada',
  encabezado: 'Jerarquía de encabezado',
  figura: 'Figura sin rotular',
  tabla: 'Tabla sin rotular',
};

/* Acción masiva disponible por subtipo (objetividad del motor) */
type SubtypeAction = 'accept' | 'resolveGhosts' | 'autoCaption' | 'mark' | 'none';

const SUBTYPE_ACTION: Record<string, SubtypeAction> = {
  parrafo_ia: 'mark',
  frase_ia: 'mark',
  muletilla: 'mark',
  repeticion: 'mark',
  primera_persona: 'accept',
  verbo_bloom: 'accept',
  ortografia: 'accept',
  texto_pegado: 'accept',
  cita_fantasma: 'resolveGhosts',
  referencia_huerfana: 'none',
  encabezado: 'none',
  figura: 'autoCaption',
  tabla: 'autoCaption',
};

const SEVERITY_RANK: Record<AuditItem['severity'], number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

interface SubtypeGroup {
  key: string;
  label: string;
  items: AuditItem[];
  action: SubtypeAction;
}

interface EngineGroup {
  id: ToolWindowId;
  title: string;
  chip: string;
  subtitle: string;
  Icon: React.ElementType;
  items: AuditItem[];
  subtypes: SubtypeGroup[];
  criticalHigh: number;
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

  /* Grupos colapsables: por defecto NINGUNO abierto; al cargar datos solo se
     expande el grupo con más hallazgos críticos (nunca todo abierto de entrada). */
  const [openWindows, setOpenWindows] = useState<Record<ToolWindowId, boolean>>({
    ai: false, style: false, spelling: false, citations: false, structure: false,
  });
  const [hiddenEngines, setHiddenEngines] = useState<Set<ToolWindowId>>(new Set());
  const [expandedSubtype, setExpandedSubtype] = useState<string | null>(null);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [isScanningAll, setIsScanningAll] = useState<boolean>(false);
  const [dismissedItemIds, setDismissedItemIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState<number>(1);
  const didInitGroupsRef = useRef(false);

  const elements = useMemo(() => doc?.elements || [], [doc]);

  /* Páginas reales del lienzo (misma función que usa PaperCanvas) */
  const pages = useMemo(() => computePages(elements), [elements]);
  const totalPages = pages.length;

  // Mapa de elementos a números de página aproximados
  const elementPageMap = useMemo(() => {
    const map = new Map<string, number>();
    let currentPageNum = 1;
    let charCount = 0;
    elements.forEach((e) => {
      const len = (e.text || '').length;
      charCount += len;
      if (charCount > 1800) {
        currentPageNum += Math.floor(charCount / 1800);
        charCount = charCount % 1800;
      }
      map.set(e.id, Math.max(1, currentPageNum));
    });
    return map;
  }, [elements]);

  const toggleWindow = (id: ToolWindowId) => {
    setOpenWindows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleEngineFilter = (id: ToolWindowId) => {
    setHiddenEngines((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Recolección y unificación de hallazgos por cada ventana de herramienta
  const itemsByCategory = useMemo<Record<ToolWindowId, AuditItem[]>>(() => {
    const categories: Record<ToolWindowId, AuditItem[]> = {
      ai: [], style: [], spelling: [], citations: [], structure: [],
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
            subtype: 'parrafo_ia',
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
          subtype: k === 'ai_phrase' ? 'frase_ia' : k === 'muletilla' ? 'muletilla' : 'repeticion',
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
          subtype: isBloom ? 'verbo_bloom' : 'primera_persona',
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
          subtype: k === 'ortografia' ? 'ortografia' : 'texto_pegado',
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
          subtype: 'cita_fantasma',
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
          subtype: 'referencia_huerfana',
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
          subtype: 'encabezado',
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
          subtype: 'figura',
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
          subtype: 'tabla',
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

  /* Hallazgos visibles = no descartados y con su motor activo en los chips */
  const visibleItems = useMemo(
    () => allItems.filter((i) => !hiddenEngines.has(i.category)),
    [allItems, hiddenEngines],
  );

  /* Resaltado inline en el lienzo: un solo conjunto de element_id */
  const highlightIds = useMemo(() => {
    const set = new Set<string>();
    visibleItems.forEach((i) => { if (i.element_id) set.add(i.element_id); });
    return set;
  }, [visibleItems]);

  /* Grupos: motor -> subtipos agrupados (una fila por subtipo) */
  const engineGroups = useMemo<EngineGroup[]>(() => {
    return ENGINE_ORDER.map((id) => {
      const items = itemsByCategory[id];
      const bySubtype = new Map<string, AuditItem[]>();
      items.forEach((it) => {
        const arr = bySubtype.get(it.subtype) || [];
        arr.push(it);
        bySubtype.set(it.subtype, arr);
      });
      const subtypes: SubtypeGroup[] = Array.from(bySubtype.entries()).map(([key, groupItems]) => ({
        key,
        label: SUBTYPE_LABELS[key] || key,
        items: groupItems,
        action: SUBTYPE_ACTION[key] || 'accept',
      }));
      subtypes.sort((a, b) => {
        const aMin = Math.min(...a.items.map((i) => SEVERITY_RANK[i.severity]));
        const bMin = Math.min(...b.items.map((i) => SEVERITY_RANK[i.severity]));
        if (aMin !== bMin) return aMin - bMin;
        return b.items.length - a.items.length;
      });
      const meta = ENGINE_META[id];
      return {
        id,
        ...meta,
        items,
        subtypes,
        criticalHigh: items.filter((i) => i.severity === 'critical' || i.severity === 'high').length,
      };
    });
  }, [itemsByCategory]);

  const visibleGroups = engineGroups.filter((g) => !hiddenEngines.has(g.id));

  /* Apertura por defecto: SOLO el grupo con más hallazgos críticos+altos */
  useEffect(() => {
    if (didInitGroupsRef.current) return;
    const hasAuditData = !!reviewResult || !!citationAuditResult || proofreadFindings.length > 0;
    if (allItems.length > 0) {
      didInitGroupsRef.current = true;
      const best = engineGroups.reduce<EngineGroup | null>((acc, g) => {
        if (!acc || g.criticalHigh > acc.criticalHigh) return g;
        return acc;
      }, null);
      const initial = { ai: false, style: false, spelling: false, citations: false, structure: false };
      if (best) initial[best.id] = true;
      setOpenWindows(initial);
    } else if (hasAuditData) {
      /* Sin hallazgos: todos abiertos mostrando "Sin observaciones" verificado */
      didInitGroupsRef.current = true;
      setOpenWindows({ ai: true, style: true, spelling: true, citations: true, structure: true });
    }
  }, [allItems, engineGroups, reviewResult, citationAuditResult, proofreadFindings]);

  /* Página actual: mide el lienzo en scroll (capture), sin tocar PaperCanvas */
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const nodes = document.querySelectorAll<HTMLElement>('div[id^="paper-page-"]');
      if (!nodes.length) return;
      const line = window.innerHeight * 0.35;
      let cur = 1;
      nodes.forEach((n) => {
        const idx = Number(n.id.replace('paper-page-', '')) + 1;
        if (n.getBoundingClientRect().top <= line) cur = idx;
      });
      setCurrentPage((prev) => (prev === cur ? prev : cur));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    document.addEventListener('scroll', onScroll, true);
    measure();
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* Marcas del minimapa: color = motor dominante de la página */
  const pageMarks = useMemo(() => {
    const map = new Map<number, MinimapMark>();
    const bestRank = new Map<number, number>();
    visibleItems.forEach((item) => {
      const rank = SEVERITY_RANK[item.severity];
      const prevBest = bestRank.get(item.pageNumber);
      const existing = map.get(item.pageNumber);
      if (existing) existing.count += 1;
      if (prevBest === undefined || rank < prevBest) {
        bestRank.set(item.pageNumber, rank);
        map.set(item.pageNumber, {
          color: ENGINE_COLORS[item.category],
          count: existing ? existing.count : 1,
          label: ENGINE_META[item.category].title,
        });
      } else if (!existing) {
        map.set(item.pageNumber, { color: ENGINE_COLORS[item.category], count: 1, label: ENGINE_META[item.category].title });
      }
    });
    return map;
  }, [visibleItems]);

  // Métricas Globales
  const totalIssues = allItems.length;
  const criticalCount = allItems.filter((i) => i.severity === 'critical').length;
  const aiGlobalScore = Math.round((reviewResult?.ai_indices?.score || 0.08) * 100);
  const apaComplianceScore = Math.max(70, Math.min(100, 100 - (totalIssues * 3)));

  const goToPage = (page: number) => {
    const target = pages[page - 1];
    const el = target?.find((e) => e.id && e.type !== 'page_break');
    if (el) {
      setSelectedElementId(el.id);
      setScrollTargetId(el.id);
    }
    setCurrentPage(page);
  };

  const orderedItems = useMemo(
    () => [...visibleItems].sort((a, b) => a.pageNumber - b.pageNumber),
    [visibleItems],
  );

  const handleNextFinding = () => {
    if (!orderedItems.length) return;
    const idx = orderedItems.findIndex((i) => i.id === selectedAuditId);
    const next = orderedItems[(idx + 1) % orderedItems.length];
    setOpenWindows((prev) => ({ ...prev, [next.category]: true }));
    setExpandedSubtype(`${next.category}:${next.subtype}`);
    handleSelectReview(next);
  };

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

  const acceptOne = async (item: AuditItem): Promise<boolean> => {
    if (!doc || !item.element_id) return false;
    try {
      if (item.suggestedText) {
        updateElementText(item.element_id, item.suggestedText);
      } else {
        const rewritten = await api.rewriteText(
          doc.session_id,
          item.element_id,
          item.originalText,
          'Reescribir en voz formal impersonal académica según APA 7, eliminando rigidez y muletillas'
        );
        if (!rewritten) return false;
        updateElementText(item.element_id, rewritten);
      }
      setDismissedItemIds((prev) => new Set(prev).add(item.id));
      return true;
    } catch {
      return false;
    }
  };

  const handleAcceptFix = async (item: AuditItem) => {
    setIsProcessingId(item.id);
    const ok = await acceptOne(item);
    setIsProcessingId(null);
    if (ok) {
      showToast('Corrección aplicada al documento', 'success');
      if (selectedAuditId === item.id) setSelectedAuditId(null);
    } else {
      showToast('Error al aplicar la sugerencia', 'error');
    }
  };

  /* Aceptar TODAS las apariciones de un subtipo/grupo (corrección objetiva) */
  const handleAcceptMany = async (items: AuditItem[]) => {
    const targets = items.filter((i) => i.element_id);
    if (!targets.length) return;
    setIsBatchProcessing(true);
    let ok = 0;
    for (const it of targets) {
      const done = await acceptOne(it);
      if (done) ok += 1;
    }
    setIsBatchProcessing(false);
    if (ok > 0) showToast(`${ok} corrección(es) aplicada(s)`, 'success');
    else showToast('No se pudieron aplicar las correcciones', 'error');
  };

  /* Motor probabilístico: marcar para revisar, NUNCA aceptar */
  const handleMarkForReview = (items: AuditItem[]) => {
    setMarkedIds((prev) => {
      const next = new Set(prev);
      items.forEach((i) => next.add(i.id));
      return next;
    });
    showToast('Marcado para revisar. El texto original no se modifica.', 'info');
  };

  const handleDismissItem = (item: AuditItem) => {
    setDismissedItemIds((prev) => new Set(prev).add(item.id));
    if (selectedAuditId === item.id) setSelectedAuditId(null);
    showToast('Alerta descartada. Texto original conservado.', 'info');
  };

  const runSubtypeAction = (action: SubtypeAction, items: AuditItem[]) => {
    if (action === 'accept') handleAcceptMany(items);
    else if (action === 'resolveGhosts') autoResolveGhosts();
    else if (action === 'autoCaption') autoCaptionAll();
    else if (action === 'mark') handleMarkForReview(items);
  };

  const massLabel: Record<SubtypeAction, string> = {
    accept: 'Aceptar todas',
    resolveGhosts: 'Resolver',
    autoCaption: 'Auto-Rotular',
    mark: 'Marcar para revisar',
    none: '',
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

  /* Acción masiva del encabezado de cada motor */
  const engineMassAction: Record<ToolWindowId, () => void> = {
    ai: () => handleMarkForReview(itemsByCategory.ai),
    style: () => handleAcceptMany(itemsByCategory.style),
    spelling: () => handleAcceptMany(itemsByCategory.spelling),
    citations: () => autoResolveGhosts(),
    structure: () => autoCaptionAll(),
  };

  const engineMassLabel: Record<ToolWindowId, string> = {
    ai: 'Marcar todas',
    style: 'Aceptar todas',
    spelling: 'Aceptar todas',
    citations: 'Resolver Fantasmas',
    structure: 'Auto-Rotular Todo',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--canvas-bg)',
      }}
    >
      {/* ── Cabecera compacta: identidad + acciones globales ── */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--surface-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-accent-soft)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={17} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Revisión & Calidad IA
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
              Suite de control editorial y estilo académico
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
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

      {/* ── Barra superior con DOS ZONAS: chips | navegación ── */}
      <div
        style={{
          padding: '7px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--sidebar-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        {/* Zona izquierda: chips de filtro por motor con conteo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
          {engineGroups.map((g) => {
            const active = !hiddenEngines.has(g.id);
            const GIcon = g.Icon;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleEngineFilter(g.id)}
                title={active ? `Ocultar ${g.title}` : `Mostrar ${g.title}`}
                aria-pressed={active}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: active ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  backgroundColor: active ? 'var(--color-accent-soft)' : 'transparent',
                  color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  opacity: active ? 1 : 0.7,
                }}
              >
                <GIcon size={11} />
                <span>{g.chip}</span>
                <span
                  style={{
                    padding: '0 5px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: active ? 'var(--surface-elevated)' : 'var(--border-subtle)',
                    color: active ? 'var(--text-main)' : 'var(--text-secondary)',
                    fontWeight: 800,
                  }}
                >
                  {g.items.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Zona derecha: Página X de N + Siguiente hallazgo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              padding: '2px 4px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--surface-elevated)',
            }}
          >
            <button
              type="button"
              onClick={() => goToPage(Math.max(1, currentPage - 1))}
              title="Página anterior"
              style={{
                padding: '2px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              Página {currentPage} de {Math.max(1, totalPages)}
            </span>
            <button
              type="button"
              onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
              title="Página siguiente"
              style={{
                padding: '2px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleNextFinding}
            disabled={!orderedItems.length}
            title="Saltar directamente al próximo problema"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 9px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-xs)',
              fontWeight: 800,
              cursor: orderedItems.length ? 'pointer' : 'not-allowed',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              opacity: orderedItems.length ? 1 : 0.6,
            }}
          >
            <span>Siguiente hallazgo</span>
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* ── LAYOUT DE TRES COLUMNAS ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Columna 1: Minimapa de páginas */}
        <ReviewMinimap
          totalPages={totalPages}
          marks={pageMarks}
          currentPage={currentPage}
          onPageClick={goToPage}
        />

        {/* Columna 2 (la más ancha): documento con resaltado inline */}
        <div style={{ flex: 1, height: '100%', minWidth: 0, overflow: 'hidden' }}>
          <PaperCanvas reviewHighlightIds={highlightIds} />
        </div>

        {/* Columna 3: hallazgos agrupados por motor -> subtipo */}
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
          {/* Mini HUD de Estado Global */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              padding: '10px 12px 6px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>Cumplimiento APA</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 900, color: 'var(--color-success)' }}>{apaComplianceScore}%</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>Índice de IA</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 900, color: aiGlobalScore > 40 ? 'var(--color-warning)' : 'var(--text-main)' }}>
                {aiGlobalScore}%
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>Observaciones</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 900, color: criticalCount > 0 ? 'var(--color-danger)' : 'var(--text-main)' }}>
                {totalIssues} {criticalCount > 0 ? `(${criticalCount} críticas)` : ''}
              </span>
            </div>
          </div>

          {/* Zona Scrollable: Rack de Grupos Colapsables por Motor */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {visibleGroups.length === 0 && (
              <div
                style={{
                  padding: '16px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                }}
              >
                Todos los motores están ocultos. Activa un chip para ver sus hallazgos.
              </div>
            )}
            {visibleGroups.map((g) => {
              const isOpen = openWindows[g.id];
              const hasItems = g.items.length > 0;
              const GIcon = g.Icon;

              return (
                <div
                  key={g.id}
                  style={{
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    overflow: 'hidden',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  {/* Cabecera del grupo colapsable: motor + conteo + acción masiva */}
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
                    onClick={() => toggleWindow(g.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <div
                        style={{
                          color: hasItems ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <GIcon size={16} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-main)' }}>
                            {g.title}
                          </span>
                          <span
                            style={{
                              fontSize: 'var(--text-xs)',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: hasItems ? 'var(--color-warning)' : 'var(--border-subtle)',
                              color: hasItems ? '#ffffff' : 'var(--text-secondary)',
                            }}
                          >
                            {g.items.length}
                          </span>
                        </div>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.subtitle}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {hasItems && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            engineMassAction[g.id]();
                          }}
                          disabled={isBatchProcessing}
                          style={{
                            fontSize: 'var(--text-xs)',
                            fontWeight: 700,
                            padding: '3px 7px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: g.id === 'ai' ? 'transparent' : 'var(--surface-elevated)',
                            border: '1px solid var(--border-subtle)',
                            color: g.id === 'ai' ? 'var(--text-secondary)' : 'var(--accent-primary)',
                            cursor: isBatchProcessing ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {engineMassLabel[g.id]}
                        </button>
                      )}
                      {isOpen ? <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />}
                    </div>
                  </div>

                  {/* Contenido: subtipos agrupados (una fila por subtipo) */}
                  {isOpen && (
                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {g.subtypes.length === 0 ? (
                        <div
                          style={{
                            padding: '12px',
                            textAlign: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            color: 'var(--color-success)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 700,
                          }}
                        >
                          <CheckCircle2 size={14} />
                          <span>Sin observaciones en este módulo. Cumplimiento verificado.</span>
                        </div>
                      ) : (
                        g.subtypes.map((sub) => {
                          const subKey = `${g.id}:${sub.key}`;
                          const isExpanded = expandedSubtype === subKey;
                          const current =
                            sub.items.find((i) => i.id === selectedAuditId) || sub.items[0];
                          const currentIdx = Math.max(0, sub.items.findIndex((i) => i.id === current?.id));
                          const allMarked = sub.items.every((i) => markedIds.has(i.id));
                          const isObjective = sub.action !== 'mark';

                          return (
                            <div
                              key={subKey}
                              style={{
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: isExpanded ? 'var(--color-accent-soft)' : 'var(--sidebar-bg)',
                                border: isExpanded ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                padding: '8px 10px',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {/* Fila única del subtipo: contador xN + acción */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div
                                  style={{ flex: 1, minWidth: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                  onClick={() => {
                                    setExpandedSubtype(isExpanded ? null : subKey);
                                    if (!isExpanded && current) handleSelectReview(current);
                                  }}
                                  title="Ver detalle y recorrer ocurrencias"
                                >
                                  <span
                                    style={{
                                      fontSize: 'var(--text-xs)',
                                      fontWeight: 800,
                                      padding: '1px 6px',
                                      borderRadius: 'var(--radius-full)',
                                      backgroundColor:
                                        current?.severity === 'critical'
                                          ? 'rgba(220, 38, 38, 0.12)'
                                          : current?.severity === 'high'
                                          ? 'rgba(217, 119, 6, 0.12)'
                                          : 'rgba(59, 130, 246, 0.12)',
                                      color:
                                        current?.severity === 'critical'
                                          ? 'var(--color-danger)'
                                          : current?.severity === 'high'
                                          ? 'var(--color-warning)'
                                          : 'var(--accent-primary)',
                                      flexShrink: 0,
                                    }}
                                  >
                                    ×{sub.items.length}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 'var(--text-xs)',
                                      fontWeight: 800,
                                      color: 'var(--text-main)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {sub.label}
                                  </span>
                                  {g.id === 'ai' && allMarked && (
                                    <span
                                      style={{
                                        fontSize: 'var(--text-xs)',
                                        fontWeight: 700,
                                        padding: '1px 6px',
                                        borderRadius: 'var(--radius-full)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-secondary)',
                                        flexShrink: 0,
                                      }}
                                    >
                                      Marcado
                                    </span>
                                  )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                  {sub.action !== 'none' && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        runSubtypeAction(sub.action, sub.items);
                                      }}
                                      disabled={isBatchProcessing}
                                      title={
                                        sub.action === 'mark'
                                          ? 'Motor probabilístico: solo marca, nunca modifica el texto'
                                          : 'Corrección objetiva del motor'
                                      }
                                      style={{
                                        fontSize: 'var(--text-xs)',
                                        fontWeight: 800,
                                        padding: '3px 7px',
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: isBatchProcessing ? 'not-allowed' : 'pointer',
                                        border: sub.action === 'mark' ? '1px solid var(--border-subtle)' : 'none',
                                        backgroundColor: sub.action === 'mark' ? 'transparent' : 'var(--accent-primary)',
                                        color: sub.action === 'mark' ? 'var(--text-secondary)' : '#ffffff',
                                      }}
                                    >
                                      {massLabel[sub.action]}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedSubtype(isExpanded ? null : subKey);
                                      if (!isExpanded && current) handleSelectReview(current);
                                    }}
                                    title="Expandir detalle"
                                    style={{
                                      padding: '2px',
                                      border: 'none',
                                      background: 'transparent',
                                      color: 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                    }}
                                  >
                                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                  </button>
                                </div>
                              </div>

                              {/* Detalle de la ocurrencia actual (con navegación, sin tarjetas repetidas) */}
                              {isExpanded && current && (
                                <div
                                  style={{
                                    padding: '8px',
                                    borderRadius: 'var(--radius-sm)',
                                    backgroundColor: 'var(--surface-elevated)',
                                    border: '1px solid var(--border-subtle)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                  }}
                                >
                                  {/* Navegación entre ocurrencias + badge de página */}
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                    <span
                                      style={{
                                        fontSize: 'var(--text-xs)',
                                        fontWeight: 800,
                                        padding: '1px 5px',
                                        borderRadius: 'var(--radius-sm)',
                                        textTransform: 'uppercase',
                                        backgroundColor:
                                          current.severity === 'critical'
                                            ? 'rgba(220, 38, 38, 0.12)'
                                            : current.severity === 'high'
                                            ? 'rgba(217, 119, 6, 0.12)'
                                            : 'rgba(59, 130, 246, 0.12)',
                                        color:
                                          current.severity === 'critical'
                                            ? 'var(--color-danger)'
                                            : current.severity === 'high'
                                            ? 'var(--color-warning)'
                                            : 'var(--accent-primary)',
                                      }}
                                    >
                                      Pág. {current.pageNumber}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const prev = sub.items[(currentIdx - 1 + sub.items.length) % sub.items.length];
                                          handleSelectReview(prev);
                                        }}
                                        title="Ocultación anterior"
                                        style={{
                                          padding: '2px',
                                          border: '1px solid var(--border-subtle)',
                                          borderRadius: 'var(--radius-sm)',
                                          background: 'var(--surface-elevated)',
                                          color: 'var(--text-secondary)',
                                          cursor: 'pointer',
                                          display: 'flex',
                                        }}
                                      >
                                        <ChevronLeft size={12} />
                                      </button>
                                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                        {currentIdx + 1}/{sub.items.length}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = sub.items[(currentIdx + 1) % sub.items.length];
                                          handleSelectReview(next);
                                        }}
                                        title="Ocultación siguiente"
                                        style={{
                                          padding: '2px',
                                          border: '1px solid var(--border-subtle)',
                                          borderRadius: 'var(--radius-sm)',
                                          background: 'var(--surface-elevated)',
                                          color: 'var(--text-secondary)',
                                          cursor: 'pointer',
                                          display: 'flex',
                                        }}
                                      >
                                        <ChevronRight size={12} />
                                      </button>
                                    </div>
                                  </div>

                                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                                    {current.detail}
                                  </p>

                                  {current.originalText && (
                                    <div>
                                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--color-danger)' }}>
                                        Texto Original:
                                      </span>
                                      <div
                                        style={{
                                          fontSize: 'var(--text-xs)',
                                          color: 'var(--text-main)',
                                          padding: '4px 6px',
                                          backgroundColor: 'rgba(220, 38, 38, 0.05)',
                                          borderLeft: '2px solid var(--color-danger)',
                                          borderRadius: 'var(--radius-sm)',
                                          fontFamily: 'monospace',
                                          maxHeight: '70px',
                                          overflowY: 'auto',
                                        }}
                                      >
                                        {current.originalText}
                                      </div>
                                    </div>
                                  )}

                                  <div>
                                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--color-success)' }}>
                                      {isObjective ? 'Sugerencia Académica APA 7:' : 'Revisión manual (motor probabilístico):'}
                                    </span>
                                    <div
                                      style={{
                                        fontSize: 'var(--text-xs)',
                                        color: 'var(--text-main)',
                                        padding: '4px 6px',
                                        backgroundColor: 'rgba(22, 163, 74, 0.05)',
                                        borderLeft: '2px solid var(--color-success)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontFamily: 'monospace',
                                        maxHeight: '70px',
                                        overflowY: 'auto',
                                      }}
                                    >
                                      {isObjective
                                        ? current.suggestedText || 'Reescritura en voz formal impersonal académica sin patrones mecánicos.'
                                        : 'No se aplica corrección automática: el motor solo indica probabilidad. Marca para revisión manual.'}
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleDismissItem(current)}
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

                                    {g.id === 'ai' ? (
                                      /* Probabilístico: SOLO marcar, nunca "Aceptar" */
                                      <button
                                        type="button"
                                        onClick={() => handleMarkForReview([current])}
                                        disabled={markedIds.has(current.id)}
                                        style={{
                                          fontSize: 'var(--text-xs)',
                                          fontWeight: 800,
                                          padding: '4px 10px',
                                          borderRadius: 'var(--radius-sm)',
                                          backgroundColor: markedIds.has(current.id) ? 'var(--surface-subtle)' : 'transparent',
                                          border: '1px solid var(--border-subtle)',
                                          color: markedIds.has(current.id) ? 'var(--color-success)' : 'var(--text-secondary)',
                                          cursor: markedIds.has(current.id) ? 'default' : 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                      >
                                        {markedIds.has(current.id) ? <Check size={11} /> : null}
                                        <span>{markedIds.has(current.id) ? 'Marcado para revisar' : 'Marcar para revisar'}</span>
                                      </button>
                                    ) : sub.action === 'none' ? (
                                      /* Sin corrección objetiva automática: solo descartar */
                                      null
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleAcceptFix(current)}
                                        disabled={isProcessingId === current.id}
                                        style={{
                                          fontSize: 'var(--text-xs)',
                                          fontWeight: 800,
                                          padding: '4px 10px',
                                          borderRadius: 'var(--radius-sm)',
                                          backgroundColor: 'var(--accent-primary)',
                                          border: 'none',
                                          color: '#ffffff',
                                          cursor: isProcessingId === current.id ? 'not-allowed' : 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                      >
                                        {isProcessingId === current.id ? <RefreshCw size={11} className="spin" /> : <Check size={11} />}
                                        <span>Aplicar Corrección</span>
                                      </button>
                                    )}
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
    </div>
  );
};

export default Step5AuditIAWizard;

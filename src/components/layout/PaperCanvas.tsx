/* WordAPA7 — Interactive Canvas with Faithful Original Document Layout */

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useDocStore, cleanHeadingPrefix, toRoman } from '../../store/useDocStore';
import { ElementModel } from '../../types';
import { ZoomIn, ZoomOut, Check, X, Flame, Wand2, Loader2, RotateCw, UploadCloud, Image as ImageIcon, PanelRight, Edit3 } from 'lucide-react';
import { suggestCaption, rewriteText, resolveAssetUrl } from '../../api/backend';
import { APACoverEditor } from './APACoverEditor';
import { UNICoverPreview } from './UNICoverPreview';
import { getWhatsAppComment, WhatsAppComment, WhatsAppCommentData } from './WhatsAppComment';
import { findCitationsInText } from '../../lib/citationHighlighter';
import { findAccentAgnostic } from '../../lib/accentMatch';

// Máximo de burbujas de comentario visibles por página (el resto se resume).
const MAX_GUTTER = 6;

export const computePages = (elements: ElementModel[]): ElementModel[][] => {
  const pages: ElementModel[][] = [];
  let currentPage: ElementModel[] = [];
  let currentEstimatedHeight = 0;
  const MAX_PAGE_UNITS = 30;

  elements.forEach((elem) => {
    if (elem.type === 'empty') return;

    let units = 1;
    if (elem.type === 'heading') units = 2;
    if (elem.type === 'toc') units = 20;
    if (elem.type === 'image') units = 4;
    if (elem.type === 'table') units = 6;
    if (elem.type === 'portada_block' || elem.is_cover_section) units = elem.image_info ? 1.2 : 0.6;
    if (elem.type === 'paragraph') units = Math.max(1, Math.ceil((elem.text || '').length / 250));

    const isFirstBodyHeading = !elem.is_cover_section && elem.type === 'heading' && elem.text && elem.text.toLowerCase().includes('introducc');
    const isLevel1Heading = elem.type === 'heading' && elem.heading_level === 1;
    const isToc = elem.type === 'toc';
    const pageHasToc = currentPage.some(e => e.type === 'toc');

    if (
      elem.type === 'page_break' ||
      isToc ||
      pageHasToc ||
      isFirstBodyHeading ||
      (isLevel1Heading && currentPage.length > 0) ||
      (currentEstimatedHeight + units > MAX_PAGE_UNITS && currentPage.length > 0)
    ) {
      if (currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        currentEstimatedHeight = 0;
      }
    }

    if (elem.type !== 'page_break') {
      currentPage.push(elem);
      currentEstimatedHeight += units;
    }
  });

  if (currentPage.length > 0) pages.push(currentPage);
  if (pages.length === 0) pages.push([]);

  return pages;
};

export const PaperCanvas: React.FC<{ onElementClick?: (elementId: string, rect: DOMRect, element: any) => void; reviewHighlightIds?: Set<string>; readOnly?: boolean }> = ({ onElementClick, reviewHighlightIds, readOnly }) => {
  const { doc, rules, portada, selectedElementId, setSelectedElementId, setSelectedReferenceId, updateElementType, reviewResult, zoomLevel, setZoomLevel, setForceRightPanelOpen, setWizardStep, setScrollTargetId, dismissComment } = useDocStore();
  const tableStyles = useDocStore((s) => s.tableStyles);
  const dismissedCommentIds = useDocStore((s) => s.dismissedCommentIds);
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
  const [contextMenuElemId, setContextMenuElemId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showAIHeatmap, setShowAIHeatmap] = useState<boolean>(true);
  const [showCitationMarks, setShowCitationMarks] = useState<boolean>(true);
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [brokenFigureIds, setBrokenFigureIds] = useState<Record<string, string>>({});
  const [resizeState, setResizeState] = useState<{
    id: string;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    ratio: number;
  } | null>(null);
  const resizePendingRef = useRef<{ elemId: string; patch: any } | null>(null);
  const resizeTimerRef = useRef<number | null>(null);

  const flushResize = () => {
    if (resizePendingRef.current) {
      useDocStore.getState().updateElementImage(resizePendingRef.current.elemId, resizePendingRef.current.patch);
      resizePendingRef.current = null;
      resizeTimerRef.current = null;
    }
  };
  const wrapperRef = useRef<HTMLDivElement>(null);

  const startFigureResize = (e: React.PointerEvent, elem: ElementModel) => {
    if (!elem.image_info) return;
    const w = elem.image_info.width_cm || 12;
    const h = elem.image_info.height_cm || 8;
    setResizeState({
      id: elem.id,
      startX: e.clientX,
      startY: e.clientY,
      startW: w,
      startH: h,
      ratio: w / h,
    });
    e.stopPropagation();
    e.preventDefault();
  };

  const handleFigureResize = (e: React.PointerEvent) => {
    if (!resizeState) return;
    const dxPx = e.clientX - resizeState.startX;
    const dyPx = e.clientY - resizeState.startY;
    const dxCm = dxPx / 37.8;
    const dyCm = dyPx / 37.8;
    const lockRatio = !e.shiftKey;
    const elem = doc?.elements.find((x) => x.id === resizeState.id);
    if (!elem?.image_info) return;

    let patch: any;
    if (lockRatio) {
      const newW = Math.max(3, Math.min(16, resizeState.startW + dxCm));
      const newH = Math.round((newW / resizeState.ratio) * 10) / 10;
      patch = { ...elem.image_info, width_cm: Math.round(newW * 10) / 10, height_cm: newH };
    } else {
      const newW = Math.max(3, Math.min(16, resizeState.startW + dxCm));
      const newH = Math.max(3, Math.min(30, resizeState.startH + dyCm));
      patch = { ...elem.image_info, width_cm: Math.round(newW * 10) / 10, height_cm: Math.round(newH * 10) / 10 };
    }
    // Debounce: acumula el último parche y lo aplica cada 100ms
    resizePendingRef.current = { elemId: elem.id, patch };
    if (!resizeTimerRef.current) {
      resizeTimerRef.current = window.setTimeout(flushResize, 100);
    }
  };

  const endFigureResize = () => {
    flushResize();
    setResizeState(null);
  };

  // Render de texto con resaltado inline de frases IA y errores de ortografía
  // (marcas tipo Word: subrayado ondulado para ortografía, punteado para IA)
  // + resaltador amarillo para lo que un comentario WhatsApp está señalando
  // (solo preview; nunca llega al export).
  const renderReviewedText = (elem: ElementModel, plain: string): React.ReactNode => {
    const para = reviewResult?.paragraphs.find((p) => p.element_id === elem.id);
    type Mark = { start: number; end: number; kind: 'ai' | 'spelling' | 'comment' | 'citation'; severity?: string; title: string }[];
    const marks: Mark = [];
    const lower = plain.toLowerCase();

    if (para && (para.findings?.length || para.spelling?.length)) {
      (para.findings || []).forEach((f) => {
        const phraseList: string[] = (f as any).phrases?.length ? (f as any).phrases : [f.phrase || ''];
        phraseList.forEach((rawPhrase) => {
          const phrase = rawPhrase.toLowerCase();
          if (!phrase || phrase.startsWith('(')) return;
          let idx = lower.indexOf(phrase);
          while (idx >= 0) {
            marks.push({ start: idx, end: idx + phrase.length, kind: 'ai', severity: f.severity, title: f.detail });
            idx = lower.indexOf(phrase, idx + phrase.length);
          }
        });
      });

      (para.spelling || []).forEach((s) => {
        const word = (s.word || '').toLowerCase();
        if (!word) return;
        let idx = lower.indexOf(word);
        while (idx >= 0) {
          marks.push({
            start: idx, end: idx + word.length, kind: 'spelling',
            title: s.suggestions?.length ? `Sugerencias: ${s.suggestions.slice(0, 3).join(', ')}` : 'Posible error ortográfico',
          });
          idx = lower.indexOf(word, idx + word.length);
        }
      });
    }

    // Resaltador del comentario estilo WhatsApp (lo que señala la burbuja).
    // Si el comentario no trae un fragmento específico (match), se marca el
    // texto completo del elemento para que el comentario SIEMPRE ancle a algo.
    if (elem.type === 'paragraph' || elem.type === 'bullet' || elem.type === 'numbered_list' || elem.type === 'block_quote') {
      const s = useDocStore.getState();
      const cmtCtx = {
        ghostCitations: (s.citationAuditResult?.ghost_citations || []) as any[],
        orphanReferences: (s.citationAuditResult?.orphan_references || []) as any[],
        validationIssues: (s.validationIssues || []) as any[],
      };
      const comment = getWhatsAppComment(elem, cmtCtx, 0);
      const m = comment?.match;
      if (comment) {
        if (m) {
          // Búsqueda insensible a acentos/case para que el "tachado" aparezca
          // siempre que la burbuja esté señalando un fragmento real del texto.
          const found = findAccentAgnostic(plain, m);
          if (found) {
            marks.push({ start: found.start, end: found.end, kind: 'comment', title: `${comment.emoji} ${comment.text}` });
          } else if (plain.trim()) {
            // Fragmento no localizable → marcamos el párrafo completo.
            marks.push({ start: 0, end: plain.length, kind: 'comment', title: `${comment.emoji} ${comment.text}` });
          }
        } else if (plain.trim()) {
          marks.push({ start: 0, end: plain.length, kind: 'comment', title: `${comment.emoji} ${comment.text}` });
        }
      }
    }

    // Marcado de citas APA 7 detectadas en el texto (indicador visual al usuario)
    if (showCitationMarks && (elem.type === 'paragraph' || elem.type === 'bullet' || elem.type === 'numbered_list' || elem.type === 'block_quote')) {
      const citations = findCitationsInText(plain);
      for (const c of citations) {
        const hasIssue = !!c.error;
        marks.push({
          start: c.start,
          end: c.end,
          kind: 'citation',
          severity: hasIssue ? 'HIGH' : 'OK',
          title: hasIssue
            ? `Cita detectada · ⚠ ${c.error}`
            : `Cita detectada · ${c.authors.join(', ')} (${c.year}) — formato APA 7 correcto`,
        });
      }
    }

    if (marks.length === 0) return plain;

    marks.sort((a, b) => a.start - b.start);

    // ── Consolidación de marcas solapadas ───────────────────────────────────
    // Cuando dos marcas cubren el mismo rango (p.ej. comment + citation sobre
    // "La OIT (2007)"), se renderizan dos <mark> y el texto se duplica.
    // Prioridad: comment > citation > spelling > ai. La marca ganadora absorbe
    // el rango extendido y la otra se descarta.
    const KIND_PRIORITY: Record<Mark[0]['kind'], number> = {
      comment: 4, citation: 3, spelling: 2, ai: 1,
    };
    const merged: Mark = [];
    for (const m of marks) {
      const prev = merged[merged.length - 1];
      if (prev && m.start <= prev.end) {
        // Solapamiento: la de mayor prioridad absorbe; si empate, la primera.
        if (KIND_PRIORITY[m.kind] > KIND_PRIORITY[prev.kind]) {
          // m "gana": extendemos su start al inicio del solapamiento
          const extendedStart = prev.start;
          const extendedEnd = Math.max(prev.end, m.end);
          prev.start = extendedStart;
          prev.end = extendedEnd;
          prev.kind = m.kind;
          prev.severity = m.severity;
          prev.title = m.title;
        } else {
          // prev "gana": extendemos su end si es necesario
          prev.end = Math.max(prev.end, m.end);
        }
      } else {
        merged.push({ ...m });
      }
    }

    const out: React.ReactNode[] = [];
    let cursor = 0;
    merged.forEach((m, i) => {
      if (m.start > cursor) out.push(plain.slice(cursor, m.start));
      const frag = plain.slice(m.start, m.end);
      const isSpell = m.kind === 'spelling';
      const isComment = m.kind === 'comment';
      const isCitation = m.kind === 'citation';
      const color = isCitation
        ? (m.severity === 'HIGH' ? '#8a4d00' : '#1a7f4e')
        : isComment ? '#7c5e00' : isSpell ? '#d4382e' : m.severity === 'HIGH' ? '#d4382e' : m.severity === 'MEDIUM' ? '#b8860b' : '#1e6fd9';
      const bg = isCitation
        ? (m.severity === 'HIGH' ? 'rgba(214,137,16,0.22)' : 'rgba(26,127,78,0.15)')
        : isComment ? 'rgba(255, 213, 0, 0.45)' : isSpell ? 'rgba(212,56,46,0.12)' : m.severity === 'HIGH' ? 'rgba(212,56,46,0.15)' : m.severity === 'MEDIUM' ? 'rgba(184,134,11,0.15)' : 'rgba(30,111,217,0.12)';
      out.push(
        <mark key={`${m.start}-${i}`} title={m.title} style={{
          color, backgroundColor: bg,
          textDecoration: isComment ? 'line-through underline rgba(124,94,0,0.55)' : isCitation ? 'none' : isSpell ? 'underline wavy #d4382e' : `underline dotted ${color}`,
          padding: '0 1px', borderRadius: 2,
        }}>
          {frag}
        </mark>
      );
      cursor = m.end;
    });
    if (cursor < plain.length) out.push(plain.slice(cursor));
    return out;
  };

  const handleSuggestCaption = async (elem: ElementModel) => {
    if (!doc) return;
    setAiLoadingId(elem.id);
    try {
      // Contexto real: párrafos circundantes a la figura (el texto propio de
      // una imagen suele estar vacío, por eso la IA respondía con el prompt).
      const idx = doc.elements.findIndex((e) => e.id === elem.id);
      const ctx: string[] = [];
      for (let i = Math.max(0, idx - 2); i < Math.min(doc.elements.length, idx + 3); i++) {
        const e = doc.elements[i];
        if (e.id === elem.id) continue;
        if (e.type === 'paragraph' || e.type === 'heading' || e.type === 'bullet' || e.type === 'numbered_list') {
          const t = (e.text || '').trim();
          if (t) ctx.push(t);
        }
      }
      const contextText = ctx.join('\n') || elem.text || '';
      const apiKey = useDocStore.getState().apiKey;
      const suggestion = await suggestCaption(doc.session_id, elem.id, contextText, apiKey);
      const newImageInfo = { ...elem.image_info, caption: suggestion };
      useDocStore.getState().updateElementImage(elem.id, newImageInfo);
      useDocStore.getState().showToast('Leyenda sugerida aplicada', 'success');
    } catch (err: any) {
      useDocStore.getState().showToast(err.message || 'Error al sugerir leyenda', 'error');
    } finally {
      setAiLoadingId(null);
      setContextMenuElemId(null);
    }
  };

  const handleRewriteText = async (elem: ElementModel) => {
    if (!doc) return;
    const instruction = prompt("Instrucción para reescribir (ej. 'Hazlo más formal' o 'Corrige ortografía'):", "Corrige la gramática y adapta al tono académico APA.");
    if (!instruction) return;
    
    setAiLoadingId(elem.id);
    try {
      const apiKey = useDocStore.getState().apiKey;
      const rewritten = await rewriteText(doc.session_id, elem.id, elem.text, instruction, apiKey);
      useDocStore.getState().updateElementType(elem.id, elem.type, elem.heading_level, rewritten);
      useDocStore.getState().showToast('Texto reescrito aplicado', 'success');
    } catch (err: any) {
      useDocStore.getState().showToast(err.message || 'Error al reescribir', 'error');
    } finally {
      setAiLoadingId(null);
      setContextMenuElemId(null);
    }
  };

  // Zoom con Ctrl + scroll. El handler SOLO llama preventDefault cuando Ctrl
  // está presionado (para hacer zoom). Cuando no lo está, no hace nada y deja
  // que el navegador haga scroll normal de la página. { passive: false } se
  // mantiene porque necesitamos poder llamar preventDefault en el caso del zoom.
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 10 : -10;
        const s = useDocStore.getState();
        s.setZoomLevel(s.zoomLevel + delta);
      }
      // Cuando Ctrl NO está presionado: no hacemos nada, el navegador hace
      // scroll normalmente. Esto evita bloquear el scroll de la página.
    };

    const el = wrapperRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (el) el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Scroll automático y resalte suave al seleccionar cualquier elemento desde el esquema o asistente
  useEffect(() => {
    if (selectedElementId) {
      const targetEl = document.getElementById(`paper-elem-${selectedElementId}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedElementId]);

  // Scroll del DocumentOutline / auto-scroll a Referencias SIN abrir el inspector
  const scrollTargetId = useDocStore((s) => s.scrollTargetId);
  useEffect(() => {
    if (scrollTargetId) {
      const targetEl = document.getElementById(`paper-elem-${scrollTargetId}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [scrollTargetId]);

  if (!doc) return null;

  const fontFamily = rules.font_family || 'Times New Roman';

  // Algoritmo de paginación virtual respetando salto de página del cuerpo
  const pages = computePages(doc.elements);

  // ── Comentarios: fallas estructurales siempre; estilo solo tras auditar ──
  const citationAudit = useDocStore((s) => s.citationAuditResult);
  const validationIssues = useDocStore((s) => s.validationIssues);
  const commentCtx = {
    ghostCitations: (citationAudit?.ghost_citations || []) as any[],
    orphanReferences: (citationAudit?.orphan_references || []) as any[],
    validationIssues: (validationIssues || []) as any[],
    // Sin auditoría de estilo no se juzga redacción: evita inundar de
    // comentarios ("detecta que como falla") en cada párrafo del documento.
    styleAuditRun: !!reviewResult,
  };
  // Un solo festejo: SOLO si el documento entero está impecable (cero comentarios).
  const positiveMap = new Map<string, boolean>();
  {
    let anyComment = false;
    for (const pageElements of pages) {
      for (const e of pageElements) {
        if (getWhatsAppComment(e, commentCtx, 0) !== null) { anyComment = true; break; }
      }
      if (anyComment) break;
    }
    if (!anyComment) {
      for (const pageElements of pages) {
        const h = pageElements.find((e) => e.type === 'heading' && !e.is_cover_section);
        if (h) { positiveMap.set(h.id, true); break; }
      }
    }
  }

  // ── Gutter de comentarios (estilo Word): burbujas FUERA de la hoja, en una
  // columna a la derecha de cada página, alineadas con el elemento que señalan.
  // El offsetTop de cada elemento (medido tras pintar) define la posición.
  const allGutterIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const page of pages) {
      for (const e of page) {
        if (positiveMap.get(e.id) || getWhatsAppComment(e, commentCtx, 0) !== null) set.add(e.id);
      }
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pages, positiveMap]);
  const [gutterOffsets, setGutterOffsets] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    allGutterIds.forEach((id) => {
      const el = document.getElementById(`paper-elem-${id}`);
      if (el) next[id] = el.offsetTop;
    });
    setGutterOffsets((prev) => {
      let changed = Object.keys(prev).length !== Object.keys(next).length;
      if (!changed) {
        for (const k of Object.keys(next)) {
          if (prev[k] !== next[k]) { changed = true; break; }
        }
      }
      return changed ? next : prev;
    });
  }, [allGutterIds, doc, zoomLevel]);

  // Acción "Resolver" del comentario inline: enfoca el panel lateral correcto.
  const handleResolveComment = (comment: WhatsAppCommentData, elem: ElementModel) => {
    setForceRightPanelOpen(true);
    if (comment.kind === 'ghost_citation' || comment.kind === 'orphan_references') {
      // El panel derecho de Referencias tiene el botón "Resolver" por cita.
      setSelectedElementId(null);
      setSelectedReferenceId(null);
      setWizardStep(4);
      setScrollTargetId(elem.id);
      return;
    }
    setSelectedElementId(elem.id);
    if (comment.kind && comment.kind.startsWith('validation_') && (comment.kind.includes('figur') || comment.kind.includes('tabla'))) {
      setWizardStep(3); // inspector de la figura/tabla
    }
    setScrollTargetId(elem.id);
  };

  let globalListCounter = 0;

  // Numeración JERÁRQUICA de títulos (1, 1.1, 1.1.1) aplicada SOLO en el preview.
  // Filtra headings de portada/TOC y la sección de Referencias (que no se numera).
  const isRefHeading = (txt: string): boolean => {
    const n = (txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return /^(referencias?|bibliografia|obras consultadas|works cited)\b/.test(n.trim());
  };
  const hCounters: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  const headingDisplayText = new Map<string, string>();
  for (const e of doc.elements) {
    if (e.type !== 'heading') continue;
    if (e.is_cover_section) continue;
    if (isRefHeading(e.text || '')) continue;
    const lvl = e.heading_level || 1;
    if (lvl > 3) continue;
    hCounters[lvl] = (hCounters[lvl] || 0) + 1;
    // resetear contadores de niveles más profundos al subir de nivel
    if (lvl === 1) { hCounters[2] = 0; hCounters[3] = 0; }
    if (lvl === 2) { hCounters[3] = 0; }
    const style = rules[`heading_numbering_style_lvl${lvl}` as keyof typeof rules] as string || 'decimal';
    const base = cleanHeadingPrefix(e.text || '');
    if (style === 'none') {
      headingDisplayText.set(e.id, base);
    } else {
      let num: string;
      if (lvl === 1) {
        num = style === 'roman' ? `${toRoman(hCounters[1])}.` : `${hCounters[1]}.`;
      } else if (lvl === 2) {
        num = `${hCounters[1]}.${hCounters[2]}.`;
      } else {
        num = `${hCounters[1]}.${hCounters[2]}.${hCounters[3]}.`;
      }
      headingDisplayText.set(e.id, `${num} ${base}`);
    }
  }

  return (
    <div
      ref={wrapperRef}
      style={{
        flex: 1,
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        backgroundColor: 'var(--canvas-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px',
        position: 'relative',
        scrollbarColor: 'rgba(255,255,255,0.15) transparent',
        overscrollBehavior: 'contain'
      }}
    >
      {/* Zoom control minimalista — reemplaza la barra flotante gigante */}
      <div style={{
        position: 'sticky',
        bottom: '8px',
        zIndex: 50,
        alignSelf: 'flex-end',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        backgroundColor: 'var(--surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '999px',
        padding: '3px 4px',
        marginBottom: '8px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <button
          onClick={() => setZoomLevel(zoomLevel - 10)}
          title="Reducir Zoom"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}
        >
          <ZoomOut size={14} />
        </button>
        <span style={{ fontWeight: 600, minWidth: '36px', textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>{zoomLevel}%</span>
        <button
          onClick={() => setZoomLevel(zoomLevel + 10)}
          title="Aumentar Zoom"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}
        >
          <ZoomIn size={14} />
        </button>
      </div>

      {/* Barra contextual de imagen (estilo Word: aparece al seleccionar una figura) */}
      {!readOnly && doc && selectedElementId && (() => {
        const selElem = doc.elements.find(e => e.id === selectedElementId);
        if (!selElem || selElem.type !== 'image' || !selElem.image_info) return null;
        const img = selElem.image_info;
        const rot = img.rotation || 0;
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
            backgroundColor: 'var(--surface-elevated)',
            border: '1px solid var(--accent-primary)',
            borderRadius: 'var(--radius-md)', padding: '6px 12px', marginBottom: '12px',
            fontSize: '11px', color: 'var(--text-secondary)', boxShadow: 'var(--shadow-md)',
          }}>
            <span style={{ fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ImageIcon size={13} /> Imagen seleccionada
            </span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            {/* Rotación */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              Rotar:
              {[0, 90, 180, 270].map((deg) => (
                <button key={deg} type="button"
                  onClick={() => useDocStore.getState().updateElementImage(selElem.id, { rotation: deg })}
                  title={`Rotar ${deg}°`}
                  style={{
                    padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px',
                    background: rot === deg ? 'var(--accent-primary)' : 'var(--surface-subtle)',
                    color: rot === deg ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)', fontWeight: 600,
                  }}>
                  {deg === 0 ? '0°' : `${deg}°`}
                </button>
              ))}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            {/* Ancho */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              Ancho
              <input type="number" min={2} max={20} step={0.5}
                value={img.width_cm || 12}
                onChange={(e) => useDocStore.getState().updateElementImage(selElem.id, { width_cm: parseFloat(e.target.value) || 12 })}
                style={{ width: '56px', padding: '2px 4px', fontSize: '10px', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-main)' }}
              /> cm
            </label>
            {/* Leyenda */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: '120px' }}>
              Leyenda
              <input type="text"
                value={img.caption || ''}
                onChange={(e) => useDocStore.getState().updateElementImage(selElem.id, { caption: e.target.value })}
                placeholder="Escribí la leyenda de la figura..."
                style={{ flex: 1, padding: '3px 6px', fontSize: '10px', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-main)' }}
              />
            </label>
            {/* Sugerir con IA */}
            <button type="button"
              onClick={() => handleSuggestCaption(selElem)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', fontSize: '10px', fontWeight: 600,
                background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer',
              }}>
              <Wand2 size={11} /> Sugerir IA
            </button>
            {/* Abrir/cerrar panel de edición completo */}
            <button
              type="button"
              onClick={() => useDocStore.setState({ imagePanelOpen: !useDocStore.getState().imagePanelOpen })}
              aria-pressed={useDocStore.getState().imagePanelOpen}
              title="Mostrar u ocultar el panel de edición de la imagen"
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', fontSize: '10px', fontWeight: 600,
                background: useDocStore.getState().imagePanelOpen ? 'var(--color-accent-soft)' : 'var(--surface-subtle)',
                color: useDocStore.getState().imagePanelOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer',
              }}>
              <PanelRight size={11} /> Editar panel
            </button>
          </div>
        );
      })()}

      {/* Renderizado de Páginas */}
      <div style={{
        zoom: zoomLevel / 100,
        transition: 'zoom 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {pages.map((pageElements, pageIdx) => {
          const isCoverPage = pageIdx === 0;
          const hasTocElement = pageElements.some(e => e.type === 'toc');
          const showPageNumber = !isCoverPage && !hasTocElement;

          // Separar elementos de portada en bloques lógicos para renderizado limpio
          const coverHeaderTexts: ElementModel[] = [];
          const coverAuthorTexts: ElementModel[] = [];
          const coverFooterTexts: ElementModel[] = [];
          // CHANGE 2: Detect ANY image on the cover page (not just those wider than 2cm)
          const coverLogoImage = pageElements.find(e => (e.is_cover_section || e.type === 'portada_block') && e.image_info && e.image_info.relative_url);

          if (isCoverPage) {
            pageElements.forEach(e => {
              if (e.is_cover_section || e.type === 'portada_block') {
                const txt = (e.text || '').trim();
                const txtLower = txt.toLowerCase();

                if (
                  txtLower.includes('elaborado por') ||
                  txtLower.includes('presentado por') ||
                  txtLower.includes('br.') ||
                  txtLower.includes('carnet') ||
                  txtLower.includes('carne') ||
                  txtLower.includes('tutor') ||
                  txtLower.includes('autor')
                ) {
                  coverAuthorTexts.push(e);
                } else if (
                  txtLower.includes('docente') ||
                  txtLower.includes('profesor') ||
                  txtLower.includes('grupo') ||
                  txtLower.includes('managua') ||
                  txtLower.includes('nicaragua') ||
                  txtLower.includes('recinto') ||
                  txtLower.includes('fecha') ||
                  /\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/.test(txtLower) ||
                  /\b\d{4}\b/.test(txtLower)
                ) {
                  coverFooterTexts.push(e);
                } else if (txt) {
                  coverHeaderTexts.push(e);
                }
              }
            });
          }

          // Elementos con comentario en esta página. Si hay gutter de comentarios,
          // se reserva un espaciador simétrico a la IZQUIERDA para que la hoja
          // permanezca centrada (antes solo el gutter derecho empujaba la hoja
          // ~135px y "bailaba" al activarse/desactivar comentarios).
          const pageCommentElems = pageElements.filter((e) => !dismissedCommentIds.includes(e.id) && (positiveMap.get(e.id) || getWhatsAppComment(e, commentCtx, 0) !== null));

          return (
            <div key={pageIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', position: 'relative' }}>
            {pageCommentElems.length > 0 && <div aria-hidden="true" style={{ width: '250px', flexShrink: 0 }} />}
            <div
              style={{
                width: '680px',
                minHeight: '880px',
                backgroundColor: '#ffffff',
                boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
                padding: '54px 54px',
                boxSizing: 'border-box',
                position: 'relative',
                fontFamily: fontFamily,
                fontSize: `${rules.font_size_pt}pt`,
                color: '#000000',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Encabezado Superior de Página: APA 7 exige sin número en portada e índice */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10pt',
                fontFamily: fontFamily,
                marginBottom: '16px',
                color: '#000000',
                minHeight: '20px'
              }}>
                {doc.apa_format === 'professional' && showPageNumber ? (
                  <span style={{ fontWeight: 600 }}>RUNNING HEAD</span>
                ) : (
                  <span></span>
                )}
                <span>{showPageNumber ? pageIdx + 1 : ''}</span>
              </div>

              {/* RENDERIZADO ESTRUCTURADO DE PORTADA EN PÁGINA 1
                  La cadena ternaria evalúa en orden:
                  1. cover_mode === 'generate_uni_cover' && !use_original_cover → UNICoverPreview
                  2. !use_original_cover → APACoverEditor
                  3. coverHeaderTexts.length > 0 && all cover elements → Structured cover
                     (renderiza logo, textos de encabezado, autores y pie — incluso
                      cuando use_original_cover es true, para que el usuario VEA la
                      portada original en lugar de un placeholder)
                  4. else → Standard body rendering */}
              {isCoverPage && (portada.cover_mode === 'generate_uni_cover') && !portada.use_original_cover ? (
                <UNICoverPreview />
              ) : isCoverPage && !portada.use_original_cover ? (
                <APACoverEditor />
              ) : isCoverPage && coverHeaderTexts.length > 0 && pageElements.every(e => e.is_cover_section || e.type === 'portada_block') ? (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', minHeight: '780px' }}>
                  
                  {/* Badge informativo: la portada original del archivo se conserva
                      en el documento final. Sutil y no intrusivo para que el usuario
                      sepa que VE la portada original, no una versión regenerada. */}
                  {portada.use_original_cover && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      alignSelf: 'center',
                      fontSize: '9pt',
                      color: '#64748b',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '2px 10px',
                      marginBottom: '10px',
                      fontStyle: 'italic',
                    }}>
                      Portada original conservada
                    </div>
                  )}
                  
                  {/* Encabezado: Logo + Universidad/Título */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '4px' }}>
                    {coverLogoImage?.image_info?.relative_url && (
                      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                        <img
                          src={resolveAssetUrl(coverLogoImage.image_info.relative_url)}
                          alt="Logo Universidad"
                          style={{ maxHeight: '110px', maxWidth: '320px', objectFit: 'contain' }}
                        />
                      </div>
                    )}
                    {/* Separar textos institucionales de nombres cortos para distribuirlos horizontalmente */}
                    {(() => {
                      const INSTITUTIONAL_KW = ['universidad', 'recinto', 'facultad', 'tema', 'trabajo', 'asignatura', 'curso', 'departamento', 'carrera', 'ingenier', 'licenc', 'unidad academica', 'asignatura'];
                      const isNameLike = (txt: string) => {
                        const lower = (txt || '').toLowerCase();
                        return (txt || '').trim().length <= 80 && !INSTITUTIONAL_KW.some(kw => lower.includes(kw));
                      };
                      const institutionalTexts = coverHeaderTexts.filter(e => !isNameLike(e.text || ''));
                      const nameLikeTexts = coverHeaderTexts.filter(e => isNameLike(e.text || ''));
                      return (
                        <>
                          {/* Textos institucionales (universidad, tema, etc.) — verticales, centrados */}
                          {institutionalTexts.map(elem => (
                            <p
                              key={elem.id}
                              id={`paper-elem-${elem.id}`}
                              onClick={(e) => { e.stopPropagation(); setSelectedElementId(elem.id); onElementClick?.(elem.id, (e.currentTarget as HTMLElement).getBoundingClientRect(), elem); }}
                              style={{
                                margin: '2px 0',
                                textAlign: (elem.alignment as any) || 'center',
                                fontWeight: elem.is_bold ? 'bold' : 'normal',
                                fontSize: elem.font_size ? `${elem.font_size}pt` : '12pt',
                                color: '#0f172a',
                                cursor: 'pointer'
                              }}
                            >
                              {elem.text}
                            </p>
                          ))}
                          {/* Nombres cortos — distribuidos horizontalmente como en el documento original */}
                          {nameLikeTexts.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px 24px', marginTop: '12px', maxWidth: '100%' }}>
                              {nameLikeTexts.map(elem => (
                                <p
                                  key={elem.id}
                                  id={`paper-elem-${elem.id}`}
                                  onClick={(e) => { e.stopPropagation(); setSelectedElementId(elem.id); onElementClick?.(elem.id, (e.currentTarget as HTMLElement).getBoundingClientRect(), elem); }}
                                  style={{
                                    margin: 0,
                                    textAlign: 'center',
                                    fontWeight: elem.is_bold ? 'bold' : 'normal',
                                    fontSize: elem.font_size ? `${elem.font_size}pt` : '12pt',
                                    color: '#0f172a',
                                    cursor: 'pointer',
                                    whiteSpace: 'pre-line',
                                  }}
                                >
                                  {elem.text}
                                </p>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Bloque Autores: Grilla de Columnas Limpia */}
                  {coverAuthorTexts.length > 0 && (
                    <div style={{ width: '100%', margin: '20px 0' }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: '12px',
                        alignItems: 'start',
                        borderLeft: '2px solid #e2e8f0',
                        paddingLeft: '12px'
                      }}>
                        {coverAuthorTexts.map(elem => (
                          <div
                            key={elem.id}
                            id={`paper-elem-${elem.id}`}
                            onClick={(e) => { e.stopPropagation(); setSelectedElementId(elem.id); onElementClick?.(elem.id, (e.currentTarget as HTMLElement).getBoundingClientRect(), elem); }}
                            style={{
                              padding: '4px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              backgroundColor: selectedElementId === elem.id ? '#eff6fc' : 'transparent'
                            }}
                          >
                            <p style={{
                              margin: 0,
                              fontSize: '11pt',
                              fontWeight: elem.text.toLowerCase().includes('elaborado') || elem.text.toLowerCase().includes('tutor') ? 'bold' : 'normal',
                              color: '#0f172a',
                              whiteSpace: 'pre-line'
                            }}>
                              {elem.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pie de Portada: Docente/Grupo & Fecha/Lugar */}
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {coverFooterTexts
                        .filter(e => !e.text.toLowerCase().includes('managua') && !e.text.toLowerCase().includes('nicaragua') && !/\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(e.text))
                        .map(elem => (
                          <p
                            key={elem.id}
                            id={`paper-elem-${elem.id}`}
                            onClick={(e) => { e.stopPropagation(); setSelectedElementId(elem.id); onElementClick?.(elem.id, (e.currentTarget as HTMLElement).getBoundingClientRect(), elem); }}
                            style={{
                              margin: 0,
                              fontSize: '11pt',
                              fontWeight: 'bold',
                              color: '#0f172a',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            {elem.text}
                          </p>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end' }}>
                      {coverFooterTexts
                        .filter(e => e.text.toLowerCase().includes('managua') || e.text.toLowerCase().includes('nicaragua') || /\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(e.text))
                        .map(elem => (
                          <p
                            key={elem.id}
                            id={`paper-elem-${elem.id}`}
                            onClick={(e) => { e.stopPropagation(); setSelectedElementId(elem.id); onElementClick?.(elem.id, (e.currentTarget as HTMLElement).getBoundingClientRect(), elem); }}
                            style={{
                              margin: 0,
                              fontSize: '11pt',
                              fontWeight: 'bold',
                              color: '#0f172a',
                              cursor: 'pointer',
                              textAlign: 'right'
                            }}
                          >
                            {elem.text}
                          </p>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* RENDERIZADO ESTÁNDAR DEL CUERPO (PÁGINAS > 1) */
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {pageElements.map((elem) => {
                    const isSelected = selectedElementId === elem.id;
                    const isContextMenuOpen = contextMenuElemId === elem.id;
                    const showFigureLabel = elem.type === 'image' && elem.image_info && (elem.image_info.figure_number || 0) > 0 && !elem.is_cover_section;
                    const captionPosition = elem.image_info?.caption_position ?? 'below';
                    const tableStyle = elem.type === 'table' ? (tableStyles[elem.id] || 'standard') : 'standard';
                    const imgAlign = (elem.type === 'image' && elem.image_info?.alignment) || 'center';
                    const imgOuterTextAlign = imgAlign === 'left' ? 'left' : imgAlign === 'right' ? 'right' : 'center';
                    const imgInnerMargin = imgAlign === 'left' ? '8px auto 8px 0' : imgAlign === 'right' ? '8px 0 8px auto' : '8px auto';

                    if (elem.type === 'heading') {
                      globalListCounter = 0;
                    } else if (elem.type === 'numbered_list') {
                      globalListCounter += 1;
                    }
                    const currentItemNum = globalListCounter;

                    let aiBgColor = 'transparent';
                    let tooltipText = undefined;
                    
                    const hasGhostCitation = useDocStore.getState().citationAuditResult?.ghost_citations?.some((c: any) => c.element_id === elem.id);
                    let borderColor = 'transparent';
                    if (hasGhostCitation) borderColor = '#dc2626';
                    
                    if (showAIHeatmap) {
                      const score = elem.ai_score !== undefined ? elem.ai_score : (elem.confidence < 0.5 ? 0.9 : 0.1);
                      if (score >= 0.75) {
                        aiBgColor = 'rgba(239, 68, 68, 0.15)'; // High Risk - Red
                      } else if (score >= 0.4) {
                        aiBgColor = 'rgba(234, 179, 8, 0.15)'; // Medium Risk - Yellow
                      }
                      
                      if (elem.ai_findings && elem.ai_findings.length > 0) {
                        tooltipText = `Riesgo IA: ${Math.round(score * 100)}%\n` + 
                          elem.ai_findings.map(f => `- ${f.pattern}: ${f.detail}`).join('\n');
                      } else {
                        tooltipText = `Riesgo IA Estimado: ${Math.round(score * 100)}%`;
                      }
                    }

                    // Detector IA Margen (Siempre activo si el score > 0.5)
                    const aiScore = elem.ai_score !== undefined ? elem.ai_score : 0;
                    const isAIGenerated = aiScore > 0.5;
                    const aiMarginBorder = isAIGenerated ? '2px solid rgba(250,173,20,0.4)' : '2px solid transparent';
                    const aiTooltip = isAIGenerated ? `Posible contenido IA (${Math.round(aiScore * 100)}%). Patrones detectados.` : undefined;

                    return (
                      <div
                        key={elem.id}
                        id={`paper-elem-${elem.id}`}
                        title={hasGhostCitation ? 'Este párrafo contiene una cita sin referencia bibliográfica.' : (tooltipText || aiTooltip)}
                        onMouseEnter={(e) => {
                          if (elem.type !== 'image' && elem.type !== 'table') {
                            (e.currentTarget as HTMLElement).dataset.hover = 'true';
                          }
                        }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).dataset.hover = ''; }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId(elem.id);
                          onElementClick?.(elem.id, (e.currentTarget as HTMLElement).getBoundingClientRect(), elem);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          (window.getSelection?.() ?? null)?.removeAllRanges?.();
                          if (readOnly) return;
                          if (elem.type === 'image' && elem.image_info) {
                            setEditingId(elem.id);
                            setEditValue(elem.image_info.caption || '');
                          } else if (elem.type !== 'image' && elem.type !== 'table') {
                            setEditingId(elem.id);
                            setEditValue(elem.text || '');
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedElementId(elem.id);
                          if (!readOnly) setContextMenuElemId(elem.id);
                        }}
                        style={{
                          position: 'relative',
                          border: isSelected ? '2px solid var(--word-blue)' : hasGhostCitation ? '2px dashed #dc2626' : '2px solid transparent',
                          borderLeft: isSelected ? '2px solid var(--word-blue)' : aiMarginBorder,
                          borderRadius: '2px',
                          padding: '2px 2px 2px 6px',
                          backgroundColor: isSelected ? 'rgba(43, 87, 154, 0.05)' : (hasGhostCitation ? 'rgba(254, 242, 242, 0.5)' : aiBgColor),
                          transition: 'all 0.2s',
                          cursor: 'text',
                          // Hover contextual: la burbuja resalta el elemento referenciado
                          ...(hoveredCommentId === elem.id ? {
                            outline: '2px solid var(--accent-primary)',
                            outlineOffset: '2px',
                            backgroundColor: 'rgba(79,124,255,0.08)',
                            boxShadow: '0 0 0 4px rgba(79,124,255,0.10)',
                          } : {}),
                        }}
                      >
                        {/* Menú Contextual — debajo del elemento para que nunca
                            se salga por arriba del viewport en el primer elemento */}
                        {isContextMenuOpen && (
                          <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: '0',
                            backgroundColor: '#ffffff',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            display: 'flex',
                            gap: '4px',
                            zIndex: 300,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                            flexWrap: 'wrap',
                            maxWidth: '100%'
                          }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                              onClick={() => { updateElementType(elem.id, 'heading', 1, elem.text); setContextMenuElemId(null); }}
                            >
                              Heading 1
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                              onClick={() => { updateElementType(elem.id, 'heading', 2, elem.text); setContextMenuElemId(null); }}
                            >
                              Heading 2
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                              onClick={() => { updateElementType(elem.id, 'paragraph', 1, elem.text); setContextMenuElemId(null); }}
                            >
                              Párrafo
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                              onClick={() => { updateElementType(elem.id, 'bullet', 1, elem.text); setContextMenuElemId(null); }}
                            >
                              Viñeta
                            </button>
                            
                            {/* AI Actions */}
                            <div style={{ width: '1px', backgroundColor: '#e2e8f0', margin: '0 4px' }} />
                            {(elem.type === 'image' || elem.type === 'table') && (
                              <button
                                className="btn btn-sm"
                                style={{ padding: '2px 6px', fontSize: '10px', backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => handleSuggestCaption(elem)}
                              >
                                <Wand2 size={10} /> Sugerir Leyenda
                              </button>
                            )}
                            {elem.type === 'table' && (
                              <button
                                className="btn btn-sm"
                                style={{ padding: '2px 6px', fontSize: '10px', backgroundColor: 'var(--color-accent-soft, rgba(79,124,255,0.10))', color: 'var(--accent-primary)', border: '1px solid rgba(79,124,255,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => {
                                  setSelectedElementId(elem.id);
                                  useDocStore.getState().setForceRightPanelOpen(true);
                                  setContextMenuElemId(null);
                                }}
                              >
                                <Edit3 size={10} /> Editar celdas
                              </button>
                            )}
                            {(elem.type === 'paragraph' || elem.type === 'heading') && (
                              <button
                                className="btn btn-sm"
                                style={{ padding: '2px 6px', fontSize: '10px', backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => handleRewriteText(elem)}
                              >
                                <Wand2 size={10} /> Reescribir Texto
                              </button>
                            )}
                          </div>
                        )}

                        {aiLoadingId === elem.id && (
                          <div style={{
                            position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
                          }}>
                            <Loader2 size={20} className="animate-spin" color="var(--word-blue)" />
                          </div>
                        )}

                        {editingId === elem.id && elem.type !== 'image' ? (
                          <div style={{ position: 'relative', margin: '4px 0' }}>
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              autoFocus
                              style={{
                                width: '100%',
                                minHeight: '60px',
                                fontFamily: fontFamily,
                                fontSize: `${rules.font_size_pt}pt`,
                                padding: '8px',
                                border: '2px solid var(--word-blue)',
                                borderRadius: '4px',
                                outline: 'none',
                                resize: 'vertical'
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setEditingId(null);
                                } else if (e.key === 'Enter' && e.ctrlKey) {
                                  if (elem.type === 'image') {
                                    if (editValue !== (elem.image_info?.caption || '')) {
                                      useDocStore.getState().updateElementImage(elem.id, { caption: editValue });
                                    }
                                  } else if (editValue !== elem.text) {
                                    updateElementType(elem.id, elem.type, elem.heading_level, editValue);
                                  }
                                  setEditingId(null);
                                } else if (e.key === 'Enter' && !e.shiftKey) {
                                  if (elem.type === 'image') {
                                    if (editValue !== (elem.image_info?.caption || '')) {
                                      useDocStore.getState().updateElementImage(elem.id, { caption: editValue });
                                    }
                                  } else if (editValue !== elem.text) {
                                    updateElementType(elem.id, elem.type, elem.heading_level, editValue);
                                  }
                                  setEditingId(null);
                                }
                              }}
                            />
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '4px' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setEditingId(null)}
                                title="Cancelar (Esc)"
                              >
                                <X size={14} />
                              </button>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  if (editValue !== elem.text) {
                                    updateElementType(elem.id, elem.type, elem.heading_level, editValue);
                                  }
                                  setEditingId(null);
                                }}
                                title="Guardar (Ctrl+Enter)"
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          </div>
                        ) : elem.type !== 'image' ? (
                          <>
                            {elem.type === 'heading' && (() => {
                              const isRef = isRefHeading(elem.text || '');
                              if (isRef) {
                                return (
                                  <div style={{ marginTop: '20px', marginBottom: '8px' }}>
                                    <p style={{
                                      fontFamily: fontFamily,
                                      fontWeight: 'bold', textAlign: 'center', fontSize: '14pt',
                                      margin: '0 0 12px 0',
                                    }}>
                                      {elem.text}
                                    </p>
                                    {/* Lista de referencias estructuradas */}
                                    {doc.referencias && doc.referencias.length > 0 ? (
                                      <div style={{ paddingLeft: 0 }}>
                                        {doc.referencias.map((ref, ri) => (
                                          <p key={ref.id || ri} style={{
                                            fontFamily: fontFamily,
                                            fontSize: '11pt', lineHeight: 2.0, textAlign: 'left',
                                            textIndent: '-0.5in', marginLeft: '0.5in',
                                            marginBottom: '8px', marginTop: 0, marginRight: 0,
                                            paddingLeft: 0,
                                          }}>
                                            {ref.formatted_apa || (
                                              <>{[...(ref.authors || [])].join(', ')}{ref.year ? ` (${ref.year}).` : '.'} {ref.title}.{ref.source ? ` ${ref.source}.` : ''}{ref.doi_or_url ? ` ${ref.doi_or_url}` : ''}</>
                                            )}
                                          </p>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              }
                              return (
                                <p style={{
                                  fontFamily: fontFamily,
                                  fontWeight: 'bold',
                                  fontStyle: elem.heading_level === 3 ? 'italic' : 'normal',
                                  textAlign: elem.heading_level === 1 ? 'center' : 'left',
                                  marginTop: '12px',
                                  marginBottom: '8px',
                                  // APA 7: sin decoración visual (bordes, paddings). Solo negrita/itálica/alineación.
                                  // El resaltado de revisión usa un fondo sutil, no un borde decorativo.
                                  backgroundColor: reviewHighlightIds?.has(elem.id)
                                    ? 'var(--color-accent-soft)'
                                    : 'transparent',
                                  borderRadius: reviewHighlightIds?.has(elem.id) ? 'var(--radius-sm)' : 0,
                                  transition: 'background-color 0.15s ease',
                                }}>
                                  {headingDisplayText.get(elem.id) ?? elem.text}
                                </p>
                              );
                            })()}

                            {elem.type === 'paragraph' && (
                              <p style={{
                                fontFamily: fontFamily,
                                textIndent: '0.5in',
                                lineHeight: rules.line_spacing,
                                textAlign: 'justify',
                                margin: '0 0 8px 0'
                              }}>
                                {renderReviewedText(elem, elem.text)}
                              </p>
                            )}

                            {elem.type === 'block_quote' && (
                              <p style={{
                                fontFamily: fontFamily,
                                marginLeft: '0.5in',
                                lineHeight: rules.line_spacing,
                                fontSize: `${rules.font_size_pt - 1}pt`,
                                marginTop: '6px', marginBottom: '8px'
                              }}>
                                {renderReviewedText(elem, elem.text)}
                              </p>
                            )}

                            {elem.type === 'bullet' && (
                              <p style={{ fontFamily: fontFamily, marginLeft: `${((elem.list_level || 1) - 1) * 24 + 24}px`, textIndent: '-12px', marginBottom: '4px' }}>
                                • {renderReviewedText(elem, elem.text)}
                              </p>
                            )}

                            {elem.type === 'numbered_list' && (
                              <p style={{ fontFamily: fontFamily, marginLeft: `${((elem.list_level || 1) - 1) * 24 + 24}px`, textIndent: '-12px', marginBottom: '4px' }}>
                                {currentItemNum}. {renderReviewedText(elem, elem.text)}
                              </p>
                            )}

                            {elem.type === 'toc' && (
                              <div style={{
                                margin: '16px 0 24px 0',
                                padding: '20px 24px',
                                backgroundColor: '#f8fafc',
                                border: '1.5px dashed #94a3b8',
                                borderRadius: '8px',
                                fontFamily: fontFamily,
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '13pt', color: '#0f172a' }}>Índice / Tabla de Contenidos</span>
                                    <span style={{ fontSize: '10px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                      Nativo Word (TOC) con hipervínculos
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      useDocStore.getState().removeTocElement();
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#ef4444',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                    }}
                                    title="Quitar este índice del documento"
                                  >
                                    Eliminar índice
                                  </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {doc.elements
                                    .filter(e => e.type === 'heading' && !e.is_cover_section && (e.heading_level || 1) <= 3)
                                    .map((h, hIdx) => {
                                      const lvl = h.heading_level || 1;
                                      const title = headingDisplayText.get(h.id) ?? h.text;
                                      return (
                                        <div
                                          key={h.id || hIdx}
                                          onClick={(ev) => {
                                            ev.stopPropagation();
                                            const target = document.getElementById(`paper-elem-${h.id}`);
                                            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                          }}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'baseline',
                                            justifyContent: 'space-between',
                                            marginLeft: `${(lvl - 1) * 20}px`,
                                            fontSize: `${rules.font_size_pt - 0.5}pt`,
                                            cursor: 'pointer',
                                            color: '#1e293b',
                                            fontWeight: lvl === 1 ? 600 : 400,
                                            padding: '2px 4px',
                                            borderRadius: '4px',
                                            transition: 'background-color 0.15s ease',
                                          }}
                                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                                            {title}
                                          </span>
                                          <span style={{ flex: 1, borderBottom: '1px dotted #94a3b8', margin: '0 8px', minWidth: '20px' }}></span>
                                          <span style={{ fontSize: '10pt', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                                            {hIdx + 3}
                                          </span>
                                        </div>
                                      );
                                    })}
                                </div>
                                <div style={{ marginTop: '14px', fontSize: '10px', color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>
                                  Word COM generará este índice automáticamente con los números de página exactos y enlaces interactivos para PDF.
                                </div>
                              </div>
                            )}
                          </>
                        ) : null}

                        {/* CHANGE 2: Guard — los elementos de portada (is_cover_section)
                            ya son renderizados por el bloque de portada estructurado arriba.
                            No deben duplicarse como figura en el cuerpo. */}
                        {(elem.type === 'image' || elem.image_info) && !elem.is_cover_section && (
                          <div style={{
                            margin: '16px auto', maxWidth: '95%',
                            border: '1px solid #cbd5e1', borderRadius: '8px',
                            backgroundColor: '#fafbfc', padding: '10px',
                            position: 'relative',
                            display: 'flex', flexDirection: 'column',
                          }}>
                            {/* Número de figura + caption (order: arriba=0, abajo=2) */}
                            {showFigureLabel && (
                              <div style={{ marginBottom: '8px', order: captionPosition === 'above' ? 0 : 2 }}>
                                <p style={{ fontWeight: 'bold', textAlign: 'left', margin: '0 0 2px 0', fontSize: '11pt' }}>
                                  Figura {elem.image_info?.figure_number}
                                </p>
                                {editingId === elem.id ? (
                                  <textarea
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    autoFocus
                                    onKeyDown={(ke) => {
                                      if (ke.key === 'Escape') setEditingId(null);
                                      else if (ke.key === 'Enter' && !ke.shiftKey) {
                                        if (editValue !== (elem.image_info?.caption || '')) {
                                          useDocStore.getState().updateElementImage(elem.id, { caption: editValue });
                                        }
                                        setEditingId(null);
                                      } else if (ke.key === 'Enter' && ke.ctrlKey) {
                                        if (editValue !== (elem.image_info?.caption || '')) {
                                          useDocStore.getState().updateElementImage(elem.id, { caption: editValue });
                                        }
                                        setEditingId(null);
                                      }
                                    }}
                                    style={{
                                      width: '100%', minHeight: '40px', fontSize: '11pt', fontStyle: 'italic',
                                      border: '1px solid var(--accent-primary)', borderRadius: '4px', padding: '4px 8px',
                                      outline: 'none',
                                    }}
                                  />
                                ) : (
                                  <p
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      (window.getSelection?.() ?? null)?.removeAllRanges?.();
                                      setEditingId(elem.id);
                                      setEditValue(elem.image_info?.caption || '');
                                    }}
                                    style={{ fontStyle: 'italic', textAlign: 'left', margin: 0, cursor: 'text', minHeight: '1em', userSelect: 'none', WebkitUserSelect: 'none' }}
                                  >
                                    {/* Limpiar prefijo "Figura N:" redundante para no duplicar el contador */}
                                    {(elem.image_info?.caption || '').replace(/^(figura|fig\.?)\s+\d+[:\.\s]*\s*/i, '') || (
                                      <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Doble clic para editar leyenda</span>
                                    )}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Marco de la imagen — ocupa el ancho de la página sin achicarse demasiado */}
                            <div
                              style={{
                                order: 1,
                                margin: '0 auto',
                                width: '100%', maxWidth: '100%',
                                height: elem.image_info?.height_cm ? `${elem.image_info.height_cm * 37.8}px` : '200px',
                                minWidth: '120px',
                                minHeight: '120px',
                                overflow: 'hidden',
                                backgroundColor: '#f8fafc',
                                border: selectedElementId === elem.id
                                  ? '2px solid var(--accent-primary)'
                                  : '1px solid #e2e8f0',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-secondary)',
                                position: 'relative',
                                cursor: 'grab',
                                touchAction: 'none',
                                transform: elem.image_info?.rotation ? `rotate(${elem.image_info.rotation}deg)` : undefined,
                                transformOrigin: 'center center',
                                boxSizing: 'border-box',
                              }}
                            >
                              {elem.image_info?.relative_url && !elem.image_info?.render_error && !brokenFigureIds[elem.id] ? (
                                <img
                                  src={resolveAssetUrl(elem.image_info.relative_url)}
                                  alt="Figura"
                                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                                  onError={() => setBrokenFigureIds((prev) => ({
                                    ...prev,
                                    [elem.id]: 'La imagen no pudo cargarse en el navegador.',
                                  }))}
                                />
                              ) : (
                                <div style={{ padding: '12px', textAlign: 'left', maxWidth: '100%' }}>
                                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--accent-warning)' }}>
                                    Previsualización no disponible
                                  </div>
                                  <div style={{ fontSize: '11px', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                                    {brokenFigureIds[elem.id] || (elem.image_info as any)?.render_error || 'El formato original no puede renderizarse en este preview. Revisa el archivo original o exporta la figura a PNG/SVG.'}
                                  </div>
                                </div>
                              )}

                              {/* Resize handle */}
                              {selectedElementId === elem.id && (
                                <div
                                  onPointerDown={(e) => startFigureResize(e, elem)}
                                  onPointerMove={resizeState?.id === elem.id ? handleFigureResize : undefined}
                                  onPointerUp={endFigureResize}
                                  onPointerLeave={resizeState?.id === elem.id ? endFigureResize : undefined}
                                  title="Arrastrar para redimensionar · Shift para liberar proporción"
                                  style={{
                                    position: 'absolute', right: 0, bottom: 0,
                                    width: '0', height: '0',
                                    cursor: 'nwse-resize', touchAction: 'none',
                                    borderBottom: '18px solid var(--accent-primary)',
                                    borderLeft: '18px solid transparent',
                                    borderBottomRightRadius: '10px',
                                  }}
                                />
                              )}
                            </div>

                            {elem.image_info?.note && (
                              <p style={{ fontSize: '11px', marginTop: '8px', color: '#334155', textAlign: 'left', order: 3 }}>
                                <span style={{ fontStyle: 'italic', fontWeight: 600 }}>Nota.</span> {elem.image_info.note}
                              </p>
                            )}
                          </div>
                        )}

                        {elem.type === 'table' && elem.table_info && (() => {
                          const isCompact = tableStyle === 'compact';
                          const isExpanded = tableStyle === 'expanded';
                          const borderW = isExpanded ? '2px' : '1px';
                          const cellPad = isCompact ? '3px' : isExpanded ? '10px' : '6px';
                          const cellFont = isCompact ? '9pt' : isExpanded ? '12pt' : '11pt';
                          const styleLabel = tableStyle === 'compact' ? 'Compacto' : tableStyle === 'expanded' ? 'Expandido' : 'Estándar';
                          return (
                          <div style={{ margin: '16px 0', width: '100%', overflowX: 'auto' }}>
                            <p style={{ fontWeight: 'bold', margin: '0 0 2px 0' }}>
                              Tabla {elem.table_info.table_number}
                              <span style={{ fontWeight: 500, fontStyle: 'italic', fontSize: '9pt', color: '#475569', marginLeft: '8px' }}>
                                · estilo {styleLabel}
                              </span>
                            </p>
                            {elem.table_info.caption && <p style={{ fontStyle: 'italic', margin: '0 0 8px 0' }}>{elem.table_info.caption}</p>}
                            <table style={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              borderTop: `${borderW} solid #000000`,
                              borderBottom: `${borderW} solid #000000`,
                              margin: '8px 0'
                            }}>
                              {elem.table_info.headers && (
                                <thead>
                                  <tr style={{ borderBottom: `${borderW} solid #000000` }}>
                                    {elem.table_info.headers.map((h, i) => (
                                      <th key={i} style={{ padding: cellPad, textAlign: 'left', fontWeight: 'bold', fontSize: cellFont }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                              )}
                              <tbody>
                                {elem.table_info.rows.map((row, rIdx) => (
                                  <tr key={rIdx}>
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} style={{ padding: cellPad, fontSize: cellFont }}>{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {elem.table_info.note && (
                              <p style={{ fontSize: '11px', marginTop: '6px', color: '#334155' }}>
                                <span style={{ fontStyle: 'italic', fontWeight: 600 }}>Nota.</span> {elem.table_info.note}
                              </p>
                            )}
                          </div>
                          );
                        })()}

                        {/* Comentarios estilo WhatsApp: ahora viven en el gutter
                            lateral (columna derecha fuera de la hoja, como Word). */}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Gutter de comentarios: columna lateral fuera de la hoja (estilo Word).
                Tope de burbujas por página (MAX_GUTTER) para no inundar; el resto
                se resume en un chip "+N más". */}
            {pageCommentElems.length > 0 && (
              <div style={{ position: 'relative', width: '250px', flexShrink: 0 }}>
                {(() => {
                  let shown = 0;
                  const extra = pageElements.filter(
                    (e) => !dismissedCommentIds.includes(e.id) && (positiveMap.get(e.id) || getWhatsAppComment(e, commentCtx, 0) !== null),
                  ).length;
                  return (
                    <>
                      {pageElements.map((elem, idx) => {
                        const positive = !!positiveMap.get(elem.id);
                        const hasComment = positive || getWhatsAppComment(elem, commentCtx, 0) !== null;
                        if (!hasComment || dismissedCommentIds.includes(elem.id)) return null;
                        if (shown >= MAX_GUTTER) return null;
                        shown += 1;
                        const measured = gutterOffsets[elem.id];
                        const top = typeof measured === 'number' && measured > 0
                          ? measured
                          : Math.min(idx * 96, 880 - 84);
                        return (
                          <div
                            key={elem.id}
                            className="wa-gutter"
                            style={{ position: 'absolute', top: `${top}px`, left: 0, width: '100%' }}
                          >
                            <WhatsAppComment
                              elem={elem}
                              positive={positive}
                              onHover={setHoveredCommentId}
                              onLeave={() => setHoveredCommentId(null)}
                              onResolve={handleResolveComment}
                              onDismiss={dismissComment}
                            />
                          </div>
                        );
                      })}
                      {extra > MAX_GUTTER && (
                        <div style={{
                          position: 'absolute', top: `${Math.min((MAX_GUTTER + 1) * 96, 880 - 84)}px`, left: 0, width: '100%',
                          fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: '5px',
                        }}>
                          <span style={{
                            width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)',
                          }}>{extra - MAX_GUTTER}</span>
                          más en esta página
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Conector punteado sutil (Google Docs / Figma): une la burbuja en
                hover con el borde del elemento referenciado en la hoja. */}
            {hoveredCommentId && pageElements.some((e) => e.id === hoveredCommentId) && gutterOffsets[hoveredCommentId] != null && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute', left: '680px', top: `${gutterOffsets[hoveredCommentId]}px`,
                  width: '20px', height: 0,
                  borderTop: '1.5px dashed rgba(79,124,255,0.65)',
                  pointerEvents: 'none', zIndex: 20,
                }}
              />
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

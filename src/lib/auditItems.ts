/* WordAPA7 — Recolección unificada de hallazgos para la fase Revisión & IA.
   Única fuente de la lista que consumen la puerta, el recorrido y el conteo del riel. */
import type { ElementModel, ProofreadFinding } from '../types';
import type { AIReviewResult } from '../api/backend';

export type ToolWindowId = 'ai' | 'style' | 'spelling' | 'citations' | 'structure';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface AuditItem {
  id: string;
  element_id: string;
  category: ToolWindowId;
  severity: Severity;
  summary: string;
  detail: string;
  originalText: string;
  suggestedText?: string;
  pageNumber: number;
  aiScore?: number;
  readOnly: boolean;
}

export interface AuditInput {
  elements: ElementModel[];
  reviewResult: AIReviewResult | null;
  proofreadFindings: ProofreadFinding[];
  citationAuditResult: { ghost_citations: any[]; orphan_references: any[] } | null;
  dismissedIds?: Set<string>;
}

const CHARS_POR_PAGINA = 1800;

/** Mapa heurístico elemento → página aproximada. */
export function buildElementPageMap(elements: ElementModel[]): Map<string, number> {
  const map = new Map<string, number>();
  let currentPage = 1;
  let charCount = 0;
  elements.forEach((e) => {
    const len = (e.text || '').length;
    charCount += len;
    if (charCount > CHARS_POR_PAGINA) {
      currentPage += Math.floor(charCount / CHARS_POR_PAGINA);
      charCount = charCount % CHARS_POR_PAGINA;
    }
    map.set(e.id, Math.max(1, currentPage));
  });
  return map;
}

function pageOf(map: Map<string, number>, id: string): number {
  return map.get(id) || 1;
}

export function collectAuditItems(input: AuditInput): AuditItem[] {
  const { elements, reviewResult, proofreadFindings, citationAuditResult } = input;
  const dismissed = input.dismissedIds ?? new Set<string>();
  const pageMap = buildElementPageMap(elements);
  const items: AuditItem[] = [];

  const elemDe = (id: string) => elements.find((e) => e.id === id);
  const esPortada = (e: ElementModel | undefined) => Boolean(e?.is_cover_section);

  if (reviewResult?.paragraphs) {
    reviewResult.paragraphs.forEach((p, idx) => {
      const score = p.ai_score || 0;
      if (score < 45 && p.ai_category !== 'HIGH' && p.ai_category !== 'MEDIUM') return;
      const id = `ai_rev_${p.element_id}_${idx}`;
      if (dismissed.has(id)) return;
      items.push({
        id,
        element_id: p.element_id,
        category: 'ai',
        severity: score >= 70 ? 'high' : 'medium',
        summary: `Índice de IA ${score || 60}% — rigidez sintáctica detectada`,
        detail: 'Estructura reiterativa y conectores sintéticos característicos de modelos generativos.',
        originalText: elemDe(p.element_id)?.text || p.text || '',
        pageNumber: pageOf(pageMap, p.element_id),
        aiScore: (score || 50) / 100,
        readOnly: false,
      });
    });
  }

  proofreadFindings.forEach((f, idx) => {
    const id = `proact_${f.element_id}_${idx}`;
    if (dismissed.has(id)) return;
    const elem = elemDe(f.element_id);
    const original = elem?.text || f.excerpt || '';
    const k = String(f.kind);
    const readOnly = Boolean((f as any).read_only) || esPortada(elem);
    const suggestion = readOnly ? undefined : f.suggestion || undefined;

    const base = {
      id, element_id: f.element_id, originalText: original,
      pageNumber: pageOf(pageMap, f.element_id), readOnly,
    };

    if (k === 'ai_phrase' || k === 'muletilla' || k === 'ngram_repetition') {
      items.push({
        ...base, category: 'ai', severity: 'medium',
        summary: f.message.length > 70 ? f.message.slice(0, 70) + '…' : f.message,
        detail: f.message, suggestedText: suggestion,
      });
    } else if (k === 'first_person' || k === 'persona' || k.startsWith('bloom')) {
      const isBloom = k.startsWith('bloom');
      items.push({
        ...base, category: 'style', severity: isBloom ? 'high' : 'medium',
        summary: isBloom ? 'Verbo impreciso en objetivo académico' : 'Uso de primera persona gramatical',
        detail: f.message,
        suggestedText: suggestion ?? (isBloom && !readOnly ? 'Determinar y analizar de forma rigurosa' : undefined),
      });
    } else if (k === 'ortografia' || k === 'pegado') {
      items.push({
        ...base, category: 'spelling', severity: k === 'ortografia' ? 'high' : 'medium',
        summary: k === 'ortografia' ? `Falta ortográfica o tilde: ${f.excerpt}` : 'Texto pegado sin espaciado correcto',
        detail: f.message, suggestedText: suggestion,
      });
    } else {
      items.push({
        ...base, category: 'style', severity: 'low',
        summary: f.message, detail: f.message, suggestedText: suggestion,
      });
    }
  });

  if (citationAuditResult?.ghost_citations) {
    citationAuditResult.ghost_citations.forEach((ghost, idx) => {
      const id = `ghost_cite_${idx}`;
      if (dismissed.has(id)) return;
      items.push({
        id, element_id: ghost.element_id || '', category: 'citations', severity: 'critical',
        summary: `Cita "${ghost.citation_text || 'Desconocida'}" ausente en bibliografía`,
        detail: 'Aparece citada en el cuerpo del documento pero no figura en la lista final de referencias.',
        originalText: ghost.citation_text || '',
        pageNumber: ghost.element_id ? pageOf(pageMap, ghost.element_id) : 1,
        readOnly: false,
      });
    });
  }

  if (citationAuditResult?.orphan_references) {
    citationAuditResult.orphan_references.forEach((orphan, idx) => {
      const id = `orphan_ref_${idx}`;
      if (dismissed.has(id)) return;
      items.push({
        id, element_id: '', category: 'citations', severity: 'medium',
        summary: `Referencia "${orphan.authors?.[0] || 'Autor'} (${orphan.year || 's.f.'})" no citada en texto`,
        detail: 'Consta en la bibliografía final pero ninguna sección del documento la referencia expresamente.',
        originalText: orphan.raw_text || '',
        pageNumber: elements.length > 0 ? pageOf(pageMap, elements[elements.length - 1].id) : 1,
        readOnly: false,
      });
    });
  }

  elements.forEach((e) => {
    if (e.type === 'heading' && e.needs_review) {
      const id = `struct_head_${e.id}`;
      if (dismissed.has(id)) return;
      items.push({
        id, element_id: e.id, category: 'structure', severity: 'medium',
        summary: `Encabezado nivel ${e.heading_level || 1} requiere confirmación de jerarquía`,
        detail: 'Verificar que no existan saltos ilegales de nivel (ej. H1 a H3 sin H2 intermedio).',
        originalText: e.text || '', pageNumber: pageOf(pageMap, e.id), readOnly: false,
      });
    } else if (e.type === 'image' && !e.is_cover_section && !e.image_info?.caption) {
      const id = `struct_fig_${e.id}`;
      if (dismissed.has(id)) return;
      items.push({
        id, element_id: e.id, category: 'structure', severity: 'high',
        summary: 'Figura sin rotulación APA 7 (Figura N y Nota)',
        detail: 'Las normas APA 7 exigen numeración secuencial en negrita, título cursivo y nota explicativa.',
        originalText: '[Figura sin rotular]',
        suggestedText: 'Figura 1. Representación esquemática del procedimiento.',
        pageNumber: pageOf(pageMap, e.id), readOnly: false,
      });
    } else if (e.type === 'table' && !e.table_info?.caption) {
      const id = `struct_tbl_${e.id}`;
      if (dismissed.has(id)) return;
      items.push({
        id, element_id: e.id, category: 'structure', severity: 'high',
        summary: 'Tabla sin rotulación reglamentaria APA 7',
        detail: 'Requiere etiqueta "Tabla N" superior y nota al pie con la fuente o especificación.',
        originalText: '[Tabla sin rotular]',
        suggestedText: 'Tabla 1. Datos recopilados durante la fase experimental.',
        pageNumber: pageOf(pageMap, e.id), readOnly: false,
      });
    }
  });

  return items;
}

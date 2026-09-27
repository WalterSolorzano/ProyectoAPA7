/* WordAPA7 — review: la lista de hallazgos, como función pura.
   Vive FUERA del hook a propósito: `useReviewWorkbench` la usa para pintar el
   workbench y el rail la usa para CONTAR lo que le falta al usuario. Cuando las
   dos cosas eran la misma línea de un hook, el rail solo podía contar
   ortografía y citas fantasma mientras la pantalla abría cinco motores más, y
   el rail llegaba a Revisión & IA con un punto verde y la palabra "Listo".

   Reglas que este módulo no negocia (las mismas que las del hook):
   1. El detector de IA es PROBABILÍSTICO: un ítem de IA propone, la persona
      decide. Aquí solo se declara; ninguna función de este archivo escribe.
   2. Un hallazgo que no se conoce NO se descarta: cae bajo
      "Otro hallazgo del corrector" (`PROOFREAD_SPECS` tiene fila para lo
      declarado y una que recoge lo nuevo).
   3. La página es un dato de la VISTA, no del hallazgo: quien no pagina
      (el rail) pasa un `pageOf` que no existe y recibe `null`. Lo que define
      si algo es un hallazgo es esto, no dónde cae. */

import type { ElementModel, ProofreadFinding } from '../types';

export type EngineId = 'ai' | 'style' | 'spelling' | 'citations' | 'structure';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface AuditItem {
  id: string;
  element_id: string;
  category: EngineId;
  /** Subtipo para agrupar: una fila por subtipo, no una por aparición */
  subtype: string;
  severity: Severity;
  summary: string;
  detail: string;
  originalText: string;
  suggestedText?: string;
  /** Página REAL del elemento, o `null` si no está en el índice */
  pageNumber: number | null;
  aiScore?: number;
}

/* ── Hallazgos del proofreador local ──────────────────────────────────────
   Una fila por `kind`, y la fila es TOTAL: `ProofreadFinding['kind']` es
   `'ortografia' | ... | string`, así que el tipo admite kinds que todavía no
   existen. Un hallazgo que este archivo no conoce NO se descarta: se muestra
   bajo "Otro hallazgo del corrector". Antes se descartaba en silencio, y el
   store ya lo publicaba en el mapa de transparencia (`auditSlice` KIND_LABELS
   → localStorage + StorageEvent): el usuario leía en el lienzo un aviso que
   el panel de Revisión no tenía. Un panel que calla un hallazgo que el lienzo
   enseña rompe la sincronización que AGENTS.md §2 exige entre los dos
   canales. */
export interface ProofreadSource {
  excerpt?: string;
  message: string;
}

interface ProofreadRow {
  category: EngineId;
  subtype: string;
  severity: Severity;
  summary: string;
  suggestedText?: string;
}

interface ProofreadSpec {
  category: EngineId;
  subtype: string;
  severity: Severity;
  /** Texto fijo de la fila, o el mensaje del motor si este ya lo explica. */
  summary: string | ((f: ProofreadSource) => string);
  suggestedText?: string;
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}…` : s);

const DEL_MOTOR = (f: ProofreadSource) => clip(f.message, 70);

const PROOFREAD_SPECS: Record<string, ProofreadSpec> = {
  // Ortografía y pegado: la corrección es mecánica (objetivos, 'accept').
  ortografia: {
    category: 'spelling',
    subtype: 'ortografia',
    severity: 'high',
    summary: (f) => `Falta ortográfica o tilde: ${f.excerpt ?? ''}`,
  },
  pegado: {
    category: 'spelling',
    subtype: 'texto_pegado',
    severity: 'medium',
    summary: 'Texto pegado sin espaciado correcto',
  },

  // Redacción y Bloom.
  first_person: {
    category: 'style',
    subtype: 'primera_persona',
    severity: 'medium',
    summary: 'Uso de primera persona gramatical',
  },
  persona: {
    category: 'style',
    subtype: 'mezcla_personas',
    severity: 'medium',
    summary: DEL_MOTOR,
  },
  bloom_vague: {
    category: 'style',
    subtype: 'verbo_bloom',
    severity: 'high',
    summary: 'Verbo impreciso en objetivo académico',
    suggestedText: 'Determinar y analizar de forma rigurosa',
  },
  bloom_low: {
    category: 'style',
    subtype: 'verbo_bloom',
    severity: 'high',
    summary: 'Nivel de Bloom por debajo del objetivo del trabajo',
    suggestedText: 'Determinar y analizar de forma rigurosa',
  },

  // Lo que el detector probabilístico señala: se marca, nunca se aplica.
  ai_phrase: { category: 'ai', subtype: 'frase_ia', severity: 'medium', summary: DEL_MOTOR },
  muletilla: { category: 'ai', subtype: 'muletilla', severity: 'medium', summary: DEL_MOTOR },
  ngram_repetition: { category: 'ai', subtype: 'repeticion', severity: 'medium', summary: DEL_MOTOR },

  /* Detectados con certeza, pero sin corrección automática posible: cuál de
     las tres repeticiones se corta, a qué antecedente apunta "esto", dónde
     partir una oración de 60 palabras, qué idea falta al final. Todos 'mark'
     (la severidad espeja la que emite el auditor: incomplete → 'error',
     long_sentence → 'warn', el resto → 'info'). */
  repeticion: { category: 'style', subtype: 'palabra_repetida', severity: 'low', summary: DEL_MOTOR },
  ambigua: { category: 'style', subtype: 'pronombre_ambiguo', severity: 'low', summary: DEL_MOTOR },
  passive_voice: { category: 'style', subtype: 'voz_pasiva', severity: 'low', summary: DEL_MOTOR },
  long_sentence: { category: 'style', subtype: 'oracion_larga', severity: 'medium', summary: DEL_MOTOR },
  incompleta: { category: 'style', subtype: 'idea_incompleta', severity: 'high', summary: DEL_MOTOR },
};

/** Todo kind tiene fila: la tabla cubre los declarados y la última recoge lo
 *  que llegue nuevo. Nunca devuelve `null`: no hay kinds que se pierdan. */
export function proofreadRow(kind: string, f: ProofreadSource): ProofreadRow {
  const spec = PROOFREAD_SPECS[kind] ?? {
    category: 'style' as EngineId,
    subtype: 'otro',
    severity: 'low' as Severity,
    summary: DEL_MOTOR,
  };
  return {
    category: spec.category,
    subtype: spec.subtype,
    severity: spec.severity,
    summary: typeof spec.summary === 'function' ? spec.summary(f) : spec.summary,
    suggestedText: spec.suggestedText,
  };
}

/** Párrafo con probabilidad alta o categoría MEDIA+: el umbral que usa la
 *  pantalla. "Alta" es 45, no 50: el mismo número que ella, escrito una vez. */
export const AI_PARAGRAPH_THRESHOLD = 45;

export interface AIReviewParagraph {
  element_id?: string;
  text?: string;
  ai_score?: number;
  ai_category?: string;
}

export interface AuditSources {
  elements: readonly ElementModel[];
  reviewResult: { paragraphs?: AIReviewParagraph[] } | null;
  proofreadFindings: readonly ProofreadFinding[];
  citationAuditResult: {
    ghost_citations?: unknown[];
    orphan_references?: unknown[];
  } | null;
}

/**
 * TODOS los hallazgos del documento, en el orden en que los produce cada motor.
 *
 * `pageOf` es opcional a propósito: el rail solo necesita el CUÁNTO, y para eso
 * la página no existe. Lo que no es opcional es la lista: si el rail y la
 * pantalla dejaran de compartir esta función, el rail volvería a prometer
 * trabajo que la pantalla no muestra.
 */
export function collectAuditItems(
  sources: AuditSources,
  pageOf?: (elementId: string) => number | null,
): AuditItem[] {
  const { elements, reviewResult, proofreadFindings, citationAuditResult } = sources;
  const out: AuditItem[] = [];
  const byId = new Map(elements.map((e) => [e.id, e]));
  const page = pageOf ?? (() => null);

  // 1. Detector de IA: párrafos con probabilidad alta o categoría MEDIA+.
  for (const [idx, p] of (reviewResult?.paragraphs || []).entries()) {
    const score = p.ai_score || 0;
    if (!(score >= AI_PARAGRAPH_THRESHOLD || p.ai_category === 'HIGH' || p.ai_category === 'MEDIUM')) continue;
    // `ai_score` ausente o cero no es un 60% ni un 50%: es "no medido". Un
    // párrafo puede entrar por `ai_category` con la puntuación sin calcular,
    // y mostrarle un número al usuario sería inventarlo.
    const medido = score > 0;
    out.push({
      id: `ai_rev_${p.element_id}_${idx}`,
      element_id: p.element_id || '',
      category: 'ai',
      subtype: 'parrafo_ia',
      severity: score >= 70 ? 'high' : 'medium',
      summary: medido
        ? `Índice de IA ${score}% — rigidez sintética detectada`
        : 'Índice de IA alto — rigidez sintética detectada',
      detail: 'Estructura reiterativa y conectores sintéticos característicos de modelos generativos.',
      originalText: (p.element_id ? byId.get(p.element_id)?.text : '') || p.text || '',
      suggestedText: undefined,
      pageNumber: p.element_id ? page(p.element_id) : null,
      aiScore: medido ? score / 100 : undefined,
    });
  }

  // 2. Hallazgos proactivos locales: TODOS los `kind` que emite el auditor.
  for (const [idx, f] of (proofreadFindings ?? []).entries()) {
    const row = proofreadRow(String(f.kind), f);
    out.push({
      id: `proact_${f.element_id}_${idx}`,
      element_id: f.element_id,
      category: row.category,
      subtype: row.subtype,
      severity: row.severity,
      summary: row.summary,
      detail: f.message,
      originalText: (f.element_id ? byId.get(f.element_id)?.text : '') || f.excerpt || '',
      suggestedText: f.suggestion || row.suggestedText,
      pageNumber: f.element_id ? page(f.element_id) : null,
    });
  }

  // 3. Citas fantasma (aparecen en el texto, no en la bibliografía).
  for (const [idx, ghost] of (citationAuditResult?.ghost_citations || []).entries()) {
    const g = ghost as {
      element_id?: string;
      citation_text?: string;
      raw_text?: string;
    };
    const texto = g.citation_text || g.raw_text || 'Desconocida';
    out.push({
      id: `ghost_cite_${idx}`,
      element_id: g.element_id || '',
      category: 'citations',
      subtype: 'cita_fantasma',
      severity: 'critical',
      summary: `Cita "${texto}" ausente en bibliografía`,
      detail: 'Aparece citada en el cuerpo del documento pero no figura en la lista final de referencias.',
      originalText: g.citation_text || '',
      pageNumber: g.element_id ? page(g.element_id) : null,
    });
  }

  // 4. Referencias huérfanas (en la bibliografía, nunca citadas).
  for (const [idx, orphan] of (citationAuditResult?.orphan_references || []).entries()) {
    const o = orphan as { authors?: string[]; year?: string | number; raw_text?: string };
    out.push({
      id: `orphan_ref_${idx}`,
      element_id: '',
      category: 'citations',
      subtype: 'referencia_huerfana',
      severity: 'medium',
      summary: `Referencia "${o.authors?.[0] || 'Autor'} (${o.year || 's.f.'})" no citada en texto`,
      detail: 'Consta en la bibliografía final pero ninguna sección del documento la referencia expresamente.',
      originalText: o.raw_text || '',
      // Sin elemento que anclar: una referencia huérfana vive en la lista
      // final, y la lista no tiene página. `null` antes que la página del
      // último elemento (que era la estimación que se reemplaza aquí).
      pageNumber: null,
    });
  }

  // 5. Estructura y rotulación APA 7.
  for (const e of elements) {
    if (e.type === 'heading' && e.needs_review) {
      out.push({
        id: `struct_head_${e.id}`,
        element_id: e.id,
        category: 'structure',
        subtype: 'encabezado',
        severity: 'medium',
        summary: `Encabezado nivel ${e.heading_level || 1} requiere confirmación de jerarquía`,
        detail: 'Verificar que no existan saltos ilegales de nivel (ej. H1 a H3 sin H2 intermedio).',
        originalText: e.text || '',
        pageNumber: page(e.id),
      });
    } else if (e.type === 'image' && !e.is_cover_section && !e.image_info?.caption) {
      out.push({
        id: `struct_fig_${e.id}`,
        element_id: e.id,
        category: 'structure',
        subtype: 'figura',
        severity: 'high',
        summary: 'Figura sin rotulación APA 7 (Figura N y Nota)',
        detail: 'Las normas APA 7 exigen numeración secuencial en negrita, título cursivo y nota explicativa.',
        originalText: '[Figura sin rotular]',
        suggestedText: 'Figura 1. Representación esquemática del procedimiento.',
        pageNumber: page(e.id),
      });
    } else if (e.type === 'table' && !e.table_info?.caption) {
      out.push({
        id: `struct_tbl_${e.id}`,
        element_id: e.id,
        category: 'structure',
        subtype: 'tabla',
        severity: 'high',
        summary: 'Tabla sin rotulación reglamentaria APA 7',
        detail: 'Requiere etiqueta "Tabla N" superior y nota al pie con la fuente o especificación.',
        originalText: '[Tabla sin rotular]',
        suggestedText: 'Tabla 1. Datos recopilados durante la fase experimental.',
        pageNumber: page(e.id),
      });
    }
  }

  return out;
}

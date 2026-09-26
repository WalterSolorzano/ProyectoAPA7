/* WordAPA7 — review: resaltados inline del párrafo.
   Implementación ÚNICA. Antes vivía dentro de PaperCanvas con rgba y hex
   escritos a mano; ahora el lienzo y la tarjeta de lectura pintan igual, y lo
   pintan con tokens del design system (Cero hex fuera de design-system.css). */

import React from 'react';
import type { ElementModel, ProofreadFinding } from '../../types';
import type { AIReviewParagraph, AIReviewResult } from '../../api/backend';
import { getWhatsAppComment, type WhatsAppContext } from '../layout/WhatsAppComment';
import { findAccentAgnostic } from '../../lib/accentMatch';
import { findCitationsInText } from '../../lib/citationHighlighter';

export type MarkKind = 'ai' | 'spelling' | 'style' | 'comment' | 'citation';

export interface ReadingMark {
  start: number;
  end: number;
  kind: MarkKind;
  severity?: string;
  title: string;
}

/** Todo lo que un párrafo necesita para saber qué resaltar. */
export interface MarkSource {
  /** Párrafo de la revisión IA. Se localiza por `element_id` si hay `elem`. */
  reviewResult: AIReviewResult | null;
  /** Hallazgos del corrector, por elemento. */
  proofreadFindings: ProofreadFinding[];
  /** Contexto de comentarios, el MISMO que usa la burbuja (buildCommentContext). */
  commentCtx: WhatsAppContext;
  /** Interruptor de la tira de citas APA. */
  showCitations: boolean;
  /**
   * Elemento que se está pintando. Los canales que dependen del elemento
   * (comentario, corrector) no se evalúan sin él: un id inventado haría que
   * citas fantasma y reglas de validación nunca casaran con nada.
   */
  elem?: ElementModel;
  /** Ids que el usuario ya descartó. Un hallazgo descartado no deja ni
   *  burbuja ni subrayado: los dos canales tienen que coincidir. */
  dismissedCommentIds?: string[];
}

/** Colores por motor. Todos por token: ningún hex, ningún rgba (Review Focus #1). */
export const MARK_STYLE: Record<MarkKind, React.CSSProperties> = {
  spelling: {
    backgroundColor: 'var(--severity-critical-soft)',
    borderBottom: '2px solid var(--color-danger)',
    color: 'var(--color-danger)',
    fontWeight: 500,
  },
  style: {
    backgroundColor: 'var(--color-accent-soft)',
    borderBottom: '2px solid var(--color-accent)',
    color: 'var(--color-accent)',
    fontWeight: 500,
  },
  ai: {
    backgroundColor: 'var(--mark-ai-bg)',
    borderBottom: '2px dashed var(--color-text-secondary)',
    color: 'var(--color-text-secondary)',
  },
  comment: {
    backgroundColor: 'var(--severity-warning-soft)',
    borderBottom: '2px solid var(--color-warning)',
    color: 'var(--color-text-primary)',
  },
  citation: {
    backgroundColor: 'var(--severity-info-soft)',
    borderBottom: '2px solid var(--color-info)',
    color: 'var(--color-text-primary)',
  },
};

/** Orden de predominio cuando dos motores se solapan: el más alto gana el
 *  rango y el color; el otro se funde en él. El comentario va primero porque
 *  es el que tiene burbuja: si el color no coincide con la burbuja, el
 *  usuario ve dos subrayados distintos para el mismo hallazgo. */
const KIND_PRIORITY: Record<MarkKind, number> = {
  comment: 5, citation: 4, spelling: 3, style: 2, ai: 1,
};

/** Tipos de bloque cuyo `text` es prosa corrida: admiten cita APA. */
const TEXT_BLOCK_TYPES = new Set(['paragraph', 'bullet', 'numbered_list', 'block_quote']);

/**
 * Tipos que además admiten el subrayado del comentario. Incluye `heading`
 * porque los gatillos de redacción de `WhatsAppComment`
 * (`CONCLUSION_TRIGGERS`, `AI_TRIGGERS`, y el bloque de estilo) no filtran por
 * tipo de elemento: un título con "en conclusión" recibe burbuja, así que
 * excluirlo del subrayado dejaría el hallazgo anunciado y sin marcar.
 * Figuras y tablas quedan fuera: su `text` es un rótulo, no una frase.
 */
const COMMENT_TYPES = new Set([...TEXT_BLOCK_TYPES, 'heading']);

/** Corrector: qué motor pinta cada tipo de hallazgo. */
const PROOFREAD_ENGINE: Record<string, MarkKind> = {
  ortografia: 'spelling',
  ai_phrase: 'ai',
  muletilla: 'ai',
};

/**
 * Todas las apariciones de `phrase`, sin distinguir acentos ni mayúsculas.
 * Se usa el rango real del match (no `start + phrase.length`): el texto
 * original puede venir con otra capitalización y la marca debe caer sobre él.
 */
function occurrences(text: string, phrase: string): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  if (!phrase) return out;
  let from = 0;
  for (;;) {
    const hit = findAccentAgnostic(text.slice(from), phrase);
    if (!hit) return out;
    out.push({ start: from + hit.start, end: from + hit.end });
    from += hit.end;
  }
}

/** El párrafo de la revisión que corresponde a este texto, o null. */
function reviewedParagraph(text: string, source: MarkSource): AIReviewParagraph | null {
  const paragraphs = source.reviewResult?.paragraphs || [];
  if (source.elem) return paragraphs.find((p) => p.element_id === source.elem!.id) || null;
  return paragraphs.find((p) => p.text === text) || null;
}

/**
 * Rango del fragmento señalado por un hallazgo del corrector. Los offsets del
 * backend son sobre el texto del elemento; si no sirven (documento editado,
 * hallazgo de otro motor) se cae al excerpt, al que se le quita la elipsis de
 * contexto que el auditor le agrega.
 */
function findingRange(text: string, f: ProofreadFinding): { start: number; end: number } | null {
  if (Number.isInteger(f.start) && Number.isInteger(f.end) && f.start >= 0 && f.end > f.start && f.end <= text.length) {
    return { start: f.start, end: f.end };
  }
  const excerpt = (f.excerpt || '').replace(/…/g, ' ').trim();
  if (!excerpt) return null;
  return findAccentAgnostic(text, excerpt);
}

export function collectMarks(text: string, source: MarkSource): ReadingMark[] {
  const marcas: ReadingMark[] = [];
  /** Diagnósticos del corrector, para reinyectarlos después de consolidar. */
  const delCorrector: Array<{ start: number; end: number; message: string }> = [];
  const push = (start: number, end: number, kind: MarkKind, title: string, severity?: string) => {
    if (start < 0 || end <= start || end > text.length) return;
    marcas.push({ start, end, kind, title, severity });
  };

  // ── Motor de IA (frases de plantilla detectadas por el revisor) ────────────
  const parrafo = reviewedParagraph(text, source);
  for (const f of parrafo?.findings || []) {
    const frases: string[] = (f as { phrases?: string[] }).phrases?.length
      ? (f as { phrases?: string[] }).phrases!
      : f.phrase ? [f.phrase] : [];
    for (const frase of frases) {
      // Una cita entre paréntesis no es un patrón de IA: la pinta el motor
      // de citas, con su propio color y su propio diagnóstico.
      if (!frase || frase.startsWith('(')) continue;
      for (const hit of occurrences(text, frase)) {
        push(hit.start, hit.end, 'ai', f.detail || 'Patrón de IA', f.severity);
      }
    }
  }

  // ── Motor de ortografía ────────────────────────────────────────────────────
  for (const s of parrafo?.spelling || []) {
    for (const hit of occurrences(text, s.word)) {
      const sugerencias = s.suggestions?.length ? s.suggestions.slice(0, 3).join(', ') : '';
      push(hit.start, hit.end, 'spelling', sugerencias
        ? `Ortografía: ${s.word} → ${sugerencias}`
        : `Ortografía: ${s.word}`);
    }
  }

  // ── Hallazgos del corrector, por elemento ─────────────────────────────────
  if (source.elem) {
    for (const f of source.proofreadFindings) {
      if (f.element_id !== source.elem.id) continue;
      const rango = findingRange(text, f);
      if (!rango) continue;
      delCorrector.push({ start: rango.start, end: rango.end, message: f.message });
      push(rango.start, rango.end, PROOFREAD_ENGINE[f.kind] || 'style', f.message, f.severity);
    }
  }

  // ── Comentario del gutter: el mismo fragmento que ancla la burbuja ─────────
  if (source.elem && COMMENT_TYPES.has(source.elem.type)) {
    const descartado = (source.dismissedCommentIds || []).includes(source.elem.id);
    if (!descartado) {
      const comment = getWhatsAppComment(source.elem, source.commentCtx, 0);
      if (comment) {
        const hit = comment.match ? findAccentAgnostic(text, comment.match) : null;
        if (hit) {
          push(hit.start, hit.end, 'comment', comment.text);
        } else if (text.trim()) {
          // Fragmento no localizable → el párrafo entero, para que el
          // comentario siempre ancle a algo visible.
          push(0, text.length, 'comment', comment.text);
        }
      }
    }
  }

  // ── Motor de citas APA 7 ──────────────────────────────────────────────────
  if (source.showCitations && source.elem && TEXT_BLOCK_TYPES.has(source.elem.type)) {
    for (const c of findCitationsInText(text)) {
      push(c.start, c.end, 'citation', c.error
        ? `Cita detectada · ${c.error}`
        : `Cita detectada · ${c.authors.join(', ')} (${c.year}) — formato APA 7 correcto`, c.error ? 'HIGH' : 'OK');
    }
  }

  // ── Consolida solapes: gana la de mayor prioridad y absorbe el rango ──────
  // Se recorre por posición (no por prioridad) porque una marca que empieza
  // antes puede tener que extender el `start` de la que ya se está
  // acumulando; si se ordenara por prioridad, ese tramo se perdería.
  // Marcas contiguas (`a.end === b.start`) también se funden: dos <mark>
  // pegados dejan una costura de fondo que Word no deja.
  marcas.sort((a, b) => (a.start - b.start) || (KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind]));
  const out: ReadingMark[] = [];
  for (const m of marcas) {
    const previa = out[out.length - 1];
    if (previa && m.start <= previa.end) {
      if (KIND_PRIORITY[m.kind] > KIND_PRIORITY[previa.kind]) {
        previa.kind = m.kind;
        previa.severity = m.severity;
        previa.title = m.title;
      }
      previa.end = Math.max(previa.end, m.end);
      continue;
    }
    out.push({ ...m });
  }

  // ── El corrector se anota SOBRE la marca consolidada ──────────────────────
  // `getWhatsAppComment` tiene sus propios detectores de estilo (primera
  // persona, muletillas, cierre…) y `buildCommentContext` los enciende en
  // cuanto hay hallazgos del corrector, así que la burbuja y el corrector caen
  // sobre el MISMO rango. El comentario gana por prioridad y se llevaba el
  // `title` por delante, dejando el diagnóstico del corrector inalcanzable en
  // el lienzo. Aquí se reinyecta: el comentario conserva color y ancla (es lo
  // que la burbuja señala), y el mensaje del corrector queda en el tooltip.
  for (const d of delCorrector) {
    const mark = out.find((m) => m.start <= d.start && d.end <= m.end);
    // Si la marca ES la del corrector, su título ya es el mensaje.
    if (mark && !mark.title.includes(d.message)) {
      mark.title = `${mark.title} · Corrector: ${d.message}`;
    }
  }
  return out;
}

export function ReadingText({ text, source }: { text: string; source: MarkSource }): JSX.Element {
  const marcas = collectMarks(text, source);
  if (!marcas.length) return <>{text}</>;

  const partes: React.ReactNode[] = [];
  let cursor = 0;
  marcas.forEach((m, i) => {
    if (m.start > cursor) partes.push(<span key={`t-${i}`}>{text.slice(cursor, m.start)}</span>);
    partes.push(
      <mark
        key={`m-${i}`}
        title={m.title}
        style={{ ...MARK_STYLE[m.kind], padding: '0 1px', borderRadius: 'var(--radius-sm)' }}
      >
        {text.slice(m.start, m.end)}
      </mark>,
    );
    cursor = m.end;
  });
  if (cursor < text.length) partes.push(<span key="tail">{text.slice(cursor)}</span>);
  return <>{partes}</>;
}

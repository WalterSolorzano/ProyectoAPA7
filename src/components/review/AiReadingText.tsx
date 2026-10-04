/* WordAPA7 — subrayado inline de la SALA DE IA (fase 5).
   Es un lector propio, no el `ReadingText` general del documento: aquel es el
   único dueño del subrayado inline de `PaperCanvas` y de los comentarios
   (`AGENTS.md` §2), y su contrato (`source: MarkSource`) es distinto. La sala
   de IA solo necesita pintar los hallazgos del proofreador sobre el texto de
   un párrafo y anotar la confianza del detector, así que vive aparte para no
   mezclar los dos modelos de marca.

   Portado del rediseño original de la fase 5; las marcas usan tokens legacy
   (`--accent-primary`, etc.) que el design system define como alias de los
   canónicos `--color-*`. */
import React from 'react';
import type { ProofreadFinding } from '../../types';

export interface ReadingMark {
  element_id: string;
  start: number;
  end: number;
  kind: string;
  severity: 'info' | 'warn' | 'error';
}

export const MARK_STYLE: Record<string, { color: string; underline: string }> = {
  ai_phrase: { color: 'var(--accent-primary)', underline: 'var(--accent-primary)' },
  muletilla: { color: 'var(--text-secondary)', underline: 'var(--text-secondary)' },
  ngram_repetition: { color: 'var(--color-warning)', underline: 'var(--color-warning)' },
  ortografia: { color: 'var(--color-danger)', underline: 'var(--color-danger)' },
  pegado: { color: 'var(--color-warning)', underline: 'var(--color-warning)' },
  first_person: { color: 'var(--color-warning)', underline: 'var(--color-warning)' },
  persona: { color: 'var(--color-warning)', underline: 'var(--color-warning)' },
  default: { color: 'var(--text-secondary)', underline: 'var(--text-secondary)' },
};

export function marksForElement(findings: ProofreadFinding[], elementId: string): ReadingMark[] {
  return findings
    .filter((f) => f.element_id === elementId && f.end > f.start)
    .map((f) => ({
      element_id: f.element_id, start: f.start, end: f.end,
      kind: String(f.kind), severity: f.severity,
    }))
    .sort((a, b) => a.start - b.start);
}

interface Props {
  text: string;
  elementId: string;
  findings: ProofreadFinding[];
  renderNote?: (mark: ReadingMark) => React.ReactNode;
}

export const AiReadingText: React.FC<Props> = ({ text, elementId, findings, renderNote }) => {
  const marks = marksForElement(findings, elementId);
  if (marks.length === 0) return <span>{text}</span>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  marks.forEach((mark, i) => {
    // Clamp contra solapes: una marca cuyo fin ya fue cubierto por una anterior
    // se descarta; una que arranca dentro de lo ya cubierto se recorta al cursor
    // para no duplicar caracteres en el DOM.
    if (mark.end <= cursor) return;
    const start = Math.max(mark.start, cursor);
    if (start > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, start)}</span>);
    const style = MARK_STYLE[mark.kind] || MARK_STYLE.default;
    parts.push(
      <span
        key={`m${i}`}
        data-mark={mark.kind}
        style={{ borderBottom: `2px solid ${style.underline}`, color: 'inherit' }}
      >
        {text.slice(start, mark.end)}
        {renderNote ? renderNote(mark) : null}
      </span>,
    );
    cursor = mark.end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <span>{parts}</span>;
};

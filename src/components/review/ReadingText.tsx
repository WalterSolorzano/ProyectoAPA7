/* WordAPA7 — Único dueño del subrayado inline en la fase de revisión.
   Si agregás un resaltado, va acá. Si agregás un tipo de comentario, verificá que se subraye acá. */
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
  ngram_repetition: { color: 'var(--accent-warning)', underline: 'var(--accent-warning)' },
  ortografia: { color: 'var(--accent-danger)', underline: 'var(--accent-danger)' },
  pegado: { color: 'var(--accent-warning)', underline: 'var(--accent-warning)' },
  first_person: { color: 'var(--accent-warning)', underline: 'var(--accent-warning)' },
  persona: { color: 'var(--accent-warning)', underline: 'var(--accent-warning)' },
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

export const ReadingText: React.FC<Props> = ({ text, elementId, findings, renderNote }) => {
  const marks = marksForElement(findings, elementId);
  if (marks.length === 0) return <span>{text}</span>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  marks.forEach((mark, i) => {
    if (mark.start > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, mark.start)}</span>);
    const style = MARK_STYLE[mark.kind] || MARK_STYLE.default;
    parts.push(
      <span
        key={`m${i}`}
        data-mark={mark.kind}
        style={{ borderBottom: `2px solid ${style.underline}`, color: 'inherit' }}
      >
        {text.slice(mark.start, mark.end)}
        {renderNote ? renderNote(mark) : null}
      </span>,
    );
    cursor = mark.end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <span>{parts}</span>;
};

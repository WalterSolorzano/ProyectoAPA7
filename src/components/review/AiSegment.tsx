/* WordAPA7 — Un segmento de la sala de IA: subrayado inline violeta + confianza + comparador. */
import React from 'react';
import { ArrowLeft, ArrowRight, Bookmark } from 'lucide-react';
import { AiReadingText } from './AiReadingText';
import type { ProofreadFinding } from '../../types';

interface ParagraphLike { element_id: string; text: string; ai_score: number; ai_category: string }

interface Props {
  title: string;
  paragraphs: ParagraphLike[];
  findings: ProofreadFinding[];
  index: number;
  total: number;
  onMark: (elementId: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

export const AiSegment: React.FC<Props> = ({
  title, paragraphs, findings, index, total, onMark, onPrev, onNext,
}) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ flex: 1, fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--text-main)' }}>{title}</span>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Sección {index + 1} de {total}</span>
      <button type="button" onClick={onPrev} disabled={index === 0} style={navBtn} aria-label="Sección anterior"><ArrowLeft size={14} /></button>
      <button type="button" onClick={onNext} disabled={index >= total - 1} style={navBtn} aria-label="Sección siguiente"><ArrowRight size={14} /></button>
    </header>

    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {paragraphs.map((p) => (
        <article key={p.element_id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <AiReadingText
            text={p.text}
            elementId={p.element_id}
            findings={findings}
            renderNote={(mark) => (
              <sup
                title={`Confianza IA detectada: ${mark.kind}`}
                style={{ marginLeft: '2px', fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--accent-primary)' }}
              >
                {Math.round(p.ai_score)}%
              </sup>
            )}
          />
          <button type="button" onClick={() => onMark(p.element_id)} style={markBtn}>
            <Bookmark size={12} /> Marcar para revisar
          </button>
        </article>
      ))}
    </div>
  </div>
);

const navBtn: React.CSSProperties = {
  padding: '4px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
  background: 'transparent', color: 'var(--text-main)', cursor: 'pointer',
};
const markBtn: React.CSSProperties = {
  alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
  background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer',
};

/* WordAPA7 — Capa 3: sala de IA aparte, segmentada por títulos H1/H2. */
import React, { useMemo, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { AIReviewResult } from '../../api/backend';
import type { ElementModel, ProofreadFinding } from '../../types';
import { AiSegment } from './AiSegment';
import type { AuditItem } from '../../lib/auditItems';

interface ParagraphLike { element_id: string; text: string; ai_score: number; ai_category: string }

const navBtnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer',
};

/** Segmenta los párrafos por H1. Sin H1 devuelve un único segmento "Documento completo". */
export function segmentsFromParagraphs(
  paragraphs: ParagraphLike[],
  elements: ElementModel[],
): { id: string; title: string; paragraphs: ParagraphLike[] }[] {
  const h1s = elements.filter((e) => e.type === 'heading' && (e.heading_level || 1) === 1);
  if (h1s.length === 0) {
    return [{ id: 'doc', title: 'Documento completo', paragraphs }];
  }
  const orden = elements.map((e) => e.id);
  const posH1 = h1s.map((h) => orden.indexOf(h.id));
  const segs = h1s.map((h) => ({
    id: h.id, title: h.text || 'Sección', paragraphs: [] as ParagraphLike[],
  }));
  paragraphs.forEach((p) => {
    const pos = orden.indexOf(p.element_id);
    let target = 0;
    for (let i = 0; i < posH1.length; i++) {
      if (posH1[i] <= pos) target = i;
    }
    if (segs[target]) segs[target].paragraphs.push(p);
  });
  return segs.filter((s) => s.paragraphs.length > 0);
}

interface Props {
  reviewResult: AIReviewResult | null;
  elements: ElementModel[];
  findings: ProofreadFinding[];
  /** Hallazgos de IA del documento, para el split-comparador por párrafo. */
  aiItems?: AuditItem[];
  onMark: (elementId: string) => void;
  onReplace?: (id: string, text: string) => void;
  onExit: () => void;
}

export const AiRoom: React.FC<Props> = ({ reviewResult, elements, findings, aiItems = [], onMark, onReplace, onExit }) => {
  const paragraphs = (reviewResult?.paragraphs ?? []) as ParagraphLike[];
  const [index, setIndex] = useState(0);

  const segs = useMemo(() => segmentsFromParagraphs(paragraphs, elements), [paragraphs, elements]);

  if (paragraphs.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '40px' }}>
        <Sparkles size={28} />
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Aún no hay un análisis de voz sintética.</p>
        <button type="button" onClick={onExit} style={navBtnGhost}>
          <ArrowLeft size={14} /> Volver al estado del documento
        </button>
      </div>
    );
  }

  const safeIndex = Math.min(index, Math.max(0, segs.length - 1));
  const current = segs[safeIndex];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: 'var(--canvas-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
        <button type="button" onClick={onExit} style={navBtnGhost}>
          <ArrowLeft size={14} /> Estado del documento
        </button>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Sala de IA · solo marcar para revisar</span>
      </div>
      {current && (
        <AiSegment
          title={current.title}
          paragraphs={current.paragraphs}
          findings={findings}
          aiItems={aiItems}
          index={safeIndex}
          total={segs.length}
          onMark={onMark}
          onReplace={onReplace}
          onPrev={() => setIndex((i) => Math.max(0, i - 1))}
          onNext={() => setIndex((i) => Math.min(segs.length - 1, i + 1))}
        />
      )}
    </div>
  );
};

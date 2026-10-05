// src/components/review/AiChapterFocus.tsx
import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { AuditItem } from '../../lib/auditItems';
import { EvaluacionComparador } from './EvaluacionComparador';

export interface AiChapterFocusProps {
  titulo: string;
  findings: AuditItem[];
  onMark?: (item: AuditItem) => void;
  onDismiss?: (item: AuditItem) => void;
  onApplyParaphrase?: (item: AuditItem, newText: string) => Promise<void>;
  busy?: boolean;
  onBack: () => void;
  onNext?: () => void;
  onAnterior?: () => void;
  contador?: string;
}

export function AiChapterFocus({
  titulo,
  findings,
  onMark,
  onDismiss,
  onApplyParaphrase,
  busy,
  onBack,
  onNext,
  onAnterior,
  contador,
}: AiChapterFocusProps) {
  const [sel, setSel] = React.useState(0);
  const actual = findings[Math.min(sel, Math.max(0, findings.length - 1))] ?? null;

  return (
    <section
      aria-label={`Capítulo ${titulo}`}
      className="rev-item"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 10px',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
          }}
        >
          <ArrowLeft size={14} aria-hidden /> ‹ Mapa IA
        </button>
        <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 800 }}>{titulo}</h3>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {findings.map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setSel(i)}
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: i === sel ? 'var(--ia-nivel-2)' : 'transparent',
              color: 'var(--color-text-secondary)',
            }}
          >
            Alerta {i + 1}
            {f.pageNumber ? ` (Pág. ${f.pageNumber})` : ''}
          </button>
        ))}
      </div>

      {actual ? (
        <div key={actual.id} className="rev-item">
          <EvaluacionComparador
            item={actual}
            onMark={onMark}
            onDismiss={onDismiss}
            onApplyParaphrase={onApplyParaphrase}
            busy={busy}
          />
        </div>
      ) : (
        <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
          Este capítulo no tiene párrafos marcados.
        </p>
      )}

      {(onAnterior || onNext) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
            marginTop: 'var(--space-2)',
          }}
        >
          {onAnterior && (
            <button
              type="button"
              onClick={onAnterior}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 10px',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
              }}
            >
              <ArrowLeft size={14} aria-hidden /> Anterior con IA
            </button>
          )}
          {contador && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{contador}</span>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginLeft: 'auto',
                background: 'var(--color-accent)',
                border: '1px solid var(--color-accent)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px',
                cursor: 'pointer',
                color: 'var(--color-text-on-accent)',
                fontWeight: 700,
              }}
            >
              Siguiente con IA <ArrowRight size={14} aria-hidden />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default AiChapterFocus;

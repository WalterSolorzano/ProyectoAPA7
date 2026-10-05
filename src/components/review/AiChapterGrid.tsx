// src/components/review/AiChapterGrid.tsx
import React from 'react';
import type { AuditItem } from '../../lib/auditItems';
import { RANGOS_IA } from '../../lib/aiHeatmap';

export interface AiChapterGridProps {
  chapters: { id: string; titulo: string; findings: AuditItem[]; score?: number }[];
  onOpen: (id: string) => void;
}

const TOKEN: Record<1 | 2 | 3 | 4, string> = {
  1: 'var(--ia-nivel-1)',
  2: 'var(--ia-nivel-2)',
  3: 'var(--ia-nivel-3)',
  4: 'var(--ia-nivel-4)',
};

/** El escalón del score, con los mismos cortes absolutos que el mapa de calor. */
function nivelDe(score: number): 1 | 2 | 3 | 4 {
  if (score >= RANGOS_IA[3]) return 4;
  if (score >= RANGOS_IA[2]) return 3;
  if (score >= RANGOS_IA[1]) return 2;
  return 1;
}

export function AiChapterGrid({ chapters, onOpen }: AiChapterGridProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {chapters.map((c) => {
        const hayScore = typeof c.score === 'number';
        const nivel = hayScore && c.score! > 0 ? nivelDe(c.score!) : null;
        const relleno = hayScore ? Math.max(0, Math.min(100, c.score!)) : 0;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            style={{
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: 'var(--space-3) 0',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--color-border-subtle)',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)', width: '100%' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {c.titulo}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                {c.findings.length} con IA
              </span>
              {hayScore && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {c.score}%
                </span>
              )}
            </span>
            {nivel && (
              <span
                aria-hidden
                style={{
                  display: 'block',
                  height: 6,
                  width: '100%',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-bg-surface-alt)',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    height: 6,
                    width: `${relleno}%`,
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: TOKEN[nivel],
                  }}
                />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default AiChapterGrid;

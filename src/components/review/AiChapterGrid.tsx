// src/components/review/AiChapterGrid.tsx
import React from 'react';
import type { AuditItem } from '../../lib/auditItems';

export interface AiChapterGridProps {
  chapters: { id: string; titulo: string; findings: AuditItem[] }[];
  onOpen: (id: string) => void;
}

function nivel(findings: AuditItem[]): string {
  const alto = findings.filter((f) => (f.aiScore ?? 0) >= 0.75).length;
  if (findings.length === 0) return 'var(--ia-nivel-1)';
  if (alto >= 2 || findings.length >= 5) return 'var(--ia-nivel-4)';
  if (findings.length >= 3) return 'var(--ia-nivel-3)';
  return 'var(--ia-nivel-2)';
}

export function AiChapterGrid({ chapters, onOpen }: AiChapterGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 'var(--space-2)',
      }}
    >
      {chapters.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onOpen(c.id)}
          style={{
            textAlign: 'left',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-3)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            backgroundColor: nivel(c.findings),
          }}
        >
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {c.titulo}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            {c.findings.length === 0
              ? 'sin alertas'
              : `${c.findings.length} alerta${c.findings.length === 1 ? '' : 's'}`}
          </span>
        </button>
      ))}
    </div>
  );
}

export default AiChapterGrid;

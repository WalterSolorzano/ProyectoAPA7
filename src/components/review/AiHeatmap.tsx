// src/components/review/AiHeatmap.tsx
import React from 'react';
import type { FilaHeatmap } from '../../lib/aiHeatmap';

export interface AiHeatmapProps {
  filas: FilaHeatmap[];
  max: number;
}

const RANGOS = ['45–59', '60–74', '75–89', '90–100'];
const NIVEL = ['var(--ia-nivel-1)', 'var(--ia-nivel-2)', 'var(--ia-nivel-3)', 'var(--ia-nivel-4)'];
const LEYENDA = ['Nada', 'Media', 'Alta', 'Muy alta'];

/** Color por intensidad relativa al máximo (no degradado continuo: 4 escalones). */
function fondo(n: number, max: number): string {
  if (n <= 0) return 'var(--color-bg-surface-alt)';
  const ratio = max <= 0 ? 0 : n / max;
  const idx = ratio > 0.75 ? 3 : ratio > 0.5 ? 2 : ratio > 0.25 ? 1 : 0;
  return NIVEL[idx];
}

export function AiHeatmap({ filas, max }: AiHeatmapProps) {
  return (
    <div role="table" aria-label="Mapa de calor de índice IA por capítulo" style={{ width: '100%', overflowX: 'auto' }}>
      <div role="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1.4fr) repeat(4, 1fr)', gap: 4, marginBottom: 4 }}>
        <span />
        {RANGOS.map((r) => (
          <span key={r} data-testid="heatmap-col" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>{r}</span>
        ))}
      </div>
      {filas.map((f) => (
        <div key={f.h1Id} role="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1.4fr) repeat(4, 1fr)', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.titulo}>{f.titulo}</span>
          {f.counts.map((n, i) => (
            <span key={i} style={{ height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', backgroundColor: fondo(n, max), color: 'var(--color-text-primary)', fontSize: 'var(--text-xs)', fontVariantNumeric: 'tabular-nums' }}>
              {n > 0 ? n : ''}
            </span>
          ))}
        </div>
      ))}
      {filas.some((f) => f.sinMedir > 0) && (
        <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          {filas.reduce((s, f) => s + f.sinMedir, 0)} párrafos sin medición numérica (clasificados sin score).
        </p>
      )}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
          marginTop: 'var(--space-2)',
        }}
      >
        {LEYENDA.map((t, i) => (
          <span
            key={t}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 12,
                height: 12,
                borderRadius: 'var(--radius-sm)',
                backgroundColor: NIVEL[i],
                display: 'inline-block',
              }}
            />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

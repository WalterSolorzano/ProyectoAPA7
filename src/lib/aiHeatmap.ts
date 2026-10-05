import type { AuditItem } from './auditItems';

export const RANGOS_IA = [45, 60, 75, 90] as const;

export interface FilaHeatmap {
  h1Id: string;
  titulo: string;
  counts: [number, number, number, number];
  total: number;
  sinMedir: number;
}

function bucket(score: number): 0 | 1 | 2 | 3 {
  if (score < 60) return 0;
  if (score < 75) return 1;
  if (score < 90) return 2;
  return 3;
}

export function construirHeatmap(
  chapters: { id: string; titulo: string; findings: readonly AuditItem[] }[],
): { filas: FilaHeatmap[]; max: number } {
  const filas: FilaHeatmap[] = chapters.map((c) => {
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    let sinMedir = 0;
    for (const f of c.findings) {
      if (typeof f.aiScore !== 'number') {
        sinMedir += 1;
        continue;
      }
      const score = Math.round(f.aiScore * 100);
      if (score < RANGOS_IA[0]) {
        sinMedir += 1;
        continue;
      }
      counts[bucket(score)] += 1;
    }
    return {
      h1Id: c.id,
      titulo: c.titulo,
      counts,
      total: counts[0] + counts[1] + counts[2] + counts[3],
      sinMedir,
    };
  });
  const max = filas.reduce((m, f) => Math.max(m, ...f.counts), 0);
  return { filas, max };
}

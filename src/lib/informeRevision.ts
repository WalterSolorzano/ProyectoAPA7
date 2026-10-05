import type { ElementModel } from '../types';
import type { AuditItem } from './auditItems';
import { PHASE_ORDER, phaseLabel } from './auditItems';

export interface TerminoRepetido {
  termino: string;
  conteo: number;
}

const VACIAS = new Set([
  'para', 'como', 'donde', 'cuando', 'desde', 'hacia', 'entre', 'sobre', 'bajo',
  'este', 'esta', 'estos', 'estas', 'esto', 'esos', 'esas', 'aquel', 'aquella',
  'porque', 'pues', 'sino', 'solo', 'tambien', 'también', 'cada', 'otro', 'otra',
  'otros', 'otras', 'mismo', 'misma', 'toda', 'todo', 'todos', 'todas',
  'ser', 'son', 'fue', 'era', 'han', 'has', 'hay', 'sus', 'del', 'las', 'los',
  'con', 'por', 'que', 'una', 'uno', 'unos', 'unas', 'de', 'la', 'el', 'en',
  'se', 'su', 'al', 'lo', 'es', 'no', 'si', 'ya', 'más', 'mas', 'muy',
]);

const MIN_LARGO = 5;
const MIN_CONTEOS = 3;

function normalizarPalabra(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zñü]/g, '');
}

export function repeticionCuerpo(elements: readonly ElementModel[], topN = 8): TerminoRepetido[] {
  const conteo = new Map<string, { termino: string; conteo: number }>();
  for (const e of elements) {
    const texto = (e as { text?: string }).text || '';
    for (const raw of texto.split(/\s+/)) {
      const clave = normalizarPalabra(raw);
      if (clave.length < MIN_LARGO || VACIAS.has(clave)) continue;
      const prev = conteo.get(clave);
      if (prev) prev.conteo += 1;
      else conteo.set(clave, { termino: clave, conteo: 1 });
    }
  }
  return [...conteo.values()]
    .filter((t) => t.conteo >= MIN_CONTEOS)
    .sort((a, b) => b.conteo - a.conteo || a.termino.localeCompare(b.termino))
    .slice(0, topN);
}

export interface LeyPorFase {
  phase: string;
  label: string;
  items: AuditItem[];
}

const ORDEN_FASE: readonly string[] = PHASE_ORDER;

function indiceFase(phase: string): number {
  const i = ORDEN_FASE.indexOf(phase);
  return i === -1 ? ORDEN_FASE.length : i;
}

/** Leyes de metodología: hallazgos con fase concreta (nunca `global` ni `null`). */
export function leyesPorFase(items: readonly AuditItem[]): LeyPorFase[] {
  const mapa = new Map<string, AuditItem[]>();
  for (const it of items) {
    if (!it.phase || it.phase === 'global') continue;
    const lista = mapa.get(it.phase);
    if (lista) lista.push(it);
    else mapa.set(it.phase, [it]);
  }
  return [...mapa.entries()]
    .sort((a, b) => indiceFase(a[0]) - indiceFase(b[0]))
    .map(([phase, lista]) => ({ phase, label: phaseLabel(phase), items: lista }));
}

/* WordAPA7 — Capa 1: puerta de estado. Cumplimiento, sub-cifras y matriz de
   calor fase × motor.
   Sin emoji: los iconos son de lucide-react y la mascota es `EditorialMascot`.
   Todo el color sale de tokens; ninguna celda escribe un hex. */
import React, { useMemo } from 'react';
import { ShieldCheck, Sparkles, ArrowRight, ChevronRight, Lock, ListChecks, Bot, Layers } from 'lucide-react';
import type { AuditItem, ToolWindowId } from '../../lib/auditItems';
import { phaseLabel } from '../../lib/auditItems';
import type { ElementModel } from '../../types';
import {
  cumplimiento,
  matrizFaseMotor,
  fasePorElemento,
  nivelCelda,
  MOTORES_MATRIZ,
  type MotorMatriz,
} from '../../lib/informeRevision';
import { EditorialMascot } from '../layout/EditorialMascot';

/** Matriz de calor: cuenta hallazgos por motor/categoría. Función pura. */
export function heatMatrix(items: AuditItem[]): Record<ToolWindowId, number> {
  const m: Record<ToolWindowId, number> = { ai: 0, style: 0, spelling: 0, citations: 0, structure: 0 };
  items.forEach((it) => { m[it.category] += 1; });
  return m;
}

/* Las cuatro columnas de la matriz. Citas queda fuera: vive en su fase (paso 4)
   y un documento que solo tiene citas no debe abrir la puerta con filas. */
const COLUMNA: Record<MotorMatriz, { label: string; marca: string; relleno: [string, string, string] }> = {
  spelling: {
    label: 'Ortografía',
    marca: 'var(--color-accent)',
    relleno: ['var(--color-accent-a20)', 'var(--color-accent-a40)', 'var(--color-accent-a65)'],
  },
  structure: {
    label: 'Estructura',
    marca: 'var(--color-accent)',
    relleno: ['var(--color-accent-a20)', 'var(--color-accent-a40)', 'var(--color-accent-a65)'],
  },
  style: {
    label: 'Redacción',
    marca: 'var(--color-warning)',
    relleno: ['var(--color-warning-a08)', 'var(--color-warning-a30)', 'var(--color-warning-a40)'],
  },
  ai: {
    label: 'IA',
    marca: 'var(--color-engine-ia)',
    relleno: ['var(--ia-nivel-1)', 'var(--ia-nivel-2)', 'var(--ia-nivel-3)'],
  },
};

const rellenoDe = (motor: MotorMatriz, nivel: 0 | 1 | 2 | 3): string =>
  nivel === 0 ? 'transparent' : COLUMNA[motor].relleno[nivel - 1];

/** Foco con el que la puerta abre la revisión: una fase y, si la celda es de un
 *  motor concreto, también ese motor. El drill-down va de lo general (la matriz
 *  entera) a lo específico (una fase y un motor). */
export interface FocoRevision {
  phase?: string;
  engine?: MotorMatriz;
}

/* La matriz agrupa las reglas generales como `sin_fase`, pero el workbench las
   filtra por `global` (`it.phase ?? 'global'`). Sin traducir, abrir esa fila
   dejaría la revisión vacía: la celda prometería hallazgos que la superficie no
   abre. Es la única clave que la matriz y el hook nombran distinto. */
const faseDeFiltro = (phase: string): string => (phase === 'sin_fase' ? 'global' : phase);

interface Props {
  items: AuditItem[];
  aiScore: number;
  isScanning: boolean;
  onScan: () => void;
  /** Abre la revisión. Sin argumento, sin filtro (la matriz entera). Con
   *  `{ phase, engine }`, ya acotada a esa fila y esa celda. */
  onStart: (foco?: FocoRevision) => void;
  onOpenAiRoom: () => void;
  /** El documento, para resolver la fase de cada elemento por su H1 ancestro. */
  elements?: readonly ElementModel[];
}

export const ReviewGate: React.FC<Props> = ({
  items,
  aiScore,
  isScanning,
  onScan,
  onStart,
  onOpenAiRoom,
  elements = [],
}) => {
  const matrix = useMemo(() => heatMatrix(items), [items]);
  const total = items.filter((it) => it.category !== 'ai').length;
  const aiCount = matrix.ai;

  const filas = useMemo(
    () => matrizFaseMotor(items, fasePorElemento(elements, items)),
    [items, elements],
  );

  const maxPorMotor = useMemo(() => {
    const m: Record<MotorMatriz, number> = { spelling: 0, structure: 0, style: 0, ai: 0 };
    for (const fila of filas) for (const motor of MOTORES_MATRIZ) m[motor] = Math.max(m[motor], fila.counts[motor]);
    return m;
  }, [filas]);

  if (items.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '40px' }}>
        <div style={{ color: 'var(--color-accent)' }}><ShieldCheck size={32} aria-hidden /></div>
        <h2 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Aún no hay una revisión</h2>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Ejecutá el escaneo para medir ortografía, voz, estructura y voz sintética.
        </p>
        <button type="button" onClick={onScan} disabled={isScanning} aria-busy={isScanning} style={solidBtn}>
          <Sparkles size={14} aria-hidden /> Escanear documento
        </button>
      </div>
    );
  }

  const porcentaje = cumplimiento(total);

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ flex: 1, minHeight: '100%', width: '100%', maxWidth: '860px', margin: '0 auto', padding: 'clamp(20px, 4vw, 48px)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={eyebrow}>Paso 5 · Revisión &amp; IA</div>
            <h1 style={{ margin: '6px 0 0', fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Estado de tu documento</h1>
            <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', maxWidth: '46ch' }}>
              Todavía no revisaste este borrador. Esto es lo que encontramos.
            </p>
          </div>
          <EditorialMascot kind="reference" size={64} />
        </header>

        <div style={{ marginTop: '28px' }}>
          <div style={{ fontSize: 'clamp(34px, 5vw, 44px)', fontWeight: 800, lineHeight: 1, color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums' }}>{porcentaje}%</div>
          <div style={{ marginTop: '6px', fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}>
            LISTO PARA PUBLICAR
          </div>
        </div>

        <div role="status" aria-atomic="true" style={{ display: 'flex', flexWrap: 'wrap', marginTop: '24px' }}>
          <Cifra valor={total} etiqueta="por revisar" testId="review-gate-total" icono={<ListChecks size={14} />} />
          <Cifra valor={`${Math.round(aiScore * 100)}%`} etiqueta="voz sintética" icono={<Bot size={14} />} />
          <Cifra valor={filas.length} etiqueta={filas.length === 1 ? 'fase' : 'fases'} icono={<Layers size={14} />} />
        </div>

        <section aria-label="Hallazgos por fase y motor" style={{ marginTop: '28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1fr) repeat(4, 60px)', gap: '4px', alignItems: 'center' }}>
            <div />
            {MOTORES_MATRIZ.map((motor) => (
              <div key={motor} style={colHeader}>{COLUMNA[motor].label}</div>
            ))}

            {filas.map((fila) => (
              <React.Fragment key={fila.phase}>
                {/* La fila abre la fase entera; cada celda con hallazgos abre la
                    fase acotada además a su motor. Botones reales, con nombre
                    accesible: la matriz deja de ser un cartel y pasa a ser la
                    puerta de entrada al detalle. */}
                <button
                  type="button"
                  onClick={() => onStart({ phase: faseDeFiltro(fila.phase) })}
                  aria-label={`Revisar la fase ${fila.label}`}
                  style={filaBtn}
                >
                  <ChevronRight size={12} aria-hidden style={{ flexShrink: 0, color: 'var(--color-text-tertiary)' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fila.label}</span>
                  {fila.protegida && <Lock size={12} aria-label="Portada protegida" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />}
                </button>
                {MOTORES_MATRIZ.map((motor) => {
                  const n = fila.counts[motor];
                  const nivel = nivelCelda(n, maxPorMotor[motor]);
                  const abrible = n > 0;
                  return (
                    <button
                      key={motor}
                      type="button"
                      disabled={!abrible}
                      onClick={() => onStart({ phase: faseDeFiltro(fila.phase), engine: motor })}
                      aria-label={`Revisar ${fila.label}: ${n} hallazgo${n === 1 ? '' : 's'} de ${COLUMNA[motor].label}`}
                      title={`${fila.label} · ${COLUMNA[motor].label}: ${n}`}
                      style={{
                        height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 'var(--radius-sm)', background: rellenoDe(motor, nivel),
                        fontSize: 'var(--text-xs)', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                        color: n > 0 ? 'var(--color-text-primary)' : 'transparent',
                        border: 'none', fontFamily: 'inherit', padding: 0,
                        cursor: abrible ? 'pointer' : 'default',
                      }}
                    >
                      {n > 0 ? n : ''}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}

            <div />
            {MOTORES_MATRIZ.map((motor) => (
              <div key={motor} style={{ height: '4px', borderRadius: 'var(--radius-sm)', background: COLUMNA[motor].marca }} />
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '12px' }}>
            <Leyenda color="var(--color-accent)" texto="Ortografía y estructura" />
            <Leyenda color="var(--color-warning)" texto="Redacción" />
            <Leyenda color="var(--color-engine-ia)" texto="IA" />
          </div>
        </section>

        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => onStart()} style={solidBtn}>
            Empezar revisión <ArrowRight size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onOpenAiRoom}
            disabled={aiCount === 0}
            title={aiCount === 0 ? 'Todavía no hay fragmentos con voz sintética' : undefined}
            style={{ ...ghostBtn, opacity: aiCount === 0 ? 0.5 : 1, cursor: aiCount === 0 ? 'not-allowed' : 'pointer' }}
          >
            <Sparkles size={14} aria-hidden /> Ver mapa de IA
          </button>
        </div>
      </div>
    </div>
  );
};

const Cifra: React.FC<{ valor: number | string; etiqueta: string; testId?: string; icono?: React.ReactNode }> = ({ valor, etiqueta, testId, icono }) => (
  <div style={{ flex: '1 1 90px', padding: '0 18px', borderLeft: '1px solid var(--color-border-subtle)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {icono && (
        <span aria-hidden style={{ display: 'inline-flex', color: 'var(--color-text-tertiary)' }}>
          {icono}
        </span>
      )}
      <div data-testid={testId} style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, lineHeight: 1.1, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
    </div>
    <div style={{ marginTop: '2px', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)' }}>{etiqueta}</div>
  </div>
);

const Leyenda: React.FC<{ color: string; texto: string }> = ({ color, texto }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
    <span aria-hidden style={{ width: '10px', height: '10px', borderRadius: 'var(--radius-sm)', background: color }} />
    {texto}
  </span>
);

const eyebrow: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '1.4px', color: 'var(--color-text-tertiary)',
};

const colHeader: React.CSSProperties = {
  fontSize: '10px', color: 'var(--color-text-tertiary)',
  textAlign: 'center', lineHeight: 1.1, overflowWrap: 'anywhere',
};

/* La etiqueta de fase es un botón, no un rótulo: reset de botón y el foco
   visible lo aporta `.revision-phase :focus-visible` (revision.css). */
const filaBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)',
  minWidth: 0, background: 'transparent', border: 'none',
  padding: 0, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
};

const solidBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '10px 18px', borderRadius: 'var(--radius-sm)',
  border: 'none', background: 'var(--color-accent)', color: 'var(--color-text-on-accent)',
  fontSize: 'var(--text-sm)', fontWeight: 800, cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '10px 18px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border-subtle)', background: 'transparent',
  color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer',
};

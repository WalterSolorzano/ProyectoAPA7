import React, { useMemo } from 'react';
import { ArrowLeft, PenLine } from 'lucide-react';
import type { AuditItem } from '../../lib/auditItems';
import type { ElementModel } from '../../types';
import { construirCapitulos, contarPorCapitulo } from '../../lib/capitulosRevision';
import { repeticionCuerpo, leyesPorFase } from '../../lib/informeRevision';
import { objetivosBloom, type ElementLike } from '../../lib/contentReview';
import { BloomPanel } from './BloomPanel';

export interface ReviewInformeProps {
  items: readonly AuditItem[];
  elements: readonly ElementModel[];
  title: string;
  embedded?: boolean;
  onStart: (capituloId?: string) => void;
  onBack: () => void;
  /** Aplica una alternativa de Bloom al documento (paso a `updateElementText`). */
  onAplicar?: (elementId: string, texto: string) => void;
}

const panel: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5) var(--space-6)',
};
const titulo: React.CSSProperties = {
  margin: '0 0 var(--space-3)',
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-tertiary)',
};
/** Tope de puntos del recuento de repeticiones: por encima, el sobrante se
 *  resume en «+N» en vez de vomitar una fila de marcas. */
const MAX_PUNTOS = 12;

export function ReviewInforme({ items, elements, title, embedded, onStart, onBack, onAplicar }: ReviewInformeProps) {
  const objetivos = useMemo(() => objetivosBloom(elements as unknown as ElementLike[]), [elements]);
  const repetidos = useMemo(() => repeticionCuerpo(elements), [elements]);
  const leyes = useMemo(() => leyesPorFase(items), [items]);
  const caps = useMemo(() => construirCapitulos(elements), [elements]);
  const porCap = useMemo(() => contarPorCapitulo(items, caps), [items, caps]);
  const maxElems = Math.max(1, ...caps.map((c) => c.elementIds.length));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 880, margin: '0 auto' }}>
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button type="button" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', padding: '6px 10px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={14} aria-hidden /> Estado del documento
          </button>
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Informe general</h2>
          {title && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>{title}</span>}
        </div>
      )}

      {leyes.length > 0 && (
        <section style={panel} aria-label="Leyes de metodología por fase">
          <h3 style={titulo}>Leyes de metodología</h3>
          {leyes.map((g) => (
            <div key={g.phase} style={{ marginBottom: 'var(--space-3)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{g.label}</div>
              {g.items.map((it) => (
                <div key={it.id} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'baseline', padding: '4px 0', borderTop: '1px solid var(--color-border-subtle)', fontSize: 'var(--text-sm)' }}>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text-primary)' }}>{it.summary}</span>
                  {it.originalText && (
                    <span style={{ color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>&ldquo;{it.originalText.slice(0, 40)}&rdquo;</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        <section style={{ ...panel, gridColumn: '1 / -1' }} aria-label="Objetivos y validación Bloom">
          <h3 style={titulo}>Objetivos · validación Bloom</h3>
          <BloomPanel objetivos={objetivos} onAplicar={onAplicar} />
        </section>

        <section style={panel} aria-label="Repetición del cuerpo completo">
          <h3 style={titulo}>Repetición · cuerpo completo</h3>
          {repetidos.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>Sin repeticiones relevantes.</p>
          ) : (
            repetidos.map((t) => (
              <div key={t.termino} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '4px 0', fontSize: 'var(--text-sm)' }}>
                <span style={{ width: 130, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t.termino}</span>
                <span aria-hidden style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                  {Array.from({ length: Math.min(t.conteo, MAX_PUNTOS) }).map((_, i) => (
                    <span key={i} style={{ width: 6, height: 6, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-warning)' }} />
                  ))}
                  {t.conteo > MAX_PUNTOS && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>+{t.conteo - MAX_PUNTOS}</span>
                  )}
                </span>
                <span style={{ width: 32, textAlign: 'right', color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{t.conteo}</span>
              </div>
            ))
          )}
        </section>
      </div>

      {caps.length > 0 && (
        <section style={panel} aria-label="Salud por capítulo">
          <h3 style={titulo}>Capítulos · pendientes por fase</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 'var(--space-2)' }}>
            {caps.map((c) => {
              const n = porCap[c.id] ?? 0;
              const span = Math.min(6, Math.max(2, 2 + Math.round(2 * (c.elementIds.length / maxElems))));
              return (
                <button key={c.id} type="button" onClick={() => onStart(c.id)}
                  aria-label={`Capítulo ${c.titulo}${n === 0 ? '' : ` · ${n} pendiente${n === 1 ? '' : 's'}`}`}
                  style={{
                    gridColumn: `span ${span}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                    minHeight: 64, padding: 'var(--space-3)', cursor: 'pointer', textAlign: 'left',
                    borderRadius: 'var(--radius-sm)',
                    border: n === 0 ? '1px solid var(--color-border-subtle)' : '1px solid var(--color-warning-a40)',
                    backgroundColor: n === 0 ? 'var(--color-bg-surface-alt)' : 'var(--color-bg-surface)',
                  }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{c.titulo}</span>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: n === 0 ? 'var(--color-text-tertiary)' : 'var(--color-warning)' }}>
                    {n === 0 ? 'sin pendientes' : `${n} pendiente${n === 1 ? '' : 's'}`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!embedded && (
        <button type="button" onClick={() => onStart()} disabled={items.length === 0}
          style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-accent)', backgroundColor: items.length === 0 ? 'var(--color-bg-surface-alt)' : 'var(--color-accent)', color: items.length === 0 ? 'var(--color-text-tertiary)' : 'var(--color-text-on-accent)', fontWeight: 700, cursor: items.length === 0 ? 'not-allowed' : 'pointer' }}>
          <PenLine size={15} aria-hidden /> Leer y corregir
        </button>
      )}
    </div>
  );
}

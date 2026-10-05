import React, { useMemo } from 'react';
import { ArrowLeft, ArrowRight, PenLine } from 'lucide-react';
import type { AuditItem } from '../../lib/auditItems';
import type { ElementModel } from '../../types';
import { construirCapitulos, contarPorCapitulo } from '../../lib/capitulosRevision';
import { repeticionCuerpo, leyesPorFase } from '../../lib/informeRevision';
import { objetivosBloom, type ElementLike } from '../../lib/contentReview';

export interface ReviewInformeProps {
  items: readonly AuditItem[];
  elements: readonly ElementModel[];
  title: string;
  embedded?: boolean;
  onStart: (capituloId?: string) => void;
  onBack: () => void;
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

export function ReviewInforme({ items, elements, title, embedded, onStart, onBack }: ReviewInformeProps) {
  const objetivos = useMemo(() => objetivosBloom(elements as unknown as ElementLike[]), [elements]);
  const repetidos = useMemo(() => repeticionCuerpo(elements), [elements]);
  const leyes = useMemo(() => leyesPorFase(items), [items]);
  const caps = useMemo(() => construirCapitulos(elements), [elements]);
  const porCap = useMemo(() => contarPorCapitulo(items, caps), [items, caps]);
  const maxRep = repetidos[0]?.conteo ?? 1;
  const maxCap = Math.max(1, ...caps.map((c) => porCap[c.id] ?? 0));

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
        <section style={panel} aria-label="Objetivos y validación Bloom">
          <h3 style={titulo}>Objetivos · validación Bloom</h3>
          {objetivos.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>No se detectaron objetivos.</p>
          ) : (
            objetivos.map((o) => (
              <div key={o.elementId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '6px 0', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.texto}>{o.texto}</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 7px', borderRadius: 999, backgroundColor: 'var(--color-bg-surface-alt)', color: 'var(--color-warning)' }}>{o.verboActual}</span>
                <ArrowRight size={13} aria-hidden style={{ color: 'var(--color-text-tertiary)' }} />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 7px', borderRadius: 999, backgroundColor: 'var(--color-bg-surface-alt)', color: 'var(--color-success)' }}>{o.verboPropuesto}</span>
              </div>
            ))
          )}
        </section>

        <section style={panel} aria-label="Repetición del cuerpo completo">
          <h3 style={titulo}>Repetición · cuerpo completo</h3>
          {repetidos.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>Sin repeticiones relevantes.</p>
          ) : (
            repetidos.map((t) => (
              <div key={t.termino} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '4px 0', fontSize: 'var(--text-sm)' }}>
                <span style={{ width: 130, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t.termino}</span>
                <span style={{ flex: 1, height: 9, borderRadius: 5, backgroundColor: 'var(--color-bg-surface-alt)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.round((t.conteo / maxRep) * 100)}%`, backgroundColor: 'var(--color-warning)' }} />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3)' }}>
            {caps.map((c) => {
              const n = porCap[c.id] ?? 0;
              return (
                <button key={c.id} type="button" onClick={() => onStart(c.id)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', backgroundColor: n === 0 ? 'var(--color-bg-surface-alt)' : 'var(--color-bg-surface)', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{c.titulo}</span>
                  <span style={{ height: 5, width: '100%', borderRadius: 3, backgroundColor: 'var(--color-bg-surface-alt)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.round((n / maxCap) * 100)}%`, backgroundColor: 'var(--color-danger)' }} />
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{n === 0 ? 'sin pendientes' : `${n} pendiente${n === 1 ? '' : 's'}`}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!embedded && (
        <button type="button" onClick={() => onStart()} disabled={items.length === 0}
          style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-accent)', backgroundColor: items.length === 0 ? 'var(--color-bg-surface-alt)' : 'var(--color-accent)', color: items.length === 0 ? 'var(--color-text-tertiary)' : '#fff', fontWeight: 700, cursor: items.length === 0 ? 'not-allowed' : 'pointer' }}>
          <PenLine size={15} aria-hidden /> Leer y corregir
        </button>
      )}
    </div>
  );
}

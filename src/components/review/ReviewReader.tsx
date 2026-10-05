import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, Check, CheckCheck, X } from 'lucide-react';
import type { AuditItem } from '../../lib/auditItems';
import type { ElementModel } from '../../types';
import { construirCapitulos, contarPorCapitulo, type CapituloRevision } from '../../lib/capitulosRevision';
import { ReadingText } from './ReadingText';
import { useMarkSourceBase, buildMarkSource } from '../../hooks/useMarkSource';
import { ENGINE_META } from '../../hooks/useReviewWorkbench';
import { ReviewInforme } from './ReviewInforme';

export interface ReviewReaderProps {
  elements: readonly ElementModel[];
  items: readonly AuditItem[];
  initialCapId?: string | null;
  onAccept: (item: AuditItem) => void;
  onMark: (item: AuditItem) => void;
  onDismiss: (item: AuditItem) => void;
  onBack: () => void;
}

const barra: React.CSSProperties = {
  position: 'sticky', top: 0, zIndex: 5,
  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
  padding: '8px 12px', borderRadius: 'var(--radius-full)',
  backgroundColor: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-subtle)',
  boxShadow: 'var(--shadow-sm)',
};
const iconoBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer',
};

export function ReviewReader({ elements, items, initialCapId, onAccept, onDismiss, onBack }: ReviewReaderProps) {
  const markBase = useMarkSourceBase();
  const caps = useMemo(() => construirCapitulos(elements), [elements]);
  const [capId, setCapId] = useState<string | null>(initialCapId ?? caps[0]?.id ?? null);
  const [cat, setCat] = useState<AuditItem['category'] | 'all'>('all');
  const [cursor, setCursor] = useState(0);
  const [informe, setInforme] = useState(false);

  const cap: CapituloRevision | null = caps.find((c) => c.id === capId) ?? caps[0] ?? null;
  const elemsCap = useMemo(
    () => (cap ? (cap.elementIds.map((id) => elements.find((e) => e.id === id)).filter(Boolean) as ElementModel[]) : []),
    [cap, elements],
  );
  const itemsCap = useMemo(
    () => items.filter((it) => (cat === 'all' ? true : it.category === cat) && cap?.elementIds.includes(it.element_id)),
    [items, cat, cap],
  );
  const actual = itemsCap[Math.min(cursor, Math.max(0, itemsCap.length - 1))] ?? null;
  const porCap = useMemo(() => contarPorCapitulo(items, caps), [items, caps]);

  const motores: (AuditItem['category'] | 'all')[] = ['all', 'spelling', 'style', 'structure', 'citations'];

  const irA = (capituloId: string) => { setCapId(capituloId); setCursor(0); };
  const siguiente = () => setCursor((c) => (itemsCap.length === 0 ? 0 : (c + 1) % itemsCap.length));
  const aceptarTodas = () => { itemsCap.forEach((it) => onAccept(it)); };

  return (
    <div style={{ position: 'relative', maxWidth: 820, margin: '0 auto', paddingBottom: 120 }}>
      <div style={barra}>
        <button type="button" onClick={onBack} style={{ ...iconoBtn, width: 'auto', borderRadius: 'var(--radius-md)', padding: '0 10px', gap: 6 }}>
          <ArrowLeft size={14} aria-hidden /> <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>Informe</span>
        </button>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
          Revisión <span style={{ color: 'var(--color-text-tertiary)' }}>· {cap?.titulo ?? 'Sin capítulo'}</span>
        </span>
        <span style={{ flex: 1, display: 'flex', gap: 4, minWidth: 80, alignItems: 'center' }}>
          {caps.map((c) => {
            const pend = porCap[c.id] ?? 0;
            return (
              <span key={c.id} style={{ flex: Math.max(1, c.elementIds.length), display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <button type="button" aria-label={`${c.titulo}${pend === 0 ? '' : ` · ${pend} pendiente${pend === 1 ? '' : 's'}`}`} title={c.titulo} onClick={() => irA(c.id)}
                  style={{ width: '100%', height: 6, border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', backgroundColor: c.id === cap?.id ? 'var(--color-accent)' : 'var(--color-bg-surface-alt)' }} />
                {pend > 0 && (
                  <span aria-hidden style={{ alignSelf: 'center', width: 5, height: 5, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-danger)' }} />
                )}
              </span>
            );
          })}
        </span>
        {motores.map((m) => (
          <button key={m} type="button" onClick={() => { setCat(m); setCursor(0); }}
            style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '4px 9px', borderRadius: 'var(--radius-full)', cursor: 'pointer', border: '1px solid var(--color-border-subtle)', backgroundColor: cat === m ? 'var(--color-bg-surface-alt)' : 'transparent', color: cat === m ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}>
            {m === 'all' ? 'Todos' : ENGINE_META[m]?.title ?? m}
          </button>
        ))}
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
          {itemsCap.length === 0 ? '0 de 0' : `${Math.min(cursor + 1, itemsCap.length)} de ${itemsCap.length}`}
        </span>
        <button type="button" aria-label="Informe" onClick={() => setInforme((v) => !v)} style={iconoBtn}><BarChart3 size={15} aria-hidden /></button>
        <button type="button" aria-label="Siguiente hallazgo" onClick={siguiente} style={{ ...iconoBtn, backgroundColor: 'var(--color-accent)', borderColor: 'var(--color-accent)', color: 'var(--color-text-on-accent)' }}><ArrowRight size={15} aria-hidden /></button>
      </div>

      <div style={{ backgroundColor: 'var(--paper-white)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-10) var(--space-12)', marginTop: 'var(--space-4)' }}>
        {elemsCap.map((e) => (
          <div key={e.id} style={{ marginBottom: 'var(--space-4)' }}>
            <ReadingText text={e.text || ''} source={buildMarkSource(markBase, e)} />
          </div>
        ))}
        {elemsCap.length === 0 && <p style={{ color: 'var(--color-text-tertiary)' }}>Sin contenido para mostrar.</p>}
      </div>

      <div style={{ position: 'fixed', left: '50%', bottom: 18, transform: 'translateX(-50%)', width: 'min(720px, 92%)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '10px 12px', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-md)' }}>
        {actual ? (
          <>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-bg-surface-alt)', color: ENGINE_META[actual.category]?.color ?? 'var(--color-text-secondary)' }}>
              {ENGINE_META[actual.category]?.title ?? actual.category}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <b style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', display: 'block' }}>{actual.summary}</b>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                {actual.pageNumber ? `Pág. ${actual.pageNumber}` : 'Sin página'}
              </p>
            </div>
            {!actual.readOnly && (
              <>
                <button type="button" onClick={() => onAccept(actual)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-accent)', backgroundColor: 'var(--color-accent)', color: 'var(--color-text-on-accent)', fontWeight: 700, cursor: 'pointer' }}><Check size={14} aria-hidden /> Aceptar</button>
                <button type="button" onClick={aceptarTodas} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)', fontWeight: 700, cursor: 'pointer' }}><CheckCheck size={14} aria-hidden /> Aceptar todas</button>
              </>
            )}
            <button type="button" aria-label="Descartar" onClick={() => onDismiss(actual)} style={iconoBtn}><X size={15} aria-hidden /></button>
          </>
        ) : (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
            {cap ? 'Sin hallazgos en este capítulo. Elegí otro en la cinta.' : 'No hay capítulos con hallazgos.'}
          </span>
        )}
      </div>

      {informe && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--scrim-overlay)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '26px 16px', zIndex: 20 }}>
          <div style={{ width: 'min(760px, 96%)', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5) var(--space-6)', maxHeight: '86vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 800 }}>Informe general</h3>
              <span style={{ flex: 1 }} />
              <button type="button" aria-label="Cerrar informe" onClick={() => setInforme(false)} style={iconoBtn}><X size={15} aria-hidden /></button>
            </div>
            <ReviewInforme items={items} elements={elements} title="" embedded onStart={(id) => { if (id) irA(id); setInforme(false); }} onBack={() => setInforme(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default ReviewReader;

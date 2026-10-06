/* WordAPA7 — Sala de Revisión, corrección (REV-L1). Texto delante, corrección al
   lado. La acción se deriva de `accionDeItem`: objetivo ⇒ aceptar; IA ⇒ marcar;
   portada (readOnly) ⇒ sin acción. El subrayado inline lo pinta `ReadingText`,
   dueño único de los dos canales (AGENTS.md §2); aquí no se normaliza nada. */
import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, CheckCheck, Flag } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { useReviewWorkbench, accionDeItem, ENGINE_META } from '../../hooks/useReviewWorkbench';
import { rotuloDeSubtipo } from '../../lib/rotulos';
import { phaseLabel, type EngineId } from '../../lib/auditItems';
import { ReadingText } from './ReadingText';
import { useMarkSourceBase, buildMarkSource } from '../../hooks/useMarkSource';
import { MascotaFrase } from './MascotaFrase';

export interface RevisionDetailProps {
  foco: { motor?: EngineId; phase?: string };
  onBack: () => void;
}

export const RevisionDetail: React.FC<RevisionDetailProps> = ({ foco, onBack }) => {
  const { items, acceptOne, acceptMany, markForReview, isApplying } = useReviewWorkbench();
  const base = useMarkSourceBase();
  const elements = useDocStore((s) => s.doc?.elements ?? []);
  const [sub, setSub] = useState<string | 'todas'>('todas');

  const delFoco = useMemo(
    () => items.filter((it) => (foco.motor ? it.category === foco.motor : true) && (foco.phase ? (it.phase ?? 'global') === foco.phase : true)),
    [items, foco],
  );
  const subtipos = useMemo(() => [...new Set(delFoco.map((it) => it.subtype))], [delFoco]);
  const visibles = sub === 'todas' ? delFoco : delFoco.filter((it) => it.subtype === sub);
  const [idx, setIdx] = useState(0);
  const actual = visibles[Math.min(idx, visibles.length - 1)] ?? null;
  const accion = actual ? accionDeItem(actual) : 'none';
  const motor = foco.motor;
  const aplicables = visibles.filter((it) => !it.readOnly);
  const titulo = motor ? ENGINE_META[motor].title : foco.phase ? phaseLabel(foco.phase) : 'Revisión';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--color-bg-canvas)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button type="button" onClick={onBack} style={fantasma}><ArrowLeft size={14} aria-hidden /> Menú general</button>
          <div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{titulo}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{delFoco.length} puntos · {motor === 'ai' ? 'motor probabilístico' : 'motor objetivo'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => { setSub('todas'); setIdx(0); }} style={chip(sub === 'todas')}>Todas · {delFoco.length}</button>
          {subtipos.map((s) => (
            <button key={s} type="button" onClick={() => { setSub(s); setIdx(0); }} style={chip(sub === s)}>{rotuloDeSubtipo(s)} · {delFoco.filter((it) => it.subtype === s).length}</button>
          ))}
        </div>
      </div>

      {actual ? (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', minHeight: 0 }}>
          <div style={{ overflowY: 'auto', padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-3)' }}>
              <span style={eyebrow}>{actual.phase ?? 'Todo el documento'} · {actual.pageNumber ? `página ${actual.pageNumber}` : 'sin página'}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>punto {idx + 1} de {visibles.length}</span>
            </div>
            <p style={{ margin: 0, fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 'var(--text-lg)', lineHeight: 1.85, color: 'var(--color-text-primary)' }}>
              <ReadingText text={actual.originalText || elements.find((e) => e.id === actual.element_id)?.text || ''} source={buildMarkSource(base, elements.find((e) => e.id === actual.element_id))} />
            </p>
          </div>

          <div style={{ overflowY: 'auto', borderLeft: '1px solid var(--color-border-subtle)', padding: 'var(--space-4)', background: 'var(--color-bg-surface-alt)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <span style={eyebrow}>Qué pasa</span>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>{actual.detail || actual.summary}</p>
            {actual.suggestedText && (
              <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', background: 'var(--color-bg-surface)' }}>
                <span style={eyebrow}>Propuesta</span>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{actual.suggestedText}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {accion === 'accept' && (
                <>
                  <button type="button" disabled={isApplying} onClick={() => acceptOne(actual)} style={exito}><Check size={13} aria-hidden /> Aceptar</button>
                  {aplicables.length > 0 && <button type="button" disabled={isApplying} onClick={() => acceptMany(aplicables)} style={primario}><CheckCheck size={13} aria-hidden /> Aceptar todas ({aplicables.length})</button>}
                </>
              )}
              {accion === 'mark' && <button type="button" onClick={() => markForReview(actual)} style={primario}><Flag size={13} aria-hidden /> Marcar para revisar</button>}
              {accion === 'none' && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Solo lectura: la portada se mide, no se escribe.</span>}
            </div>
            <div style={{ marginTop: 'auto' }}>
              <MascotaFrase frase={visibles.length ? `Vas bien: ${idx + 1} de ${visibles.length}.` : ''} kind="ruler" expression="neutral" size={44} />
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--color-text-secondary)' }}>No hay hallazgos con este filtro.</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-5)', borderTop: '1px solid var(--color-border-subtle)' }}>
        <button type="button" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))} style={fantasma}>‹ Punto anterior</button>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{visibles.length ? idx + 1 : 0} de {visibles.length}</span>
        <button type="button" disabled={idx >= visibles.length - 1} onClick={() => setIdx((i) => Math.min(visibles.length - 1, i + 1))} style={fantasma}>Punto siguiente ›</button>
      </div>
    </div>
  );
};

const eyebrow: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 };
const chip = (on: boolean): React.CSSProperties => ({ fontSize: 'var(--text-xs)', fontWeight: 600, padding: '3px 9px', borderRadius: 'var(--radius-full)', border: `1px solid ${on ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`, background: on ? 'var(--color-accent-soft)' : 'transparent', color: on ? 'var(--color-accent)' : 'var(--color-text-secondary)', cursor: 'pointer' });
const primario: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-text-on-accent)', fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer' };
const exito: React.CSSProperties = { ...primario, background: 'var(--color-success)' };
const fantasma: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', background: 'transparent', color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer' };

export default RevisionDetail;

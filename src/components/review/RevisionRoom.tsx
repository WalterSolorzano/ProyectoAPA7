/* WordAPA7 — Sala de Revisión, panorama (REV-L0). Solo navegación: aquí no se
   acepta nada. El % es SOLO revisión; el índice de IA no se mezcla. */
import React, { useMemo } from 'react';
import { ArrowLeft, Lock } from 'lucide-react';
import type { AuditItem, EngineId } from '../../lib/auditItems';
import type { ElementModel } from '../../types';
import { contarParrafos, cumplimiento } from '../../lib/informeRevision';
import { resumenMotores, calificacionPorFase, resumenObjetivos } from '../../lib/revisionResumen';
import { fraseDeRevision, colorDeRevision } from '../../lib/mascotaFrases';
import { MascotaFrase } from './MascotaFrase';
import { ENGINE_META } from '../../hooks/useReviewWorkbench';

export interface RevisionRoomProps {
  items: AuditItem[];
  elements: readonly ElementModel[];
  onOpenDetail: (foco: { motor?: EngineId; phase?: string }) => void;
  onOpenObjetivos: () => void;
  onBack: () => void;
}

export const RevisionRoom: React.FC<RevisionRoomProps> = ({ items, elements, onOpenDetail, onOpenObjetivos, onBack }) => {
  const revision = useMemo(() => items.filter((it) => it.category !== 'ai'), [items]);
  const parrafos = useMemo(() => contarParrafos(elements), [elements]);
  const calificacion = cumplimiento(revision.length, parrafos);
  const motores = useMemo(() => resumenMotores(revision), [revision]);
  const fases = useMemo(() => calificacionPorFase(revision, elements), [revision, elements]);
  const objetivos = useMemo(() => resumenObjetivos(elements), [elements]);
  const peor = [...motores].sort((a, b) => b.count - a.count)[0];

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg-canvas)' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginTop: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)' }}>Sala de Revisión</h2>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Motores objetivos · aceptar o aceptar todas, nunca borra tu texto</div>
          </div>
          <button type="button" onClick={onBack} style={fantasma}><ArrowLeft size={14} aria-hidden /> Volver</button>
        </div>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 'var(--space-5)', padding: 'var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div>
            <div style={eyebrow}>Calificación de revisión</div>
            <div data-testid="rev-calificacion" style={{ fontSize: 'clamp(34px, 5vw, 48px)', fontWeight: 800, lineHeight: 1, color: colorDeRevision(calificacion), fontVariantNumeric: 'tabular-nums' }}>{calificacion}<span style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text-tertiary)' }}>%</span></div>
            <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              {revision.length} de {parrafos} párrafos · 100 − 200·({revision.length}/{parrafos}) = {calificacion}. El índice de IA no se mezcla aquí.
            </div>
          </div>
          <MascotaFrase frase={peor ? `${fraseDeRevision(calificacion, 'rev')} Lo que más te baja: ${ENGINE_META[peor.motor].title}, ${peor.count} puntos.` : fraseDeRevision(calificacion, 'rev')} kind="highlighter" expression="worried" />
        </section>

        <section style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={eyebrow}>Motores objetivos · {revision.length} por revisar</div>
          {motores.map((m) => (
            <button key={m.motor} type="button" onClick={() => onOpenDetail({ motor: m.motor })} style={{ display: 'grid', gridTemplateColumns: '200px minmax(0,1fr) 130px 24px', alignItems: 'center', gap: 'var(--space-4)', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderTop: '1px solid var(--color-border-subtle)', padding: 'var(--space-3) var(--space-1)', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                <span aria-hidden style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center', background: ENGINE_META[m.motor].color, color: 'var(--color-text-on-accent)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>{ENGINE_META[m.motor].title[0]}</span>
                {ENGINE_META[m.motor].title}
              </span>
              <Severidad porSeveridad={m.porSeveridad} total={m.count} />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}><b style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>{m.count}</b> · {m.secciones} secciones</span>
              <span aria-hidden style={{ color: 'var(--color-text-tertiary)', textAlign: 'right' }}>›</span>
            </button>
          ))}
        </section>

        <section style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={eyebrow}>Objetivos · analizador propio (aparte)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '230px minmax(0,1fr)', gap: 'var(--space-5)', border: '1px solid var(--color-accent-a30)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
            <div style={{ borderRight: '1px solid var(--color-border-subtle)', paddingRight: 'var(--space-4)' }}>
              <div style={{ fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 800, color: 'var(--color-warning)' }}>{objetivos.nivelGeneral ?? '—'}<small style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}> /6</small></div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', marginTop: 'var(--space-1)' }}>Bloom · nivel 4 exigido</div>
              <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
                <Kpi n={`${objetivos.medibles}/${objetivos.especificos.length + (objetivos.general ? 1 : 0)}`} k="medibles" />
                <Kpi n={`${objetivos.conVariable}`} k="con variable" />
              </div>
              <button type="button" onClick={onOpenObjetivos} style={{ ...primario, marginTop: 'var(--space-4)' }}>Analizar objetivos</button>
            </div>
            <BloomMini objetivos={objetivos.general ? [objetivos.general, ...objetivos.especificos] : objetivos.especificos} />
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', border: '1px dashed var(--color-border-subtle)', borderRadius: 'var(--radius-sm)' }}>
            Objetivos no se mezcla con las fases: tiene reglas de método propias (verbo Bloom, medibilidad, jerarquía general/específicos).
          </div>
        </section>

        <section style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={eyebrow}>Fases del documento · calificación por fase (0–10)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)', height: 180, marginTop: 'var(--space-4)' }}>
            {fases.map((f) => (
              <button key={f.phase} type="button" onClick={() => onOpenDetail({ phase: f.phase })} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit', padding: 0 }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>{(f.calificacion / 10).toFixed(1)}</span>
                <span style={{ width: '100%', maxWidth: 46, height: `${f.calificacion}%`, borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', background: colorDeRevision(f.calificacion) }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4, textAlign: 'center', lineHeight: 1.2 }}>{f.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section style={{ padding: 'var(--space-5)' }}>
          <div style={eyebrow}>Portada</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', opacity: 0.72 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}><Lock size={13} aria-hidden /> Zona protegida · se mide, no se escribe · sin acciones</span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Bloqueada</span>
          </div>
        </section>
      </div>
    </div>
  );
};

const Severidad: React.FC<{ porSeveridad: Record<string, number>; total: number }> = ({ porSeveridad, total }) => {
  const orden: [string, string][] = [['critical', 'var(--color-danger)'], ['high', 'var(--color-warning)'], ['medium', 'var(--color-success)'], ['low', 'var(--color-text-tertiary)']];
  return (
    <span style={{ display: 'flex', height: 9, borderRadius: 'var(--radius-full)', overflow: 'hidden', border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface-alt)' }}>
      {orden.map(([sev, color]) => (
        <i key={sev} style={{ width: `${((porSeveridad[sev] ?? 0) / (total || 1)) * 100}%`, background: color, display: 'block' }} />
      ))}
    </span>
  );
};

const BloomMini: React.FC<{ objetivos: { verboActual: string; nivelActual: number | null; esGeneral: boolean }[] }> = ({ objetivos }) => {
  const NIVELES = ['Recordar', 'Comprender', 'Aplicar', 'Analizar', 'Evaluar', 'Crear'];
  return (
    <div>
      <div style={eyebrow}>Nivel cognitivo de cada objetivo (escala Bloom)</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
        {NIVELES.map((n, i) => <span key={n} style={{ flex: 1, textAlign: 'center' }}>{n}<div style={{ marginTop: 4, height: 8, borderTop: '2px solid var(--color-border-subtle)', position: 'relative' }}>{objetivos.map((o, j) => (o.nivelActual === i + 1 ? <i key={j} title={`${o.verboActual}${o.esGeneral ? ' (general)' : ''}`} style={{ position: 'absolute', top: -7, left: '50%', width: o.esGeneral ? 14 : 10, height: o.esGeneral ? 14 : 10, marginLeft: o.esGeneral ? -7 : -5, borderRadius: '50%', background: o.esGeneral ? 'var(--color-accent)' : 'var(--color-warning)' }} /> : null))}</div></span>)}
      </div>
    </div>
  );
};

const Kpi: React.FC<{ n: string; k: string }> = ({ n, k }) => (
  <span><span style={{ display: 'block', fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{n}</span><span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{k}</span></span>
);

const eyebrow: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 };
const primario: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-text-on-accent)', fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer' };
const fantasma: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', background: 'transparent', color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer' };

export default RevisionRoom;

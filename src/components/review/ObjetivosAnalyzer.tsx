/* WordAPA7 — Analizador de objetivos (REV-L2). Único analizador propio: el nivel
   Bloom y la jerarquía general/específicos no se ven párrafo a párrafo.
   Fidelidad visual: `docs/superpowers/mockups/2026-10-05-revision-ia-dos-salas/
   ui-6-analizador-objetivos.html`. Son reglas OBJETIVAS (Bloom, medibilidad y
   jerarquía), así que la propuesta sí se puede aplicar: la persona elige el verbo
   y confirma. Nada se escribe solo. */
import React, { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { ElementModel } from '../../types';
import { objetivosBloom, reemplazarVerbo, type ObjetivoBloom } from '../../lib/contentReview';
import { resumenObjetivos } from '../../lib/revisionResumen';
import { MascotaFrase } from './MascotaFrase';

export interface ObjetivosAnalyzerProps {
  elements: readonly ElementModel[];
  onApply: (elementId: string, texto: string) => void;
  onBack: () => void;
}

const NIVELES = ['Recordar', 'Comprender', 'Aplicar', 'Analizar', 'Evaluar', 'Crear'];
const NIVEL_EXIGIDO = 4;

export const ObjetivosAnalyzer: React.FC<ObjetivosAnalyzerProps> = ({ elements, onApply, onBack }) => {
  const resumen = useMemo(() => resumenObjetivos(elements), [elements]);
  const objetivos = useMemo(() => objetivosBloom(elements), [elements]);
  const general = resumen.general;
  const especificos = resumen.especificos;

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg-canvas)' }}>
      <div style={{ maxWidth: '900px', margin: 'var(--space-5) auto', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button type="button" onClick={onBack} style={fantasma}><ArrowLeft size={14} aria-hidden /> Sala de Revisión</button>
            <div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>Analizador de objetivos</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{general ? 1 : 0} general · {especificos.length} específicos · nivel Bloom, medibilidad y jerarquía</div>
            </div>
          </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 290px', gap: 'var(--space-5)', padding: 'var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)', alignItems: 'center' }}>
          <div>
            <span style={pastillaAlerta}>Requiere atención</span>
            <h3 style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-xl)', fontWeight: 750, color: 'var(--color-text-primary)' }}>{resumen.veredicto}</h3>
            <div style={{ display: 'flex', gap: 'var(--space-5)', marginTop: 'var(--space-4)' }}>
              <Stat n={`${general?.nivelActual ?? '—'}/6`} k="nivel del general" />
              <Stat n={`${resumen.medibles}/${objetivos.length}`} k="medibles" tono="var(--color-warning)" />
              <Stat n={`${resumen.conVariable}`} k="con variable" tono="var(--color-warning)" />
            </div>
          </div>
          <MascotaFrase frase={general && general.sinVariable ? '«Conocer» no se puede medir. Ni tú sabes cuándo terminaste.' : 'Cada objetivo, un verbo medible.'} kind="ruler" expression="worried" />
        </section>

        <section style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <EscalaBloom objetivos={objetivos} />
          <p style={nota}>La línea azul punteada marca el nivel exigido (Analizar, nivel {NIVEL_EXIGIDO}).</p>
        </section>

        <section style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={ancla}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
              <span style={{ ...eyebrow, color: 'var(--color-accent)' }}>Objetivo general</span>
              <span style={etiquetaAncla}>Ancla del análisis</span>
            </div>
            {general ? (
              <FilaObjetivo o={general} etiqueta="General" onApply={onApply} sinBorde />
            ) : (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>No se detectó un objetivo general.</p>
            )}
          </div>
        </section>

        <section style={{ padding: 'var(--space-5)' }}>
          <div style={{ paddingLeft: 'var(--space-4)', borderLeft: '2px dashed var(--color-accent-a30)' }}>
            <div style={{ ...eyebrow, color: 'var(--color-text-primary)' }}>Objetivos específicos · {especificos.length} <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--color-text-secondary)' }}>derivan del general · su nivel no debe superarlo</span></div>
            {especificos.map((o, i) => <FilaObjetivo key={o.elementId} o={o} etiqueta={`E${i + 1}`} onApply={onApply} />)}
          </div>
          <NotaJerarquia general={general} especificos={especificos} />
        </section>
      </div>
    </div>
  );
};

const FilaObjetivo: React.FC<{ o: ObjetivoBloom; etiqueta: string; onApply: (id: string, t: string) => void; sinBorde?: boolean }> = ({ o, etiqueta, onApply, sinBorde }) => {
  const [elegido, setElegido] = useState<string | null>(null);
  const hallazgo = o.sinVariable || o.tieneDosVerbos || o.nivelActual === null || o.nivelActual < NIVEL_EXIGIDO;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 250px', gap: 'var(--space-4)', padding: 'var(--space-3) 0', borderTop: sinBorde ? 'none' : '1px solid var(--color-border-subtle)' }}>
      <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5, color: 'var(--color-text-primary)' }}>
        <span style={{ fontWeight: 700, marginRight: 6 }}>{etiqueta}</span>{o.texto}
        <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
          <Tag ok={o.nivelActual !== null && !o.sinVariable} texto={`Nivel ${o.nivelActual ?? '—'}/6`} />
          <Tag ok={!o.sinVariable} texto={o.sinVariable ? 'Sin variable' : 'Declara variable'} />
        </div>
      </div>
      <div style={{ borderLeft: '1px solid var(--color-border-subtle)', paddingLeft: 'var(--space-4)' }}>
        {hallazgo && o.alternativas.length > 0 ? (
          <>
            <span style={eyebrow}>Propuesta</span>
            <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', margin: 'var(--space-2) 0' }}>
              {o.alternativas.map((alt) => (
                <button key={alt} type="button" onClick={() => setElegido(alt)} style={{ fontSize: 'var(--text-xs)', padding: '2px 9px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-accent)', color: elegido === alt ? 'var(--color-text-on-accent)' : 'var(--color-accent)', background: elegido === alt ? 'var(--color-accent)' : 'transparent', cursor: 'pointer' }}>{alt}</button>
              ))}
            </div>
            <button type="button" disabled={!elegido} onClick={() => elegido && onApply(o.elementId, reemplazarVerbo(o.texto, elegido))} style={{ ...primario, opacity: elegido ? 1 : 0.5 }}>Aplicar</button>
          </>
        ) : (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>Cumple. Sin acciones.</span>
        )}
      </div>
    </div>
  );
};

const EscalaBloom: React.FC<{ objetivos: ObjetivoBloom[] }> = ({ objetivos }) => {
  let especificos = 0;
  return (
    <div>
      <div style={eyebrow}>Nivel cognitivo (Bloom) por objetivo</div>
      <div style={{ position: 'relative', height: 84, margin: 'var(--space-4) var(--space-4) 0' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 44, height: 2, background: 'var(--color-border-subtle)' }} />
        <div style={{ position: 'absolute', top: 30, bottom: 52, left: `${((NIVEL_EXIGIDO - 1) / 5) * 100}%`, borderLeft: '2px dashed var(--color-accent)', opacity: 0.55 }} />
        {NIVELES.map((n, i) => (
          <React.Fragment key={n}>
            <span style={{ position: 'absolute', top: 44, left: `${(i / 5) * 100}%`, width: 1, height: 9, background: 'var(--color-border-strong)' }} />
            <span style={{ position: 'absolute', top: 56, left: `${(i / 5) * 100}%`, transform: 'translateX(-50%)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>{n}</span>
          </React.Fragment>
        ))}
        {objetivos.map((o) => {
          if (o.nivelActual === null) return null;
          if (!o.esGeneral) especificos += 1;
          const etiqueta = o.esGeneral ? 'General' : `E${especificos}`;
          return (
            <span key={o.elementId} style={{ position: 'absolute', top: 44, left: `${((o.nivelActual - 1) / 5) * 100}%`, transform: 'translate(-50%,-50%)' }}>
              <span style={{ position: 'absolute', bottom: 15, left: '50%', transform: 'translateX(-50%)', fontSize: 'var(--text-xs)', fontWeight: 700, whiteSpace: 'nowrap', color: o.esGeneral ? 'var(--color-accent)' : 'var(--color-warning)' }}>{etiqueta}</span>
              <span style={{ display: 'block', width: o.esGeneral ? 14 : 10, height: o.esGeneral ? 14 : 10, borderRadius: '50%', background: o.esGeneral ? 'var(--color-accent)' : 'var(--color-warning)', border: '2px solid var(--color-bg-surface)' }} />
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** Solo se dibuja cuando hay general y al menos un específico: sin ancla no hay
 *  jerarquía que juzgar. */
const NotaJerarquia: React.FC<{ general: ObjetivoBloom | null; especificos: ObjetivoBloom[] }> = ({ general, especificos }) => {
  if (!general || especificos.length === 0) return null;
  const nGen = general.nivelActual;
  const superan = nGen === null ? [] : especificos.filter((o) => o.nivelActual !== null && o.nivelActual > nGen);
  const coherente = superan.length === 0;
  return (
    <div style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', background: coherente ? 'var(--color-success-a12)' : 'var(--color-warning-a12)', border: `1px solid ${coherente ? 'var(--color-success-a14)' : 'var(--color-warning-a30)'}`, borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)' }}>
      <b>{coherente ? 'Jerarquía coherente:' : 'Revisá la jerarquía:'}</b>{' '}
      {coherente ? 'ningún específico apunta más alto que el ancla.' : 'un específico apunta a un nivel mayor que el ancla.'}
    </div>
  );
};

const Tag: React.FC<{ ok: boolean; texto: string }> = ({ ok, texto }) => (
  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-sm)', border: `1px solid ${ok ? 'var(--color-success-a14)' : 'var(--color-danger-a30)'}`, color: ok ? 'var(--color-success)' : 'var(--color-danger)' }}>{texto}</span>
);

const Stat: React.FC<{ n: string; k: string; tono?: string }> = ({ n, k, tono }) => (
  <span><span style={{ display: 'block', fontSize: 'var(--text-xl)', fontWeight: 750, color: tono ?? 'var(--color-accent)' }}>{n}</span><span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{k}</span></span>
);

const eyebrow: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 };
const nota: React.CSSProperties = { margin: 'var(--space-3) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' };
const pastillaAlerta: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', padding: '2px 8px', borderRadius: 'var(--radius-full)', color: 'var(--color-warning)', background: 'var(--color-warning-a12)', border: '1px solid var(--color-warning-a30)' };
const ancla: React.CSSProperties = { border: '1px solid var(--color-accent-a30)', background: 'var(--color-accent-a05)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-4)' };
const etiquetaAncla: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-accent)', border: '1px solid var(--color-accent-a40)', borderRadius: 'var(--radius-full)', padding: '1px 8px' };
const primario: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: 'var(--color-text-on-accent)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer' };
const fantasma: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', background: 'transparent', color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer' };

export default ObjetivosAnalyzer;

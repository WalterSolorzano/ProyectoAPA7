import React, { useMemo, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, ShieldAlert, SpellCheck, Loader2, RefreshCw, Sparkles, Check, Edit3,
} from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import * as api from '../../api/backend';
import type { AIReviewParagraph } from '../../api/backend';

type Flag = {
  start: number;
  end: number;
  kind: 'ai' | 'spelling';
  severity: string;
  detail: string;
  suggestions?: string[];
};

function findFlags(p: AIReviewParagraph): Flag[] {
  const flags: Flag[] = [];
  const text = p.text;
  const lower = text.toLowerCase();

  for (const f of p.findings) {
    const phraseList: string[] = (f as any).phrases?.length ? (f as any).phrases : [f.phrase || ''];
    for (const rawPhrase of phraseList) {
      const phrase = (rawPhrase || '').toLowerCase();
      if (!phrase) continue;
      if (phrase.startsWith('(') && phrase.endsWith(')')) continue; // marcador simbólico
      let idx = lower.indexOf(phrase);
      while (idx >= 0) {
        flags.push({
          start: idx,
          end: idx + phrase.length,
          kind: 'ai',
          severity: f.severity,
          detail: f.detail,
        });
        idx = lower.indexOf(phrase, idx + phrase.length);
      }
    }
  }

  for (const s of p.spelling) {
    const w = (s.word || '').toLowerCase();
    if (!w) continue;
    let idx = lower.indexOf(w);
    while (idx >= 0) {
      flags.push({
        start: idx,
        end: idx + w.length,
        kind: 'spelling',
        severity: 'HIGH',
        detail: `Posible error ortográfico: "${s.word}"`,
        suggestions: s.suggestions,
      });
      idx = lower.indexOf(w, idx + w.length);
    }
  }

  // ordenar por posición; en colisiones, priorizar spelling
  flags.sort((a, b) => a.start - b.start || (a.kind === 'spelling' ? -1 : 1));
  return flags;
}

function renderText(text: string, flags: Flag[]): React.ReactNode[] {
  if (flags.length === 0) return [text];
  const out: React.ReactNode[] = [];
  let cursor = 0;
  // evitar superposición tomando el primer flag que no se solape con el anterior consumido
  const used: Flag[] = [];
  for (const f of flags) {
    if (f.start < cursor) continue;
    used.push(f);
    cursor = f.end;
  }
  cursor = 0;
  for (let i = 0; i < used.length; i++) {
    const f = used[i];
    if (f.start > cursor) out.push(text.slice(cursor, f.start));
    const frag = text.slice(f.start, f.end);
    const color =
      f.kind === 'spelling' ? 'var(--color-danger)' :
      f.severity === 'HIGH' ? 'var(--color-danger)' :
      f.severity === 'MEDIUM' ? 'var(--color-warning)' : 'var(--color-info)';
    const bg =
      f.kind === 'spelling' ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)' :
      f.severity === 'HIGH' ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)' :
      f.severity === 'MEDIUM' ? 'color-mix(in srgb, var(--color-warning) 10%, transparent)' : 'color-mix(in srgb, var(--color-info) 8%, transparent)';
    const deco = f.kind === 'spelling' ? 'underline wavy var(--color-danger)' : 'underline dotted ' + color;
    out.push(
      <mark
        key={`f-${i}`}
        title={f.detail}
        style={{
          color,
          backgroundColor: bg,
          textDecoration: deco,
          borderRadius: '2px',
          padding: '0 1px',
          fontWeight: f.kind === 'spelling' ? 600 : 500,
        }}
      >
        {frag}
      </mark>
    );
    cursor = f.end;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function sevColor(sev: string): string {
  return sev === 'HIGH' ? 'var(--accent-danger)' : sev === 'MEDIUM' ? 'var(--accent-warning)' : 'var(--accent-primary)';
}

function scoreColor(score: number): string {
  if (score >= 50) return 'var(--accent-danger)';
  if (score >= 25) return 'var(--accent-warning)';
  return 'var(--accent-success)';
}

export const ReviewPanel: React.FC = () => {
  const {
    reviewResult, isReviewLoading, isReviewOpen,
    setReviewOpen, runAIReview, doc, updateElementType,
    applyRewriteVariation, apiKey,
  } = useDocStore();

  const [filter, setFilter] = useState<'all' | 'flagged' | 'spelling'>('flagged');
  const [cursor, setCursor] = useState(0);
  const [variations, setVariations] = useState<string[] | null>(null);
  const [varLoading, setVarLoading] = useState(false);
  const [varProvider, setVarProvider] = useState<string>('');
  const [selectedVar, setSelectedVar] = useState<number | null>(null);
  const [asTracked, setAsTracked] = useState(true);

  const list = useMemo(() => {
    if (!reviewResult) return [];
    if (filter === 'flagged') return reviewResult.paragraphs.filter(p => p.ai_score >= 25 || p.spelling.length > 0);
    if (filter === 'spelling') return reviewResult.paragraphs.filter(p => p.spelling.length > 0);
    return reviewResult.paragraphs;
  }, [reviewResult, filter]);

  const current = list[cursor];

  // Reset variaciones al cambiar de párrafo o cerrar
  const paragraphKey = current?.element_id;
  React.useEffect(() => {
    setVariations(null); setSelectedVar(null); setVarProvider('');
  }, [paragraphKey]);

  if (!isReviewOpen) return null;

  const close = () => setReviewOpen(false);

  const handleDiscardAsHeading = (el: any) => {
    // no-op placeholder: integración futura con reescritura IA
  };

  return (
    <div
      role="dialog"
      aria-label="Revisor IA y ortografía"
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1180px, 96vw)', height: 'min(720px, 92vh)',
          backgroundColor: 'var(--app-bg)', color: 'var(--text-main)',
          borderRadius: '12px', boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          display: 'flex', overflow: 'hidden', fontFamily: 'var(--font-sans)',
        }}
      >
        {/* ── Columna izquierda: resumen + lista ── */}
        <div style={{ width: '248px', flexShrink: 0, borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', background: 'var(--sidebar-bg)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <strong style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={15} color="var(--accent-primary)" /> Revisor IA
              </strong>
              <button type="button" onClick={close} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }} aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>

            {isReviewLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Analizando documento…
                <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
              </div>
            ) : reviewResult ? (
              <>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <Metric label="IA promedio" value={`${reviewResult.ai_avg_score}%`} color={scoreColor(reviewResult.ai_avg_score)} />
                  <Metric label="Bandera" value={`${reviewResult.flagged_count}`} color="var(--accent-warning)" />
                  <Metric label="Ortografía" value={`${reviewResult.spelling_count}`} color="var(--accent-danger)" />
                </div>
                {(reviewResult.document_signals?.length > 0 || reviewResult.table_signals?.length > 0) && (
                  <div style={{ marginBottom: '10px', padding: '8px', borderRadius: '8px', background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.25)' }}>
                    {reviewResult.document_signals?.map((s, i) => (
                      <div key={`ds-${i}`} style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--accent-warning)' }}>⚠</span>
                        <span>{s}</span>
                      </div>
                    ))}
                    {reviewResult.table_signals?.map((ts, i) => (
                      <div key={`ts-${i}`} style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--accent-warning)' }}>▦</span>
                        <span>{ts.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => runAIReview()}
                  disabled={!doc || isReviewLoading}
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  <RefreshCw size={12} /> Volver a analizar
                </button>
                {reviewResult.spelling_status !== 'ok' && (
                  <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    Ortografía: {reviewResult.spelling_status === 'not_run' || reviewResult.spelling_status === 'no_original'
                      ? 'requiere el .docx original (Word COM)'
                      : reviewResult.spelling_status}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Sin resultados.</div>
            )}
          </div>

          {reviewResult && !isReviewLoading && (
            <>
              <div style={{ display: 'flex', padding: '6px 10px', gap: '6px' }}>
                {(['flagged', 'all', 'spelling'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { setFilter(f); setCursor(0); }}
                    style={{
                      flex: 1, padding: '4px 6px', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: '11px', fontWeight: 600,
                      background: filter === f ? 'var(--accent-primary)' : 'transparent',
                      color: filter === f ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid ' + (filter === f ? 'var(--accent-primary)' : 'var(--border-subtle)'),
                    }}
                  >
                    {f === 'flagged' ? 'Señaladas' : f === 'all' ? 'Todas' : 'Ortografía'}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {list.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    Ningún párrafo coincide con el filtro.
                  </div>
                )}
                {list.map((p, i) => {
                  const active = i === cursor;
                  const flags = findFlags(p);
                  return (
                    <button
                      key={p.element_id}
                      type="button"
                      onClick={() => setCursor(i)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 12px', cursor: 'pointer',
                        background: active ? 'rgba(79,124,255,0.14)' : 'transparent',
                        border: 'none', borderBottom: '1px solid var(--border-subtle)',
                        borderLeft: active ? '3px solid var(--accent-primary)' : '3px solid transparent',
                        fontFamily: 'inherit', color: 'var(--text-main)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>#{p.index + 1} · {p.type}</span>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '999px',
                          backgroundColor: 'var(--color-bg-surface-hover)',
                          color: p.ai_category === 'HIGH' ? 'var(--accent-danger)'
                            : p.ai_category === 'MEDIUM' ? 'var(--accent-warning)' : 'var(--accent-success)',
                          border: '1px solid var(--border-subtle)',
                        }}>
                          IA {p.ai_score}%
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-main)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {renderText(p.text, flags)}
                      </div>
                      {(p.findings.length > 0 || p.spelling.length > 0) && (
                        <div style={{ marginTop: '4px', display: 'flex', gap: '6px', fontSize: '10px' }}>
                          {p.findings.length > 0 && <span style={{ color: 'var(--accent-warning)' }}>{p.findings.length} hallazgo(s) IA</span>}
                          {p.spelling.length > 0 && <span style={{ color: 'var(--accent-danger)' }}>{p.spelling.length} ortog.</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Columna derecha: detalle del párrafo ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <SpellCheck size={14} color="var(--accent-primary)" />
              {reviewResult && current
                ? <><strong style={{ color: 'var(--text-main)' }}>{current.index + 1}</strong> / {list.length}</>
                : 'Revisor de párrafos'}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={() => setCursor(c => Math.max(0, c - 1))} disabled={cursor <= 0}
                style={navBtn(cursor <= 0)}>
                <ChevronLeft size={14} /> Anterior
              </button>
              <button type="button" onClick={() => setCursor(c => Math.min(list.length - 1, c + 1))} disabled={cursor >= list.length - 1}
                style={navBtn(cursor >= list.length - 1)}>
                Siguiente <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {isReviewLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Analizando…
              </div>
            )}
            {!isReviewLoading && !current && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                {reviewResult && reviewResult.total_paragraphs === 0
                  ? 'El documento no tiene párrafos de texto para revisar.'
                  : 'Seleccioná un párrafo a la izquierda o ejecutá el análisis.'}
              </div>
            )}
            {!isReviewLoading && current && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <span style={{
                    fontSize: '13px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px',
                    backgroundColor: 'var(--color-bg-surface-hover)',
                    color: current.ai_category === 'HIGH' ? 'var(--accent-danger)'
                      : current.ai_category === 'MEDIUM' ? 'var(--accent-warning)' : 'var(--accent-success)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    Riesgo IA: {current.ai_score}%
                  </span>
                  {current.spelling.length > 0 && (
                    <span style={{
                      fontSize: '12px', fontWeight: 600, padding: '3px 9px', borderRadius: '999px',
                      backgroundColor: 'rgba(255,77,79,0.14)', color: 'var(--accent-danger)',
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                    }}>
                      <SpellCheck size={12} /> {current.spelling.length} error(es) ortográfico(s)
                    </span>
                  )}
                </div>

                <div style={{
                  background: 'var(--color-paper, #ffffff)',
                  color: 'var(--color-text-primary, #1a1a1a)',
                  border: '1px solid var(--color-border-subtle)',
                  padding: '22px 26px', borderRadius: '8px', fontSize: '14px', lineHeight: 1.8,
                  fontFamily: '"Times New Roman", Georgia, serif', boxShadow: 'var(--shadow-sm)',
                  marginBottom: '18px', minHeight: '90px',
                }}>
                  {renderText(current.text, findFlags(current))}
                </div>

                {current.findings.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldAlert size={13} /> Hallazgos de IA ({current.findings.length})
                    </div>
                    {current.findings.map((f, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: '10px', padding: '8px 10px', marginBottom: '6px',
                        borderRadius: '6px', background: 'rgba(79,124,255,0.06)',
                        borderLeft: `3px solid ${sevColor(f.severity)}`,
                      }}>
                        <div style={{ flexShrink: 0, fontSize: '11px', fontWeight: 700, color: sevColor(f.severity), minWidth: '48px' }}>
                          {f.severity}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                          {f.detail}
                          {f.phrase && !f.phrase.startsWith('(') && (
                            <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>
                              — frase: «{f.phrase}»
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {current.spelling.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <SpellCheck size={13} /> Ortografía ({current.spelling.length})
                    </div>
                    {current.spelling.map((s, i) => (
                      <div key={i} style={{
                        padding: '8px 10px', marginBottom: '6px', borderRadius: '6px',
                        background: 'rgba(255,77,79,0.06)', borderLeft: '3px solid var(--accent-danger)',
                      }}>
                        <div style={{ fontSize: '12px' }}>
                          <strong style={{ color: 'var(--accent-danger)' }}>{s.word}</strong>
                          {s.suggestions && s.suggestions.length > 0 ? (
                            <>
                              <span style={{ color: 'var(--text-secondary)' }}> → sugerencias: </span>
                              {s.suggestions.map((sg, j) => (
                                <span key={j} style={sugChip}>{sg}</span>
                              ))}
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}> — sin sugerencias</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {current.findings.length === 0 && current.spelling.length === 0 && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Este párrafo no presenta señales destacadas.
                  </div>
                )}
              </>
            )}
          </div>

          {current && !isReviewLoading && (
            <>
              {/* Sección de reescritura IA con variaciones (propuesta 2 + track changes IA) */}
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--sidebar-bg)' }}>
                {/* Cabecera de la sección */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={13} color="var(--accent-primary)" /> Reescritura IA
                  </span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={asTracked}
                      onChange={(e) => setAsTracked(e.target.checked)}
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    Aplicar como Track Changes (autor "IA")
                  </label>
                </div>

                {/* Acciones de generación */}
                {variations === null && !varLoading && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!doc || !current) return;
                        setVarLoading(true);
                        try {
                          const findings = current.findings
                            .map(f => f.phrase)
                            .filter(p => p && !p.startsWith('('));
                          const instruction =
                            'Reescribe en español académico APA 7, eliminando las muletillas de IA: '
                            + (findings.length ? findings.join(', ') : 'en conclusión, no obstante, es importante destacar')
                            + '. Varía la longitud de las oraciones.';
                          const res = await api.rewriteVariations(
                            doc.session_id, current.element_id, current.text, instruction, 3, apiKey,
                          );
                          setVariations(res.variations);
                          setVarProvider(`${res.provider} (${res.provider_id})`);
                          setSelectedVar(0);
                        } catch (err: any) {
                          useDocStore.getState().showToast(err.message || 'Error al generar variaciones', 'error');
                        } finally {
                          setVarLoading(false);
                        }
                      }}
                      style={{
                        padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
                        background: 'var(--accent-primary)', border: 'none', color: '#fff',
                        fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600,
                      }}
                    >
                      <Sparkles size={12} /> Generar 3 versiones
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const text = current?.text || '';
                        navigator.clipboard?.writeText(text);
                        useDocStore.getState().showToast('Párrafo copiado', 'info');
                      }}
                      style={{
                        padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      <Edit3 size={12} /> Copiar original
                    </button>
                  </div>
                )}

                {/* Spinner de generación */}
                {varLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Generando variaciones… <span style={{ color: 'var(--text-tertiary)' }}>({varProvider || 'proveedor IA'})</span>
                  </div>
                )}

                {/* Variaciones generadas */}
                {variations && variations.length > 0 && !varLoading && (
                  <div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {variations.map((v, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedVar(i)}
                          style={{
                            padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit',
                            fontSize: '11px', fontWeight: 600,
                            background: selectedVar === i ? 'var(--accent-primary)' : 'rgba(79,124,255,0.1)',
                            color: selectedVar === i ? '#fff' : 'var(--accent-primary)',
                            border: '1px solid ' + (selectedVar === i ? 'var(--accent-primary)' : 'rgba(79,124,255,0.4)'),
                          }}
                        >
                          Versión {String.fromCharCode(65 + i)}
                        </button>
                      ))}
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', alignSelf: 'center' }}>
                        por {varProvider}
                      </span>
                    </div>
                    <div style={{
                      background: 'var(--canvas-bg, #fff)', color: '#1a1a1a',
                      padding: '12px 14px', borderRadius: '6px', fontSize: '13px', lineHeight: 1.7,
                      fontFamily: '"Times New Roman", serif', marginBottom: '8px', maxHeight: '140px', overflowY: 'auto',
                    }}>
                      {variations[selectedVar ?? 0]}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => { setVariations(null); setSelectedVar(null); setVarProvider(''); }}
                        style={secondaryBtn}
                      >Descartar</button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (current && variations[selectedVar ?? 0]) {
                            await applyRewriteVariation(current.element_id, variations[selectedVar ?? 0], asTracked);
                            setVariations(null); setSelectedVar(null); setVarProvider('');
                          }
                        }}
                        style={{
                          padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
                          background: 'var(--accent-primary)', border: 'none', color: '#fff',
                          fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600,
                        }}
                      >
                        <Check size={12} /> Aplicar {asTracked ? '(Track Changes)' : ''}
                      </button>
                    </div>
                  </div>
                )}

                {!variations && !varLoading && current && current.findings.length === 0 && current.spelling.length === 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    Párrafo limpio — no hay disparadores de IA; la reescritura es opcional.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const secondaryBtn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-secondary)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
};

const navBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer',
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-secondary)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px',
  opacity: disabled ? 0.4 : 1, fontFamily: 'inherit',
});

const sugChip: React.CSSProperties = {
  display: 'inline-block', padding: '2px 8px', marginRight: '4px',
  borderRadius: '999px', backgroundColor: 'color-mix(in srgb, var(--accent-success) 14%, transparent)', color: 'var(--accent-success)',
  fontWeight: 600, fontSize: '11px',
};

const Metric: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
    <div style={{ fontSize: '16px', fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
  </div>
);
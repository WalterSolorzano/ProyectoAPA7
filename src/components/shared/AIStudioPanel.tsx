import React, { useEffect, useState } from 'react';
import {
  X, Activity, Cpu, Zap, AlertTriangle, CheckCircle2, Clock, Database,
  RefreshCw, ArrowRight, Wand2, ShieldAlert, Link2, Sparkles, BookOpen, Loader2,
} from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { citationSurname, refSurnameMatches } from '../../lib/citationMatcher';
import { syncAllProviderKeys } from '../../api/backend';

export const AIStudioPanel: React.FC = () => {
  const {
    aiStudioOpen, setAiStudioOpen,
    providerStatus, fetchProviderStatus,
    llmProgress, llmUsageStats, nimLogs,
    runLLMClassify, runAIReview,
    preflightReport, doc, isLoading,
  } = useDocStore();

  const [tab, setTab] = useState<'providers' | 'citas' | 'logs' | 'preflight'>('providers');
  const [syncState, setSyncState] = useState<{ status: 'idle' | 'syncing' | 'ok' | 'error'; applied: number; error?: string }>({ status: 'idle', applied: 0 });

  const doSync = async () => {
    setSyncState((s) => ({ ...s, status: 'syncing' }));
    const r = await syncAllProviderKeys();
    setSyncState({
      status: r.ok ? 'ok' : 'error',
      applied: r.applied.length,
      error: r.error,
    });
    await fetchProviderStatus();
  };

  // Refresca estado de proveedores periódicamente mientras el panel está abierto
  useEffect(() => {
    if (!aiStudioOpen) return;
    doSync();
    const t = setInterval(doSync, 8000);
    return () => clearInterval(t);
  }, [aiStudioOpen]);

  if (!aiStudioOpen) return null;

  const fallbacks = llmProgress.provider_fallbacks || [];
  const activeProviders = providerStatus?.providers.filter(p => p.active) || [];

  return (
    <div
      role="dialog"
      aria-label="IA Studio"
      style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: '380px',
        backgroundColor: 'var(--sidebar-bg)', color: 'var(--text-main)',
        borderLeft: '1px solid var(--border-subtle)', boxShadow: '-8px 0 24px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', zIndex: 8000,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={15} color="var(--accent-primary)" /> IA Studio
        </strong>
        <button
          type="button"
          onClick={() => setAiStudioOpen(false)}
          aria-label="Cerrar"
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
        {([
          ['providers', 'Proveedores'],
          ['citas', 'Citas'],
          ['logs', 'Actividad'],
          ['preflight', 'Pre-flight'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              flex: 1, padding: '10px 8px', cursor: 'pointer', fontFamily: 'inherit',
              background: tab === id ? 'rgba(79,124,255,0.10)' : 'transparent',
              border: 'none', borderBottom: tab === id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: tab === id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '12px', fontWeight: 600,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* ── Pestaña Proveedores ── */}
        {tab === 'providers' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {providerStatus?.total_active ?? 0} activos · {providerStatus?.total_configured ?? 0} claves guardadas
              </span>
              <button
                type="button"
                onClick={doSync}
                style={{
                  background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '6px',
                  padding: '3px 6px', cursor: 'pointer', color: 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px',
                }}
              >
                <RefreshCw size={11} /> Refrescar
              </button>
            </div>

            {syncState.status !== 'idle' && (
              <div style={{
                padding: '10px 12px', marginBottom: '12px', borderRadius: '8px', fontSize: '11px', lineHeight: 1.5,
                backgroundColor: syncState.status === 'ok' ? 'color-mix(in srgb, var(--accent-success) 8%, transparent)' : syncState.status === 'error' ? 'color-mix(in srgb, var(--color-danger) 8%, transparent)' : 'rgba(79,124,255,0.08)',
                border: '1px solid ' + (syncState.status === 'ok' ? 'color-mix(in srgb, var(--accent-success) 30%, transparent)' : syncState.status === 'error' ? 'color-mix(in srgb, var(--color-danger) 30%, transparent)' : 'rgba(79,124,255,0.3)'),
                color: 'var(--text-main)',
              }}>
                {syncState.status === 'syncing' && <>Sincronizando claves guardadas con el backend…</>}
                {syncState.status === 'ok' && (
                  syncState.applied > 0
                    ? <>✓ {syncState.applied} clave(s) sincronizada(s) con el backend.</>
                    : <>No hay claves guardadas en este dispositivo. Usá «Abrir estudio y añadir clave» para configurar al menos una.</>
                )}
                {syncState.status === 'error' && (
                  <>✗ No se pudo sincronizar con el backend: <strong>{syncState.error}</strong> Verificá que el servidor esté corriendo.</>
                )}
              </div>
            )}

            {activeProviders.length === 0 && (
              <div style={{
                padding: '14px', marginBottom: '14px', borderRadius: '10px',
                backgroundColor: 'rgba(250,173,20,0.10)', border: '1px solid rgba(250,173,20,0.35)',
                color: 'var(--text-main)', fontSize: '12px', lineHeight: 1.5,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <AlertTriangle size={14} color="var(--accent-warning)" />
                  <strong>Sin claves configuradas</strong>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Sin una API key, la clasificación funciona con reglas heurísticas (sin IA). Para usar NVIDIA, Groq, OpenRouter y otros, abrí el estudio de ajustes y guardá al menos una clave.
                </p>
                <button
                  type="button"
                  onClick={() => { setAiStudioOpen(false); useDocStore.getState().setSettingsStudioOpen(true); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '6px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                    background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '6px',
                  }}
                >
                  <Wand2 size={12} /> Abrir estudio y añadir clave
                </button>
              </div>
            )}

            {providerStatus?.providers.map(p => (
              <div key={p.id} style={{
                padding: '10px', marginBottom: '8px', borderRadius: '8px',
                backgroundColor: p.active ? 'color-mix(in srgb, var(--accent-success) 6%, transparent)' : 'rgba(255,255,255,0.03)',
                border: '1px solid ' + (p.active ? 'color-mix(in srgb, var(--accent-success) 25%, transparent)' : 'var(--border-subtle)'),
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{p.name}</span>
                  {p.active ? (
                    <span style={{ fontSize: '10px', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                      <Activity size={10} /> ACTIVO
                    </span>
                  ) : (
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>inactivo</span>
                  )}
                </div>
                {p.capacity && (
                  <div style={{ display: 'flex', gap: '10px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    <span><Clock size={9} style={{ verticalAlign: 'middle' }} /> {p.capacity.typical_latency_s}s</span>
                    <span><Zap size={9} style={{ verticalAlign: 'middle' }} /> {p.capacity.max_tokens} tk</span>
                    <span style={{ textTransform: 'capitalize' }}>{p.id}</span>
                  </div>
                )}
              </div>
            ))}

            {!providerStatus && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Cargando proveedores…</div>
            )}

            {/* Métricas de uso */}
            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'rgba(79,124,255,0.06)', border: '1px solid rgba(79,124,255,0.2)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Uso acumulado
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                <Metric label="Tokens" value={String(llmUsageStats.total_tokens || 0)} icon={<Database size={11} />} />
                <Metric label="Llamadas" value={String(llmUsageStats.api_calls || 0)} icon={<Wand2 size={11} />} />
                <Metric label="Caché hits" value={String(llmUsageStats.cache_hits || 0)} icon={<CheckCircle2 size={11} />} />
                <Metric label="Provs" value={String((llmUsageStats.providers_used || []).length)} icon={<Cpu size={11} />} />
              </div>
            </div>
          </div>
        )}

        {/* ── Pestaña Citas: trazador unificado (citas texto ↔ bibliografía) ── */}
        {tab === 'citas' && (
          <div>
            {!doc && (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                Cargá un documento para ver el trazado de citas vs referencias.
              </div>
            )}
            {doc && <CitationTracerEmbed />}
          </div>
        )}

        {/* ── Pestaña Actividad (logs en vivo) ── */}
        {tab === 'logs' && (
          <div>
            {fallbacks.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
                  Cadena de fallback
                </div>
                {fallbacks.map((f: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--accent-danger)' }}>{f.from}</span>
                    <ArrowRight size={11} color="var(--text-tertiary)" />
                    <span style={{ color: 'var(--accent-success)' }}>{f.to}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>— {f.reason || 'fallback'}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
              Historial de solicitudes ({nimLogs.length})
            </div>
            {nimLogs.length === 0 && (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Sin actividad todavía. Ejecuta una acción IA para ver el flujo.</div>
            )}
            {nimLogs.map((log: any) => (
              <div key={log.id} style={{
                padding: '8px', marginBottom: '6px', borderRadius: '6px',
                background: log.status === 'error' ? 'rgba(255,77,79,0.06)' : 'rgba(255,255,255,0.03)',
                borderLeft: '3px solid ' + (log.status === 'error' ? 'var(--accent-danger)' : 'var(--accent-primary)'),
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{log.endpoint}</span>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
                    color: log.status === 'success' ? 'var(--accent-success)' : 'var(--accent-danger)',
                    background: log.status === 'success' ? 'color-mix(in srgb, var(--accent-success) 10%, transparent)' : 'rgba(255,77,79,0.1)',
                  }}>
                    {log.statusCode}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-main)', lineHeight: 1.4 }}>{log.message}</div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  <span>{log.tokensUsed} tk</span>
                  <span>{(log.durationMs / 1000).toFixed(1)}s</span>
                  <span style={{ textTransform: 'capitalize' }}>{log.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Pestaña Pre-flight accionable ── */}
        {tab === 'preflight' && (
          <div>
            {!preflightReport && !doc && (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Carga un documento y ejecuta el análisis para ver el pre-flight.</div>
            )}
            {preflightReport && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={13} color="var(--accent-primary)" /> Reporte de clasificación
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  <Metric label="Títulos" value={String(preflightReport.headings)} icon={<Wand2 size={11} />} />
                  <Metric label="Figuras" value={String(preflightReport.figures)} icon={<Cpu size={11} />} />
                  <Metric label="Tablas" value={String(preflightReport.tables)} icon={<Cpu size={11} />} />
                  <Metric label="Párrafos" value={String(preflightReport.paragraphs)} icon={<Database size={11} />} />
                </div>

                {(preflightReport.flaggedHigh > 0 || preflightReport.flaggedMedium > 0) && (
                  <div style={{
                    padding: '10px', borderRadius: '8px', marginBottom: '12px',
                    background: preflightReport.flaggedHigh > 0 ? 'rgba(255,77,79,0.08)' : 'rgba(250,173,20,0.08)',
                    border: '1px solid ' + (preflightReport.flaggedHigh > 0 ? 'rgba(255,77,79,0.3)' : 'rgba(250,173,20,0.3)'),
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: preflightReport.flaggedHigh > 0 ? 'var(--accent-danger)' : 'var(--accent-warning)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={13} />
                      {preflightReport.flaggedHigh} párrafos con riesgo IA alto · {preflightReport.flaggedMedium} medios
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Abrí el Revisor para verlos uno por uno y reescribirlos con IA.</div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button type="button" onClick={() => runLLMClassify()} disabled={isLoading || !doc}
                    style={actionBtn(isLoading || !doc)}>
                    <Wand2 size={12} /> Refinar clasificación con IA
                  </button>
                  <button type="button" onClick={() => runAIReview()} disabled={isLoading || !doc}
                    style={actionBtn(isLoading || !doc)}>
                    <ShieldAlert size={12} /> Abrir Revisor IA + Ortografía
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const actionBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '9px 12px', borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
  background: 'var(--accent-primary)', border: 'none', color: '#fff',
  fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 600,
  opacity: disabled ? 0.5 : 1,
});

/** Trazador compacto de citas ↔ referencias embebido en el IA Studio. */
const CitationTracerEmbed: React.FC = () => {
  const {
    doc, references, validationIssues,
    citationAuditResult, runCitationAudit, isLoading, setWizardStep,
  } = useDocStore();

  const [hovered, setHovered] = useState<number | null>(null);

  const citas = (doc?.citas_intext || []) as any[];
  const refs = references || [];
  const ghost = citationAuditResult?.ghost_citations || [];
  const orphan = citationAuditResult?.orphan_references || [];

  // Emparejar cita → referencia (primera coincidencia de apellido)
  const pairs = citas.map((cit: any, ci: number) => {
    const surname = citationSurname(cit);
    const ri = refs.findIndex((r: any) => refSurnameMatches(r, surname));
    return { ci, ri, ghost: ri < 0 };
  });

  const usedRefs = new Set(pairs.filter((p) => !p.ghost).map((p) => p.ri));
  const orphanIdx = refs.map((_, ri) => ri).filter((ri) => !usedRefs.has(ri));

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <button
          type="button"
          onClick={() => runCitationAudit()}
          disabled={isLoading}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            padding: '7px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '6px',
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          {isLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
          Analizar citas
        </button>
        <button
          type="button"
          onClick={() => setWizardStep(5)}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 8px', fontSize: '11px', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)', borderRadius: '6px',
          }}
        >
          <BookOpen size={12} /> Referencias
        </button>
      </div>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <Metric label="Citas texto" value={String(citas.length)} icon={<Link2 size={11} />} />
        <Metric label="Referencias" value={String(refs.length)} icon={<BookOpen size={11} />} />
        <Metric label="Citas sin ref" value={String(ghost.length)} icon={<AlertTriangle size={11} />} />
        <Metric label="Refs sin cita" value={String(orphan.length)} icon={<AlertTriangle size={11} />} />
      </div>

      {/* Problemas detectados por la auditoría de citas (ghost + huérfanas) */}
      {citationAuditResult && (ghost.length > 0 || orphan.length > 0) && (
        <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,77,79,0.05)', border: '1px solid rgba(255,77,79,0.25)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-danger)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <AlertTriangle size={12} /> Problemas detectados ({ghost.length + orphan.length})
          </div>
          {ghost.map((g: any, gi: number) => (
            <div key={`g-${gi}`} style={{ fontSize: '11px', lineHeight: 1.4, color: 'var(--text-main)', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, color: 'var(--accent-danger)' }}>Cita sin referencia:</span>{' '}
              <em>{typeof g === 'string' ? g : (g.raw_text || `${(g.authors || []).join(', ')}${g.year ? ` (${g.year})` : ''}`)}</em>
              {g?.element_id && <span style={{ display: 'block', fontSize: '9px', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{g.element_id}</span>}
            </div>
          ))}
          {orphan.map((o: any, oi: number) => (
            <div key={`o-${oi}`} style={{ fontSize: '11px', lineHeight: 1.4, color: 'var(--text-main)', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, color: 'var(--accent-warning)' }}>Referencia sin cita:</span>{' '}
              {o.formatted_apa || o.raw_text || o.title || (o.authors || []).join(', ')}
            </div>
          ))}
        </div>
      )}

      {/* Citas del texto */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
        Citas en el texto ({citas.length})
      </div>
      {citas.length === 0 ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '12px' }}>
          Sin citas detectadas. Pulsa "Analizar citas".
        </div>
      ) : (
        citas.map((cit: any, ci: number) => {
          const pair = pairs[ci];
          return (
            <button
              key={ci}
              type="button"
              onClick={() => pair.ri >= 0 && setHovered(pair.ri === hovered ? null : pair.ri)}
              title={cit.element_id ? 'Ir a esta cita' : undefined}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '6px', width: '100%', textAlign: 'left',
                padding: '6px 8px', marginBottom: '4px', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit',
                background: pair.ghost ? 'rgba(255,77,79,0.06)' : 'rgba(255,255,255,0.03)',
                border: '1px solid ' + (pair.ghost ? 'rgba(255,77,79,0.3)' : 'var(--border-subtle)'),
                color: 'var(--text-main)', fontSize: '12px',
              }}
            >
              {pair.ghost ? (
                <AlertTriangle size={13} color="var(--accent-danger)" style={{ flexShrink: 0, marginTop: '1px' }} />
              ) : (
                <CheckCircle2 size={13} color="var(--accent-success)" style={{ flexShrink: 0, marginTop: '1px' }} />
              )}
              <span style={{ lineHeight: 1.4, fontStyle: 'italic' }}>
                {cit.raw_text || cit.authors?.join(', ') || '[cita]'}
                <span style={{ display: 'block', fontSize: '10px', fontStyle: 'normal', color: pair.ghost ? 'var(--accent-danger)' : 'var(--text-tertiary)' }}>
                  {pair.ghost ? 'Sin referencia en la bibliografía' : `→ Referencia ${pair.ri + 1}`}
                </span>
              </span>
            </button>
          );
        })
      )}

      {/* Referencias */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '14px 0 6px' }}>
        Referencias ({refs.length})
      </div>
      {refs.length === 0 ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Aún no hay referencias.</div>
      ) : (
        refs.map((ref: any, ri: number) => {
          const isOrphan = orphanIdx.includes(ri);
          return (
            <div
              key={ref.id || ri}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '6px 8px', marginBottom: '4px',
                borderRadius: '6px', fontFamily: 'inherit', fontSize: '11px', color: 'var(--text-main)', lineHeight: 1.4,
                background: hovered === ri ? 'rgba(79,124,255,0.12)' : isOrphan ? 'rgba(250,173,20,0.06)' : 'rgba(255,255,255,0.03)',
                border: '1px solid ' + (hovered === ri ? 'rgba(79,124,255,0.4)' : isOrphan ? 'rgba(250,173,20,0.3)' : 'var(--border-subtle)'),
              }}
            >
              {isOrphan ? (
                <AlertTriangle size={13} color="var(--accent-warning)" style={{ flexShrink: 0, marginTop: '1px' }} />
              ) : (
                <CheckCircle2 size={13} color="var(--accent-success)" style={{ flexShrink: 0, marginTop: '1px' }} />
              )}
              <span style={{ paddingLeft: '14px', textIndent: '-14px' }}>
                {ref.formatted_apa || ref.raw_text || ref.title || `[Referencia ${ri + 1}]`}
              </span>
            </div>
          );
        })
      )}

      {/* Problemas APA adicionales */}
      {(validationIssues || []).length > 0 && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
            Verificaciones APA
          </div>
          {(validationIssues || []).slice(0, 8).map((issue: any, idx: number) => (
            <div key={idx} style={{
              padding: '6px 8px', marginBottom: '4px', borderRadius: '6px', fontSize: '11px', lineHeight: 1.4,
              borderLeft: `3px solid ${issue.severity === 'error' ? 'var(--accent-danger)' : issue.severity === 'warning' ? 'var(--accent-warning)' : 'var(--accent-success)'}`,
              background: 'rgba(255,255,255,0.03)', color: 'var(--text-main)',
            }}>
              {issue.message}
              {issue.suggestion && <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', marginTop: '2px' }}>{issue.suggestion}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)' }}>
    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
      {icon}{value}
    </div>
    <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '2px' }}>{label}</div>
  </div>
);
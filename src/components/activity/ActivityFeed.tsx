/* WordAPA7 — Feed de actividad (Layer 4)
   Panel unificado: progreso de clasificación LLM, resultados de revisión IA
   y notificaciones recientes. Reemplaza los elementos flotantes
   (LLMProgressPanel, mascota, toasts) por contenido en el panel derecho. */

import React from 'react';
import { useDocStore, ActivityEvent } from '../../store/useDocStore';
import { LLMProgressPanel } from '../shared/LLMProgressPanel';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, ShieldAlert, Loader2, RotateCw, Activity, LucideIcon } from 'lucide-react';

const EVENT_ICONS: Record<ActivityEvent['kind'], LucideIcon> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const EVENT_COLORS: Record<ActivityEvent['kind'], string> = {
  success: 'var(--color-success)',
  error: 'var(--color-danger)',
  info: 'var(--color-info)',
  warning: 'var(--color-warning)',
};

const IDLE_PROGRESS = {
  status: 'idle' as const,
  total_batches: 0,
  completed_batches: 0,
  current_provider: '',
  current_provider_id: '',
  elements_processed: 0,
  elements_total: 0,
  estimated_time_remaining_seconds: 0,
  provider_fallbacks: [],
  last_error: null,
};

function timeAgo(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 10) return 'ahora';
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export const ActivityFeed: React.FC = () => {
  const {
    llmProgress,
    setIsNIMDiagnosticsOpen,
    reviewResult,
    isReviewLoading,
    runAIReview,
    activityEvents,
  } = useDocStore();

  const llmActive = llmProgress.status !== 'idle';

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Progreso de clasificación LLM (antes: panel flotante) */}
      {llmActive && (
        <LLMProgressPanel
          progress={llmProgress}
          isExpanded={false}
          onToggle={() => {}}
          onClose={() => useDocStore.setState({ llmProgress: { ...IDLE_PROGRESS } as any })}
          onOpenDiagnostics={() => setIsNIMDiagnosticsOpen(true)}
          embedded
        />
      )}

      {/* Resultado de revisión IA (antes: modal ReviewPanel) */}
      {(reviewResult || isReviewLoading) && (
        <div style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--surface-elevated)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)',
          }}>
            <ShieldAlert size={15} color="var(--accent-primary)" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>Revisión IA</span>
          </div>
          <div style={{ padding: '12px' }}>
            {isReviewLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Analizando documento…
                <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : reviewResult ? (
              <>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '10px' }}>
                  {reviewResult.total_paragraphs} párrafos analizados ·{' '}
                  <strong style={{ color: reviewResult.flagged_count > 0 ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
                    {reviewResult.flagged_count}
                  </strong>{' '}
                  con señales de IA u ortografía.
                </div>
                <button
                  type="button"
                  onClick={() => runAIReview()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                    background: 'var(--color-accent-soft)', color: 'var(--accent-primary)',
                    border: '1px solid rgba(79,124,255,0.35)', fontFamily: 'inherit',
                    fontSize: '12px', fontWeight: 600,
                  }}
                >
                  <RotateCw size={13} /> Revisar de nuevo
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Feed de eventos recientes (antes: toasts flotantes) */}
      <div style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--surface-elevated)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <Activity size={15} color="var(--accent-secondary)" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>Actividad</span>
          {activityEvents.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>
              {activityEvents.length} evento(s)
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {activityEvents.length === 0 ? (
            <div style={{ padding: '16px 12px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, textAlign: 'center' }}>
              Tu actividad aparecerá acá: clasificación, validación, auditoría de citas, revisiones y notificaciones.
            </div>
          ) : (
            activityEvents.map((ev) => {
              const Icon = EVENT_ICONS[ev.kind] || Info;
              const color = EVENT_COLORS[ev.kind] || EVENT_COLORS.info;
              return (
                <div key={ev.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <Icon size={15} color={color} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.4 }}>
                      {ev.title}
                    </div>
                    {ev.detail && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '2px' }}>
                        {ev.detail}
                      </div>
                    )}
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {timeAgo(ev.time)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityFeed;

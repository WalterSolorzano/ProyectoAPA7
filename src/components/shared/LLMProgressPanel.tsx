/* WordAPA7 — LLM Classification Progress Panel */

import React from 'react';
import {
  Cpu,
  Zap,
  Route,
  Layers,
  CheckCircle,
  AlertTriangle,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { LLMProgressState } from '../../types';

interface LLMProgressPanelProps {
  progress: LLMProgressState;
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  onOpenDiagnostics: () => void;
}

const PROVIDER_COLORS: Record<string, string> = {
  nvidia_nim: '#76B900',
  groq: '#F97316',
  openrouter: '#8B5CF6',
  cerebras: '#06B6D4',
  mistral: '#EC4899',
  opencodezen: '#22C55E',
  zenmux: '#A855F7',
  gemini: '#4285F4',
};

const PROVIDER_LOGOS: Record<string, string> = {
  nvidia_nim: 'NV',
  groq: 'GQ',
  openrouter: 'OR',
  cerebras: 'CB',
  mistral: 'MS',
  opencodezen: 'OZ',
  zenmux: 'ZM',
  gemini: 'GM',
};

function getProviderColor(providerId: string): string {
  return PROVIDER_COLORS[providerId] || 'var(--text-tertiary)';
}

export const LLMProgressPanel: React.FC<LLMProgressPanelProps> = ({
  progress,
  isExpanded,
  onToggle,
  onClose,
  onOpenDiagnostics,
}) => {
  const isProcessing = progress.status === 'processing';
  const isComplete = progress.status === 'complete';
  const isError = progress.status === 'error';

  // Modo heurístico = sin proveedor LLM activo (no se usó IA real)
  const isHeuristic = isComplete && !progress.current_provider;

  const percentComplete =
    progress.elements_total > 0
      ? Math.round((progress.elements_processed / progress.elements_total) * 100)
      : 0;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '34px',
        right: '16px',
        width: 'min(480px, calc(100vw - 32px))',
        zIndex: 9998,
        backgroundColor: 'var(--surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: isProcessing
          ? '0 12px 32px rgba(0,0,0,0.6)'
          : '0 8px 24px rgba(0,0,0,0.5)',
        transition: 'box-shadow 0.3s ease',
        overflow: 'hidden',
      }}
    >
      {/* Compact bar (always visible) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          {/* Status indicator */}
          {isProcessing && (
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: getProviderColor(progress.current_provider_id),
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          )}
          {isHeuristic && <AlertTriangle size={16} color="var(--accent-warning)" />}
          {isComplete && !isHeuristic && <CheckCircle size={16} color="var(--accent-primary)" />}
          {isError && <AlertTriangle size={16} color="var(--color-danger)" />}
          {progress.status === 'idle' && <Cpu size={16} color="var(--text-tertiary)" />}

          {/* Provider badge */}
          {progress.current_provider && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#ffffff',
                backgroundColor: getProviderColor(progress.current_provider_id),
              }}
            >
              {PROVIDER_LOGOS[progress.current_provider_id] || 'AI'}
              {' '}
              {progress.current_provider}
            </span>
          )}

          {/* Status text */}
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {isProcessing && (
              <>
                Clasificando: {progress.completed_batches}/{progress.total_batches} lotes
                {' '}({progress.elements_processed}/{progress.elements_total} elementos)
              </>
            )}
            {isHeuristic && (
              <span style={{ color: 'var(--accent-warning)' }}>
                ⚠ Clasificado con <strong>reglas heurísticas</strong> (sin IA) — revisa los elementos marcados.
              </span>
            )}
            {isComplete && !isHeuristic && (
              <>
                Clasificacion completada con{' '}
                <strong>{progress.current_provider || 'reglas heuristicas'}</strong>
                {' '}({progress.elements_total} elementos)
              </>
            )}
            {isError && (
              <span style={{ color: 'var(--color-danger)' }}>
                Error en clasificacion: {progress.last_error || 'Error desconocido'}
              </span>
            )}
            {progress.status === 'idle' && 'Clasificador de IA listo'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Progress bar (compact) */}
          {isProcessing && (
            <div
              style={{
                width: '80px',
                height: '6px',
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${percentComplete}%`,
                  height: '100%',
                  backgroundColor: getProviderColor(progress.current_provider_id),
                  borderRadius: '3px',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
          )}

          <span style={{
            fontSize: '11px',
            color: isHeuristic ? 'var(--accent-warning)' : 'var(--text-muted)',
            minWidth: isHeuristic ? 'auto' : '32px',
            textAlign: 'right',
            fontWeight: isHeuristic ? 700 : 400,
          }}>
            {isHeuristic ? 'Sin IA' : `${percentComplete}%`}
          </span>

          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              color: 'var(--text-muted)',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div
          style={{
            padding: '12px 16px 16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Full progress bar */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                marginBottom: '4px',
              }}
            >
              <span>Progreso de clasificacion</span>
              <span>
                {progress.elements_processed}/{progress.elements_total} elementos
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '10px',
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderRadius: '5px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${percentComplete}%`,
                  height: '100%',
                  backgroundColor: getProviderColor(progress.current_provider_id),
                  borderRadius: '5px',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
          </div>

          {/* Stats grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '8px',
            }}
          >
            <div
              style={{
                padding: '8px 10px',
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                LOTES COMPLETADOS
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                {progress.completed_batches}/{progress.total_batches}
              </div>
            </div>

            <div
              style={{
                padding: '8px 10px',
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                PROVEEDOR ACTUAL
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: getProviderColor(progress.current_provider_id),
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Cpu size={12} />
                {progress.current_provider || 'N/A'}
              </div>
            </div>

            <div
              style={{
                padding: '8px 10px',
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                TIEMPO ESTIMADO
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                {isProcessing && progress.estimated_time_remaining_seconds > 0
                  ? `~${progress.estimated_time_remaining_seconds}s`
                  : isComplete
                  ? 'Completado'
                  : '--'}
              </div>
            </div>

            <div
              style={{
                padding: '8px 10px',
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                ELEMENTOS
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                {progress.elements_processed}
                {progress.elements_total > 0 && (
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                    /{progress.elements_total}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Fallback chain */}
          {progress.provider_fallbacks.length > 0 && (
            <div
              style={{
                padding: '8px 10px',
                backgroundColor: 'rgba(250,173,20,0.1)',
                borderRadius: '6px',
                border: '1px solid rgba(250,173,20,0.35)',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  color: 'var(--accent-warning)',
                  fontWeight: 600,
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Route size={12} />
                CADENA DE FALLBACK
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {progress.provider_fallbacks.map((fb, idx) => (
                  <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{
                      backgroundColor: getProviderColor(fb.from),
                      color: '#fff',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      fontSize: '10px',
                      fontWeight: 700,
                    }}>
                      {PROVIDER_LOGOS[fb.from] || fb.from}
                    </span>
                    <span style={{ color: 'var(--color-warning)' }}>&rarr;</span>
                    <span style={{
                      backgroundColor: getProviderColor(fb.to),
                      color: '#fff',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      fontSize: '10px',
                      fontWeight: 700,
                    }}>
                      {PROVIDER_LOGOS[fb.to] || fb.to}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {progress.last_error && (
            <div
              style={{
                padding: '8px 10px',
                backgroundColor: 'rgba(255,77,79,0.12)',
                borderRadius: '6px',
                border: '1px solid rgba(255,77,79,0.35)',
                fontSize: '11px',
                color: 'var(--color-danger)',
              }}
            >
              <strong>Error:</strong> {progress.last_error}
            </div>
          )}

          {/* Complete summary */}
          {isComplete && progress.elements_total > 0 && (
            <div
              style={{
                padding: '8px 10px',
                backgroundColor: isHeuristic ? 'rgba(250,173,20,0.12)' : 'rgba(79,124,255,0.12)',
                borderRadius: '6px',
                border: `1px solid ${isHeuristic ? 'rgba(250,173,20,0.4)' : 'rgba(79,124,255,0.35)'}`,
                fontSize: '12px',
                color: isHeuristic ? 'var(--accent-warning)' : 'var(--accent-primary)',
              }}
            >
              {isHeuristic ? (
                <>
                  <AlertTriangle size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  <strong>No se usó IA.</strong> La clasificación se hizo con reglas heurísticas locales
                  porque no hay API Key configurada. Los elementos con confianza baja quedaron marcados
                  para revisión manual.
                </>
              ) : (
                <>
                  <CheckCircle size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Clasificacion completada con{' '}
                  <strong>{progress.current_provider || 'reglas heuristicas'}</strong>.
                  {progress.provider_fallbacks.length > 0
                    ? ` Se usaron ${progress.provider_fallbacks.length + 1} proveedores en la cadena de fallback.`
                    : ''}
                </>
              )}
              {' '}
              <button
                onClick={onOpenDiagnostics}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isHeuristic ? 'var(--accent-warning)' : 'var(--accent-primary)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: 0,
                }}
              >
                Ver diagnostico detallado
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LLMProgressPanel;

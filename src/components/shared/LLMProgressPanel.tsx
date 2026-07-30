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
  return PROVIDER_COLORS[providerId] || '#64748b';
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

  const percentComplete =
    progress.elements_total > 0
      ? Math.round((progress.elements_processed / progress.elements_total) * 100)
      : 0;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9998,
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        boxShadow: isProcessing
          ? '0 -4px 24px rgba(0,0,0,0.1)'
          : '0 -2px 12px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.3s ease',
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
          {isComplete && <CheckCircle size={16} color="#16a34a" />}
          {isError && <AlertTriangle size={16} color="#dc2626" />}
          {progress.status === 'idle' && <Cpu size={16} color="#94a3b8" />}

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
          <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
            {isProcessing && (
              <>
                Clasificando: {progress.completed_batches}/{progress.total_batches} lotes
                {' '}({progress.elements_processed}/{progress.elements_total} elementos)
              </>
            )}
            {isComplete && (
              <>
                Clasificacion completada con{' '}
                <strong>{progress.current_provider || 'reglas heuristicas'}</strong>
                {' '}({progress.elements_total} elementos)
              </>
            )}
            {isError && (
              <span style={{ color: '#dc2626' }}>
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
                backgroundColor: '#e2e8f0',
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

          <span style={{ fontSize: '11px', color: '#94a3b8', minWidth: '32px', textAlign: 'right' }}>
            {percentComplete}%
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
              color: '#94a3b8',
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
            borderTop: '1px solid #f1f5f9',
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
                color: '#64748b',
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
                backgroundColor: '#e2e8f0',
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
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>
                LOTES COMPLETADOS
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                {progress.completed_batches}/{progress.total_batches}
              </div>
            </div>

            <div
              style={{
                padding: '8px 10px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>
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
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>
                TIEMPO ESTIMADO
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
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
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>
                ELEMENTOS
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                {progress.elements_processed}
                {progress.elements_total > 0 && (
                  <span style={{ color: '#94a3b8', fontWeight: 400 }}>
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
                backgroundColor: '#fffbeb',
                borderRadius: '6px',
                border: '1px solid #fde68a',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  color: '#d97706',
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
              <div style={{ fontSize: '12px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                    <span style={{ color: '#d97706' }}>&rarr;</span>
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
                backgroundColor: '#fef2f2',
                borderRadius: '6px',
                border: '1px solid #fecaca',
                fontSize: '11px',
                color: '#dc2626',
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
                backgroundColor: '#f0fdf4',
                borderRadius: '6px',
                border: '1px solid #bbf7d0',
                fontSize: '12px',
                color: '#166534',
              }}
            >
              <CheckCircle size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Clasificacion completada con{' '}
              <strong>{progress.current_provider || 'reglas heuristicas'}</strong>.
              {progress.provider_fallbacks.length > 0
                ? ` Se usaron ${progress.provider_fallbacks.length + 1} proveedores en la cadena de fallback.`
                : ''}
              {' '}
              <button
                onClick={onOpenDiagnostics}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#16a34a',
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

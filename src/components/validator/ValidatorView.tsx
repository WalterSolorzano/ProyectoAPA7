/* WordAPA7 — Validator Report (Fluent Design) */

import React, { useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, ShieldCheck, Sparkles, LucideIcon } from 'lucide-react';

const SEVERITY_ICON: Record<string, LucideIcon> = {
  ok: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

export const ValidatorView: React.FC = () => {
  const { validationIssues, runValidation, isLoading, aiCitationValidation, apiKey } = useDocStore();

  useEffect(() => {
    runValidation();
  }, []);

  const okCount = validationIssues.filter((i) => i.severity === 'ok').length;
  const warningCount = validationIssues.filter((i) => i.severity === 'warning').length;
  const errorCount = validationIssues.filter((i) => i.severity === 'error').length;

  return (
    <div className="view-page">
      <div className="view-page-inner">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="view-page-title" style={{ marginBottom: 0 }}>
              Informe de Validacion de Citas y Referencias
            </h2>
            {aiCitationValidation && apiKey && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                padding: '2px 8px', borderRadius: '4px',
                backgroundColor: '#f0fdf4', color: '#16a34a',
                border: '1px solid #bbf7d0',
                fontSize: '10px', fontWeight: 600,
              }}>
                <Sparkles size={10} />
                IA activa
              </span>
            )}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try { await runValidation(); }
              catch (err: any) { useDocStore.getState().showToast(err.message || 'Error al validar documento', 'error'); }
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading-spinner loading-spinner-sm" />
            ) : (
              <RefreshCw size={14} />
            )}
            Re-validar Ahora
          </button>
        </div>

        {/* Summary Cards */}
        {validationIssues.length > 0 && (
          <div className="semaphore-stats" style={{ marginBottom: '20px' }}>
            <div className="semaphore-stat semaphore-stat-green">
              <span className="semaphore-count">{okCount}</span>
              <span className="semaphore-label">Correcto</span>
            </div>
            <div className="semaphore-stat semaphore-stat-yellow">
              <span className="semaphore-count">{warningCount}</span>
              <span className="semaphore-label">Advertencias</span>
            </div>
            <div className="semaphore-stat semaphore-stat-red">
              <span className="semaphore-count">{errorCount}</span>
              <span className="semaphore-label">Errores</span>
            </div>
          </div>
        )}

        {/* Issues List */}
        {validationIssues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
            <ShieldCheck size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p>No hay reportes de validacion disponibles.</p>
            <p className="text-xs" style={{ marginTop: '4px' }}>
              Carga un documento y presiona "Re-validar Ahora" para comenzar.
            </p>
          </div>
        ) : (
          validationIssues.map((issue, idx) => {
            const IconComponent = SEVERITY_ICON[issue.severity] || Info;
            return (
              <div
                key={idx}
                className={`validation-issue validation-issue-${issue.severity}`}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <IconComponent size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <p className="validation-issue-message">{issue.message}</p>
                    {issue.suggestion && (
                      <p className="validation-issue-suggestion">
                        Sugerencia: {issue.suggestion}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

/* Need Info icon for fallback */
const Info: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

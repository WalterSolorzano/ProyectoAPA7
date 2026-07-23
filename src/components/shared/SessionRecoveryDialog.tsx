/* WordAPA7 — Dialogo de Recuperacion de Sesion */

import React from 'react';
import { SessionRecovery } from '../../types';
import { History, X, ArrowRight, Trash2 } from 'lucide-react';

interface SessionRecoveryDialogProps {
  sessions: SessionRecovery[];
  onContinue: (sessionId: string) => void;
  onStartFresh: () => void;
  onDismiss: () => void;
}

export const SessionRecoveryDialog: React.FC<SessionRecoveryDialogProps> = ({
  sessions,
  onContinue,
  onStartFresh,
  onDismiss,
}) => {
  if (sessions.length === 0) return null;

  const mostRecent = sessions[0];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: '520px',
        backgroundColor: 'var(--bg-base)',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'var(--status-yellow-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--status-yellow)',
            }}>
              <History size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Sesion encontrada</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Hay una sesion de trabajo sin finalizar
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Session info */}
        <div style={{ padding: '24px' }}>
          <div style={{
            padding: '16px',
            backgroundColor: 'var(--bg-layer)',
            borderRadius: '8px',
            marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Archivo</span>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{mostRecent.session.file_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Formato</span>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                {mostRecent.session.apa_format === 'student' ? 'Estudiante' : 'Profesional'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Elementos</span>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                {mostRecent.session.element_count} total
                {mostRecent.session.pending_count > 0 && (
                  <span style={{ color: 'var(--status-yellow)', marginLeft: '6px' }}>
                    ({mostRecent.session.pending_count} pendientes)
                  </span>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Ultima actividad</span>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>{mostRecent.session.last_saved}</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => onContinue(mostRecent.session.session_id)}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                width: '100%',
              }}
            >
              Continuar donde estaba
              <ArrowRight size={16} />
            </button>
            <button
              onClick={onStartFresh}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                width: '100%',
              }}
            >
              <Trash2 size={16} />
              Comenzar de nuevo (perdera el progreso anterior)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionRecoveryDialog;

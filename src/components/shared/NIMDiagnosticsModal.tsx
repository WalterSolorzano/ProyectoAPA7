/* WordAPA7 — Modal de Diagnóstico y Logs de llamadas a NVIDIA NIM */

import React from 'react';
import { X, Activity, Cpu, CheckCircle, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';

export interface NIMLogItem {
  id: string;
  timestamp: string;
  endpoint: string;
  statusCode: number;
  tokensUsed: number;
  durationMs: number;
  status: 'success' | 'rate_limit' | 'error';
  message: string;
}

interface NIMDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: NIMLogItem[];
  apiKeyPresent: boolean;
}

export const NIMDiagnosticsModal: React.FC<NIMDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  logs,
  apiKeyPresent
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '680px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh'
        }}
      >
        {/* Cabecera del Modal */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={20} color="#78716c" />
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                Diagnóstico de IA — NVIDIA NIM (LLaMA 3.1 70B)
              </h3>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Cola por lotes asíncrona (Máx 3,000 tokens)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Estado de Conexión */}
        <div style={{ padding: '12px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            {apiKeyPresent ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 600 }}>
                <CheckCircle size={14} /> NVIDIA_API_KEY Configurada (Modo Lotes Activo)
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d97706', fontWeight: 600 }}>
                <AlertTriangle size={14} /> Sin NVIDIA_API_KEY (Utilizando Clasificación por Reglas)
              </span>
            )}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Caché Local: <strong>Activa (SHA-256)</strong>
          </span>
        </div>

        {/* Historial de Llamadas / Logs */}
        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
          <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginTop: 0, marginBottom: '10px' }}>
            Historial de Solicitudes Recientes ({logs.length})
          </h4>

          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: '12px' }}>
              <Activity size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>No hay llamadas registradas aún en esta sesión.</p>
              <span style={{ fontSize: '11px' }}>Haz clic en "Refinar con IA" para enviar lotes ambiguos.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: log.status === 'success' ? '#f0fdf4' : log.status === 'rate_limit' ? '#fffbeb' : '#fef2f2',
                    fontSize: '11px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#0f172a' }}>{log.endpoint}</strong>
                    <span style={{ color: '#64748b', fontSize: '10px' }}>{log.timestamp}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', color: '#475569' }}>
                    <span>Estado: <strong>{log.statusCode}</strong></span>
                    <span>Tokens: <strong>{log.tokensUsed}</strong></span>
                    <span>Duración: <strong>{log.durationMs}ms</strong></span>
                  </div>
                  <p style={{ margin: '2px 0 0 0', color: '#334155', fontStyle: 'italic' }}>
                    {log.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pie de Modal */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: '#f8fafc'
          }}
        >
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ fontSize: '12px' }}>
            Cerrar Diagnóstico
          </button>
        </div>
      </div>
    </div>
  );
};

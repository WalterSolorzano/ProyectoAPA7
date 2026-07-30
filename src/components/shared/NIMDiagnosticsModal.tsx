/* WordAPA7 — Modal de Diagnóstico y Logs de llamadas a NVIDIA NIM */

import React, { useState } from 'react';
import { X, Activity, Cpu, CheckCircle, AlertTriangle, ShieldCheck, RefreshCw, Save, Server, Cloud } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';

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
  const { apiKey, setApiKey, aiProviderConfig, setAiProviderConfig } = useDocStore();
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  const [useLocal, setUseLocal] = useState(aiProviderConfig.useLocal);
  const [nimUrl, setNimUrl] = useState(aiProviderConfig.nimUrl);
  const [isSaved, setIsSaved] = useState(false);

  // Sync state when opened
  React.useEffect(() => {
    if (isOpen) {
      setLocalApiKey(apiKey || '');
      setUseLocal(aiProviderConfig.useLocal);
      setNimUrl(aiProviderConfig.nimUrl);
      setIsSaved(false);
    }
  }, [isOpen, apiKey, aiProviderConfig]);

  const handleSave = () => {
    setApiKey(localApiKey.trim());
    setAiProviderConfig({ useLocal, nimUrl: nimUrl.trim() });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

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

        {/* Configuración de Proveedor AI */}
        <div style={{ padding: '16px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 12px 0', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Server size={14} /> Configuración de Conexión
          </h4>
          
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <input type="radio" checked={!useLocal} onChange={() => setUseLocal(false)} />
              <Cloud size={14} color={!useLocal ? '#185ABD' : '#94a3b8'} /> NVIDIA NIM Cloud
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <input type="radio" checked={useLocal} onChange={() => setUseLocal(true)} />
              <Server size={14} color={useLocal ? '#16a34a' : '#94a3b8'} /> Servidor Local (Offline)
            </label>
          </div>

          {!useLocal && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>NVIDIA API Key:</label>
              <input
                type="password"
                placeholder="nvapi-..."
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                className="input-field"
                style={{ width: '100%', padding: '8px', fontSize: '12px' }}
              />
              <span style={{ fontSize: '10px', color: '#64748b' }}>Requerido para usar los modelos en la nube de NVIDIA.</span>
            </div>
          )}

          {useLocal && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>URL del Servidor Local (Compatible OpenAI):</label>
              <input
                type="text"
                placeholder="http://localhost:8000/v1/chat/completions"
                value={nimUrl}
                onChange={(e) => setNimUrl(e.target.value)}
                className="input-field"
                style={{ width: '100%', padding: '8px', fontSize: '12px' }}
              />
              <span style={{ fontSize: '10px', color: '#64748b' }}>Ej: NIM en Docker o LM Studio local. No se requiere API Key.</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              {(!useLocal && localApiKey) || useLocal ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 600 }}>
                  <CheckCircle size={14} /> Listo para Procesar
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d97706', fontWeight: 600 }}>
                  <AlertTriangle size={14} /> Faltan credenciales (Se usará modo Reglas)
                </span>
              )}
            </div>
            <button
              onClick={handleSave}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Save size={14} /> {isSaved ? 'Guardado' : 'Guardar Configuración'}
            </button>
          </div>
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

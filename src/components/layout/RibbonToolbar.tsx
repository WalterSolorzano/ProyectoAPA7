/* WordAPA7 — Microsoft Word Style Ribbon Toolbar (Interfaz Limpia y Botón Unificado) */

import React, { useState, useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { WandIcon, ShieldCheckIcon } from '../shared/Icons';
import { Download, Sliders, Cpu, Sparkles } from 'lucide-react';
import { ModeSwitch } from './ModeSwitch';

const PROVIDER_DOTS = [
  { id: 'nvidia_nim', initial: 'NV' },
  { id: 'groq', initial: 'Gq' },
  { id: 'openrouter', initial: 'OR' },
  { id: 'cerebras', initial: 'Cb' },
  { id: 'mistral', initial: 'Mi' },
  { id: 'opencodezen', initial: 'OZ' },
  { id: 'zenmux', initial: 'ZM' },
  { id: 'gemini', initial: 'Ge' },
];

export const RibbonToolbar: React.FC = () => {
  const {
    rules, setRules, runLLMClassify, exportDocx, exportPdf, acceptHighConfidenceElements,
    isLoading, apiKey, setApiKey, wizardStep, doc,
    llmProgress, aiCitationValidation, setAiCitationValidation, showToast,
  } = useDocStore();
  const [showSettings, setShowSettings] = useState(false);
  const [providerStatus, setProviderStatus] = useState<Record<string, { active: boolean; name: string; latency?: number }>>({});
  const isProcessing = llmProgress.status === 'processing';

  useEffect(() => {
    fetch('/api/provider-status')
      .then(r => r.json())
      .then(data => {
        const map: Record<string, any> = {};
        for (const p of data.providers) {
          map[p.id] = { active: p.active, name: p.name, latency: p.capacity?.typical_latency_s };
        }
        setProviderStatus(map);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="ribbon-container" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid var(--border-color)' }}>
      {/* Contenido Dinámico del Ribbon */}
      <div className="ribbon-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 16px' }}>

        {/* Lado Izquierdo: Acciones Rápidas y Configuración APA */}
        <div className="ribbon-left-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          
          {/* Configuración APA Rápidas */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSettings(!showSettings)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '5px 10px' }}
          >
            <Sliders size={13} />
            <span>Configuración APA: <strong>{rules.font_family} ({rules.line_spacing}x)</strong></span>
          </button>

          {/* Menú Emergente de Configuración */}
          {showSettings && (
            <div style={{
              position: 'absolute',
              top: '42px',
              left: '16px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '12px',
              display: 'flex',
              gap: '12px',
              zIndex: 300,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
            }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Fuente APA 7</label>
                <select
                  className="form-control"
                  value={rules.font_family}
                  onChange={(e) => setRules({ font_family: e.target.value })}
                  style={{ width: '150px', padding: '4px', fontSize: '11px' }}
                >
                  <option value="Times New Roman">Times New Roman (12 pt)</option>
                  <option value="Calibri">Calibri (11 pt)</option>
                  <option value="Arial">Arial (11 pt)</option>
                  <option value="Georgia">Georgia (11 pt)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Interlineado</label>
                <select
                  className="form-control"
                  value={rules.line_spacing}
                  onChange={(e) => setRules({ line_spacing: parseFloat(e.target.value) })}
                  style={{ width: '100px', padding: '4px', fontSize: '11px' }}
                >
                  <option value={2.0}>Doble (2.0)</option>
                  <option value={1.5}>1.5 lineas</option>
                  <option value={1.0}>Sencillo</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>API Key (NVIDIA)</label>
                <input
                  type="password"
                  placeholder="Ingresa tu API Key..."
                  value={apiKey || ''}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{ width: '140px', padding: '4px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
              </div>

              {/* Provider Status Dots */}
              <div>
                <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Proveedores IA</label>
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                  {PROVIDER_DOTS.map((p) => {
                    const status = providerStatus[p.id];
                    const active = status?.active ?? false;
                    return (
                      <span
                        key={p.id}
                        title={`${status?.name || p.id}: ${active ? `Activo ${status?.latency ? `(~${status.latency}s)` : ''}` : 'Sin configurar'}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          fontSize: '7px',
                          fontWeight: 700,
                          color: '#fff',
                          backgroundColor: active ? '#22c55e' : '#cbd5e1',
                          cursor: 'default',
                          transition: 'background-color 0.2s',
                        }}
                      >
                        {p.initial}
                      </span>
                    );
                  })}
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                    {Object.values(providerStatus).filter((s: any) => s.active).length}/{PROVIDER_DOTS.length}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Botón 1: Aprobar Verdes */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try { await acceptHighConfidenceElements(); }
              catch (err: any) { showToast(err.message || 'Error al aprobar elementos', 'error'); }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#15803d', borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }}
            title="Aprobar automaticamente todos los elementos con confianza >= 90%"
          >
            <ShieldCheckIcon size={13} />
            <span>Aprobar Verdes (90% o mas)</span>
          </button>

          {/* Botón 2: Refinar con IA (multi-proveedor) */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try { await runLLMClassify(); }
              catch (err: any) { showToast(err.message || 'Error en clasificacion con IA', 'error'); }
            }}
            disabled={isLoading || isProcessing}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px',
              color: apiKey ? 'var(--word-blue)' : '#94a3b8',
              borderColor: apiKey ? 'var(--word-blue)' : '#e2e8f0',
            }}
            title={apiKey ? 'Refinar clasificacion con IA multi-proveedor (NVIDIA > Groq > OpenRouter > ...)' : 'Ingresa una API Key para usar clasificacion por IA'}
          >
            {isProcessing ? (
              <Cpu size={13} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <WandIcon size={13} />
            )}
            <span>
              {isProcessing
                ? `Clasificando... ${llmProgress.completed_batches}/${llmProgress.total_batches} lotes`
                : apiKey
                ? 'Refinar con IA'
                : 'Refinar (sin API Key)'}
            </span>
            {apiKey && !isProcessing && (
              <span style={{
                fontSize: '9px', padding: '1px 4px', borderRadius: '3px',
                backgroundColor: '#dbeafe', color: '#1d4ed8',
              }}>
                Multi-provider
              </span>
            )}
          </button>

          {/* Botón 3: Auditoría de Citas */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try { await useDocStore.getState().runCitationAudit(); }
              catch (err: any) { showToast(err.message || 'Error en auditoria de citas', 'error'); }
            }}
            disabled={isLoading || isProcessing}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
            title="Verifica citas fantasmas y referencias huerfanas (Heuristico)"
          >
            <ShieldCheckIcon size={13} />
            <span>Auditoria Citas</span>
          </button>
        </div>

        {/* Lado Derecho: Toggle de Modo y Descarga (oculto en paso 6, el wizard ya tiene botones) */}
        {doc && wizardStep !== 6 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ModeSwitch />
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => exportDocx(false)}
                disabled={isLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '4px 10px' }}
              >
                <Download size={13} />
                <span>DOCX</span>
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => exportPdf()}
                disabled={isLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '4px 10px' }}
              >
                <Download size={13} />
                <span>PDF</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

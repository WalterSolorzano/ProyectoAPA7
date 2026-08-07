/* WordAPA7 — Status Bar con Progreso Real, Warnings y Zoom */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { NIMDiagnosticsModal } from '../shared/NIMDiagnosticsModal';
import { RotatingComment } from './RotatingComment';
import { Cpu, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const {
    doc,
    rules,
    zoomLevel,
    setZoomLevel,
    apiKey,
    nimLogs,
    isNIMDiagnosticsOpen,
    setIsNIMDiagnosticsOpen,
    lastRequestId,
    forceRightPanelOpen,
    setForceRightPanelOpen,
    activityUnseen,
  } = useDocStore();

  if (!doc) return null;

  const elements = doc.elements;

  // Metricas reales
  const totalElements = elements.length;
  const totalWords = elements.reduce((acc, elem) => {
    if (elem.text) {
      return acc + elem.text.trim().split(/\s+/).filter(Boolean).length;
    }
    return acc;
  }, 0);

  const headingsCount = elements.filter((e) => e.type === 'heading').length;
  const paragraphsCount = elements.filter((e) => e.type === 'paragraph').length;
  const bulletsCount = elements.filter((e) => e.type === 'bullet' || e.type === 'numbered_list').length;
  const tablesCount = elements.filter((e) => e.type === 'table').length;
  const figuresCount = elements.filter((e) => e.type === 'image' && (e.image_info?.figure_number || 0) > 0).length;
  const emptyCount = elements.filter((e) => e.type === 'empty' || (e.text && !e.text.trim())).length;

  // Estado de procesamiento
  const needsReviewCount = elements.filter((e) => e.needs_review).length;
  const autoAccepted = elements.filter((e) => e.auto_applied || (e.confidence >= 0.85 && !e.needs_review)).length;
  const userModified = elements.filter((e) => e.is_user_modified).length;

  const estimatedPages = Math.max(1, Math.ceil(totalElements / 14));

  // Warnings
  const warnings: string[] = [];
  if (needsReviewCount > 0) warnings.push(`${needsReviewCount} pendientes de revision`);
  if (doc.has_landscape_sections) warnings.push('Seccion horizontal detectada');
  if (doc.meta.content_warning) warnings.push(doc.meta.content_warning);
  const hasCitations = doc.citas_intext && doc.citas_intext.length > 0;
  if (hasCitations && doc.referencias && doc.referencias.length === 0) {
    warnings.push('Citas detectadas sin referencias');
  }

  return (
    <>
      <footer className="app-statusbar" style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--app-bg)', borderTop: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-muted)' }}>
        {/* Left: Document stats */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', color: 'var(--text-main)', fontWeight: 500, flexShrink: 0 }}>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Pag: {estimatedPages}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{totalWords} pal.</span>

          {/* Iconos de elementos con tooltips descriptivos */}
          {headingsCount > 0 && <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }} title={`${headingsCount} títulos`}>T{headingsCount}</span>}
          {paragraphsCount > 0 && <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }} title={`${paragraphsCount} párrafos`}>P{paragraphsCount}</span>}
          {figuresCount > 0 && <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }} title={`${figuresCount} figuras`}>F{figuresCount}</span>}
          {tablesCount > 0 && <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }} title={`${tablesCount} tablas`}>Tb{tablesCount}</span>}
          {bulletsCount > 0 && <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }} title={`${bulletsCount} listas`}>L{bulletsCount}</span>}

          {/* Warnings */}
          {warnings.length > 0 && (
            <span
              style={{
                display: 'flex', alignItems: 'center', gap: '3px',
                fontSize: '10px', fontWeight: 600,
                color: needsReviewCount > 0 ? 'var(--accent-danger)' : 'var(--accent-warning)',
                cursor: 'help',
              }}
              title={'Avisos del documento:\n' + warnings.join('\n')}
            >
              <AlertTriangle size={12} />
              {warnings.length} aviso{warnings.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Center: comentario rotativo (frases de la biblioteca) */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0, overflow: 'hidden', padding: '0 12px' }}>
          <RotatingComment />
        </div>

        {/* Right: Config and zoom */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', color: 'var(--text-main)', fontWeight: 500, flexShrink: 0 }}>
          <span style={{ fontSize: '10px' }}>
            {rules.font_family} ({rules.font_size_pt}pt)
          </span>
          <span style={{ fontSize: '10px' }}>
            {rules.line_spacing}x
          </span>

          {/* Status icons */}
          {needsReviewCount === 0 && totalElements > 0 && (
            <span style={{ fontSize: '10px', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <CheckCircle size={12} /> Completo
            </span>
          )}

          {/* Panel derecho contextual */}
          <button
            onClick={() => {
              const willOpen = !forceRightPanelOpen;
              setForceRightPanelOpen(willOpen);
            }}
            style={{
              background: forceRightPanelOpen ? 'rgba(79,124,255,0.15)' : 'transparent',
              border: forceRightPanelOpen ? '1px solid var(--accent-primary)' : '1px solid transparent',
              borderRadius: '4px',
              padding: '2px 6px',
              color: forceRightPanelOpen ? 'var(--accent-primary)' : 'var(--text-main)',
              cursor: 'pointer',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
            title="Alternar panel derecho contextual (cambia según lo que selecciones)"
          >
            P. derecho {forceRightPanelOpen ? 'On' : 'Off'}
            {activityUnseen > 0 && (
              <span style={{
                minWidth: '15px', height: '15px', borderRadius: '999px',
                backgroundColor: 'var(--accent-primary)', color: '#fff',
                fontSize: '9px', fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              }}>
                {activityUnseen > 99 ? '99+' : activityUnseen}
              </span>
            )}
          </button>

          {/* Zoom Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => setZoomLevel(zoomLevel - 10)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', padding: '0 2px' }}
              title="Reducir Zoom"
            >
              -
            </button>
            <input
              type="range"
              min={50}
              max={300}
              step={5}
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              style={{ width: '60px', cursor: 'pointer' }}
            />
            <button
              onClick={() => setZoomLevel(zoomLevel + 10)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', padding: '0 2px' }}
              title="Aumentar Zoom"
            >
              +
            </button>
            <span style={{ fontSize: '10px', width: '32px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>{zoomLevel}%</span>
          </div>

          {/* Request ID */}
          {lastRequestId && (
            <span style={{
              fontSize: '9px',
              fontFamily: 'monospace',
              color: 'var(--text-muted)',
              padding: '1px 4px',
              borderRadius: '3px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'none',
            }} title="Ultimo ID de solicitud">
              #{lastRequestId}
            </span>
          )}

          {/* NIM Badge */}
          <button
            onClick={() => setIsNIMDiagnosticsOpen(true)}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px',
              padding: '2px 6px',
              color: 'var(--text-main)',
              cursor: 'pointer',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Ver Diagnostico de IA"
          >
            <Cpu size={11} color={apiKey ? 'var(--accent-secondary)' : 'var(--accent-warning)'} />
            <span style={{ color: apiKey ? 'var(--accent-secondary)' : 'var(--accent-warning)', fontWeight: 700 }}>
              {apiKey ? 'NIM' : 'Reglas'}
            </span>
          </button>
        </div>
      </footer>

      <NIMDiagnosticsModal
        isOpen={isNIMDiagnosticsOpen}
        onClose={() => setIsNIMDiagnosticsOpen(false)}
        logs={nimLogs || []}
        apiKeyPresent={!!apiKey}
      />
    </>
  );
};

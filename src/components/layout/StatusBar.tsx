/* WordAPA7 — Status Bar: sugerencias protagonistas + controles etiquetados */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { NIMDiagnosticsModal } from '../shared/NIMDiagnosticsModal';
import { RotatingComment } from './RotatingComment';
import { Sparkles, AlertTriangle, CheckCircle, Download, ZoomIn, ZoomOut, Cpu } from 'lucide-react';
import { getWhatsAppComment } from './WhatsAppComment';

const LABEL: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)',
};

const GHOST_BTN: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)', padding: '3px 8px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'inherit',
  color: 'var(--text-secondary)',
};

export const StatusBar: React.FC = () => {
  const {
    doc,
    zoomLevel,
    setZoomLevel,
    apiKey,
    nimLogs,
    isNIMDiagnosticsOpen,
    setIsNIMDiagnosticsOpen,
    forceRightPanelOpen,
    setForceRightPanelOpen,
    activityUnseen,
  } = useDocStore();
  const proactivas = useDocStore((s) => s.sugerenciasProactivas !== false);
  const citationAudit = useDocStore((s) => s.citationAuditResult);
  const validationIssues = useDocStore((s) => s.validationIssues);
  const reviewResult = useDocStore((s) => s.reviewResult);
  const proofreadFindings = useDocStore((s) => s.proofreadFindings);

  if (!doc) return null;

  const elements = doc.elements;
  const totalElements = elements.length;
  const totalWords = elements.reduce((acc, elem) => {
    if (elem.text) return acc + elem.text.trim().split(/\s+/).filter(Boolean).length;
    return acc;
  }, 0);

  const needsReviewCount = elements.filter((e) => e.needs_review).length;
  const estimatedPages = Math.max(1, Math.ceil(totalElements / 14));

  // Sugerencias totales = globos WhatsApp + hallazgos del revisor por lotes.
  let suggestionCount = proofreadFindings.length;
  let firstSuggestionId: string | null = null;
  if (proactivas) {
    const ctx = {
      ghostCitations: citationAudit?.ghost_citations || [],
      orphanReferences: citationAudit?.orphan_references || [],
      validationIssues: validationIssues || [],
      styleAuditRun: !!reviewResult,
    } as any;
    for (const e of elements) {
      if (!dismissed(e.id) && getWhatsAppComment(e, ctx, 0)) {
        suggestionCount += 1;
        if (!firstSuggestionId) firstSuggestionId = e.id;
      }
    }
  }
  function dismissed(id: string): boolean {
    try { return (useDocStore.getState().dismissedCommentIds || []).includes(id); } catch { return false; }
  }

  const warnings: string[] = [];
  if (needsReviewCount > 0) warnings.push(`${needsReviewCount} pendientes de revisión`);
  if (doc.has_landscape_sections) warnings.push('Sección horizontal detectada');
  if ((doc.meta as any)?.content_warning) warnings.push((doc.meta as any).content_warning);
  const hasCitations = doc.citas_intext && doc.citas_intext.length > 0;
  if (hasCitations && doc.referencias && doc.referencias.length === 0) {
    warnings.push('Citas detectadas sin referencias');
  }

  const openSuggestions = () => {
    setForceRightPanelOpen(true);
    if (firstSuggestionId) useDocStore.getState().setSelectedElementId(firstSuggestionId);
  };

  return (
    <>
      <footer
        className="app-statusbar app-no-drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'var(--sidebar-bg)',
          borderTop: '1px solid var(--border-subtle)',
          color: 'var(--text-muted)',
          padding: '4px 12px',
        }}
      >
        {/* ── BOTÓN ÚNICO: Asistente (sugerencias + panel contextual) ── */}
        <button
          type="button"
          onClick={openSuggestions}
          title={suggestionCount > 0 ? `${suggestionCount} sugerencias pendientes — clic para verlas` : 'Abrir panel del asistente'}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: suggestionCount > 0 ? 'var(--accent-primary)' : 'transparent',
            border: suggestionCount > 0 ? 'none' : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', padding: '5px 12px',
            color: suggestionCount > 0 ? '#fff' : 'var(--accent-primary)',
            fontWeight: 700, fontSize: 'var(--text-xs)', fontFamily: 'inherit',
            cursor: 'pointer', flexShrink: 0,
            boxShadow: suggestionCount > 0 ? 'var(--shadow-sm)' : 'none',
          }}
        >
          <Sparkles size={15} />
          <span>Asistente</span>
          {(suggestionCount > 0 || activityUnseen > 0) && (
            <span style={{
              minWidth: '18px', height: '18px', borderRadius: '999px',
              backgroundColor: suggestionCount > 0 ? '#fff' : 'var(--accent-primary)',
              color: suggestionCount > 0 ? 'var(--accent-primary)' : '#fff',
              fontSize: '10px', fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 5px',
            }}>
              {suggestionCount > 0
                ? (suggestionCount > 99 ? '99+' : suggestionCount)
                : (activityUnseen > 99 ? '99+' : activityUnseen)}
            </span>
          )}
        </button>

        <div style={LABEL as React.CSSProperties}>
          Pág. {estimatedPages}
        </div>
        <div style={LABEL}>{totalWords} pal.</div>

        {/* Avisos */}
        {warnings.length > 0 ? (
          <span
            style={{ ...GHOST_BTN, borderColor: 'var(--border-strong, var(--border-subtle))' }}
            title={'Avisos del documento:\n' + warnings.join('\n')}
          >
            <AlertTriangle size={12} color="var(--color-warning)" />
            <span>{warnings.length} aviso{warnings.length > 1 ? 's' : ''}</span>
          </span>
        ) : (
          needsReviewCount === 0 && (
            <span style={{ ...GHOST_BTN, cursor: 'default', color: 'var(--color-success)' }}
              title="Sin problemas detectados">
              <CheckCircle size={12} /> En regla
            </span>
          )
        )}

        {/* Centro: comentario rotativo — NO TOCAR */}
        <div
          style={{
            flex: 1, display: 'flex', justifyContent: 'center',
            alignItems: 'center', minWidth: 0, overflow: 'hidden', padding: '0 12px',
          }}
        >
          <RotatingComment />
        </div>

        {/* Derecha: zoom + descargar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          <button type="button" onClick={() => setZoomLevel(zoomLevel - 10)} title="Reducir zoom" style={{ ...GHOST_BTN, border: 'none', padding: '3px 5px' }}>
            <ZoomOut size={13} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(100)}
            title="Restablecer zoom a 100%"
            style={{ ...LABEL, width: '38px', textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
          >
            {zoomLevel}%
          </button>
          <button type="button" onClick={() => setZoomLevel(zoomLevel + 10)} title="Aumentar zoom" style={{ ...GHOST_BTN, border: 'none', padding: '3px 5px' }}>
            <ZoomIn size={13} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => useDocStore.getState().openExportTunnel()}
          disabled={!doc}
          title="Abrir menú de exportación: Word APA 7, PDF, con control de cambios"
          style={{
            ...GHOST_BTN,
            borderColor: 'var(--accent-primary)',
            color: 'var(--accent-primary)',
            fontWeight: 700,
          }}
        >
          <Download size={13} />
          <span>Descargar</span>
        </button>

        <button
          type="button"
          onClick={() => setIsNIMDiagnosticsOpen(true)}
          style={{ ...GHOST_BTN, border: 'none', padding: '3px 5px' }}
          title={apiKey ? 'Motor IA activo — ver diagnóstico' : 'Modo reglas locales — ver diagnóstico'}
        >
          <Cpu size={13} color={apiKey ? 'var(--accent-secondary)' : 'var(--accent-warning)'} />
        </button>

        <span
          style={{
            fontSize: '9px', fontWeight: 700, color: 'var(--accent-primary)',
            backgroundColor: 'var(--accent-soft)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', padding: '2px 7px', letterSpacing: '0.02em',
            flexShrink: 0,
          }}
        >
          APA 7
        </span>
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

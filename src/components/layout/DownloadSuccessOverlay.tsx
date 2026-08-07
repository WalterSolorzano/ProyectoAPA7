/* WordAPA7 — Micro-animación de cierre + papeleta de entrega.
 * Cuando el DOCX/PDF termina de generarse con éxito:
 * 1) spinner → check con mini-rebote (200ms).
 * 2) "Papeleta de entrega": resumen en lenguaje de resultado (compartible),
 *    con botón "Copiar resumen". Auto-se oculta a los ~8s. */

import React, { useState, useEffect, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Copy, Check } from 'lucide-react';

export const DownloadSuccessOverlay: React.FC = () => {
  const exportSuccessAt = useDocStore((s) => s.exportSuccessAt);
  const doc = useDocStore((s) => s.doc);
  const citationAuditResult = useDocStore((s) => s.citationAuditResult);
  const references = useDocStore((s) => s.references);
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastSeenRef = useRef<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!exportSuccessAt) return;
    if (lastSeenRef.current === exportSuccessAt) return; // mismo evento
    lastSeenRef.current = exportSuccessAt;
    setCopied(false);
    setShow(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShow(false), 8000);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [exportSuccessAt]);

  if (!show) return null;

  const headings = doc?.elements.filter((e) => e.type === 'heading').length || 0;
  const figures = doc?.elements.filter((e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0).length || 0;
  const tables = doc?.elements.filter((e) => e.type === 'table' && e.table_info).length || 0;
  const pages = doc?.meta?.page_count || 0;
  const ghosts = citationAuditResult?.ghost_citations?.length || 0;
  const refs = references?.length || doc?.referencias?.length || 0;
  const fileName = (doc as any)?.meta?.file_name || doc?.file_name || 'documento';

  const summary = [
    `Entrega APA 7 — ${fileName}`,
    `${pages || '?'} páginas · ${headings} títulos · ${figures} figuras · ${tables} tablas · ${refs} referencias`,
    ghosts === 0 ? 'Citas al día: sin citas fantasma' : `${ghosts} cita(s) sin referencia (revisar en Referencias)`,
    'Formateado con WordAPA7',
  ].join('\n');

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard no disponible */ }
  };

  return (
    <div className="download-success" role="status" aria-live="polite">
      <div className="download-success-icon">
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
          <circle cx="17" cy="17" r="15" className="download-success-ring" />
          <path d="M10 17.5 L15 22.5 L24 12" className="download-success-check" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
      <span className="download-success-text">¡Listo, a entregar!</span>

      {/* Papeleta de entrega */}
      <div style={{
        marginTop: '12px', width: '100%', maxWidth: '360px',
        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--surface-elevated)', overflow: 'hidden',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-main)' }}>Papeleta de entrega</span>
          <span style={{ marginLeft: 'auto' }} />
          <button
            type="button"
            onClick={copySummary}
            title="Copiar resumen"
            aria-label="Copiar resumen"
            style={{
              display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700,
              padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit',
              background: copied ? 'rgba(82,196,26,0.14)' : 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)', borderRadius: '999px',
              color: copied ? 'var(--accent-success)' : 'var(--text-secondary)',
            }}
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <pre style={{
          margin: 0, padding: '10px 12px', fontSize: '11px', lineHeight: 1.6,
          color: 'var(--text-secondary)', fontFamily: 'inherit', whiteSpace: 'pre-wrap',
        }}>
          {summary}
        </pre>
      </div>
    </div>
  );
};

export default DownloadSuccessOverlay;

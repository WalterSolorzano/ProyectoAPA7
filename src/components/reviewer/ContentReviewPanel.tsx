/* WordAPA7 — Panel de "Revisión de contenido".
 * Checks de calidad académica (taxonomía de Bloom, introducción, hipótesis,
 * metodología, resumen, conclusiones) SEPARADOS de la revisión de formato APA.
 * v1 es 100% local: no gasta tokens de IA.
 */

import React, { useMemo } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { reviewContent, CONTENT_SECTION_LABELS, ContentFinding } from '../../lib/contentReview';
import { X, ClipboardCheck, Lightbulb, AlertTriangle, Info, ArrowRight } from 'lucide-react';

const SEVERITY_META: Record<ContentFinding['severity'], { label: string; color: string; icon: React.ReactNode }> = {
  error: { label: 'Revisar', color: 'var(--color-danger)', icon: <AlertTriangle size={11} /> },
  warning: { label: 'Sugerencia', color: 'var(--color-warning)', icon: <Lightbulb size={11} /> },
  info: { label: 'Idea', color: 'var(--color-info)', icon: <Info size={11} /> },
};

export const ContentReviewPanel: React.FC = () => {
  const isOpen = useDocStore((s) => s.isContentReviewOpen);
  const setOpen = useDocStore((s) => s.setContentReviewOpen);
  const doc = useDocStore((s) => s.doc);

  const findings = useMemo(() => {
    if (!doc) return [];
    return reviewContent(doc.elements as any[], (doc as any).file_name || (doc as any).title || '');
  }, [doc]);

  const handleNavigate = (elementId: string) => {
    useDocStore.getState().setSelectedElementId(elementId);
  };

  if (!isOpen) return null;

  const grouped = new Map<string, ContentFinding[]>();
  for (const f of findings) {
    const arr = grouped.get(f.section) || [];
    arr.push(f);
    grouped.set(f.section, arr);
  }

  const total = findings.length;
  const bySeverity = (sev: ContentFinding['severity']) => findings.filter((f) => f.severity === sev).length;

  return (
      <div style={{
        position: 'fixed', right: '16px', top: '64px', bottom: '64px', width: 'min(360px, calc(100vw - 32px))',
        zIndex: 80, display: 'flex', flexDirection: 'column',
        background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
        animation: 'download-success-in 0.2s ease-out both',
      }}>
        {/* Cabecera */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
          borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
        }}>
          <ClipboardCheck size={15} color="var(--accent-primary)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
              {total} hallazgos de contenido
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
              {bySeverity('error') > 0 && <span style={{ color: 'var(--color-danger)' }}>{bySeverity('error')} corregir</span>}
              {bySeverity('warning') > 0 && <span style={{ color: 'var(--color-warning)' }}>{bySeverity('warning')} sugerencias</span>}
              {bySeverity('info') > 0 && <span style={{ color: 'var(--color-info)' }}>{bySeverity('info')} ideas</span>}
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} title="Cerrar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', display: 'flex' }}>
            <X size={15} />
          </button>
        </div>

        {/* Lista compacta */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          {total === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', padding: '32px 12px', lineHeight: 1.5 }}>
              Sin hallazgos. Las reglas que requieren LLM quedan desactivadas.
            </div>
          )}
          {[...grouped.entries()].map(([section, items]) => (
            <div key={section}>
              <div style={{
                fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: 'var(--text-tertiary)', padding: '8px 6px 4px',
              }}>
                {CONTENT_SECTION_LABELS[section] || section}
              </div>
              {items.map((f) => {
                const meta = SEVERITY_META[f.severity];
                const firstId = f.elementIds[0];
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => firstId && handleNavigate(firstId)}
                    title="Click: ver en el documento"
                    style={{
                      display: 'flex', gap: '8px', width: '100%', textAlign: 'left',
                      background: 'transparent', border: 'none', borderRadius: '8px',
                      padding: '7px 8px', cursor: firstId ? 'pointer' : 'default',
                      fontFamily: 'inherit', lineHeight: 1.35,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ color: meta.color, display: 'flex', flexShrink: 0, marginTop: 1 }}>{meta.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>{f.message}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: 2 }}>{f.suggestion}</div>
                    </div>
                    {firstId && <ArrowRight size={10} style={{ flexShrink: 0, color: 'var(--text-tertiary)', marginTop: 3 }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
  );
};

export default ContentReviewPanel;

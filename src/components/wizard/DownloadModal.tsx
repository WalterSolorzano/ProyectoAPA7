/* WordAPA7 — Download Modal (acción terminal, no es un paso)
   Per plan §3.9: máximo 2 botones (Cancelar + Descargar), sin elementos decorativos.
   Corrección 5: checklist específico con datos reales del documento procesado,
   con advertencias clickeables que llevan al paso correspondiente. */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { FileText, Loader2, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';
import { Modal } from '../ui/wordapa7';
import { needsReview } from '../../lib/portadaAuthors';
import { parseAuthorEntries } from '../../lib/portadaAuthors';

type ExportFormat = 'docx' | 'pdf' | 'tracked' | 'latex';

const FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: 'docx', label: 'Word (.docx)', hint: 'Formato editable' },
  { id: 'pdf', label: 'PDF', hint: 'Listo para imprimir' },
  { id: 'tracked', label: 'Word con cambios visibles', hint: 'Track changes vs original' },
  { id: 'latex', label: 'LaTeX (.tex)', hint: 'Código fuente compilable' },
];

interface ChecklistItem {
  label: string;
  ok: boolean;
  count?: number;
  targetStep?: number;
}

export const DownloadModal: React.FC = () => {
  const { isDownloadModalOpen, setDownloadModalOpen, exportDocx, exportPdf, isLoading, doc, portada, validationIssues, setWizardStep, exportLatex, showToast } = useDocStore();
  const [format, setFormat] = useState<ExportFormat>('docx');

  if (!isDownloadModalOpen) return null;

  const unresolved = validationIssues.filter((i) => i.severity === 'error').length;
  const warnings = validationIssues.filter((i) => i.severity === 'warning').length;

  const headingsCount = doc ? doc.elements.filter((e) => e.type === 'heading').length : 0;
  const figuresCount = doc ? doc.elements.filter((e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0).length : 0;
  const tablesCount = doc ? doc.elements.filter((e) => e.type === 'table' && e.table_info).length : 0;
  const authorsCount = parseAuthorEntries(portada.author).length;
  const reviewHeadings = doc ? doc.elements.filter((e) => e.type === 'heading' && needsReview(e as any)).length : 0;
  const reviewFigures = doc ? doc.elements.filter((e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0 && needsReview(e as any)).length : 0;
  const reviewTables = doc ? doc.elements.filter((e) => e.type === 'table' && e.table_info && needsReview(e as any)).length : 0;
  const refsCount = doc ? (doc.referencias?.length || 0) : 0;

  const checklist: ChecklistItem[] = [
    { label: `Portada con ${authorsCount} integrante${authorsCount === 1 ? '' : 's'}`, ok: authorsCount > 0 },
    { label: `${headingsCount} títulos clasificados`, ok: reviewHeadings === 0, count: reviewHeadings, targetStep: 2 },
    { label: `${figuresCount} figuras y ${tablesCount} tablas`, ok: reviewFigures === 0 && reviewTables === 0, count: reviewFigures + reviewTables, targetStep: 3 },
    { label: `${refsCount} referencias en la lista`, ok: refsCount > 0, targetStep: 5 },
    { label: 'Citas cruzadas contra referencias', ok: unresolved === 0, count: unresolved, targetStep: 5 },
  ];

  const goToStep = (step?: number) => {
    if (step) setWizardStep(step);
    setDownloadModalOpen(false);
  };

  const handleDownload = () => {
    // Mensaje de madrugada: si se exporta entre 1am y 5am (hora local)
    const hour = new Date().getHours();
    if (hour >= 1 && hour < 5) {
      showToast('subiendo esto a esta hora, eh… éxito con la entrega 🫡', 'info');
    }
    if (format === 'pdf') {
      exportPdf();
    } else if (format === 'latex') {
      exportLatex();
    } else {
      exportDocx(format === 'tracked');
    }
    setDownloadModalOpen(false);
  };

  const handlePreviewPdf = () => {
    setDownloadModalOpen(false);
    useDocStore.getState().setViewMode('result');
  };

  return (
    <Modal open onClose={() => setDownloadModalOpen(false)} style={{ maxWidth: '520px' }}>
      <div style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', margin: 0 }}>
            Descargar documento
          </h2>
          <button
            type="button"
            onClick={() => setDownloadModalOpen(false)}
            aria-label="Cerrar"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: '4px', borderRadius: 'var(--radius-sm)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-4)', lineHeight: 1.5 }}>
          Tu documento está formateado a APA 7. Antes de exportar, esto es lo que se revisó:
        </p>

        {/* Checklist específico con datos reales */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
          {checklist.map((item) => (
            <div
              key={item.label}
              role={item.ok || item.targetStep === undefined ? undefined : 'button'}
              tabIndex={item.ok || item.targetStep === undefined ? undefined : 0}
              onClick={() => { if (!item.ok && item.targetStep) goToStep(item.targetStep); }}
              onKeyDown={(e) => { if (!item.ok && item.targetStep && (e.key === 'Enter' || e.key === ' ')) goToStep(item.targetStep); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: item.ok ? 'rgba(45,106,79,0.08)' : 'rgba(183,121,31,0.08)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${item.ok ? 'rgba(45,106,79,0.2)' : 'rgba(183,121,31,0.25)'}`,
                cursor: item.ok || item.targetStep === undefined ? 'default' : 'pointer',
                transition: 'border-color var(--transition-fast)',
              }}
            >
              {item.ok ? (
                <CheckCircle2 size={16} color="var(--color-success)" style={{ flexShrink: 0 }} />
              ) : (
                <AlertTriangle size={16} color="var(--color-warning)" style={{ flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{item.label}</span>
              {!item.ok && item.count !== undefined && (
                <span style={{
                  fontSize: 'var(--text-xs)', color: 'var(--color-warning)',
                  marginLeft: 'auto', fontWeight: 'var(--font-medium)',
                }}>
                  {item.count} por revisar
                </span>
              )}
              {!item.ok && item.targetStep && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', marginLeft: '4px', fontWeight: 'var(--font-medium)', whiteSpace: 'nowrap' }}>
                  Ir al paso →
                </span>
              )}
            </div>
          ))}
        </div>

        <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-4)', lineHeight: 1.5 }}>
          Elige el formato de salida:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
          {FORMATS.map((f) => (
            <label
              key={f.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                border: `1px solid ${format === f.id ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                background: format === f.id ? 'var(--color-accent-soft)' : 'transparent',
                transition: 'border-color var(--transition-fast), background var(--transition-fast)',
              }}
            >
              <input
                type="radio"
                name="export-format"
                checked={format === f.id}
                onChange={() => setFormat(f.id)}
                style={{ accentColor: 'var(--color-accent)' }}
              />
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)' }}>{f.label}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>{f.hint}</span>
            </label>
          ))}
          <button
            type="button"
            onClick={handlePreviewPdf}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
              padding: '6px 10px', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)',
              background: 'transparent', color: 'var(--color-accent)', cursor: 'pointer',
              border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-sm)',
              alignSelf: 'flex-start',
            }}
            title="Generar y ver el PDF formateado sin descargarlo"
          >
            <Eye size={14} /> Vista previa PDF
          </button>
        </div>

        {unresolved > 0 && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'rgba(197,48,48,0.06)', border: '1px solid rgba(197,48,48,0.2)',
            borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-5)',
          }}>
            <AlertTriangle size={16} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '1px' }} />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              {unresolved} inconsistencias sin resolver (además de {warnings} advertencias). Puedes descargar de todas formas.
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setDownloadModalOpen(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={isLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            {isLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={16} />}
            {isLoading ? 'Generando…' : 'Descargar'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DownloadModal;

/* WordAPA7 — Export & Health Check modal (acción terminal, no es un paso)
   - Card "[Perfil] Health Check" con pill Good / Needs review
   - Checklist generado desde el perfil activo (verde resuelto / ámbar pendiente)
   - Modo Rápido: los bloqueadores duros (portada incompleta, cita sin referencia)
     se resuelven con campos inline dentro del modal y deshabilitan Descargar.
     Las advertencias suaves se listan pero nunca bloquean.
   - El flujo guiado conserva "Ir al paso →" para cada pendiente. */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { FileText, Loader2, CheckCircle2, AlertTriangle, Eye, ShieldCheck } from 'lucide-react';
import { Modal, InputField } from '../ui/wordapa7';
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

const COVER_FIELDS: { key: 'title' | 'author' | 'institution' | 'course' | 'instructor' | 'date'; label: string; placeholder: string }[] = [
  { key: 'title', label: 'Título del trabajo', placeholder: 'Título completo del documento' },
  { key: 'author', label: 'Autor/es', placeholder: 'Nombre y apellido del autor' },
  { key: 'institution', label: 'Institución', placeholder: 'Universidad o facultad' },
  { key: 'course', label: 'Curso / materia', placeholder: 'Nombre del curso' },
  { key: 'instructor', label: 'Docente', placeholder: 'Nombre del docente' },
  { key: 'date', label: 'Fecha', placeholder: 'DD/MM/AAAA' },
];

export const DownloadModal: React.FC = () => {
  const {
    isDownloadModalOpen, setDownloadModalOpen, exportDocx, exportPdf, isLoading, doc,
    portada, validationIssues, setWizardStep, exportLatex, showToast,
    profiles, activeProfileId, pendingQuickExport, clearQuickExport,
    citationAuditResult, addReference, runCitationAudit, setPortada,
  } = useDocStore();
  const [format, setFormat] = useState<ExportFormat>('docx');
  const [refAuthor, setRefAuthor] = useState('');
  const [refYear, setRefYear] = useState('');
  const [refTitle, setRefTitle] = useState('');
  const [refSource, setRefSource] = useState('');

  if (!isDownloadModalOpen) return null;

  const profile = profiles.find((p) => p.profile_id === activeProfileId) || profiles[0] || null;
  const profileName = profile?.display_name || 'APA 7ª edición';

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

  // ── Bloqueadores duros del Health Check (perfil) ──────────────────────────
  const requiredFields = (profile?.cover_required_fields || ['title', 'author']).filter(
    (f) => COVER_FIELDS.some((c) => c.key === f)
  );
  const missingCover = requiredFields.filter((f) => !(portada[f as keyof typeof portada] || '').toString().trim());
  const ghostCount = citationAuditResult?.ghost_citations?.length || 0;
  const blockers = pendingQuickExport ? missingCover.length + ghostCount : 0;
  const healthOk = blockers === 0;

  const checklist: ChecklistItem[] = [
    { label: `Portada con ${authorsCount} integrante${authorsCount === 1 ? '' : 's'}`, ok: missingCover.length === 0 },
    { label: `${headingsCount} títulos clasificados`, ok: reviewHeadings === 0, count: reviewHeadings, targetStep: 2 },
    { label: `${figuresCount} figuras y ${tablesCount} tablas`, ok: reviewFigures === 0 && reviewTables === 0, count: reviewFigures + reviewTables, targetStep: 3 },
    { label: `${refsCount} referencias en la lista`, ok: refsCount > 0, targetStep: 5 },
    { label: 'Citas cruzadas contra referencias', ok: ghostCount === 0 && unresolved === 0, count: ghostCount + unresolved, targetStep: 5 },
  ];

  const goToStep = (step?: number) => {
    setDownloadModalOpen(false);
    clearQuickExport();
    if (step) setWizardStep(step);
  };

  const handleDownload = () => {
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
    clearQuickExport();
    setDownloadModalOpen(false);
  };

  const handlePreviewPdf = () => {
    setDownloadModalOpen(false);
    clearQuickExport();
    useDocStore.getState().setViewMode('result');
  };

  const addInlineReference = () => {
    if (!refAuthor.trim() || !refTitle.trim()) {
      showToast('Completá al menos autor y título de la referencia', 'warning');
      return;
    }
    const raw = `${refAuthor.trim()} (${refYear.trim() || 's.f.'}). ${refTitle.trim()}. ${refSource.trim()}`;
    addReference({
      id: `ref_${Date.now()}`,
      authors: [refAuthor.trim()],
      year: refYear.trim() || undefined,
      title: refTitle.trim(),
      source: refSource.trim(),
      raw_text: raw,
    });
    setRefAuthor(''); setRefYear(''); setRefTitle(''); setRefSource('');
    showToast('Referencia agregada. Verificando citas…', 'info');
    runCitationAudit().catch(() => {});
  };

  return (
    <Modal open onClose={() => setDownloadModalOpen(false)} style={{ maxWidth: '560px' }}>
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

        {/* Card: Health Check del perfil */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)',
          backgroundColor: 'var(--color-surface-raised)', border: '1px solid var(--color-border-strong)',
          borderRadius: 'var(--radius-md)',
        }}>
          <ShieldCheck size={18} color={healthOk ? 'var(--color-success)' : 'var(--color-warning)'} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
              {profileName} — Health Check
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', lineHeight: 1.4 }}>
              {pendingQuickExport
                ? 'Modo Rápido aplicó todo lo resoluble. Completá lo pendiente abajo para desbloquear la descarga.'
                : 'Verificá cada punto antes de exportar; los pendientes te llevan al paso indicado.'}
            </div>
          </div>
          <span style={{
            padding: '3px 10px', borderRadius: '999px', fontSize: 'var(--text-xs)',
            fontWeight: 'var(--font-semibold)', whiteSpace: 'nowrap',
            backgroundColor: healthOk ? 'rgba(45,106,79,0.12)' : 'rgba(183,121,31,0.12)',
            color: healthOk ? 'var(--color-success)' : 'var(--color-warning)',
            border: `1px solid ${healthOk ? 'rgba(45,106,79,0.3)' : 'rgba(183,121,31,0.35)'}`,
          }}>
            {healthOk ? 'Correcto' : 'Pendiente'}
          </span>
        </div>

        {/* Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          {checklist.map((item) => (
            <div
              key={item.label}
              role={item.ok || item.targetStep === undefined || pendingQuickExport ? undefined : 'button'}
              tabIndex={item.ok || item.targetStep === undefined || pendingQuickExport ? undefined : 0}
              onClick={() => { if (!item.ok && item.targetStep && !pendingQuickExport) goToStep(item.targetStep); }}
              onKeyDown={(e) => { if (!item.ok && item.targetStep && !pendingQuickExport && (e.key === 'Enter' || e.key === ' ')) goToStep(item.targetStep); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: item.ok ? 'rgba(45,106,79,0.08)' : 'rgba(183,121,31,0.08)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${item.ok ? 'rgba(45,106,79,0.2)' : 'rgba(183,121,31,0.25)'}`,
                cursor: item.ok || item.targetStep === undefined || pendingQuickExport ? 'default' : 'pointer',
              }}
            >
              {item.ok ? (
                <CheckCircle2 size={16} color="var(--color-success)" style={{ flexShrink: 0 }} />
              ) : (
                <AlertTriangle size={16} color="var(--color-warning)" style={{ flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{item.label}</span>
              {!item.ok && item.count !== undefined && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)', marginLeft: 'auto', fontWeight: 'var(--font-medium)' }}>
                  {item.count} por revisar
                </span>
              )}
              {!item.ok && item.targetStep && !pendingQuickExport && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', marginLeft: '4px', fontWeight: 'var(--font-medium)', whiteSpace: 'nowrap' }}>
                  Ir al paso →
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Bloqueador duro: portada incompleta → campos inline */}
        {pendingQuickExport && missingCover.length > 0 && (
          <div style={{
            padding: 'var(--space-4)', marginBottom: 'var(--space-4)',
            backgroundColor: 'rgba(183,121,31,0.06)', border: '1px solid rgba(183,121,31,0.3)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <AlertTriangle size={15} color="var(--color-warning)" />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                Falta completar la portada ({missingCover.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {missingCover.map((f) => {
                const field = COVER_FIELDS.find((c) => c.key === f);
                if (!field) return null;
                return (
                  <label key={f} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                    {field.label}
                    <InputField
                      value={(portada[f as keyof typeof portada] || '').toString()}
                      placeholder={field.placeholder}
                      onChange={(e) => setPortada({ [f]: e.target.value } as any)}
                      style={{ marginTop: '4px' }}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Bloqueador duro: citas sin referencia → mini-form inline */}
        {pendingQuickExport && ghostCount > 0 && (
          <div style={{
            padding: 'var(--space-4)', marginBottom: 'var(--space-4)',
            backgroundColor: 'rgba(183,121,31,0.06)', border: '1px solid rgba(183,121,31,0.3)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <AlertTriangle size={15} color="var(--color-warning)" />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                {ghostCount} cita{ghostCount === 1 ? '' : 's'} sin referencia
              </span>
            </div>
            <ul style={{ margin: '0 0 var(--space-3)', paddingLeft: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              {(citationAuditResult?.ghost_citations || []).slice(0, 6).map((g: any, i: number) => (
                <li key={i} style={{ marginBottom: '2px' }}>{String(g).slice(0, 90)}</li>
              ))}
              {ghostCount > 6 && <li>y {ghostCount - 6} más…</li>}
            </ul>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <InputField placeholder="Autor/es" value={refAuthor} onChange={(e) => setRefAuthor(e.target.value)} />
              <InputField placeholder="Año" value={refYear} onChange={(e) => setRefYear(e.target.value)} />
            </div>
            <InputField placeholder="Título" value={refTitle} onChange={(e) => setRefTitle(e.target.value)} style={{ marginBottom: 'var(--space-2)' }} />
            <InputField placeholder="Fuente (editorial, revista…)" value={refSource} onChange={(e) => setRefSource(e.target.value)} />
            <button
              type="button"
              onClick={addInlineReference}
              style={{
                marginTop: 'var(--space-2)', padding: '6px 12px', fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)', background: 'transparent',
                color: 'var(--color-accent)', cursor: 'pointer',
                border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-sm)',
              }}
            >
              + Agregar referencia y re-verificar
            </button>
          </div>
        )}

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

        {pendingQuickExport && blockers > 0 && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'rgba(197,48,48,0.06)', border: '1px solid rgba(197,48,48,0.2)',
            borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-5)',
          }}>
            <AlertTriangle size={16} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '1px' }} />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              {blockers} bloqueador{blockers === 1 ? '' : 'es'} pendiente{blockers === 1 ? '' : 's'}: completá la portada y/o agregá las referencias faltantes para habilitar la descarga.
            </span>
          </div>
        )}
        {!pendingQuickExport && unresolved > 0 && (
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
          {pendingQuickExport ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => goToStep(ghostCount > 0 ? 5 : missingCover.length > 0 ? 1 : 2)}
              title="Volver al flujo guiado para revisar este documento paso a paso"
            >
              Volver a editar
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setDownloadModalOpen(false)}
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={isLoading || blockers > 0}
            title={blockers > 0 ? 'Resolvé los bloqueadores para habilitar la descarga' : undefined}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            {isLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={16} />}
            {isLoading ? 'Generando…' : 'Descargar documento'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DownloadModal;

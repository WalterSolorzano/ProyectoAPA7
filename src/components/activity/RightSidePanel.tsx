/* WordAPA7 — Panel derecho CONTEXTUAL único.
   - Sin selección  → "Documento": resumen, acciones rápidas, resultado de
     revisión IA (con mensaje claro) y actividad útil.
   - Elemento seleccionado → "Inspector": cambia según el tipo de elemento
     (texto → formato + IA, imagen → edición de imagen, tabla → APA).
   - Sin ruido: los toasts/saludos no viven acá (Capa 2).
   - Se abre automáticamente al seleccionar un elemento. */

import React, { useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ResizablePanel } from '../shared/ResizablePanel';
import { ElementInspector } from '../inspector/ElementInspector';
import { ReferenceForm } from '../referencias/ReferenceForm';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, Loader2, RotateCw, Activity, ShieldAlert, FileText, Download, ListChecks, Sparkles, X, BookOpen } from 'lucide-react';

const EVENT_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle2 size={15} color="var(--color-success)" />,
  error: <AlertCircle size={15} color="var(--color-danger)" />,
  info: <Info size={15} color="var(--color-info)" />,
  warning: <AlertTriangle size={15} color="var(--color-warning)" />,
};

function timeAgo(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 10) return 'ahora';
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export const RightSidePanel: React.FC = () => {
  const {
    forceRightPanelOpen, setForceRightPanelOpen,
    selectedElementId, selectedReferenceId, doc, wizardStep,
  } = useDocStore();

  // Se abre automáticamente al seleccionar un elemento o una referencia
  useEffect(() => {
    if ((selectedElementId || selectedReferenceId) && doc) setForceRightPanelOpen(true);
  }, [selectedElementId, selectedReferenceId, doc, setForceRightPanelOpen]);

  if (!forceRightPanelOpen) return null;

  const hasSelection = !!selectedElementId && !!doc;
  const hasReference = !hasSelection && !!selectedReferenceId;

  const sectionNames: Record<number, string> = {
    1: 'Portada', 2: 'Estructura', 3: 'Figuras y tablas', 4: 'Cuerpo', 5: 'Referencias',
  };
  const currentSection = sectionNames[wizardStep] || '';

  return (
    <ResizablePanel side="right" defaultWidth={300} minWidth={260} maxWidth={620} localStorageKey="wordapa7-inspector-width">
      <div style={{
        flexShrink: 0, display: 'flex', flexDirection: 'column',
        height: '100%', overflow: 'hidden',
        background: 'var(--sidebar-bg)', borderLeft: '1px solid var(--border-subtle)',
      }}>
        {/* Header contextual */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
          padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--sidebar-bg)',
        }}>
          {hasSelection ? (
            <ListChecks size={14} color="var(--accent-primary)" />
          ) : hasReference ? (
            <BookOpen size={14} color="var(--accent-primary)" />
          ) : (
            <FileText size={14} color="var(--accent-primary)" />
          )}
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
            {hasSelection ? 'Inspector' : hasReference ? 'Referencia' : `Documento${currentSection ? ` · ${currentSection}` : ''}`}
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => setForceRightPanelOpen(false)}
            aria-label="Cerrar panel"
            title="Cerrar panel"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          {hasSelection ? (
            <ElementInspector />
          ) : hasReference ? (
            <ReferenceForm key={selectedReferenceId} />
          ) : (
            <DocumentPanel />
          )}
        </div>
      </div>
    </ResizablePanel>
  );
};

// ── Panel "Documento" (sin selección): resumen + acciones + actividad útil ──

const DocumentPanel: React.FC = () => {
  const {
    doc, reviewResult, isReviewLoading, runAIReview, activityEvents,
    setDownloadModalOpen, runLLMClassify, runCitationAudit, citationAuditResult,
    llmProgress,
  } = useDocStore();

  if (!doc) return null;

  const headings = doc.elements.filter((e) => e.type === 'heading').length;
  const paragraphs = doc.elements.filter((e) => e.type === 'paragraph').length;
  const figures = doc.elements.filter((e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0).length;
  const tables = doc.elements.filter((e) => e.type === 'table' && e.table_info).length;
  const refs = doc.referencias?.length || 0;

  const aiFlags = reviewResult?.flagged_count || 0;
  const spellFlags = reviewResult?.spelling_count || 0;
  const llmActive = llmProgress.status !== 'idle';

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Resumen del documento */}
      <div style={{
        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--surface-elevated)', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <Activity size={15} color="var(--accent-secondary)" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>Resumen</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '10px 12px' }}>
          {[
            { label: 'Títulos', value: headings },
            { label: 'Párrafos', value: paragraphs },
            { label: 'Figuras', value: figures },
            { label: 'Tablas', value: tables },
            { label: 'Referencias', value: refs },
            { label: 'Citas fantasma', value: citationAuditResult?.ghost_citations?.length || 0, danger: (citationAuditResult?.ghost_citations?.length || 0) > 0, hint: 'Citas en el texto sin referencia en la bibliografía' },
          ].map((s) => (
            <div key={s.label} style={{ fontSize: '11px', color: 'var(--text-secondary)' }} title={(s as any).hint || s.label}>
              <span style={{ display: 'block', fontWeight: 800, color: s.danger ? 'var(--accent-danger)' : 'var(--text-main)', fontSize: '16px' }}>
                {s.value}
              </span>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Acciones rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <button
          type="button"
          onClick={() => setDownloadModalOpen(true)}
          className="btn btn-primary"
          style={{ justifyContent: 'center', fontSize: '12px', padding: '8px 6px' }}
        >
          <Download size={13} /> Descargar
        </button>
        <button
          type="button"
          onClick={() => { if (!isReviewLoading && !reviewResult) runAIReview(); else if (reviewResult) {} }}
          disabled={isReviewLoading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '8px 6px', fontSize: '12px', fontWeight: 600, cursor: isReviewLoading ? 'wait' : 'pointer',
            background: 'var(--color-accent-soft)', color: 'var(--accent-primary)',
            border: '1px solid rgba(79,124,255,0.35)', borderRadius: 'var(--radius-md)', fontFamily: 'inherit',
          }}
        >
          {isReviewLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldAlert size={13} />}
          {isReviewLoading ? 'Analizando…' : 'Revisor IA'}
        </button>
        <button
          type="button"
          onClick={() => runLLMClassify()}
          disabled={llmActive}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '8px 6px', fontSize: '12px', fontWeight: 600, cursor: llmActive ? 'wait' : 'pointer',
            background: 'var(--color-accent-soft)', color: 'var(--accent-primary)',
            border: '1px solid rgba(79,124,255,0.35)', borderRadius: 'var(--radius-md)', fontFamily: 'inherit',
          }}
        >
          <Sparkles size={13} /> {llmActive ? 'Clasificando…' : 'Refinar IA'}
        </button>
        <button
          type="button"
          onClick={() => runCitationAudit()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '8px 6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            background: 'var(--surface-subtle)', color: 'var(--text-main)',
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontFamily: 'inherit',
          }}
        >
          <ListChecks size={13} /> Validar citas
        </button>
      </div>

      {/* Resultado de revisión IA */}
      {(reviewResult || isReviewLoading) && (
        <div style={{
          border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--surface-elevated)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <ShieldAlert size={15} color="var(--accent-primary)" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>Revisión IA</span>
          </div>
          <div style={{ padding: '12px' }}>
            {isReviewLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Analizando documento…
                <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : reviewResult ? (
              <>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '8px' }}>
                  {reviewResult.total_paragraphs} párrafos analizados:
                </div>
                <ul style={{ margin: '0 0 10px', paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  <li>
                    <strong style={{ color: aiFlags > 0 ? 'var(--accent-warning)' : 'var(--accent-success)' }}>{aiFlags}</strong>{' '}
                    párrafo{aiFlags === 1 ? '' : 's'} con frases de posible texto generado
                  </li>
                  <li>
                    <strong style={{ color: spellFlags > 0 ? 'var(--accent-warning)' : 'var(--accent-success)' }}>{spellFlags}</strong>{' '}
                    párrafo{spellFlags === 1 ? '' : 's'} con posibles errores de ortografía
                  </li>
                </ul>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  El texto señalado se marca sobre el documento (subrayado punteado = IA, ondulado = ortografía).
                </div>
                <button
                  type="button"
                  onClick={() => runAIReview()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                    borderRadius: '8px', cursor: 'pointer', background: 'var(--color-accent-soft)',
                    color: 'var(--accent-primary)', border: '1px solid rgba(79,124,255,0.35)',
                    fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
                  }}
                >
                  <RotateCw size={13} /> Revisar de nuevo
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Actividad reciente (solo eventos útiles) */}
      {activityEvents.length > 0 && (
        <div style={{
          border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--surface-elevated)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <Activity size={15} color="var(--accent-secondary)" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>Actividad</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activityEvents.slice(0, 8).map((ev: any) => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ flexShrink: 0, marginTop: '1px' }}>{EVENT_ICONS[ev.kind] || EVENT_ICONS.info}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.4 }}>{ev.title}</div>
                  {ev.detail && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '2px' }}>{ev.detail}</div>}
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>{timeAgo(ev.time)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RightSidePanel;

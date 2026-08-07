/* WordAPA7 — Túnel de Exportación (reemplaza DownloadModal).
   Vista dedicada, sin modal: el documento SIEMPRE se ve (preview a la derecha).
   - Izquierda: tarjetas de formato + "Manifiesto de Entrega" (resumen de validación).
   - Fricción intencional: con citas rotas el botón NO descarga de una; pregunta
     "¿Descargar igual o resolver?" y despliega el QuickReferenceSearch inline. */

import React, { useEffect, useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ReactPDFPreview } from '../layout/ReactPDFPreview';
import { QuickReferenceSearch } from './QuickReferenceSearch';
import { needsReview, parseAuthorEntries } from '../../lib/portadaAuthors';
import {
  ArrowLeft, FileText, FileType, FileCode, ShieldCheck, CheckCircle2,
  AlertTriangle, Download, Loader2, ChevronRight, ListChecks,
} from 'lucide-react';

type Format = 'docx' | 'pdf' | 'latex';

const FORMATS: { id: Format; label: string; hint: string; icon: React.ElementType }[] = [
  { id: 'docx', label: 'Word (.docx)', hint: 'Editable en Word', icon: FileText },
  { id: 'pdf', label: 'PDF', hint: 'Listo para imprimir', icon: FileType },
  { id: 'latex', label: 'LaTeX (.tex)', hint: 'Fuente compilable', icon: FileCode },
];

const COVER_FIELDS: { key: string; label: string }[] = [
  { key: 'title', label: 'Título' },
  { key: 'author', label: 'Autor' },
  { key: 'institution', label: 'Institución' },
  { key: 'course', label: 'Curso' },
  { key: 'instructor', label: 'Docente' },
  { key: 'date', label: 'Fecha' },
];

export const ExportView: React.FC = () => {
  const {
    doc, portada, validationIssues, isLoading,
    exportDocx, exportPdf, exportLatex,
    profiles, activeProfileId, setWizardStep, setViewMode,
    citationAuditResult, sayMascot, clearQuickExport,
  } = useDocStore();

  const [format, setFormat] = useState<Format>('docx');
  const [tracked, setTracked] = useState(false);
  const [friction, setFriction] = useState<'idle' | 'ask' | 'resolve'>('idle');

  useEffect(() => {
    sayMascot('Tu documento está listo. Elegí el formato y descargalo.', 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!doc) return null;

  const profile = profiles.find((p) => p.profile_id === activeProfileId) || profiles[0] || null;
  const requiredFields = (profile?.cover_required_fields || ['title', 'author']).filter(
    (f) => COVER_FIELDS.some((c) => c.key === f),
  );
  const missingCover = requiredFields.filter((f) => !(portada[f as keyof typeof portada] || '').toString().trim());

  const ghostCount = citationAuditResult?.ghost_citations?.length || 0;
  const unresolved = validationIssues.filter((i) => i.severity === 'error').length;

  const headingsCount = doc.elements.filter((e) => e.type === 'heading').length;
  const reviewHeadings = doc.elements.filter((e) => e.type === 'heading' && needsReview(e as any)).length;
  const figuresCount = doc.elements.filter((e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0).length;
  const tablesCount = doc.elements.filter((e) => e.type === 'table' && e.table_info).length;
  const reviewFigures = doc.elements.filter((e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0 && needsReview(e as any)).length;
  const reviewTables = doc.elements.filter((e) => e.type === 'table' && e.table_info && needsReview(e as any)).length;
  const refsCount = doc.referencias?.length || 0;
  const authorsCount = parseAuthorEntries(portada.author).length;

  const manifest = [
    {
      label: `Portada con ${authorsCount} integrante${authorsCount === 1 ? '' : 's'}`,
      ok: missingCover.length === 0,
      hint: missingCover.length > 0 ? `Faltan: ${missingCover.join(', ')}` : 'Todos los campos requeridos completos',
      step: 1,
    },
    {
      label: `${headingsCount} títulos clasificados`,
      ok: reviewHeadings === 0,
      hint: reviewHeadings > 0 ? `${reviewHeadings} por revisar` : 'Jerarquía revisada',
      step: 2,
    },
    {
      label: `${figuresCount} figuras y ${tablesCount} tablas`,
      ok: reviewFigures === 0 && reviewTables === 0,
      hint: reviewFigures + reviewTables > 0 ? `${reviewFigures + reviewTables} por revisar` : 'Rotulación APA correcta',
      step: 3,
    },
    {
      label: `${refsCount} referencia${refsCount === 1 ? '' : 's'} en la lista`,
      ok: refsCount > 0,
      hint: refsCount > 0 ? 'Bibliografía ordenada' : 'Aún no hay referencias',
      step: 5,
    },
    {
      label: 'Citas cruzadas contra referencias',
      ok: ghostCount === 0 && unresolved === 0,
      hint: ghostCount + unresolved > 0 ? `${ghostCount + unresolved} hallazgo(s)` : 'Todo coincide',
      step: 5,
    },
  ];

  const goToStep = (step: number) => {
    clearQuickExport();
    setViewMode('edit');
    setWizardStep(step);
  };

  const doExport = () => {
    clearQuickExport();
    if (format === 'pdf') exportPdf();
    else if (format === 'latex') exportLatex();
    else exportDocx(tracked);
  };

  const handleDownloadClick = () => {
    if (ghostCount > 0 && friction === 'idle') {
      setFriction('ask');
      return;
    }
    doExport();
  };

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', minWidth: 0 }}>
      {/* ── Panel izquierdo: formato + manifiesto ── */}
      <aside style={{
        width: 'min(380px, 38%)', minWidth: 300, flexShrink: 0,
        backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Header */}
          <div>
            <button
              type="button"
              onClick={() => { clearQuickExport(); setViewMode('edit'); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                border: 'none', background: 'transparent', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600,
                padding: '4px 0', fontFamily: 'inherit',
              }}
            >
              <ArrowLeft size={13} /> Volver al editor
            </button>
            <h2 style={{ margin: '10px 0 4px', fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
              Túnel de exportación
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Revisá el manifiesto, elegí el formato y descargá tu documento APA 7.
            </p>
          </div>

          {/* Manifiesto de Entrega */}
          <div style={{
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--surface-elevated)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 12px',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <ListChecks size={14} color="var(--accent-secondary)" />
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>Manifiesto de entrega</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {manifest.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => { if (!item.ok) goToStep(item.step); }}
                  title={item.ok ? item.hint : `Ir a resolver: ${item.hint}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '9px 12px', border: 'none', borderBottom: '1px solid var(--border-subtle)',
                    background: 'transparent', cursor: item.ok ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    opacity: item.ok ? 1 : 1,
                  }}
                >
                  {item.ok ? (
                    <CheckCircle2 size={15} color="var(--accent-success)" style={{ flexShrink: 0 }} />
                  ) : (
                    <AlertTriangle size={15} color="var(--accent-warning)" style={{ flexShrink: 0 }} />
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{item.label}</span>
                    <span style={{ display: 'block', fontSize: '10px', color: item.ok ? 'var(--text-muted)' : 'var(--accent-warning)', marginTop: '1px' }}>
                      {item.hint}
                    </span>
                  </span>
                  {!item.ok && <ChevronRight size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          </div>

          {/* Formato de salida */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-muted)', padding: '0 2px' }}>
              Formato de salida
            </span>
            {FORMATS.map((f) => {
              const Icon = f.icon;
              const selected = format === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  aria-pressed={selected}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '11px',
                    padding: '11px 13px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${selected ? 'rgba(79,124,255,0.55)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: selected ? 'rgba(79,124,255,0.08)' : 'var(--surface-subtle)',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                  }}
                >
                  <span style={{
                    width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: selected ? 'rgba(79,124,255,0.18)' : 'rgba(255,255,255,0.06)',
                    color: selected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  }}>
                    <Icon size={16} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>{f.label}</span>
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>{f.hint}</span>
                  </span>
                  <span style={{
                    width: '15px', height: '15px', borderRadius: '50%', flexShrink: 0,
                    border: `1.5px solid ${selected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    backgroundColor: selected ? 'var(--accent-primary)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selected && <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#fff' }} />}
                  </span>
                </button>
              );
            })}

            {format === 'docx' && (
              <label style={{
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                padding: '4px 2px', fontSize: '12px', color: 'var(--text-secondary)',
              }}>
                <input
                  type="checkbox"
                  checked={tracked}
                  onChange={(e) => setTracked(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)' }}
                />
                Word con cambios visibles (Track Changes vs original)
              </label>
            )}
          </div>

          {/* Fricción intencional / resolución inline */}
          {ghostCount > 0 && friction === 'ask' && (
            <div style={{
              border: '1px solid rgba(250,173,20,0.4)', backgroundColor: 'rgba(250,173,20,0.07)',
              borderRadius: 'var(--radius-lg)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '9px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertTriangle size={15} color="var(--accent-warning)" style={{ flexShrink: 0, marginTop: '1px' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                  Faltan <strong>{ghostCount}</strong> referencia{ghostCount === 1 ? '' : 's'} en tu bibliografía.
                  ¿Descargar igual o resolver?
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={doExport} className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: '11px' }}>
                  Descargar igual
                </button>
                <button type="button" onClick={() => setFriction('resolve')} className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: '11px' }}>
                  Resolver ahora
                </button>
              </div>
            </div>
          )}

          {friction === 'resolve' && (
            <>
              <QuickReferenceSearch
                onDone={() => {
                  setFriction('idle');
                  sayMascot('Todas las referencias quedaron resueltas. Podés descargar con confianza.', 'success');
                }}
              />
              <button
                type="button"
                onClick={doExport}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '11px', alignSelf: 'flex-start' }}
              >
                Descargar igual
              </button>
            </>
          )}

          {missingCover.length > 0 && friction === 'idle' && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Tip: faltan datos de la portada (<strong>{missingCover.join(', ')}</strong>). Podés completarlos en el paso Portada.
            </div>
          )}
        </div>

        {/* CTA fija */}
        <div style={{
          flexShrink: 0, padding: '14px 18px', borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--sidebar-bg)',
        }}>
          <button
            type="button"
            onClick={handleDownloadClick}
            disabled={isLoading}
            className="btn btn-primary"
            style={{
              width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              fontSize: '13px', padding: '10px 14px',
            }}
          >
            {isLoading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={15} />}
            {isLoading ? 'Generando…' : format === 'pdf' ? 'Descargar PDF' : format === 'latex' ? 'Descargar LaTeX' : 'Descargar Word'}
          </button>
          <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
            {tracked ? 'Incluye cambios visibles vs el original' : `Formato APA 7 · ${profile?.display_name || 'APA 7ª edición'}`}
          </div>
        </div>
      </aside>

      {/* ── Panel derecho: preview en vivo (el documento NUNCA desaparece) ── */}
      <section style={{
        flex: 1, minWidth: 0, height: '100%',
        display: 'flex', flexDirection: 'column',
        backgroundColor: 'var(--canvas-bg)',
      }}>
        <div style={{
          flexShrink: 0, padding: '6px 14px',
          backgroundColor: 'var(--sidebar-bg)', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: '7px',
        }}>
          <ShieldCheck size={13} color="var(--accent-success)" />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Vista previa del documento formateado
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ReactPDFPreview />
        </div>
      </section>
    </div>
  );
};

export default ExportView;

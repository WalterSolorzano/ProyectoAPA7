/* WordAPA7 — Panel de Referencias compacto (RightSidePanel, paso 5).
   Mantiene el documento visible: la bibliografía se edita desde el panel
   derecho mientras el canvas muestra el texto completo. */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Search, Plus, CheckCircle2, AlertTriangle, Link2, Loader2, Trash2 } from 'lucide-react';
import { QuickReferenceSearch } from '../export/QuickReferenceSearch';

export const ReferencesPanel: React.FC = () => {
  const {
    references, selectedReferenceId, setSelectedReferenceId,
    addReference, removeReference, resolveDoiReference, isLoading,
    citationAuditResult, runCitationAudit, setValidatorOpen, resolveGhostCitation,
  } = useDocStore();

  const [rawInput, setRawInput] = useState('');
  const [resolving, setResolving] = useState<number | null>(null);

  const ghosts = citationAuditResult?.ghost_citations || [];
  const orphans = citationAuditResult?.orphan_references || [];

  const handleResolveDoi = () => {
    if (!rawInput.trim()) return;
    const text = rawInput.trim();
    setRawInput('');
    resolveDoiReference(text);
    useDocStore.getState().showToast('Buscando DOI…', 'info');
  };

  const handleAddManual = () => {
    if (!rawInput.trim()) return;
    const id = `manual-${Date.now()}`;
    addReference({
      id, authors: ['Autor'], year: '2026', title: 'Título', source: 'Fuente',
      raw_text: rawInput.trim(), formatted_apa: rawInput.trim(),
    });
    setRawInput('');
    setSelectedReferenceId(id);
  };

  const handleResolveGhost = async (i: number) => {
    setResolving(i);
    try {
      await resolveGhostCitation([String(ghosts[i]).replace(/[()]/g, '').split(',')[0]?.trim() || 'Autor'], String(ghosts[i]).match(/\b(19|20)\d{2}\b/)?.[0] || '');
    } catch {
      useDocStore.getState().showToast('No se pudo resolver esa cita', 'warning');
    } finally {
      setResolving(null);
    }
  };

  const sorted = [...references].sort((a, b) =>
    (a.authors?.[0] || a.title || a.raw_text || '').toLowerCase().localeCompare((b.authors?.[0] || b.title || b.raw_text || '').toLowerCase()),
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Buscador DOI / manual */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '5px 9px', backgroundColor: 'var(--canvas-bg)' }}>
          <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleResolveDoi(); }}
            placeholder="DOI o cita cruda: García, A. (2023). …"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: '12px', backgroundColor: 'transparent', color: 'var(--text-main)', fontFamily: 'inherit' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button type="button" onClick={handleResolveDoi} disabled={isLoading || !rawInput.trim()} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
            <Search size={12} /> {isLoading ? 'Buscando…' : 'Resolver DOI'}
          </button>
          <button type="button" onClick={handleAddManual} disabled={!rawInput.trim()} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Plus size={12} /> Manual
          </button>
        </div>
      </div>

      {/* Validación de citas */}
      <div style={{
        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--surface-elevated)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Link2 size={13} color="var(--accent-secondary)" />
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>Validación</span>
          <div style={{ flex: 1 }} />
          {!citationAuditResult && (
            <button type="button" onClick={() => runCitationAudit()} className="btn btn-ghost btn-sm" style={{ fontSize: '10px' }}>
              Validar citas
            </button>
          )}
          {citationAuditResult && (
            <button type="button" onClick={() => setValidatorOpen(true)} className="btn btn-ghost btn-sm" style={{ fontSize: '10px', color: 'var(--accent-primary)' }}>
              Ver validador
            </button>
          )}
        </div>

        {!citationAuditResult ? (
          <div style={{ padding: '12px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Corré una auditoría para cruzar las citas del texto contra la bibliografía.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '6px', padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: ghosts.length > 0 ? 'var(--accent-warning)' : 'var(--accent-success)' }}>{ghosts.length}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Citas sin referencia</div>
              </div>
              <div style={{ width: '1px', backgroundColor: 'var(--border-subtle)' }} />
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: orphans.length > 0 ? 'var(--accent-warning)' : 'var(--accent-success)' }}>{orphans.length}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Refs sin cita</div>
              </div>
            </div>

            {ghosts.length > 0 && (
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ghosts.slice(0, 5).map((g, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <AlertTriangle size={12} color="var(--accent-warning)" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {String(g).slice(0, 70)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleResolveGhost(i)}
                      disabled={resolving === i}
                      style={{
                        flexShrink: 0, fontSize: '10px', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer',
                        background: 'var(--accent-success)', color: '#fff', border: 'none', fontWeight: 600, fontFamily: 'inherit',
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                      }}
                    >
                      {resolving === i ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={10} />}
                      Resolver
                    </button>
                  </div>
                ))}
                {ghosts.length > 5 && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>y {ghosts.length - 5} más…</div>
                )}
              </div>
            )}

            {ghosts.length === 0 && (
              <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: 'var(--accent-success)' }}>
                <CheckCircle2 size={13} /> Todas las citas coinciden con la bibliografía.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Búsqueda de citas faltantes en Crossref (temprano, sin esperar al túnel) */}
      {ghosts.length > 0 && <QuickReferenceSearch />}

      {/* Lista de referencias */}
      <div style={{
        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--surface-elevated)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>Referencias</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>· {sorted.length}</span>
        </div>
        {sorted.length === 0 ? (
          <div style={{
            padding: '20px 14px', fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5,
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
          }}>
            <span style={{ fontSize: '24px' }}>📚</span>
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Aún no hay referencias en la lista</span>
            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
              Pegá un DOI (ej. 10.1016/...) o una cita cruda en el buscador para resolverla automáticamente.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '320px', overflowY: 'auto' }}>
            {sorted.map((ref, i) => (
              <div
                key={ref.id}
                onClick={() => setSelectedReferenceId(ref.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '7px',
                  padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  backgroundColor: ref.id === selectedReferenceId ? 'var(--color-accent-soft)' : 'transparent',
                }}
              >
                <span style={{ flex: 1, minWidth: 0, fontSize: '11px', lineHeight: 1.5, color: 'var(--text-main)', fontFamily: "'Times New Roman', serif" }}>
                  <span style={{ color: 'var(--text-muted)' }}>{i + 1}. </span>
                  {ref.authors?.join(', ') || 'Autor'} ({ref.year || 's.f.'}). {ref.title ? <em>{ref.title}.</em> : ''} {ref.source || ''}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeReference(ref.id); }}
                  title="Quitar referencia"
                  aria-label="Quitar referencia"
                  style={{ flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferencesPanel;

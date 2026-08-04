/* WordAPA7 — Sección Referencias (rediseño "canvas A4 como centro").
   El lienzo principal es una hoja A4 blanca con la bibliografía en formato
   final APA 7. La entrada de DOI/texto vive en una toolbar compacta arriba del
   lienzo, y el panel derecho contextual edita la referencia seleccionada. */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { resolveReferencesBatch } from '../../api/backend';
import { Search, FileText, BookOpen, Link2, Plus } from 'lucide-react';

export const ReferenciasView: React.FC = () => {
  const {
    references, addReference, removeReference, resolveDoiReference, updateReferences,
    isLoading, selectedReferenceId, setSelectedReferenceId,
  } = useDocStore();
  const [rawInput, setRawInput] = useState('');

  const detectedCount = references.filter((r) => r.id?.startsWith('ref-')).length;

  const handleAddManual = () => {
    if (!rawInput.trim()) return;
    const id = `manual-${Date.now()}`;
    addReference({
      id,
      authors: ['Autor'],
      year: '2026',
      title: 'Título',
      source: 'Fuente',
      raw_text: rawInput.trim(),
      formatted_apa: rawInput.trim(),
    });
    setRawInput('');
    setSelectedReferenceId(id);
  };

  const handleResolveDoi = () => {
    if (!rawInput.trim()) return;
    const text = rawInput.trim();
    setRawInput('');
    resolveDoiReference(text);
    useDocStore.getState().showToast('Buscando DOI…', 'info');
  };

  const handleResolveAll = async () => {
    if (!references.length) return;
    useDocStore.getState().showToast('Resolviendo en lote...', 'info');
    try {
      const data = await resolveReferencesBatch(references);
      const resolved = data?.resolved || data?.results || [];
      if (resolved.length) {
        const next = references.map((r) => {
          const hit = resolved.find((x: any) => x && (x.index !== undefined ? references[x.index]?.id === r.id : x.raw === r.raw_text || x.doi === r.doi_or_url));
          if (!hit) return r;
          return {
            ...r,
            authors: hit.authors || r.authors,
            year: hit.year || r.year,
            title: hit.title || r.title,
            source: hit.source || r.source,
            doi_or_url: hit.doi || r.doi_or_url,
            formatted_apa: hit.formatted || hit.apa_formatted || r.formatted_apa || r.raw_text,
          };
        });
        updateReferences(next);
        useDocStore.getState().showToast(`Resueltas ${resolved.length} referencias`, 'success');
      } else {
        useDocStore.getState().showToast('No se encontraron DOI resolubles', 'info');
      }
    } catch {
      useDocStore.getState().showToast('Error al resolver en lote', 'error');
    }
  };

  const sorted = [...references].sort((a, b) =>
    (a.authors?.[0] || a.title || a.raw_text || '').toLowerCase().localeCompare((b.authors?.[0] || b.title || b.raw_text || '').toLowerCase())
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Toolbar compacta sobre el lienzo A4 ── */}
      <div style={{
        flexShrink: 0, padding: '10px 16px',
        backgroundColor: 'var(--sidebar-bg)', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <BookOpen size={15} color="var(--accent-primary)" />
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>Referencias</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>· {references.length} {references.length === 1 ? 'entrada' : 'entradas'}</span>
        </div>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '5px 9px', backgroundColor: 'var(--canvas-bg)' }}>
            <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleResolveDoi(); }}
              placeholder="DOI (10.1016/...) o cita cruda: García, A. (2023). ..."
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: '12px', backgroundColor: 'transparent', color: 'var(--text-main)', fontFamily: 'inherit' }}
            />
          </div>
          <button type="button" onClick={handleResolveDoi} disabled={isLoading || !rawInput.trim()} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '12px', padding: '5px 12px' }}>
            <Search size={13} /> {isLoading ? 'Buscando…' : 'Resolver DOI'}
          </button>
          <button type="button" onClick={handleAddManual} disabled={!rawInput.trim()} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '12px', padding: '5px 10px' }}>
            <Plus size={13} /> Manual
          </button>
          {references.length > 0 && (
            <button type="button" onClick={handleResolveAll} disabled={isLoading} className="btn btn-ghost" style={{ fontSize: '11px' }}>
              Resolver todas
            </button>
          )}
        </div>
      </div>

      {/* ── Lienzo A4 central (hoja de bibliografía) ── */}
      <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--canvas-bg)', padding: '24px 16px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div style={{
          width: '680px', minHeight: '880px', backgroundColor: '#ffffff',
          boxShadow: '0 8px 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
          padding: '54px 54px', boxSizing: 'border-box',
          fontFamily: "'Times New Roman', serif", fontSize: '12pt', lineHeight: '2.0', color: '#000000',
        }}>
          <div style={{ textAlign: 'center', fontWeight: 700, marginBottom: '28px' }}>Referencias</div>

          {sorted.length === 0 ? (
            /* Estado vacío: plantilla visual + input de acción integrado en el lienzo */
            <div style={{ textAlign: 'center', paddingTop: '30px' }}>
              <div style={{ fontStyle: 'italic', color: '#9ca3af', marginBottom: '26px' }}>
                La bibliografía aparecerá aquí, ordenada alfabéticamente y con sangría francesa.
              </div>
              <div style={{
                display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '18px 24px',
                backgroundColor: '#f8fafc', maxWidth: '420px', width: '100%',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: 'rgba(79,124,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Search size={17} color="#4f7cff" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <input
                      type="text"
                      value={rawInput}
                      onChange={(e) => setRawInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleResolveDoi(); }}
                      placeholder="Pegá tu primer DOI o cita cruda aquí..."
                      style={{
                        width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px',
                        fontSize: '11pt', fontFamily: 'inherit', outline: 'none',
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={handleResolveDoi} disabled={isLoading || !rawInput.trim()} className="btn btn-primary" style={{ fontSize: '12px', padding: '5px 14px' }}>
                    <Search size={13} /> Resolver DOI
                  </button>
                  <button type="button" onClick={handleAddManual} disabled={!rawInput.trim()} className="btn btn-secondary" style={{ fontSize: '12px', padding: '5px 14px' }}>
                    <Plus size={13} /> Manual
                  </button>
                </div>
              </div>
              {detectedCount > 0 && (
                <div style={{ marginTop: '18px', fontSize: '10pt', color: '#6b7280' }}>
                  O detectá la sección del documento con <strong>{detectedCount}</strong> referencia(s) ya extraída(s).
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {sorted.map((ref) => {
                const selected = ref.id === selectedReferenceId;
                return (
                  <p
                    key={ref.id}
                    onClick={() => setSelectedReferenceId(ref.id)}
                    style={{
                      margin: 0,
                      padding: '4px 8px',
                      paddingLeft: '0.5in',
                      textIndent: '-0.5in',
                      textAlign: 'justify',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      backgroundColor: selected ? 'rgba(79,124,255,0.12)' : 'transparent',
                      outline: selected ? '1px solid #4f7cff' : 'none',
                      boxSizing: 'border-box',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                    }}
                    title="Clic para editar en el panel derecho"
                  >
                    {ref.authors?.length ? <span>{ref.authors.join(', ')}. </span> : null}
                    {ref.year && <span>({ref.year}). </span>}
                    {ref.title && <span style={{ fontStyle: 'italic' }}>{ref.title}. </span>}
                    {ref.source && <span>{ref.source}.</span>}
                    {!ref.authors?.length && !ref.year && !ref.title && (ref.formatted_apa || ref.raw_text)}
                    {ref.doi_or_url && (
                      <span>
                        {' '}
                        <a href={ref.doi_or_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#4f7cff', textDecoration: 'none', fontSize: '10pt' }}>
                          {ref.doi_or_url}
                        </a>
                      </span>
                    )}
                  </p>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferenciasView;

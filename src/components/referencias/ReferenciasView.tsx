import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { resolveReferencesBatch } from '../../api/backend';
import { Search, Pencil, Check, X, Trash2, FileText, Link2, BookOpen, Wand2 } from 'lucide-react';

export const ReferenciasView: React.FC = () => {
  const { references, addReference, removeReference, resolveDoiReference, updateReferences, isLoading } = useDocStore();
  const [rawInput, setRawInput] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editAuthors, setEditAuthors] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editDoi, setEditDoi] = useState('');
  const [showPreview, setShowPreview] = useState(true);

  const detectedCount = references.filter((r) => r.id?.startsWith('ref-')).length;

  const handleAddManual = () => {
    if (!rawInput.trim()) return;
    addReference({
      id: `manual-${Date.now()}`,
      authors: ['Autor'],
      year: '2026',
      title: 'Título',
      source: 'Fuente',
      raw_text: rawInput.trim(),
      formatted_apa: rawInput.trim(),
    });
    setRawInput('');
  };

  const handleResolveDoi = () => {
    if (!rawInput.trim()) return;
    resolveDoiReference(rawInput.trim());
    setRawInput('');
  };

  const startEdit = (ref: any) => {
    setEditId(ref.id);
    setEditAuthors((ref.authors || []).join(', '));
    setEditYear(ref.year || '');
    setEditTitle(ref.title || '');
    setEditSource(ref.source || '');
    setEditDoi(ref.doi_or_url || '');
  };

  const saveEdit = () => {
    if (!editId) return;
    const authorsArr = editAuthors.split(/,|&|;/).map((a) => a.trim()).filter(Boolean);
    const updated = references.map((r) => {
      if (r.id !== editId) return r;
      const formatted = [editAuthors, `(${editYear}).`, editTitle && `${editTitle}.`, editSource].filter(Boolean).join(' ');
      return {
        ...r,
        authors: authorsArr.length ? authorsArr : [editAuthors || 'Autor'],
        year: editYear,
        title: editTitle,
        source: editSource,
        doi_or_url: editDoi || undefined,
        formatted_apa: formatted,
        raw_text: formatted,
      };
    });
    updateReferences(updated);
    setEditId(null);
  };

  // "Resolver todas": ahora SÍ aplica los metadatos devueltos por el backend
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
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ── COLUMNA IZQUIERDA: editor de lista ── */}
      <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            Referencias bibliográficas
          </h2>
          {detectedCount > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--color-accent-soft)', padding: '3px 9px', borderRadius: 'var(--radius-sm)' }}>
              <FileText size={11} /> {detectedCount} detectadas del documento
            </span>
          )}
        </div>

        {/* Entrada de nueva referencia */}
        <div className="card" style={{ marginBottom: '18px', padding: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Search size={12} /> Agregar por texto libre o DOI
          </div>
          <textarea
            className="form-textarea"
            rows={2}
            placeholder="DOI (10.1016/j.compedu.2023.104) o cita cruda: García, A. (2023). Inteligencia Artificial..."
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            style={{ fontSize: '12px' }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button className="btn btn-primary btn-sm" onClick={handleResolveDoi} disabled={isLoading} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Search size={13} /> {isLoading ? 'Buscando...' : 'Resolver DOI'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleAddManual}>Agregar manual</button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            {references.length} {references.length === 1 ? 'referencia' : 'referencias'}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {references.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={handleResolveAll} disabled={isLoading} style={{ fontSize: '11px' }}>
                <Search size={12} style={{ marginRight: 4 }} />Resolver todas
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPreview(!showPreview)} style={{ fontSize: '11px' }} title="Mostrar u ocultar la vista previa de la hoja">
              <BookOpen size={12} style={{ marginRight: 4 }} />{showPreview ? 'Ocultar hoja' : 'Ver hoja'}
            </button>
          </div>
        </div>

        {references.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <FileText size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontSize: '13px', margin: 0 }}>No hay referencias. Detectá la sección del documento o agregalas arriba.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {references.map((ref) => (
              <div key={ref.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                {editId === ref.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px' }}>
                    <input value={editAuthors} onChange={(e) => setEditAuthors(e.target.value)} placeholder="Autor(es) — ej. García, A.; López, B." style={inp} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={editYear} onChange={(e) => setEditYear(e.target.value)} placeholder="Año" style={{ ...inp, width: 90, flexShrink: 0 }} />
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Título del trabajo" style={{ ...inp, flex: 1 }} />
                    </div>
                    <input value={editSource} onChange={(e) => setEditSource(e.target.value)} placeholder="Fuente / editorial / revista, vol(núm), pp." style={inp} />
                    <input value={editDoi} onChange={(e) => setEditDoi(e.target.value)} placeholder="DOI / URL (opcional)" style={inp} />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}><X size={12} /></button>
                      <button className="btn btn-primary btn-sm" onClick={saveEdit}><Check size={12} /> Guardar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'stretch' }}>
                    <div onClick={() => startEdit(ref)} style={{ flex: 1, padding: '10px 14px', cursor: 'pointer', background: 'var(--color-bg-surface)' }}>
                      <p style={{ margin: 0, fontFamily: "'Times New Roman', serif", fontSize: '11pt', lineHeight: 1.5, color: 'var(--color-text-primary)', paddingLeft: '26px', textIndent: '-26px' }}>
                        {ref.authors?.length ? <span>{ref.authors.join(', ')}. </span> : null}
                        {ref.year && <span>({ref.year}). </span>}
                        {ref.title && <span style={{ fontStyle: 'italic' }}>{ref.title}. </span>}
                        {ref.source && <span>{ref.source}.</span>}
                        {!ref.authors?.length && !ref.year && !ref.title && (ref.formatted_apa || ref.raw_text)}
                      </p>
                      {ref.doi_or_url && (
                        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, paddingLeft: '26px' }}>
                          <Link2 size={10} style={{ color: 'var(--accent-primary)' }} />
                          <a href={ref.doi_or_url} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: 'var(--accent-primary)', textDecoration: 'none' }}>{ref.doi_or_url}</a>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-subtle)' }}>
                      <button className="btn btn-ghost btn-sm" title="Editar" onClick={() => startEdit(ref)} style={{ flex: 1, borderRadius: 0, padding: '0 10px' }}>
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-ghost btn-sm" title="Eliminar" onClick={() => removeReference(ref.id)} style={{ flex: 1, borderRadius: 0, padding: '0 10px', color: 'var(--accent-danger)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── COLUMNA DERECHA: previsualizador de la hoja de bibliografía ── */}
      {showPreview && (
        <div style={{
          width: 360, flexShrink: 0, borderLeft: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--sidebar-bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Wand2 size={13} color="var(--accent-primary)" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>Vista previa de la hoja</span>
            <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>Times New Roman 12 · doble espacio</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 18px' }}>
            <div style={{
              backgroundColor: '#fff', borderRadius: '4px', padding: '32px 36px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minHeight: '520px',
            }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontFamily: "'Times New Roman', serif", fontSize: '13pt', fontWeight: 700, color: '#111' }}>Referencias</div>
                <div style={{ fontFamily: "'Times New Roman', serif", fontSize: '10pt', color: '#777', marginTop: 2 }}>
                  {sorted.length} entradas · orden alfabético
                </div>
              </div>
              {sorted.length === 0 ? (
                <div style={{ fontFamily: "'Times New Roman', serif", fontSize: '11pt', color: '#aaa', fontStyle: 'italic', textAlign: 'center', padding: '60px 0' }}>
                  La lista aparecerá aquí cuando agregues referencias.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {sorted.map((ref, i) => (
                    <p key={ref.id} style={{
                      margin: 0,
                      fontFamily: "'Times New Roman', serif",
                      fontSize: '12pt',
                      lineHeight: '2.0',
                      color: '#111',
                      textAlign: 'justify',
                      paddingLeft: '0.5in',
                      textIndent: '-0.5in',
                    }}>
                      <span style={{ color: '#999', fontSize: '9pt' }}>[{i + 1}] </span>
                      {ref.authors?.length ? <span>{ref.authors.join(', ')}. </span> : null}
                      {ref.year && <span>({ref.year}). </span>}
                      {ref.title && <span style={{ fontStyle: 'italic' }}>{ref.title}. </span>}
                      {ref.source && <span>{ref.source}.</span>}
                      {!ref.authors?.length && !ref.year && !ref.title && (ref.formatted_apa || ref.raw_text)}
                      {ref.doi_or_url && <span> {ref.doi_or_url}</span>}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '5px 8px', backgroundColor: 'var(--color-bg-surface)',
  color: 'var(--color-text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
};

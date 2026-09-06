/* WordAPA7 — Paso 4: Reference Studio (Arquitectura 3 Columnas)
   Columna 1: Captura & Búsqueda (CrossRef, DOI, Entrada manual por tipo).
   Columna 2: Gestor de Bibliografía & Auditoría (Lista alfabética, sangría francesa, filtros).
   Columna 3: Editor en Vivo APA 7 & Auditoría de Citas en el Texto. */

import React, { useState, useMemo, useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import {
  Search, Plus, CheckCircle2, AlertTriangle, Link2, Loader2,
  Trash2, BookOpen, Copy, Sparkles, Check,
  ChevronRight, RefreshCw, ArrowRight
} from 'lucide-react';
import { ReferenciaModel } from '../../types';

export const Step5ReferencesWizard: React.FC = () => {
  const {
    doc, references, selectedReferenceId, setSelectedReferenceId,
    addReference, removeReference, updateReferences, resolveDoiReference, isLoading,
    citationAuditResult, runCitationAudit, resolveGhostCitation, showToast,
    setScrollTargetId, setWizardStep, openExportTunnel,
  } = useDocStore();

  const [activeTab, setActiveTab] = useState<'all' | 'ghosts' | 'orphans'>('all');
  const [doiQuery, setDoiQuery] = useState('');
  const [resolvingGhostIdx, setResolvingGhostIdx] = useState<number | null>(null);

  // Formulario manual guiado
  const [refType, setRefType] = useState<'journal' | 'book' | 'thesis' | 'web'>('journal');
  const [formAuthors, setFormAuthors] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formDoi, setFormDoi] = useState('');

  // Sincronizar referencia seleccionada con el editor
  const selectedRef = useMemo(() => {
    return references.find((r) => r.id === selectedReferenceId) || references[0] || null;
  }, [references, selectedReferenceId]);

  const [editAuthors, setEditAuthors] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editDoi, setEditDoi] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedRef) {
      setEditAuthors((selectedRef.authors || []).join(', '));
      setEditYear(selectedRef.year || '');
      setEditTitle(selectedRef.title || '');
      setEditSource(selectedRef.source || '');
      setEditDoi(selectedRef.doi_or_url || '');
    }
  }, [selectedRef]);

  // Auditoría al entrar si no se ha corrido
  useEffect(() => {
    if (!citationAuditResult && doc) {
      runCitationAudit();
    }
  }, [citationAuditResult, doc, runCitationAudit]);

  const ghosts = citationAuditResult?.ghost_citations || [];
  const orphans = citationAuditResult?.orphan_references || [];

  const handleResolveDoi = async () => {
    if (!doiQuery.trim()) return;
    const query = doiQuery.trim();
    setDoiQuery('');
    showToast('Consultando metadatos DOI…', 'info');
    await resolveDoiReference(query);
  };

  const handleAddManual = () => {
    if (!formTitle.trim() && !formAuthors.trim()) {
      showToast('Ingresa al menos el autor o título', 'warning');
      return;
    }
    const authorsArr = formAuthors.split(/,|&|;/).map((a) => a.trim()).filter(Boolean);
    const yr = formYear.trim() || 's.f.';
    const formatted = `${formAuthors.trim()} (${yr}). ${formTitle.trim()}.${formSource.trim() ? ' ' + formSource.trim() : ''}${formDoi.trim() ? ' ' + formDoi.trim() : ''}`;

    const newRef: ReferenciaModel = {
      id: `ref-${Date.now()}`,
      authors: authorsArr.length > 0 ? authorsArr : [formAuthors.trim() || 'Autor'],
      year: yr,
      title: formTitle.trim(),
      source: formSource.trim(),
      doi_or_url: formDoi.trim() || undefined,
      formatted_apa: formatted,
      raw_text: formatted,
    };

    addReference(newRef);
    setSelectedReferenceId(newRef.id);
    setFormAuthors('');
    setFormYear('');
    setFormTitle('');
    setFormSource('');
    setFormDoi('');
    showToast('Referencia agregada a la bibliografía', 'success');
  };

  const handleSaveSelected = () => {
    if (!selectedRef) return;
    const authorsArr = editAuthors.split(/,|&|;/).map((a) => a.trim()).filter(Boolean);
    const yr = editYear.trim() || 's.f.';
    const formatted = `${editAuthors.trim()} (${yr}). ${editTitle.trim()}.${editSource.trim() ? ' ' + editSource.trim() : ''}${editDoi.trim() ? ' ' + editDoi.trim() : ''}`;

    updateReferences(references.map((r) => {
      if (r.id !== selectedRef.id) return r;
      return {
        ...r,
        authors: authorsArr.length ? authorsArr : [editAuthors.trim() || 'Autor'],
        year: yr,
        title: editTitle.trim(),
        source: editSource.trim(),
        doi_or_url: editDoi.trim() || undefined,
        formatted_apa: formatted,
        raw_text: formatted,
      };
    }));
    showToast('Ficha bibliográfica actualizada', 'success');
  };

  function ghostText(g: any): string {
    if (!g) return '';
    if (typeof g === 'string') return g;
    return g.raw_text || g.formatted_apa || [g.authors?.join?.(', '), g.year ? `(${g.year})` : '', g.title].filter(Boolean).join(' ').trim() || g.citation || '';
  }

  const handleResolveGhost = async (i: number) => {
    setResolvingGhostIdx(i);
    try {
      const g = ghosts[i];
      const txt = ghostText(g);
      const author = txt.replace(/[()]/g, '').split(',')[0]?.trim() || 'Autor';
      const year = String(txt).match(/\b(19|20)\d{2}\b/)?.[0] || '';
      await resolveGhostCitation([author], year);
    } catch {
      showToast('No se pudo resolver la cita automáticamente', 'warning');
    } finally {
      setResolvingGhostIdx(null);
    }
  };

  // Buscar menciones en el texto para la referencia activa
  const linkedParagraphs = useMemo(() => {
    if (!doc || !selectedRef) return [];
    const mainAuthor = (selectedRef.authors?.[0] || selectedRef.title || '').split(',')[0].trim().toLowerCase();
    const yr = (selectedRef.year || '').trim();
    if (!mainAuthor || mainAuthor.length < 3) return [];

    return doc.elements.filter((e) => {
      if (e.type === 'heading' || e.is_cover_section) return false;
      const text = (e.text || '').toLowerCase();
      return text.includes(mainAuthor) && (!yr || text.includes(yr));
    });
  }, [doc, selectedRef]);

  // Ordenar alfabéticamente
  const sortedReferences = useMemo(() => {
    return [...references].sort((a, b) =>
      (a.authors?.[0] || a.title || a.raw_text || '').localeCompare(b.authors?.[0] || b.title || b.raw_text || '', 'es', { sensitivity: 'base' })
    );
  }, [references]);

  const copyInTextCitation = (refItem: ReferenciaModel) => {
    const main = (refItem.authors?.[0] || 'Autor').split(',')[0].trim();
    const yr = refItem.year || 's.f.';
    const text = refItem.authors && refItem.authors.length > 2
      ? `(${main} et al., ${yr})`
      : refItem.authors && refItem.authors.length === 2
        ? `(${main} & ${refItem.authors[1].split(',')[0].trim()}, ${yr})`
        : `(${main}, ${yr})`;

    navigator.clipboard.writeText(text);
    setCopiedId(refItem.id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast(`Copiado: ${text}`, 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', backgroundColor: 'var(--canvas-bg)' }}>
      {/* ── Top Header Bar ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', backgroundColor: 'var(--sidebar-bg)',
        borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '32px', height: '32px', borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-accent-soft)', color: 'var(--accent-primary)',
          }}>
            <BookOpen size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Estudio de Referencias APA 7ma Edición
              </h2>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                backgroundColor: 'var(--color-accent-soft)', color: 'var(--accent-primary)',
              }}>
                {references.length} Fuentes Registradas
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, marginTop: '2px' }}>
              Cruce bidireccional entre las citas en el cuerpo del texto y la lista bibliográfica final.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => runCitationAudit()}
            title="Volver a analizar correspondencia de citas"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} />
            <span>Auditar Citas</span>
          </button>
          <button
            type="button"
            onClick={() => openExportTunnel()}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}
          >
            <span>Continuar a Exportar</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </header>

      {/* ── 3-Column Studio Layout ── */}
      <div style={{ display: 'flex', flex: 1, height: '100%', minHeight: 0, overflow: 'hidden' }}>

        {/* ══ COLUMNA 1: Captura & Búsqueda (320px) ══ */}
        <div style={{
          width: '320px', flexShrink: 0, height: '100%', overflowY: 'auto',
          backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-subtle)',
          padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          {/* Tarjeta de Búsqueda DOI */}
          <div style={{
            backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)', padding: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Search size={14} color="var(--accent-primary)" />
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Buscador DOI / CrossRef
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.4 }}>
              Pega un DOI (ej. <code style={{ fontSize: '10px' }}>10.1037/arc0000014</code>) o título para extraer metadatos oficiales:
            </p>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={doiQuery}
                onChange={(e) => setDoiQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleResolveDoi(); }}
                placeholder="10.xxxx/yyyy o título..."
                style={{
                  flex: 1, padding: '7px 10px', fontSize: '12px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)', backgroundColor: 'var(--canvas-bg)',
                  color: 'var(--text-main)', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleResolveDoi}
                disabled={isLoading || !doiQuery.trim()}
                className="btn btn-primary btn-sm"
                style={{ padding: '7px 12px' }}
              >
                {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              </button>
            </div>
          </div>

          {/* Formulario Manual Guiado */}
          <div style={{
            backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={14} color="var(--accent-primary)" />
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Nueva Referencia Manual
              </span>
            </div>

            {/* Selector de Tipo de Fuente */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', margin: '4px 0' }}>
              {([
                ['journal', 'Artículo'],
                ['book', 'Libro'],
                ['thesis', 'Tesis'],
                ['web', 'Web/Inf.'],
              ] as const).map(([typeKey, label]) => (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => setRefType(typeKey)}
                  style={{
                    padding: '5px 2px', fontSize: '10px', fontWeight: 700, borderRadius: 'var(--radius-sm)',
                    border: refType === typeKey ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    backgroundColor: refType === typeKey ? 'var(--color-accent-soft)' : 'transparent',
                    color: refType === typeKey ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                Autores (Apellido, Iniciales)
              </label>
              <input
                type="text"
                value={formAuthors}
                onChange={(e) => setFormAuthors(e.target.value)}
                placeholder="García, A., López, B."
                style={inputSubStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                  Año
                </label>
                <input
                  type="text"
                  value={formYear}
                  onChange={(e) => setFormYear(e.target.value)}
                  placeholder="2024"
                  style={inputSubStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                  {refType === 'web' ? 'Sitio Web / Org' : refType === 'thesis' ? 'Universidad' : 'Revista / Editorial'}
                </label>
                <input
                  type="text"
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value)}
                  placeholder={refType === 'journal' ? 'Revista de Psicología, 12(3), 45-60' : 'Editorial'}
                  style={inputSubStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                Título del Trabajo
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Impacto de la inteligencia artificial..."
                style={inputSubStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                DOI o URL permanente
              </label>
              <input
                type="text"
                value={formDoi}
                onChange={(e) => setFormDoi(e.target.value)}
                placeholder="https://doi.org/10.xxxx/..."
                style={inputSubStyle}
              />
            </div>

            <button
              type="button"
              onClick={handleAddManual}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '4px', fontSize: '12px', fontWeight: 700 }}
            >
              <Plus size={13} />
              <span>Añadir a Bibliografía</span>
            </button>
          </div>
        </div>

        {/* ══ COLUMNA 2: Lista Bibliográfica & Auditoría (380px) ══ */}
        <div style={{
          width: '380px', flexShrink: 0, height: '100%', overflowY: 'auto',
          backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Pestañas de Filtro y Métricas */}
          <div style={{
            padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface-elevated)', display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--canvas-bg)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                style={{
                  flex: 1, padding: '5px 8px', fontSize: '11px', fontWeight: 700, borderRadius: 'var(--radius-sm)',
                  border: 'none', cursor: 'pointer',
                  backgroundColor: activeTab === 'all' ? 'var(--surface-elevated)' : 'transparent',
                  color: activeTab === 'all' ? 'var(--text-main)' : 'var(--text-secondary)',
                  boxShadow: activeTab === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Todas ({references.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ghosts')}
                style={{
                  flex: 1, padding: '5px 8px', fontSize: '11px', fontWeight: 700, borderRadius: 'var(--radius-sm)',
                  border: 'none', cursor: 'pointer',
                  backgroundColor: activeTab === 'ghosts' ? 'rgba(239,68,68,0.15)' : 'transparent',
                  color: activeTab === 'ghosts' ? '#dc2626' : 'var(--text-secondary)',
                }}
              >
                Citas Fantasma ({ghosts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('orphans')}
                style={{
                  flex: 1, padding: '5px 8px', fontSize: '11px', fontWeight: 700, borderRadius: 'var(--radius-sm)',
                  border: 'none', cursor: 'pointer',
                  backgroundColor: activeTab === 'orphans' ? 'rgba(245,158,11,0.15)' : 'transparent',
                  color: activeTab === 'orphans' ? '#d97706' : 'var(--text-secondary)',
                }}
              >
                Sin Citar ({orphans.length})
              </button>
            </div>
          </div>

          {/* Lista de Referencias o Alertas */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
            {activeTab === 'ghosts' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {ghosts.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    <CheckCircle2 size={24} color="var(--accent-success)" style={{ margin: '0 auto 8px' }} />
                    No hay citas fantasma. Todas las menciones en el texto tienen su fuente correspondiente.
                  </div>
                ) : (
                  ghosts.map((g: any, i: number) => {
                    const txt = ghostText(g);
                    return (
                      <div
                        key={i}
                        style={{
                          padding: '10px 12px', borderRadius: 'var(--radius-md)',
                          backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                          display: 'flex', flexDirection: 'column', gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={13} color="#dc2626" />
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#991b1b' }}>
                            Citada en el texto sin bibliografía
                          </span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#7f1d1d', margin: 0, fontWeight: 600 }}>
                          {txt}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleResolveGhost(i)}
                          disabled={resolvingGhostIdx === i}
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: '4px', alignSelf: 'flex-start', fontSize: '11px', backgroundColor: '#dc2626' }}
                        >
                          {resolvingGhostIdx === i ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                          <span>Autocompletar Referencia</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            ) : sortedReferences.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                <BookOpen size={28} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                Aún no tienes referencias en este documento. Agrega un DOI a la izquierda para empezar.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sortedReferences.map((refItem, idx) => {
                  const isSelected = selectedRef?.id === refItem.id;
                  const isOrphan = orphans.some((o: any) => {
                    const s = typeof o === 'string' ? o : (o.title || o.raw_text || '');
                    return s.includes(refItem.authors?.[0] || '---') || s.includes(refItem.title || '---');
                  });

                  return (
                    <div
                      key={refItem.id}
                      onClick={() => setSelectedReferenceId(refItem.id)}
                      style={{
                        padding: '10px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--color-accent-soft)' : 'var(--surface-elevated)',
                        border: isSelected ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 800, color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          fontFamily: 'var(--font-mono)',
                        }}>
                          {idx + 1}. {(refItem.authors?.[0] || 'Autor').split(',')[0]} ({refItem.year || 's.f.'})
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); copyInTextCitation(refItem); }}
                            title="Copiar cita en texto"
                            style={iconBtnStyle}
                          >
                            {copiedId === refItem.id ? <Check size={11} color="var(--accent-success)" /> : <Copy size={11} />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeReference(refItem.id); showToast('Referencia eliminada', 'info'); }}
                            title="Eliminar referencia"
                            style={{ ...iconBtnStyle, color: 'var(--accent-danger)' }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      <div style={{
                        fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginTop: '4px',
                        lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {refItem.title || refItem.raw_text || 'Sin título'}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                        {refItem.doi_or_url && (
                          <span style={{ fontSize: '10px', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Link2 size={10} /> DOI
                          </span>
                        )}
                        {isOrphan && (
                          <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309' }}>
                            Sin citar en texto
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ══ COLUMNA 3: Editor en Vivo APA 7 & Cruce de Citas (Flex 1) ══ */}
        <div style={{
          flex: 1, height: '100%', overflowY: 'auto', padding: '24px',
          display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: 'var(--canvas-bg)',
        }}>
          {!selectedRef ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Selecciona una referencia de la lista para editarla y ver sus menciones en el texto.
            </div>
          ) : (
            <>
              {/* Vista Previa Tipográfica APA 7 (Sangría Francesa de 1.27cm) */}
              <div style={{
                backgroundColor: 'var(--paper-white)', borderRadius: 'var(--radius-lg)',
                padding: '20px 24px', border: '1px solid var(--border-subtle)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="var(--accent-primary)" />
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                      Vista Previa APA 7ma Edición (Sangría Francesa)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyInTextCitation(selectedRef)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', gap: '4px' }}
                  >
                    <Copy size={12} />
                    <span>Copiar Cita en Texto</span>
                  </button>
                </div>

                <div style={{
                  fontFamily: "'Times New Roman', serif", fontSize: '13pt', lineHeight: 2.0,
                  color: 'var(--ink, #000)', paddingLeft: '36px', textIndent: '-36px',
                  backgroundColor: 'var(--surface-subtle)', padding: '16px 20px 16px 48px',
                  borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent-primary)',
                }}>
                  {editAuthors || 'Autor, A.'} ({editYear || 's.f.'}). <em>{editTitle || 'Título del trabajo'}</em>. {editSource || 'Fuente'}.{' '}
                  {editDoi && (
                    <a href={editDoi} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                      {editDoi}
                    </a>
                  )}
                </div>
              </div>

              {/* Editor de Campos */}
              <div style={{
                backgroundColor: 'var(--surface-elevated)', borderRadius: 'var(--radius-lg)',
                padding: '20px', border: '1px solid var(--border-subtle)',
                display: 'flex', flexDirection: 'column', gap: '14px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  Editar Datos de la Fuente
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelFullStyle}>Autores (Formato: Apellido, Iniciales; separados por comas)</label>
                    <input
                      type="text"
                      value={editAuthors}
                      onChange={(e) => setEditAuthors(e.target.value)}
                      style={inputFullStyle}
                    />
                  </div>
                  <div>
                    <label style={labelFullStyle}>Año de Publicación</label>
                    <input
                      type="text"
                      value={editYear}
                      onChange={(e) => setEditYear(e.target.value)}
                      style={inputFullStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelFullStyle}>Título del Artículo, Libro o Monografía</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={inputFullStyle}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelFullStyle}>Fuente / Revista / Editorial / Volumen</label>
                    <input
                      type="text"
                      value={editSource}
                      onChange={(e) => setEditSource(e.target.value)}
                      style={inputFullStyle}
                    />
                  </div>
                  <div>
                    <label style={labelFullStyle}>DOI o URL Oficial</label>
                    <input
                      type="text"
                      value={editDoi}
                      onChange={(e) => setEditDoi(e.target.value)}
                      style={inputFullStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={handleSaveSelected}
                    className="btn btn-primary"
                    style={{ fontWeight: 700, padding: '8px 18px' }}
                  >
                    <Check size={14} />
                    <span>Guardar Cambios</span>
                  </button>
                </div>
              </div>

              {/* Cruce de Citas en el Texto del Documento */}
              <div style={{
                backgroundColor: 'var(--surface-elevated)', borderRadius: 'var(--radius-lg)',
                padding: '20px', border: '1px solid var(--border-subtle)',
                display: 'flex', flexDirection: 'column', gap: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Link2 size={15} color="var(--accent-primary)" />
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                      Menciones Detectadas en el Documento ({linkedParagraphs.length})
                    </span>
                  </div>
                </div>

                {linkedParagraphs.length === 0 ? (
                  <div style={{ padding: '16px', backgroundColor: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Esta referencia no aparece citada en el cuerpo del documento. Puedes usar el botón "Copiar Cita en Texto" para insertarla donde corresponda.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {linkedParagraphs.map((elem) => (
                      <div
                        key={elem.id}
                        style={{
                          padding: '10px 14px', borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--canvas-bg)', border: '1px solid var(--border-subtle)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                        }}
                      >
                        <p style={{
                          fontSize: '12px', color: 'var(--text-main)', margin: 0, lineHeight: 1.4,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1,
                        }}>
                          "{elem.text}"
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setWizardStep(2);
                            setScrollTargetId(elem.id);
                            showToast('Navegando a la sección del documento', 'info');
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ flexShrink: 0, fontSize: '11px', gap: '4px' }}
                        >
                          <span>Ver en texto</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

const inputSubStyle: React.CSSProperties = {
  width: '100%', padding: '6px 9px', fontSize: '11px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)', backgroundColor: 'var(--canvas-bg)',
  color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

const inputFullStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: '12.5px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-subtle)', backgroundColor: 'var(--canvas-bg)',
  color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

const labelFullStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
  color: 'var(--text-secondary)', display: 'block', marginBottom: '4px',
};

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '22px', height: '22px', borderRadius: 'var(--radius-sm)',
  border: 'none', background: 'transparent', cursor: 'pointer',
  color: 'var(--text-secondary)',
};

export default Step5ReferencesWizard;

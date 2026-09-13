/* WordAPA7 — Paso 4: Reference Studio (Rediseño de 2 Columnas + Progressive Disclosure)
   Criterios del documento de diseño:
   - Layout de 2 columnas (Lista Agrupada + Detalle) eliminando el formulario permanente.
   - Modal flotante "+ Nueva Referencia" (DOI / Manual) a la demanda.
   - Agrupación por estado: Válidas (verificadas DOI), Sin Verificar (zombie data / metadatos incompletos), Citas sin fuente ("En texto, no en biblio").
   - Badges accionables con tooltip ("Insertar en pág. X").
   - Paleta oficial WordAPA7 (tokens CSS, blanco papel) y cero emojis. */

import React, { useState, useMemo, useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import {
  Search, Plus, CheckCircle2, AlertTriangle, Link2, Loader2,
  Trash2, BookOpen, Copy, Sparkles, Check,
  ChevronRight, RefreshCw, ArrowRight, X, ChevronDown, HelpCircle, FileText
} from 'lucide-react';
import { ReferenciaModel } from '../../types';

export const Step5ReferencesWizard: React.FC = () => {
  const {
    doc, references, selectedReferenceId, setSelectedReferenceId, setSelectedElementId,
    addReference, removeReference, updateReferences, resolveDoiReference, isLoading,
    citationAuditResult, runCitationAudit, resolveGhostCitation, showToast,
    setScrollTargetId, openExportTunnel,
  } = useDocStore();

  const [doiQuery, setDoiQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'doi' | 'manual'>('doi');
  const [resolvingGhostIdx, setResolvingGhostIdx] = useState<number | null>(null);

  // Formulario manual guiado dentro de Modal
  const [refType, setRefType] = useState<'journal' | 'book' | 'thesis' | 'web'>('journal');
  const [formAuthors, setFormAuthors] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formDoi, setFormDoi] = useState('');

  // Estado de colapso de secciones en lista de la izquierda
  const [openValid, setOpenValid] = useState(true);
  const [openUnverified, setOpenUnverified] = useState(true);
  const [openGhosts, setOpenGhosts] = useState(true);

  // Reference activa
  const selectedRef = useMemo(() => {
    return references.find((r) => r.id === selectedReferenceId) || null;
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

  // Auditoría al entrar
  useEffect(() => {
    if (!citationAuditResult && doc) {
      runCitationAudit();
    }
  }, [citationAuditResult, doc, runCitationAudit]);

  const ghosts = citationAuditResult?.ghost_citations || [];
  const orphans = citationAuditResult?.orphan_references || [];

  // Clasificación de referencias en Válidas vs Sin Verificar (Zombie Data)
  const { validReferences, unverifiedReferences } = useMemo(() => {
    const valid: ReferenciaModel[] = [];
    const unverified: ReferenciaModel[] = [];

    references.forEach((r) => {
      const authorText = (r.authors?.[0] || '').toLowerCase();
      const titleText = (r.title || r.raw_text || '').toLowerCase();
      const isZombie =
        !r.authors?.length ||
        authorText.includes('autor (s.f.)') ||
        authorText.includes('s.f.') ||
        titleText.includes('sin título') ||
        titleText.length < 5;

      if (isZombie) {
        unverified.push(r);
      } else {
        valid.push(r);
      }
    });

    // Ordenar alfabéticamente
    const sortFn = (a: ReferenciaModel, b: ReferenciaModel) =>
      (a.authors?.[0] || a.title || '').localeCompare(b.authors?.[0] || b.title || '', 'es', { sensitivity: 'base' });

    valid.sort(sortFn);
    unverified.sort(sortFn);

    return { validReferences: valid, unverifiedReferences: unverified };
  }, [references]);

  const handleResolveDoi = async () => {
    if (!doiQuery.trim()) return;
    const query = doiQuery.trim();
    setDoiQuery('');
    showToast('Consultando metadatos DOI…', 'info');
    await resolveDoiReference(query);
    setShowAddModal(false);
  };

  const handleAddManual = () => {
    if (!formTitle.trim() && !formAuthors.trim()) {
      showToast('Ingresa al menos autor o título', 'warning');
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
    setShowAddModal(false);
    showToast('Referencia agregada exitosamente', 'success');
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
        padding: '12px 24px', backgroundColor: 'var(--sidebar-bg)',
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
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.01em' }}>
                Estudio de Referencias & Citas APA 7
              </h2>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                backgroundColor: 'var(--color-accent-soft)', color: 'var(--accent-primary)',
              }}>
                {references.length} Fuentes Registradas
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, marginTop: '2px' }}>
              Agrupación por estado y verificación bidireccional entre el cuerpo y la bibliografía.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <Plus size={14} />
            <span>Nueva Referencia</span>
          </button>
          <button
            type="button"
            onClick={() => runCitationAudit()}
            title="Re-auditar correspondencia de citas"
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

      {/* ── Layout de 2 Columnas (Progressive Disclosure) ── */}
      <div style={{ display: 'flex', flex: 1, height: '100%', minHeight: 0, overflow: 'hidden' }}>

        {/* ══ COLUMNA 1: Lista Agrupada por Estado (420px) ══ */}
        <div style={{
          width: '420px', flexShrink: 0, height: '100%', overflowY: 'auto',
          backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column', padding: '16px', gap: '12px',
        }}>

          {/* GRUPO 1: VÁLIDAS (Verificadas DOI OK) */}
          <div style={groupCardStyle}>
            <div
              onClick={() => setOpenValid(!openValid)}
              style={groupHeaderStyle}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} color="var(--accent-success, #16a34a)" />
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                  Válidas ({validReferences.length})
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>· DOI verificado OK</span>
              </div>
              <ChevronDown size={14} color="var(--text-secondary)" style={{ transform: openValid ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </div>

            {openValid && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' }}>
                {validReferences.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                    No hay fuentes válidas aún.
                  </div>
                ) : (
                  validReferences.map((refItem, idx) => {
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
                          display: 'flex', flexDirection: 'column', gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)' }}>
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
                              title="Eliminar"
                              style={{ ...iconBtnStyle, color: 'var(--accent-danger)' }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>

                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {refItem.title || refItem.raw_text || 'Sin título'}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          {refItem.doi_or_url && (
                            <span style={{ fontSize: '10px', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Link2 size={10} /> DOI
                            </span>
                          )}
                          {isOrphan && (
                            <span
                              title="Esta referencia no está citada en el texto. Haz clic para opciones."
                              style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', backgroundColor: 'var(--color-accent-soft)', color: 'var(--accent-primary)' }}
                            >
                              Sin citar en texto
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* GRUPO 2: SIN VERIFICAR (Zombie Data / Metadatos Incompletos) */}
          <div style={groupCardStyle}>
            <div
              onClick={() => setOpenUnverified(!openUnverified)}
              style={groupHeaderStyle}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={15} color="var(--accent-warning, #d97706)" />
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                  Sin verificar ({unverifiedReferences.length})
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>· Requieren completar datos</span>
              </div>
              <ChevronDown size={14} color="var(--text-secondary)" style={{ transform: openUnverified ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </div>

            {openUnverified && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' }}>
                {unverifiedReferences.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                    No hay entradas pendientes de verificación.
                  </div>
                ) : (
                  unverifiedReferences.map((refItem) => {
                    const isSelected = selectedRef?.id === refItem.id;
                    return (
                      <div
                        key={refItem.id}
                        onClick={() => setSelectedReferenceId(refItem.id)}
                        style={{
                          padding: '10px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                          backgroundColor: isSelected ? 'var(--color-accent-soft)' : 'var(--surface-elevated)',
                          border: isSelected ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                          transition: 'all 0.15s ease',
                          display: 'flex', flexDirection: 'column', gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--accent-warning, #d97706)' }}>
                            Metadatos Incompletos
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeReference(refItem.id); }}
                            title="Eliminar"
                            style={{ ...iconBtnStyle, color: 'var(--accent-danger)' }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: 600 }}>
                          {refItem.title || refItem.raw_text || 'Entrada sin título'}
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 700 }}>
                          Haz clic para completar datos →
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* GRUPO 3: CITAS FANTASMA ("En texto, no en biblio") */}
          <div style={groupCardStyle}>
            <div
              onClick={() => setOpenGhosts(!openGhosts)}
              style={groupHeaderStyle}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={15} color="var(--accent-danger, #dc2626)" />
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                  En texto, no en biblio ({ghosts.length})
                </span>
              </div>
              <ChevronDown size={14} color="var(--text-secondary)" style={{ transform: openGhosts ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </div>

            {openGhosts && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' }}>
                {ghosts.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                    No se detectaron citas huérfanas en el texto.
                  </div>
                ) : (
                  ghosts.map((g: any, i: number) => {
                    const txt = ghostText(g);
                    return (
                      <div
                        key={i}
                        style={{
                          padding: '10px 12px', borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)',
                          display: 'flex', flexDirection: 'column', gap: '6px',
                        }}
                      >
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                          {txt}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleResolveGhost(i)}
                          disabled={resolvingGhostIdx === i}
                          className="btn btn-primary btn-sm"
                          style={{ alignSelf: 'flex-start', fontSize: '11px' }}
                        >
                          {resolvingGhostIdx === i ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                          <span>Completar Referencia</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* ══ COLUMNA 2: Detalle de Referencia / Editor & Menciones en Texto (Flex 1) ══ */}
        <div style={{
          flex: 1, height: '100%', overflowY: 'auto', padding: '24px',
          display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: 'var(--canvas-bg)',
        }}>
          {!selectedRef ? (
            /* Dashboard de Resumen cuando no hay selección */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '20px', textAlign: 'center' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', maxWidth: '600px', width: '100%' }}>
                <div style={kpiBoxStyle}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Fuentes</span>
                  <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-main)' }}>{references.length}</span>
                </div>
                <div style={kpiBoxStyle}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Verificadas OK</span>
                  <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--accent-success, #16a34a)' }}>{validReferences.length}</span>
                </div>
                <div style={kpiBoxStyle}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Por Resolver</span>
                  <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--accent-warning, #d97706)' }}>{unverifiedReferences.length + ghosts.length}</span>
                </div>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '400px' }}>
                Selecciona una referencia de la izquierda para editar sus campos y consultar sus menciones directas en el cuerpo del documento.
              </div>
            </div>
          ) : (
            <>
              {/* Vista Previa Tipográfica APA 7 (Wrapping Completo sin truncamiento) */}
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
                  color: 'var(--paper-ink, #000)', paddingLeft: '36px', textIndent: '-36px',
                  backgroundColor: 'var(--surface-subtle)', padding: '16px 20px 16px 48px',
                  borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent-primary)',
                  wordBreak: 'break-word', whiteSpace: 'normal',
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
                  Editar Ficha Bibliográfica
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelFullStyle}>Autores (Formato: Apellido, Iniciales)</label>
                    <input
                      type="text"
                      value={editAuthors}
                      onChange={(e) => setEditAuthors(e.target.value)}
                      style={inputFullStyle}
                    />
                  </div>
                  <div>
                    <label style={labelFullStyle}>Año</label>
                    <input
                      type="text"
                      value={editYear}
                      onChange={(e) => setEditYear(e.target.value)}
                      style={inputFullStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelFullStyle}>Título del Trabajo</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={inputFullStyle}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelFullStyle}>Fuente / Revista / Editorial</label>
                    <input
                      type="text"
                      value={editSource}
                      onChange={(e) => setEditSource(e.target.value)}
                      style={inputFullStyle}
                    />
                  </div>
                  <div>
                    <label style={labelFullStyle}>DOI / URL Permanente</label>
                    <input
                      type="text"
                      value={editDoi}
                      onChange={(e) => setEditDoi(e.target.value)}
                      style={inputFullStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={handleSaveSelected}
                    className="btn btn-primary"
                    style={{ fontSize: '12px', fontWeight: 700 }}
                  >
                    <Check size={14} />
                    <span>Guardar Cambios</span>
                  </button>
                </div>
              </div>

              {/* Menciones en el Texto */}
              <div style={{
                backgroundColor: 'var(--surface-elevated)', borderRadius: 'var(--radius-lg)',
                padding: '16px 20px', border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                  Menciones Detectadas en el Documento ({linkedParagraphs.length})
                </div>
                {linkedParagraphs.length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    No se detectaron menciones explícitas de esta fuente en los párrafos del documento.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {linkedParagraphs.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedElementId(p.id);
                          setScrollTargetId(p.id);
                        }}
                        style={{
                          padding: '14px 16px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--paper-white)',
                          border: '1px solid var(--border-subtle)',
                          borderLeft: '3px solid var(--accent-primary)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{
                          fontSize: '12px',
                          lineHeight: '1.6',
                          color: 'var(--text-main)',
                          fontStyle: 'italic',
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                        }}>
                          "{p.text}"
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedElementId(p.id);
                              setScrollTargetId(p.id);
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: 'var(--accent-primary)',
                              gap: '4px',
                              padding: '4px 10px',
                            }}
                          >
                            <span>Ver en Hoja</span>
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modal Flotante: Nueva Referencia ── */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            width: '460px', backgroundColor: 'var(--surface-elevated)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)', boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Header Modal */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--sidebar-bg)',
            }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                Añadir Nueva Referencia Bibliográfica
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Selector de Modo (DOI vs Manual) */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '6px', background: 'var(--canvas-bg)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setAddMode('doi')}
                  style={{
                    flex: 1, padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: 'var(--radius-sm)',
                    border: 'none', cursor: 'pointer',
                    backgroundColor: addMode === 'doi' ? 'var(--surface-elevated)' : 'transparent',
                    color: addMode === 'doi' ? 'var(--text-main)' : 'var(--text-secondary)',
                  }}
                >
                  Buscador DOI / CrossRef
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('manual')}
                  style={{
                    flex: 1, padding: '6px', fontSize: '11px', fontWeight: 700, borderRadius: 'var(--radius-sm)',
                    border: 'none', cursor: 'pointer',
                    backgroundColor: addMode === 'manual' ? 'var(--surface-elevated)' : 'transparent',
                    color: addMode === 'manual' ? 'var(--text-main)' : 'var(--text-secondary)',
                  }}
                >
                  Entrada Manual
                </button>
              </div>

              {addMode === 'doi' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={labelFullStyle}>Ingrese DOI o Título de la publicación</label>
                  <input
                    type="text"
                    value={doiQuery}
                    onChange={(e) => setDoiQuery(e.target.value)}
                    placeholder="10.1037/arc0000014..."
                    style={inputFullStyle}
                  />
                  <button
                    type="button"
                    onClick={handleResolveDoi}
                    disabled={isLoading || !doiQuery.trim()}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}
                  >
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    <span>Buscar & Extraer Metadatos</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                    {(['journal', 'book', 'thesis', 'web'] as const).map((tKey) => (
                      <button
                        key={tKey}
                        type="button"
                        onClick={() => setRefType(tKey)}
                        style={{
                          padding: '4px', fontSize: '10px', fontWeight: 700, borderRadius: 'var(--radius-sm)',
                          border: refType === tKey ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                          backgroundColor: refType === tKey ? 'var(--color-accent-soft)' : 'transparent',
                          color: refType === tKey ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        {tKey === 'journal' ? 'Artículo' : tKey === 'book' ? 'Libro' : tKey === 'thesis' ? 'Tesis' : 'Web'}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label style={labelFullStyle}>Autores (Apellido, Iniciales)</label>
                    <input type="text" value={formAuthors} onChange={(e) => setFormAuthors(e.target.value)} placeholder="García, A., López, B." style={inputFullStyle} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
                    <div>
                      <label style={labelFullStyle}>Año</label>
                      <input type="text" value={formYear} onChange={(e) => setFormYear(e.target.value)} placeholder="2024" style={inputFullStyle} />
                    </div>
                    <div>
                      <label style={labelFullStyle}>Fuente / Editorial</label>
                      <input type="text" value={formSource} onChange={(e) => setFormSource(e.target.value)} placeholder="Editorial / Revista" style={inputFullStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={labelFullStyle}>Título del Trabajo</label>
                    <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Título..." style={inputFullStyle} />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddManual}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}
                  >
                    <Plus size={14} />
                    <span>Guardar en Bibliografía</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Estilos auxiliares
const groupCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
};

const groupHeaderStyle: React.CSSProperties = {
  padding: '10px 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  backgroundColor: 'var(--sidebar-bg)',
  borderBottom: '1px solid var(--border-subtle)',
  userSelect: 'none',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
};

const kpiBoxStyle: React.CSSProperties = {
  padding: '14px',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--surface-elevated)',
  border: '1px solid var(--border-subtle)',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  alignItems: 'center',
};

const labelFullStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: '3px',
};

const inputFullStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: '12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-subtle)',
  backgroundColor: 'var(--canvas-bg)',
  color: 'var(--text-main)',
  outline: 'none',
  boxSizing: 'border-box',
};

export default Step5ReferencesWizard;

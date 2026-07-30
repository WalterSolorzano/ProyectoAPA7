/* WordAPA7 — Interactive Canvas with Faithful Original Document Layout */

import React, { useState, useRef, useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ElementModel } from '../../types';
import { ZoomIn, ZoomOut, Check, X, Flame, Sparkles, Loader2 } from 'lucide-react';
import { suggestCaption, rewriteText } from '../../api/backend';

export const computePages = (elements: ElementModel[]): ElementModel[][] => {
  const pages: ElementModel[][] = [];
  let currentPage: ElementModel[] = [];
  let currentEstimatedHeight = 0;
  const MAX_PAGE_UNITS = 30;

  elements.forEach((elem) => {
    if (elem.type === 'empty') return;

    let units = 1;
    if (elem.type === 'heading') units = 2;
    if (elem.type === 'image') units = 4;
    if (elem.type === 'table') units = 6;
    if (elem.type === 'portada_block' || elem.is_cover_section) units = elem.image_info ? 1.2 : 0.6;
    if (elem.type === 'paragraph') units = Math.max(1, Math.ceil((elem.text || '').length / 250));

    const isFirstBodyHeading = !elem.is_cover_section && elem.type === 'heading' && elem.text && elem.text.toLowerCase().includes('introducc');
    const isLevel1Heading = elem.type === 'heading' && elem.heading_level === 1;

    if (
      elem.type === 'page_break' ||
      isFirstBodyHeading ||
      (isLevel1Heading && currentPage.length > 0) ||
      (currentEstimatedHeight + units > MAX_PAGE_UNITS && currentPage.length > 0)
    ) {
      if (currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        currentEstimatedHeight = 0;
      }
    }

    if (elem.type !== 'page_break') {
      currentPage.push(elem);
      currentEstimatedHeight += units;
    }
  });

  if (currentPage.length > 0) pages.push(currentPage);
  if (pages.length === 0) pages.push([]);

  return pages;
};

export const PaperCanvas: React.FC = () => {
  const { doc, rules, portada, selectedElementId, setSelectedElementId, updateElementType } = useDocStore();
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [contextMenuElemId, setContextMenuElemId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showAIHeatmap, setShowAIHeatmap] = useState<boolean>(false);
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleSuggestCaption = async (elem: ElementModel) => {
    if (!doc) return;
    setAiLoadingId(elem.id);
    try {
      const contextText = elem.text || "";
      const suggestion = await suggestCaption(doc.session_id, elem.id, contextText);
      const newImageInfo = { ...elem.image_info, caption: suggestion };
      useDocStore.getState().updateElementImage(elem.id, newImageInfo);
      useDocStore.getState().showToast('Leyenda sugerida aplicada', 'success');
    } catch (err: any) {
      useDocStore.getState().showToast(err.message || 'Error al sugerir leyenda', 'error');
    } finally {
      setAiLoadingId(null);
      setContextMenuElemId(null);
    }
  };

  const handleRewriteText = async (elem: ElementModel) => {
    if (!doc) return;
    const instruction = prompt("Instrucción para reescribir (ej. 'Hazlo más formal' o 'Corrige ortografía'):", "Corrige la gramática y adapta al tono académico APA.");
    if (!instruction) return;
    
    setAiLoadingId(elem.id);
    try {
      const rewritten = await rewriteText(doc.session_id, elem.id, elem.text, instruction);
      useDocStore.getState().updateElementType(elem.id, elem.type, elem.heading_level, rewritten);
      useDocStore.getState().showToast('Texto reescrito aplicado', 'success');
    } catch (err: any) {
      useDocStore.getState().showToast(err.message || 'Error al reescribir', 'error');
    } finally {
      setAiLoadingId(null);
      setContextMenuElemId(null);
    }
  };

  // Zoom con Ctrl + Scroll
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 10 : -10;
        setZoomLevel(prev => Math.min(Math.max(prev + delta, 50), 200));
      }
    };

    const el = wrapperRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (el) el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Scroll automático y resalte suave al seleccionar cualquier elemento desde el esquema o asistente
  useEffect(() => {
    if (selectedElementId) {
      const targetEl = document.getElementById(`paper-elem-${selectedElementId}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedElementId]);

  if (!doc) return null;

  const fontFamily = rules.font_family || 'Times New Roman';

  // Algoritmo de paginación virtual respetando salto de página del cuerpo
  const pages = computePages(doc.elements);

  let globalListCounter = 0;

  return (
    <div
      ref={wrapperRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        backgroundColor: 'var(--canvas-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px',
        position: 'relative',
        scrollbarColor: 'rgba(255,255,255,0.15) transparent'
      }}
    >
      {/* Barra de Herramientas Flotante del Lienzo */}
      <div style={{
        position: 'sticky',
        top: '0',
        zIndex: 100,
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        fontSize: '11px',
        color: '#475569',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 600, color: 'var(--word-blue)' }}>Vista Previa del Documento</span>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Tipografía: <strong>{fontFamily}</strong> ({rules.font_size_pt}pt)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className={`btn btn-xs ${showAIHeatmap ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowAIHeatmap(!showAIHeatmap)}
            title="Activar/Desactivar Mapa de Calor IA"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px' }}
          >
            <Flame size={12} color={showAIHeatmap ? '#fca5a5' : '#64748b'} />
            Mapa IA
          </button>
          
          {useDocStore.getState().citationAuditResult && (
            <div style={{ display: 'flex', gap: '6px', marginRight: '8px' }}>
              <div 
                title="Citas fantasma: Existen en el texto pero no en la bibliografía"
                style={{ 
                  display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                  backgroundColor: useDocStore.getState().citationAuditResult?.ghost_citations?.length ? '#fef2f2' : '#f0fdf4',
                  color: useDocStore.getState().citationAuditResult?.ghost_citations?.length ? '#dc2626' : '#16a34a',
                  border: `1px solid ${useDocStore.getState().citationAuditResult?.ghost_citations?.length ? '#fecaca' : '#bbf7d0'}`
                }}
              >
                {useDocStore.getState().citationAuditResult?.ghost_citations?.length || 0} Citas Fantasma
              </div>
              <div 
                title="Referencias huérfanas: Existen en la bibliografía pero nunca se citaron"
                style={{ 
                  display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                  backgroundColor: useDocStore.getState().citationAuditResult?.orphan_references?.length ? '#fffbeb' : '#f0fdf4',
                  color: useDocStore.getState().citationAuditResult?.orphan_references?.length ? '#d97706' : '#16a34a',
                  border: `1px solid ${useDocStore.getState().citationAuditResult?.orphan_references?.length ? '#fde68a' : '#bbf7d0'}`
                }}
              >
                {useDocStore.getState().citationAuditResult?.orphan_references?.length || 0} Refs Huérfanas
              </div>
            </div>
          )}

          <button
            className="btn btn-secondary btn-xs"
            onClick={() => setZoomLevel(prev => Math.max(prev - 10, 50))}
            title="Reducir Zoom"
          >
            <ZoomOut size={12} />
          </button>
          <span style={{ fontWeight: 600, minWidth: '40px', textAlign: 'center' }}>{zoomLevel}%</span>
          <button
            className="btn btn-secondary btn-xs"
            onClick={() => setZoomLevel(prev => Math.min(prev + 10, 200))}
            title="Aumentar Zoom"
          >
            <ZoomIn size={12} />
          </button>
        </div>
      </div>

      {/* Renderizado de Páginas */}
      <div style={{
        transform: `scale(${zoomLevel / 100})`,
        transformOrigin: 'top center',
        transition: 'transform 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {pages.map((pageElements, pageIdx) => {
          const isCoverPage = pageIdx === 0;

          // Separar elementos de portada en bloques lógicos para renderizado limpio
          const coverHeaderTexts: ElementModel[] = [];
          const coverAuthorTexts: ElementModel[] = [];
          const coverFooterTexts: ElementModel[] = [];
          const coverLogoImage = pageElements.find(e => (e.is_cover_section || e.type === 'portada_block') && e.image_info && (e.image_info.width_cm || 0) > 2.0);

          if (isCoverPage) {
            pageElements.forEach(e => {
              if (e.is_cover_section || e.type === 'portada_block') {
                const txt = (e.text || '').trim();
                const txtLower = txt.toLowerCase();

                if (txtLower.includes('elaborado por') || txtLower.includes('br.') || txtLower.includes('carnet') || txtLower.includes('tutor:')) {
                  coverAuthorTexts.push(e);
                } else if (txtLower.includes('grupo') || txtLower.includes('junio') || txtLower.includes('managua') || txtLower.includes('nicaragua')) {
                  coverFooterTexts.push(e);
                } else if (txt) {
                  coverHeaderTexts.push(e);
                }
              }
            });
          }

          return (
            <div
              key={pageIdx}
              style={{
                width: '680px',
                minHeight: '880px',
                backgroundColor: '#ffffff',
                boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
                padding: '54px 54px',
                boxSizing: 'border-box',
                position: 'relative',
                fontFamily: fontFamily,
                fontSize: `${rules.font_size_pt}pt`,
                color: '#000000',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Encabezado Superior de Página */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10pt',
                fontFamily: fontFamily,
                marginBottom: '16px',
                color: '#000000',
                minHeight: '20px'
              }}>
                {doc.apa_format === 'professional' && !isCoverPage ? (
                  <span style={{ fontWeight: 600 }}>RUNNING HEAD</span>
                ) : (
                  <span></span>
                )}
                <span>{!isCoverPage ? pageIdx + 1 : ''}</span>
              </div>

              {/* RENDERIZADO ESTRUCTURADO DE PORTADA EN PÁGINA 1 */}
              {isCoverPage && portada.use_original_cover && pageElements.every(e => e.is_cover_section || e.type === 'portada_block') ? (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '780px' }}>
                  <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#f1f5f9', border: '2px dashed #cbd5e1', borderRadius: '8px', maxWidth: '80%' }}>
                    <p style={{ fontWeight: 'bold', color: '#475569', margin: 0, fontSize: '14pt' }}>[Portada Original Conservada]</p>
                    <p style={{ fontSize: '11pt', color: '#64748b', marginTop: '12px' }}>El documento mantendrá la portada exacta del archivo original al generar el documento final.</p>
                  </div>
                </div>
              ) : isCoverPage && coverHeaderTexts.length > 0 && pageElements.every(e => e.is_cover_section || e.type === 'portada_block') ? (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', minHeight: '780px' }}>
                  
                  {/* Encabezado: Logo + Universidad/Título */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '4px' }}>
                    {coverLogoImage?.image_info?.relative_url && (
                      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                        <img
                          src={coverLogoImage.image_info.relative_url}
                          alt="Logo Universidad"
                          style={{ maxHeight: '110px', maxWidth: '320px', objectFit: 'contain' }}
                        />
                      </div>
                    )}
                    {coverHeaderTexts.map(elem => (
                      <p
                        key={elem.id}
                        id={`paper-elem-${elem.id}`}
                        onClick={(e) => { e.stopPropagation(); setSelectedElementId(elem.id); }}
                        style={{
                          margin: '2px 0',
                          textAlign: (elem.alignment as any) || 'center',
                          fontWeight: elem.is_bold ? 'bold' : 'normal',
                          fontSize: elem.font_size ? `${elem.font_size}pt` : '12pt',
                          color: '#0f172a',
                          cursor: 'pointer'
                        }}
                      >
                        {elem.text}
                      </p>
                    ))}
                  </div>

                  {/* Bloque Autores: Grilla de Columnas Limpia */}
                  {coverAuthorTexts.length > 0 && (
                    <div style={{ width: '100%', margin: '20px 0' }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: '12px',
                        alignItems: 'start',
                        borderLeft: '2px solid #e2e8f0',
                        paddingLeft: '12px'
                      }}>
                        {coverAuthorTexts.map(elem => (
                          <div
                            key={elem.id}
                            id={`paper-elem-${elem.id}`}
                            onClick={(e) => { e.stopPropagation(); setSelectedElementId(elem.id); }}
                            style={{
                              padding: '4px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              backgroundColor: selectedElementId === elem.id ? '#eff6fc' : 'transparent'
                            }}
                          >
                            <p style={{
                              margin: 0,
                              fontSize: '11pt',
                              fontWeight: elem.text.toLowerCase().includes('elaborado') || elem.text.toLowerCase().includes('tutor') ? 'bold' : 'normal',
                              color: '#0f172a',
                              whiteSpace: 'pre-line'
                            }}>
                              {elem.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pie de Portada: Grupo & Fecha */}
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', paddingTop: '16px' }}>
                    {coverFooterTexts.map(elem => (
                      <p
                        key={elem.id}
                        id={`paper-elem-${elem.id}`}
                        onClick={(e) => { e.stopPropagation(); setSelectedElementId(elem.id); }}
                        style={{
                          margin: 0,
                          fontSize: '11pt',
                          fontWeight: 'bold',
                          color: '#0f172a',
                          cursor: 'pointer',
                          textAlign: elem.text.toLowerCase().includes('managua') || elem.text.toLowerCase().includes('junio') ? 'right' : 'left'
                        }}
                      >
                        {elem.text}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                /* RENDERIZADO ESTÁNDAR DEL CUERPO (PÁGINAS > 1) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  {pageElements.map((elem) => {
                    const isSelected = selectedElementId === elem.id;
                    const isContextMenuOpen = contextMenuElemId === elem.id;
                    const showFigureLabel = elem.type === 'image' && elem.image_info && (elem.image_info.figure_number || 0) > 0;

                    if (elem.type === 'heading') {
                      globalListCounter = 0;
                    } else if (elem.type === 'numbered_list') {
                      globalListCounter += 1;
                    }
                    const currentItemNum = globalListCounter;

                    let aiBgColor = 'transparent';
                    let tooltipText = undefined;
                    
                    const hasGhostCitation = useDocStore.getState().citationAuditResult?.ghost_citations?.some((c: any) => c.element_id === elem.id);
                    let borderColor = 'transparent';
                    if (hasGhostCitation) borderColor = '#dc2626';
                    
                    if (showAIHeatmap) {
                      const score = elem.ai_score !== undefined ? elem.ai_score : (elem.confidence < 0.5 ? 0.9 : 0.1);
                      if (score >= 0.75) {
                        aiBgColor = 'rgba(239, 68, 68, 0.15)'; // High Risk - Red
                      } else if (score >= 0.4) {
                        aiBgColor = 'rgba(234, 179, 8, 0.15)'; // Medium Risk - Yellow
                      }
                      
                      if (elem.ai_findings && elem.ai_findings.length > 0) {
                        tooltipText = `Riesgo IA: ${Math.round(score * 100)}%\n` + 
                          elem.ai_findings.map(f => `- ${f.pattern}: ${f.detail}`).join('\n');
                      } else {
                        tooltipText = `Riesgo IA Estimado: ${Math.round(score * 100)}%`;
                      }
                    }

                    // Detector IA Margen (Siempre activo si el score > 0.5)
                    const aiScore = elem.ai_score !== undefined ? elem.ai_score : 0;
                    const isAIGenerated = aiScore > 0.5;
                    const aiMarginBorder = isAIGenerated ? '3px solid #f59e0b' : '3px solid transparent';
                    const aiTooltip = isAIGenerated ? `Posible contenido IA (${Math.round(aiScore * 100)}%). Patrones detectados.` : undefined;

                    return (
                      <div
                        key={elem.id}
                        id={`paper-elem-${elem.id}`}
                        title={hasGhostCitation ? 'Este párrafo contiene una cita sin referencia bibliográfica.' : (tooltipText || aiTooltip)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId(elem.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (elem.type !== 'image' && elem.type !== 'table') {
                            setEditingId(elem.id);
                            setEditValue(elem.text || '');
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedElementId(elem.id);
                          setContextMenuElemId(elem.id);
                        }}
                        style={{
                          position: 'relative',
                          border: isSelected ? '2px solid var(--word-blue)' : hasGhostCitation ? '2px dashed #dc2626' : '2px solid transparent',
                          borderLeft: isSelected ? '2px solid var(--word-blue)' : aiMarginBorder,
                          borderRadius: '2px',
                          padding: '2px 2px 2px 6px',
                          backgroundColor: isSelected ? 'rgba(43, 87, 154, 0.05)' : (hasGhostCitation ? 'rgba(254, 242, 242, 0.5)' : aiBgColor),
                          transition: 'all 0.2s',
                          cursor: 'text'
                        }}
                      >
                        {/* Menú Contextual */}
                        {isContextMenuOpen && (
                          <div style={{
                            position: 'absolute',
                            top: '-36px',
                            left: '0',
                            backgroundColor: '#ffffff',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            display: 'flex',
                            gap: '4px',
                            zIndex: 300,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                          }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                              onClick={() => { updateElementType(elem.id, 'heading', 1, elem.text); setContextMenuElemId(null); }}
                            >
                              Heading 1
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                              onClick={() => { updateElementType(elem.id, 'heading', 2, elem.text); setContextMenuElemId(null); }}
                            >
                              Heading 2
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                              onClick={() => { updateElementType(elem.id, 'paragraph', 1, elem.text); setContextMenuElemId(null); }}
                            >
                              Párrafo
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                              onClick={() => { updateElementType(elem.id, 'bullet', 1, elem.text); setContextMenuElemId(null); }}
                            >
                              Viñeta
                            </button>
                            
                            {/* AI Actions */}
                            <div style={{ width: '1px', backgroundColor: '#e2e8f0', margin: '0 4px' }} />
                            {(elem.type === 'image' || elem.type === 'table') && (
                              <button
                                className="btn btn-sm"
                                style={{ padding: '2px 6px', fontSize: '10px', backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => handleSuggestCaption(elem)}
                              >
                                <Sparkles size={10} /> Sugerir Leyenda
                              </button>
                            )}
                            {(elem.type === 'paragraph' || elem.type === 'heading') && (
                              <button
                                className="btn btn-sm"
                                style={{ padding: '2px 6px', fontSize: '10px', backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => handleRewriteText(elem)}
                              >
                                <Sparkles size={10} /> Reescribir Texto
                              </button>
                            )}
                          </div>
                        )}

                        {aiLoadingId === elem.id && (
                          <div style={{
                            position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
                          }}>
                            <Loader2 size={20} className="animate-spin" color="var(--word-blue)" />
                          </div>
                        )}

                        {editingId === elem.id ? (
                          <div style={{ position: 'relative', margin: '4px 0' }}>
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              autoFocus
                              style={{
                                width: '100%',
                                minHeight: '60px',
                                fontFamily: fontFamily,
                                fontSize: `${rules.font_size_pt}pt`,
                                padding: '8px',
                                border: '2px solid var(--word-blue)',
                                borderRadius: '4px',
                                outline: 'none',
                                resize: 'vertical'
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setEditingId(null);
                                } else if (e.key === 'Enter' && e.ctrlKey) {
                                  if (editValue !== elem.text) {
                                    updateElementType(elem.id, elem.type, elem.heading_level, editValue);
                                  }
                                  setEditingId(null);
                                }
                              }}
                            />
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '4px' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setEditingId(null)}
                                title="Cancelar (Esc)"
                              >
                                <X size={14} />
                              </button>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  if (editValue !== elem.text) {
                                    updateElementType(elem.id, elem.type, elem.heading_level, editValue);
                                  }
                                  setEditingId(null);
                                }}
                                title="Guardar (Ctrl+Enter)"
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {elem.type === 'heading' && (
                              <p style={{
                                fontWeight: 'bold',
                                fontStyle: elem.heading_level === 3 ? 'italic' : 'normal',
                                textAlign: elem.heading_level === 1 ? 'center' : 'left',
                                marginTop: '12px',
                                marginBottom: '6px'
                              }}>
                                {elem.text}
                              </p>
                            )}

                            {elem.type === 'paragraph' && (
                              <p style={{
                                textIndent: '0.5in',
                                lineHeight: rules.line_spacing,
                                textAlign: 'justify',
                                margin: '0 0 6px 0'
                              }}>
                                {elem.text}
                              </p>
                            )}

                            {elem.type === 'block_quote' && (
                              <p style={{
                                marginLeft: '0.5in',
                                lineHeight: rules.line_spacing,
                                fontSize: `${rules.font_size_pt - 1}pt`,
                                margin: '6px 0'
                              }}>
                                {elem.text}
                              </p>
                            )}

                            {elem.type === 'bullet' && (
                              <p style={{ marginLeft: `${((elem.list_level || 1) - 1) * 24 + 24}px`, textIndent: '-12px', marginBottom: '0px' }}>
                                • {elem.text}
                              </p>
                            )}

                            {elem.type === 'numbered_list' && (
                              <p style={{ marginLeft: `${((elem.list_level || 1) - 1) * 24 + 24}px`, textIndent: '-12px', marginBottom: '0px' }}>
                                {currentItemNum}. {elem.text}
                              </p>
                            )}
                          </>
                        )}

                        {(elem.type === 'image' || elem.image_info) && (
                          <div style={{ margin: '16px 0', textAlign: 'center', width: '100%' }}>
                            {showFigureLabel && (
                              <>
                                <p style={{ fontWeight: 'bold', textAlign: 'left', margin: '0 0 2px 0' }}>Figura {elem.image_info?.figure_number}</p>
                                {elem.image_info?.caption && <p style={{ fontStyle: 'italic', textAlign: 'left', margin: '0 0 8px 0' }}>{elem.image_info.caption}</p>}
                              </>
                            )}

                            <div style={{
                              margin: '8px auto',
                              maxWidth: '100%',
                              height: '140px',
                              backgroundColor: '#f8fafc',
                              border: '1px dashed #cbd5e1',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#64748b',
                              overflow: 'hidden'
                            }}>
                              {elem.image_info?.relative_url ? (
                                <img src={elem.image_info.relative_url} alt="Figura" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                              ) : (
                                <span style={{ fontSize: '12px' }}>{elem.text || '[Gráfico]'}</span>
                              )}
                            </div>

                            {elem.image_info?.note && (
                              <p style={{ fontSize: '11px', marginTop: '6px', color: '#334155', textAlign: 'left' }}>
                                <span style={{ fontStyle: 'italic', fontWeight: 600 }}>Nota.</span> {elem.image_info.note}
                              </p>
                            )}
                          </div>
                        )}

                        {elem.type === 'table' && elem.table_info && (
                          <div style={{ margin: '16px 0', width: '100%' }}>
                            <p style={{ fontWeight: 'bold', margin: '0 0 2px 0' }}>Tabla {elem.table_info.table_number}</p>
                            {elem.table_info.caption && <p style={{ fontStyle: 'italic', margin: '0 0 8px 0' }}>{elem.table_info.caption}</p>}
                            <table style={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              borderTop: '1px solid #000000',
                              borderBottom: '1px solid #000000',
                              margin: '8px 0'
                            }}>
                              {elem.table_info.headers && (
                                <thead>
                                  <tr style={{ borderBottom: '1px solid #000000' }}>
                                    {elem.table_info.headers.map((h, i) => (
                                      <th key={i} style={{ padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                              )}
                              <tbody>
                                {elem.table_info.rows.map((row, rIdx) => (
                                  <tr key={rIdx}>
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} style={{ padding: '6px' }}>{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {elem.table_info.note && (
                              <p style={{ fontSize: '11px', marginTop: '6px', color: '#334155' }}>
                                <span style={{ fontStyle: 'italic', fontWeight: 600 }}>Nota.</span> {elem.table_info.note}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

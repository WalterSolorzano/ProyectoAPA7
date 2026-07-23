/* WordAPA7 — Interactive Canvas with 1-to-1 Original Document Fidelity */

import React, { useState, useRef, useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ElementModel } from '../../types';
import { Type, Image as ImageIcon, Table as TableIcon, ZoomIn, ZoomOut } from 'lucide-react';

export const PaperCanvas: React.FC = () => {
  const { doc, rules, selectedElementId, setSelectedElementId, updateElementType } = useDocStore();
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [contextMenuElemId, setContextMenuElemId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
  const pages: ElementModel[][] = [];
  let currentPage: ElementModel[] = [];
  let currentEstimatedHeight = 0;
  const MAX_PAGE_UNITS = 30;

  doc.elements.forEach((elem) => {
    if (elem.type === 'empty') return;

    let units = 1;
    if (elem.type === 'heading') units = 2;
    if (elem.type === 'image') units = 4;
    if (elem.type === 'table') units = 6;
    if (elem.type === 'portada_block' || elem.is_cover_section) units = elem.image_info ? 1.5 : 0.8;
    if (elem.type === 'paragraph') units = Math.max(1, Math.ceil((elem.text || '').length / 250));

    const isFirstBodyHeading = !elem.is_cover_section && elem.type === 'heading' && elem.text && elem.text.toLowerCase().includes('introducc');

    if (
      elem.type === 'page_break' ||
      isFirstBodyHeading ||
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

  let globalListCounter = 0;

  return (
    <div
      ref={wrapperRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        backgroundColor: '#cbd5e1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px',
        position: 'relative'
      }}
      onClick={() => {
        setSelectedElementId(null);
        setContextMenuElemId(null);
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
          <span style={{ fontWeight: 600, color: 'var(--word-blue)' }}>Vista Previa Fiel al Documento Word</span>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Tipografía: <strong>{fontFamily}</strong> ({rules.font_size_pt}pt)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

          return (
            <div
              key={pageIdx}
              style={{
                width: '680px',
                minHeight: '880px',
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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

              {/* Contenido de los Elementos de la Página */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                {pageElements.map((elem) => {
                  const isSelected = selectedElementId === elem.id;
                  const isContextMenuOpen = contextMenuElemId === elem.id;
                  const isCoverElem = elem.is_cover_section || elem.type === 'portada_block';
                  const showFigureLabel = !isCoverElem && elem.type === 'image' && elem.image_info && (elem.image_info.figure_number || 0) > 0;

                  if (elem.type === 'heading') {
                    globalListCounter = 0;
                  } else if (elem.type === 'numbered_list') {
                    globalListCounter += 1;
                  }
                  const currentItemNum = globalListCounter;

                  // Renderizado Fiel de Elementos de Portada sin alterar su diseño
                  if (isCoverElem) {
                    return (
                      <div
                        key={elem.id}
                        id={`paper-elem-${elem.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId(elem.id);
                        }}
                        style={{
                          padding: '2px 4px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#eff6fc' : 'transparent',
                          boxShadow: isSelected ? '0 0 0 2px var(--word-blue)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {elem.image_info?.relative_url ? (
                          <div style={{ textAlign: (elem.alignment as any) || 'center', margin: '8px 0' }}>
                            <img
                              src={elem.image_info.relative_url}
                              alt="Imagen Portada"
                              style={{ maxHeight: '120px', maxWidth: '100%', objectFit: 'contain' }}
                            />
                          </div>
                        ) : (
                          <p style={{
                            margin: '4px 0',
                            textAlign: (elem.alignment as any) || 'center',
                            fontWeight: elem.is_bold ? 'bold' : 'normal',
                            fontStyle: elem.is_italic ? 'italic' : 'normal',
                            fontSize: elem.font_size ? `${elem.font_size}pt` : `${rules.font_size_pt}pt`,
                            color: '#0f172a'
                          }}>
                            {elem.text}
                          </p>
                        )}
                      </div>
                    );
                  }

                  // Renderizado Estándar del Cuerpo
                  return (
                    <div
                      key={elem.id}
                      id={`paper-elem-${elem.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedElementId(elem.id);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedElementId(elem.id);
                        setContextMenuElemId(elem.id);
                      }}
                      style={{
                        position: 'relative',
                        borderRadius: '4px',
                        padding: '2px 4px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#eff6fc' : 'transparent',
                        boxShadow: isSelected ? '0 0 0 2px var(--word-blue)' : 'none',
                        transition: 'all 0.15s ease'
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
                        </div>
                      )}

                      {/* Elementos por Tipo */}
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

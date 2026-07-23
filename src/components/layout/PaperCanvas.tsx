/* WordAPA7 — Paper Canvas (Interactive Drag & Drop Block Manager & Word Cover Engine) */

import React, { useEffect, useRef, useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ElementModel } from '../../types';
import { Move, AlignLeft, AlignCenter, AlignRight, ZoomIn, ZoomOut, Edit3, ArrowUp, ArrowDown } from 'lucide-react';

export const PaperCanvas: React.FC = () => {
  const { doc, rules, portada, references, zoomLevel, setZoomLevel, selectedElementId, setSelectedElementId, updateElementType } = useDocStore();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [contextMenuElemId, setContextMenuElemId] = useState<string | null>(null);

  // Estado local para personalización interactiva de bloques de portada (tamaños, alineación, orden)
  const [logoScale, setLogoScale] = useState<number>(100);
  const [tutorScale, setTutorScale] = useState<number>(130);
  const [authorAlign, setAuthorAlign] = useState<'left' | 'center'>('left');
  const [draggedElemId, setDraggedElemId] = useState<string | null>(null);

  // Shortcut Ctrl + Rueda de ratón para Zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 10 : -10;
        setZoomLevel(zoomLevel + delta);
      }
    };

    const el = wrapperRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (el) el.removeEventListener('wheel', handleWheel);
    };
  }, [zoomLevel, setZoomLevel]);

  // Scroll automático y resalte al seleccionar un elemento desde el esquema
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

  // Algoritmo de paginación virtual con aislamiento estricto de Portada (Página 1)
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
    if (elem.type === 'portada_block') units = elem.image_info ? 1.5 : 0.8;
    if (elem.type === 'paragraph') units = Math.max(1, Math.ceil((elem.text || '').length / 250));

    // Salto a Página 2 estricto si pasamos del bloque de portada al primer Heading del cuerpo
    const isFirstBodyHeading = elem.type === 'heading' && elem.text && elem.text.toLowerCase().includes('introducc');

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

  // Mantener contador de listas secuenciales a lo largo del documento
  let globalListCounter = 0;

  return (
    <div className="paper-canvas-wrapper" ref={wrapperRef} onClick={() => setContextMenuElemId(null)}>
      {/* Regla de Márgenes Superior y Barra de Herramientas de Bloques de Portada */}
      <div style={{
        width: '720px',
        maxWidth: '720px',
        height: '28px',
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        fontSize: '11px',
        color: '#475569',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: 'var(--word-blue)' }}>Modo Bloques Reorganizables</span>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <button
            className="btn btn-secondary btn-sm"
            style={{ padding: '1px 6px', fontSize: '10px' }}
            onClick={() => setLogoScale(prev => Math.min(prev + 10, 160))}
            title="Aumentar tamaño de Logo"
          >
            <ZoomIn size={12} style={{ marginRight: '2px' }} /> Logo +
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ padding: '1px 6px', fontSize: '10px' }}
            onClick={() => setLogoScale(prev => Math.max(prev - 10, 60))}
            title="Reducir tamaño de Logo"
          >
            <ZoomOut size={12} style={{ marginRight: '2px' }} /> Logo -
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ padding: '1px 6px', fontSize: '10px' }}
            onClick={() => setTutorScale(prev => Math.min(prev + 15, 200))}
            title="Aumentar escala del Tutor"
          >
            <ZoomIn size={12} style={{ marginRight: '2px' }} /> Tutor +
          </button>
        </div>

        <div>
          <span>Regla APA 7 — Carta (8.5" x 11") — Zoom: {zoomLevel}%</span>
        </div>
      </div>

      {/* Contenedor Escalable por Zoom */}
      <div style={{
        transform: `scale(${zoomLevel / 100})`,
        transformOrigin: 'top center',
        transition: 'transform 0.1s ease-out',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {pages.map((pageElements, pageIdx) => {
          const isCoverPage = pageIdx === 0;

          // Separación de elementos para la Hoja 1 (Portada)
          const logoElem = isCoverPage ? pageElements.find(e => e.image_info && (pageElements.indexOf(e) < 3 || e.image_info.filename.includes('logo'))) : null;
          const coverImages = isCoverPage ? pageElements.filter(e => e.image_info && e !== logoElem) : [];

          // Filtrar EXPLICITAMENTE fichas de autores excluyendo imagenes de lineas verticales
          const authorCards = coverImages.filter(e => e.image_info?.note !== 'vertical_line');

          // Asignación de autores por sus índices exactos
          const alexaElem = authorCards[2] || authorCards[0];
          const lanceElem = authorCards[4] || authorCards[4];
          const wilmaryElem = authorCards[0] || authorCards[1];
          const tutorElem = authorCards[5] || authorCards[5];
          const walterElem = authorCards[1] || authorCards[2];
          const pauloElem = authorCards[3] || authorCards[3];

          const topHeaderTexts = isCoverPage ? pageElements.filter(e => !e.image_info && pageElements.indexOf(e) < 10) : [];
          const footerTexts = isCoverPage ? pageElements.filter(e => !e.image_info && pageElements.indexOf(e) >= 10) : [];

          return (
            <div
              key={pageIdx}
              className="paper-sheet"
              onClick={() => {
                if (isCoverPage) {
                  const pElem = pageElements.find((e) => e.type === 'portada_block') || pageElements[0];
                  if (pElem) setSelectedElementId(pElem.id);
                }
              }}
              style={{
                fontFamily: fontFamily,
                marginBottom: '32px'
              }}
            >
              {/* Encabezado con número de página */}
              <div style={{
                display: 'flex',
                justifyContent: doc.apa_format === 'professional' && portada.running_head ? 'space-between' : 'flex-end',
                fontSize: '12px',
                marginBottom: '20px',
                borderBottom: '1px dashed #cbd5e1',
                paddingBottom: '4px',
                color: '#64748b'
              }}>
                {doc.apa_format === 'professional' && portada.running_head && !isCoverPage ? (
                  <span style={{ fontWeight: 600 }}>{portada.running_head.toUpperCase()}</span>
                ) : (
                  <span></span>
                )}
                <span>{!isCoverPage ? pageIdx + 1 : ''}</span>
              </div>

              {/* RENDERIZADO SECUENCIAL ESTRUCTURADO DE PORTADA EN PÁGINA 1 */}
              {isCoverPage ? (
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: '820px', justifyContent: 'space-between' }}>
                  
                  {/* Bloque Superior: Logo + Subencabezados Centrados */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '2px' }}>
                    {logoElem && logoElem.image_info?.relative_url && (
                      <div
                        style={{
                          textAlign: 'center',
                          margin: '0 0 16px 0',
                          width: '100%',
                          cursor: 'pointer',
                          transition: 'transform 0.15s ease'
                        }}
                        onClick={(e) => { e.stopPropagation(); setSelectedElementId(logoElem.id); }}
                      >
                        <img
                          src={logoElem.image_info.relative_url}
                          alt="Logo Universidad"
                          style={{
                            maxHeight: `${(110 * logoScale) / 100}px`,
                            maxWidth: `${(320 * logoScale) / 100}px`,
                            objectFit: 'contain'
                          }}
                        />
                      </div>
                    )}

                    {topHeaderTexts.filter(e => !e.text.toLowerCase().includes('elaborado')).map((elem) => (
                      <p
                        key={elem.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedElementId(elem.id); }}
                        style={{
                          fontSize: elem.is_bold ? '13px' : '12px',
                          textAlign: 'center',
                          fontWeight: elem.is_bold ? 'bold' : 'normal',
                          margin: '2px 0',
                          color: '#0f172a',
                          cursor: 'pointer'
                        }}
                      >
                        {elem.text}
                      </p>
                    ))}
                  </div>

                  {/* Bloque "Elaborado por:" alineado a la izquierda exacto a Word */}
                  <div style={{ width: '100%', marginTop: '20px', marginBottom: '8px' }}>
                    <p style={{ textAlign: authorAlign, fontWeight: 'bold', fontSize: '13px', color: '#0f172a', margin: '0' }}>
                      Elaborado por:
                    </p>
                  </div>

                  {/* Bloque Medio: Cuadrícula Exacta de 4 Columnas con Líneas Divisorias Verticales */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr',
                    alignItems: 'start',
                    gap: '12px',
                    margin: '8px 0 24px 0',
                    width: '100%'
                  }}>
                    {/* Columna 1 (Alexa Marian & Lance Andrew) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start' }}>
                      {alexaElem?.image_info?.relative_url && (
                        <img src={alexaElem.image_info.relative_url} alt="Alexa" style={{ maxHeight: '105px', maxWidth: '140px', objectFit: 'contain' }} />
                      )}
                      {lanceElem?.image_info?.relative_url && (
                        <img src={lanceElem.image_info.relative_url} alt="Lance" style={{ maxHeight: '105px', maxWidth: '140px', objectFit: 'contain' }} />
                      )}
                    </div>

                    {/* Línea Divisoria 1 (Cubre las 2 filas de altura) */}
                    <div style={{ width: '1px', height: '220px', backgroundColor: '#000000', alignSelf: 'start' }} />

                    {/* Columna 2 (Wilmary Eunice & Tutor) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start' }}>
                      {wilmaryElem?.image_info?.relative_url && (
                        <img src={wilmaryElem.image_info.relative_url} alt="Wilmary" style={{ maxHeight: '105px', maxWidth: '140px', objectFit: 'contain' }} />
                      )}
                      {tutorElem?.image_info?.relative_url && (
                        <img
                          src={tutorElem.image_info.relative_url}
                          alt="Tutor"
                          style={{
                            maxHeight: '105px',
                            maxWidth: '150px',
                            objectFit: 'contain',
                            transform: `scale(${tutorScale / 100})`,
                            transformOrigin: 'top left'
                          }}
                        />
                      )}
                    </div>

                    {/* Línea Divisoria 2 (Solo cubre Fila 1) */}
                    <div style={{ width: '1px', height: '105px', backgroundColor: '#000000', alignSelf: 'start' }} />

                    {/* Columna 3 (Walter Noel) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start' }}>
                      {walterElem?.image_info?.relative_url && (
                        <img src={walterElem.image_info.relative_url} alt="Walter" style={{ maxHeight: '105px', maxWidth: '140px', objectFit: 'contain' }} />
                      )}
                    </div>

                    {/* Línea Divisoria 3 (Solo cubre Fila 1) */}
                    <div style={{ width: '1px', height: '105px', backgroundColor: '#000000', alignSelf: 'start' }} />

                    {/* Columna 4 (Paulo Antonio) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start' }}>
                      {pauloElem?.image_info?.relative_url && (
                        <img src={pauloElem.image_info.relative_url} alt="Paulo" style={{ maxHeight: '105px', maxWidth: '140px', objectFit: 'contain' }} />
                      )}
                    </div>
                  </div>

                  {/* Bloque Inferior: Grupo (Izquierda) y Fecha/Lugar (Derecha al pie de portada) */}
                  <div style={{ width: '100%', marginTop: 'auto', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      {footerTexts.filter(e => !e.text.includes('junio') && !e.text.includes('Managua')).map((elem) => (
                        <p
                          key={elem.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedElementId(elem.id); }}
                          style={{
                            fontSize: '13px',
                            textAlign: 'left',
                            fontWeight: 'bold',
                            margin: '2px 0',
                            color: '#0f172a',
                            cursor: 'pointer'
                          }}
                        >
                          {elem.text}
                        </p>
                      ))}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      {footerTexts.filter(e => e.text.includes('junio') || e.text.includes('Managua')).map((elem) => (
                        <p
                          key={elem.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedElementId(elem.id); }}
                          style={{
                            fontSize: '13px',
                            textAlign: 'right',
                            fontWeight: 'bold',
                            margin: '2px 0',
                            color: '#0f172a',
                            cursor: 'pointer'
                          }}
                        >
                          {elem.text}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* RENDERIZADO ESTÁNDAR DEL CUERPO (PÁGINAS > 1) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {pageElements.map((elem) => {
                    const isSelected = selectedElementId === elem.id;
                    const isContextMenuOpen = contextMenuElemId === elem.id;
                    const isPortadaElem = elem.type === 'portada_block' || (elem.image_info && (elem.image_info.figure_number || 0) === 0);
                    const showFigureLabel = !isPortadaElem && elem.type === 'image' && elem.image_info && (elem.image_info.figure_number || 0) > 0;

                    if (elem.type === 'heading') {
                      globalListCounter = 0;
                    } else if (elem.type === 'numbered_list') {
                      globalListCounter += 1;
                    }
                    const currentItemNum = globalListCounter;

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
                        {/* Menú Contextual al Clic Derecho */}
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

                        {elem.type === 'heading' && (
                          elem.heading_level === 1 ? <h1 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px', margin: '16px 0 8px 0' }}>{elem.text}</h1> :
                          elem.heading_level === 2 ? <h2 style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '14px', margin: '14px 0 6px 0' }}>{elem.text}</h2> :
                          elem.heading_level === 3 ? <h3 style={{ textAlign: 'left', fontWeight: 'bold', fontStyle: 'italic', fontSize: '14px', margin: '12px 0 4px 0' }}>{elem.text}</h3> :
                          elem.heading_level === 4 ? <p style={{ textIndent: '24px', fontWeight: 'bold' }}>{elem.text}. </p> :
                          <p style={{ textIndent: '24px', fontWeight: 'bold', fontStyle: 'italic' }}>{elem.text}. </p>
                        )}

                        {elem.type === 'paragraph' && (
                          <p style={{ textIndent: '24px', textAlign: 'left', marginBottom: '0px', lineHeight: rules.line_spacing }}>
                            {elem.text}
                          </p>
                        )}

                        {elem.type === 'block_quote' && (
                          <p style={{ marginLeft: '24px', textIndent: '0px', marginBottom: '0px', lineHeight: rules.line_spacing }}>
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
                              border: isPortadaElem ? 'none' : '1px dashed #cbd5e1',
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

              {/* Sección de Referencias */}
              {pageIdx === pages.length - 1 && references.length > 0 && (
                <div style={{ marginTop: '40px' }}>
                  <h1 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px', marginBottom: '16px' }}>
                    Referencias
                  </h1>
                  {references.map((ref) => (
                    <p key={ref.id} style={{ marginLeft: '24px', textIndent: '-24px', marginBottom: '12px' }}>
                      {ref.formatted_apa || ref.raw_text}
                    </p>
                  ))}
                </div>
              )}

              {/* Número de Hoja al Pie */}
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                Página {pageIdx + 1} de {pages.length}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

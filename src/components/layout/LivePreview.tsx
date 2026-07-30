import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';

export const LivePreview: React.FC = () => {
  const { doc, rules, portada, references, isLoading } = useDocStore();

  // Level 1: CSS instant update (no backend call needed)
  // This happens naturally via React re-renders with updated state

  if (!doc) {
    return (
      <div className="preview-panel">
        <div className="preview-header">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>
            VISTA PREVIA
          </span>
        </div>
        <div className="preview-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-sm text-tertiary" style={{ textAlign: 'center' }}>
            No hay documento cargado para previsualizar.
          </p>
        </div>
      </div>
    );
  }

  const fontFamily = rules.font_family || 'Times New Roman';

  const renderElement = (elem: import('../../types').ElementModel) => {
    if (elem.type === 'heading') {
      const lvl = elem.heading_level || 1;
      const baseStyle: React.CSSProperties = {
        fontFamily,
        fontSize: lvl <= 2 ? '13px' : '12px',
        margin: lvl === 1 ? '12px 0 6px 0' : '10px 0 4px 0',
      };
      if (lvl === 1) return <h1 key={elem.id} style={{ ...baseStyle, textAlign: 'center', fontWeight: 'bold' }}>{elem.text}</h1>;
      if (lvl === 2) return <h2 key={elem.id} style={{ ...baseStyle, textAlign: 'left', fontWeight: 'bold' }}>{elem.text}</h2>;
      if (lvl === 3) return <h3 key={elem.id} style={{ ...baseStyle, textAlign: 'left', fontWeight: 'bold', fontStyle: 'italic' }}>{elem.text}</h3>;
      if (lvl === 4) return <p key={elem.id} style={{ textIndent: '18px', fontWeight: 'bold', fontFamily, fontSize: '12px' }}>{elem.text}. </p>;
      return <p key={elem.id} style={{ textIndent: '18px', fontWeight: 'bold', fontStyle: 'italic', fontFamily, fontSize: '12px' }}>{elem.text}. </p>;
    }

    if (elem.type === 'paragraph') {
      return (
        <p key={elem.id} style={{ textIndent: '18px', textAlign: 'left', marginBottom: 0, fontFamily, fontSize: '12px', lineHeight: '1.8' }}>
          {elem.text}
        </p>
      );
    }

    if (elem.type === 'block_quote') {
      return (
        <p key={elem.id} style={{ marginLeft: '18px', textIndent: 0, marginBottom: 0, fontFamily, fontSize: '12px' }}>
          {elem.text}
        </p>
      );
    }

    if (elem.type === 'bullet') {
      return (
        <p key={elem.id} style={{ marginLeft: '18px', textIndent: '-10px', marginBottom: 0, fontFamily, fontSize: '12px' }}>
          • {elem.text}
        </p>
      );
    }

    if (elem.type === 'numbered_list') {
      return (
        <p key={elem.id} style={{ marginLeft: '18px', textIndent: '-10px', marginBottom: 0, fontFamily, fontSize: '12px' }}>
          1. {elem.text}
        </p>
      );
    }

    if (elem.type === 'image' && elem.image_info) {
      return (
        <div key={elem.id} style={{ margin: '12px 0', textAlign: 'center' }}>
          <p style={{ fontWeight: 'bold', textAlign: 'left', fontSize: '11px', fontFamily }}>
            Figura {elem.image_info.figure_number}
          </p>
          {elem.image_info.caption && (
            <p style={{ fontStyle: 'italic', textAlign: 'left', fontSize: '11px', fontFamily }}>{elem.image_info.caption}</p>
          )}
          <div style={{
            margin: '6px auto', maxWidth: '100%', height: '80px',
            backgroundColor: '#f3f3f3', border: '1px dashed #d1d5db',
            borderRadius: '4px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#9ca3af', overflow: 'hidden',
          }}>
            {elem.image_info.relative_url ? (
              <img src={elem.image_info.relative_url} alt="Figura" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '11px' }}>[Figura {elem.image_info.figure_number}]</span>
            )}
          </div>
        </div>
      );
    }

    if (elem.type === 'table' && elem.table_info) {
      return (
        <div key={elem.id} style={{ margin: '10px 0' }}>
          <p style={{ fontWeight: 'bold', fontFamily, fontSize: '11px' }}>Tabla {elem.table_info.table_number}</p>
          {elem.table_info.caption && <p style={{ fontStyle: 'italic', fontFamily, fontSize: '11px' }}>{elem.table_info.caption}</p>}
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #000', borderBottom: '1px solid #000', margin: '6px 0' }}>
            {elem.table_info.headers && (
              <thead>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  {elem.table_info.headers.map((h, i) => (
                    <th key={i} style={{ padding: '4px', textAlign: 'left', fontWeight: 'bold', fontSize: '11px', fontFamily }}>{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {elem.table_info.rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} style={{ padding: '4px', fontSize: '11px', fontFamily }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>
          VISTA PREVIA HTML
        </span>
      </div>

      {/* Content */}
      <div className="preview-content" style={{ position: 'relative' }}>
        <>
            {/* Loading overlay */}
            {isLoading && (
              <div className="loading-overlay" style={{ borderRadius: 0 }}>
                <span className="loading-spinner" />
              </div>
            )}

            {/* Paper simulation */}
            <div style={{
              width: '100%', minHeight: '600px',
              backgroundColor: 'var(--bg-base)',
              color: 'var(--text-primary)',
              padding: '20px',
              boxShadow: 'var(--shadow-sm)',
              fontFamily,
              fontSize: '12px',
              lineHeight: '1.8',
              borderRadius: '2px',
              border: '1px solid var(--border-subtle)',
            }}>
              {/* Page number header */}
              <div style={{
                display: 'flex',
                justifyContent: doc.apa_format === 'professional' && portada.running_head ? 'space-between' : 'flex-end',
                fontSize: '10px', marginBottom: '12px',
                borderBottom: '1px dashed var(--border-subtle)',
                paddingBottom: '4px', color: 'var(--text-tertiary)',
              }}>
                {doc.apa_format === 'professional' && portada.running_head && (
                  <span>{portada.running_head.toUpperCase()}</span>
                )}
                <span>1</span>
              </div>

              {/* Level 1 CSS preview */}
              <>
                {/* Cover page */}
                {portada.use_original_cover ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', margin: '20px 0', backgroundColor: '#f1f5f9', border: '2px dashed #cbd5e1', borderRadius: '8px' }}>
                    <p style={{ fontWeight: 'bold', color: '#475569', margin: 0 }}>[Portada Original Conservada]</p>
                    <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>El documento mantendrá la portada exacta del archivo original al generar el PDF/DOCX.</p>
                  </div>
                ) : (
                  portada.title && (
                    <div style={{ textAlign: 'center', marginTop: '20px', marginBottom: '40px' }}>
                      <p style={{ fontWeight: 'bold', fontSize: '13px', fontFamily }}>{portada.title}</p>
                      <div style={{ marginTop: '12px', fontSize: '12px', fontFamily }}>
                        <p>{portada.author}</p>
                        <p>{portada.institution}</p>
                        {doc.apa_format === 'student' && (
                          <>
                            <p>{portada.course}</p>
                            <p>{portada.instructor}</p>
                            <p>{portada.date}</p>
                          </>
                        )}
                      </div>
                    </div>
                  )
                )}

                  {/* Elements */}
                  {doc.elements.filter((e) => e.type !== 'empty').map(renderElement)}

                  {/* References */}
                  {references.length > 0 && (
                    <div style={{ marginTop: '40px' }}>
                      <h1 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', marginBottom: '12px', fontFamily }}>
                        Referencias
                      </h1>
                      {references.map((ref) => (
                        <p key={ref.id} style={{ marginLeft: '18px', textIndent: '-18px', marginBottom: '10px', fontFamily, fontSize: '12px' }}>
                          {ref.formatted_apa || ref.raw_text}
                        </p>
                      ))}
                    </div>
                  )}
                </>
            </div>
          </>
      </div>
    </div>
  );
};

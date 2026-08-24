/**
 * WordAPA7 Add-in — Panel de Títulos (Headings)
 *
 * Permite al usuario:
 *   1. Escribir el texto del título
 *   2. Seleccionar el nivel (1-5) según la jerarquía APA 7
 *   3. Insertarlo con el formato APA 7 correspondiente:
 *      Nivel 1: Centrado, negrita
 *      Nivel 2: Izquierda, negrita
 *      Nivel 3: Izquierda, negrita + cursiva
 *      Nivel 4: Sangría, negrita, en línea con texto
 *      Nivel 5: Sangría, negrita + cursiva, en línea con texto
 */

import React, { useState, useEffect } from 'react'
import { insertHeadingAPA, HEADING_CONFIGS, getDocumentHeadings, navigateToParagraph, type HeadingItem } from '../office/wordHelper'

const HeadingIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4v16M18 4v16M6 12h12" />
  </svg>
)

const BulbIcon: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6M10 22h4" />
    <path d="M12 2a7 7 0 00-4 12.7c.5.4.8 1 .8 1.7V18h6.4v-1.6c0-.7.3-1.3.8-1.7A7 7 0 0012 2z" />
  </svg>
)

type HeadingLevel = 1 | 2 | 3 | 4 | 5

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const LEVEL_INFO: Record<HeadingLevel, { label: string; desc: string }> = {
  1: { label: 'Nivel 1', desc: 'Centrado, negrita' },
  2: { label: 'Nivel 2', desc: 'Izquierda, negrita' },
  3: { label: 'Nivel 3', desc: 'Izquierda, negrita + cursiva' },
  4: { label: 'Nivel 4', desc: 'Sangría, negrita, en línea' },
  5: { label: 'Nivel 5', desc: 'Sangría, negrita + cursiva, en línea' },
}

export function HeadingPanel({ showToast }: Props) {
  const [text, setText] = useState('')
  const [level, setLevel] = useState<HeadingLevel>(1)
  const [loading, setLoading] = useState(false)
  const [headings, setHeadings] = useState<HeadingItem[]>([])
  const [loadingMap, setLoadingMap] = useState(false)

  const loadHeadings = async () => {
    setLoadingMap(true)
    try {
      const h = await getDocumentHeadings()
      setHeadings(h)
    } catch {
      // Ignorar errores silentes
    } finally {
      setLoadingMap(false)
    }
  }

  useEffect(() => {
    loadHeadings()
  }, [])

  const handleInsert = async () => {
    if (!text.trim()) {
      showToast('Escribí el texto del título', 'error')
      return
    }
    setLoading(true)
    try {
      await insertHeadingAPA(text.trim(), level)
      showToast(`Título nivel ${level} insertado`, 'success')
      setText('')
      loadHeadings()
    } catch (err: any) {
      showToast(err.message || 'Error al insertar título', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleNavigate = async (index: number) => {
    try {
      await navigateToParagraph(index)
    } catch {
      showToast('No se pudo navegar al título', 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {headings.length > 0 && (
        <div className="card">
          <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="field-label" style={{ marginBottom: 0 }}>Estructura del documento</div>
            <button className="btn btn--ghost" onClick={loadHeadings} disabled={loadingMap} style={{ padding: '2px 6px', fontSize: 11 }}>
              ↻ Actualizar
            </button>
          </div>
          <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
            {loadingMap ? <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Cargando estructura...</div> : (
               headings.map(h => (
                 <div
                   key={h.index}
                   onClick={() => handleNavigate(h.index)}
                   style={{
                     fontSize: 12,
                     color: 'var(--text-secondary)',
                     cursor: 'pointer',
                     paddingLeft: `${(h.level - 1) * 12}px`,
                     whiteSpace: 'nowrap',
                     overflow: 'hidden',
                     textOverflow: 'ellipsis'
                   }}
                   title={h.text}
                 >
                   <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: 4 }}>H{h.level}</span>
                   {h.text}
                 </div>
               ))
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ padding: '10px 12px' }}>
          <div className="field-label">Texto del título</div>
          <input
            className="field-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ej: Introducción"
            onKeyDown={(e) => { if (e.key === 'Enter') handleInsert() }}
          />
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '10px 12px' }}>
          <div className="field-label">Nivel APA 7</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {([1, 2, 3, 4, 5] as const).map((lvl) => {
              const config = HEADING_CONFIGS[lvl]
              const active = level === lvl
              return (
                <button
                  key={lvl}
                  onClick={() => setLevel(lvl)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                    background: active ? 'var(--accent-soft)' : 'var(--bg-primary)',
                    color: active ? 'var(--accent-primary)' : 'var(--text-primary)',
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ flex: 1 }}>
                    {LEVEL_INFO[lvl].label}
                  </span>
                  <span style={{ fontSize: 10, color: active ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}>
                    {LEVEL_INFO[lvl].desc}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Preview del formato */}
      <div className="card">
        <div style={{ padding: '10px 12px' }}>
          <div className="field-label">Vista previa</div>
          <div style={{
            padding: '8px 10px',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontFamily: 'Times New Roman, serif',
            fontSize: 12,
            fontWeight: 'bold',
            fontStyle: HEADING_CONFIGS[level].italic ? 'italic' : 'normal',
            textAlign: HEADING_CONFIGS[level].alignment === Word.Alignment.centered ? 'center' : 'left',
            marginLeft: HEADING_CONFIGS[level].indentCm > 0 ? `${HEADING_CONFIGS[level].indentCm}cm` : 0,
            color: 'var(--text-primary)',
          }}>
            {text || 'Texto del título...'}
          </div>
        </div>
      </div>

      <button
        className="btn btn--primary btn--full"
        onClick={handleInsert}
        disabled={loading || !text.trim()}
      >
        {loading ? (
          <>
            <span className="spinner" /> Insertando...
          </>
        ) : (
          <><HeadingIcon /> Insertar Título APA 7</>
        )}
      </button>

      <div className="tip-box">
        <span className="tip-box__icon"><BulbIcon /></span>
        <span className="tip-box__text">5 niveles según la jerarquía. Elegí según cuán profundo sea tu trabajo.</span>
      </div>
    </div>
  )
}

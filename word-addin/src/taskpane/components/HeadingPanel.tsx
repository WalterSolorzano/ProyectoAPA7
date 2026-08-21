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

import React, { useState } from 'react'
import { insertHeadingAPA, HEADING_CONFIGS } from '../office/wordHelper'

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
    } catch (err: any) {
      showToast(err.message || 'Error al insertar título', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            color: '#000',
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
          <>¶ Insertar Título APA 7</>
        )}
      </button>
    </div>
  )
}

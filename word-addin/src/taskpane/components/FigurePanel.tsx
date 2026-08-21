/**
 * WordAPA7 Add-in — Panel de Figuras
 *
 * Permite al usuario:
 *   1. Subir una imagen (drag & drop o botón)
 *   2. Definir título, nota y texto alternativo
 *   3. Insertarla en el documento con formato APA 7 completo
 *   4. La numeración ("Figura N") es automática
 */

import React, { useState, useRef } from 'react'
import {
  insertFigureAPA,
  getNextFigureNumber,
  fileToBase64,
  type FigureData,
} from '../office/wordHelper'

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export function FigurePanel({ showToast }: Props) {
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [note, setNote] = useState('')
  const [altText, setAltText] = useState('')
  const [widthInches, setWidthInches] = useState(5.5)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Solo se admiten imágenes', 'error')
      return
    }
    try {
      const b64 = await fileToBase64(file)
      setImageBase64(b64)
      setPreviewUrl(URL.createObjectURL(file))
    } catch {
      showToast('Error al procesar la imagen', 'error')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleInsert = async () => {
    if (!imageBase64) {
      showToast('Primero subí una imagen', 'error')
      return
    }
    setLoading(true)
    try {
      const figNum = await getNextFigureNumber()

      const data: FigureData = {
        imageBase64,
        caption: caption || `Título de la Figura ${figNum}`,
        note,
        widthInches: widthInches,
        altText,
      }

      await insertFigureAPA(data, figNum)
      showToast(`Figura ${figNum} insertada con formato APA 7`, 'success')
    } catch (err: any) {
      showToast(err.message || 'Error al insertar figura', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Dropzone */}
      <div
        className={`dropzone ${dragging ? 'dropzone--active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {previewUrl ? (
          <img src={previewUrl} className="dropzone__preview" alt="Preview" />
        ) : (
          <>
            <span style={{ fontSize: 24 }}>⬆</span>
            <span className="dropzone__text">Arrastrá una imagen o hacé clic</span>
            <span className="dropzone__text" style={{ opacity: 0.6 }}>PNG, JPG, GIF, etc.</span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
      </div>

      {/* Campos */}
      <div className="card">
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div className="field-label">Título de la figura (en cursiva, APA 7)</div>
            <input
              className="field-input"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Ej: Diagrama de flujo del proceso"
            />
          </div>
          <div>
            <div className="field-label">Nota (opcional)</div>
            <input
              className="field-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Adaptado de Fernández et al. (2024)"
            />
          </div>
          <div>
            <div className="field-label">Texto alternativo (accesibilidad)</div>
            <input
              className="field-input"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Descripción breve de la figura"
            />
          </div>
          <div>
            <div className="field-label">Ancho (pulgadas): {widthInches.toFixed(1)}"</div>
            <input
              type="range"
              min={1}
              max={6.5}
              step={0.1}
              value={widthInches}
              onChange={(e) => setWidthInches(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-tertiary)' }}>
              <span>1"</span>
              <span>6.5"</span>
            </div>
          </div>
        </div>
      </div>

      <button
        className="btn btn--primary btn--full"
        onClick={handleInsert}
        disabled={loading || !imageBase64}
      >
        {loading ? (
          <>
            <span className="spinner" /> Insertando...
          </>
        ) : (
          <>⛶ Insertar Figura APA 7</>
        )}
      </button>

      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', padding: '0 8px' }}>
        La numeración "Figura 1, 2, 3..." es automática.
        La imagen se centra según el estándar APA 7.
      </div>
    </div>
  )
}

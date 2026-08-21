/**
 * WordAPA7 Add-in — Panel de Referencias / Bibliografía
 * ====================================================
 *
 * Muestra las citas detectadas y la bibliografía sugerida (APA 7) construida
 * a partir de ellas. Permite insertarla al final del documento, editar
 * referencias y re-extraer citas del documento actual.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { backend, type ReferenceDTO } from '../api/backend'
import { getDocumentText, insertBibliographyAPA } from '../office/wordHelper'

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export function ReferencesPanel({ showToast }: Props) {
  const [references, setReferences] = useState<ReferenceDTO[]>([])
  const [bibText, setBibText] = useState('')
  const [loading, setLoading] = useState(false)
  const [inserting, setInserting] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await backend.buildBibliography()
      setReferences(res.references || [])
      setBibText(res.bibliography_text || '')
    } catch {
      // backend offline: intentar listReferences
      try {
        const res = await backend.listReferences()
        setReferences(res.references || [])
        setBibText(res.bibliography_text || '')
      } catch {
        showToast('Backend no disponible. Iniciá WordAPA7.', 'error')
      }
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    refresh()
  }, [refresh])

  const reextract = useCallback(async () => {
    setLoading(true)
    try {
      const text = await getDocumentText()
      // 1. Escanear el documento y persistir las citas en el store del backend.
      //    El endpoint /extract-citations detecta (Autor, Año) y crea
      //    referencias "borrador" automáticamente.
      let newCount = 0
      try {
        const extracted = await backend.extractCitations(text)
        newCount = extracted.new_count ?? 0
      } catch {
        /* si falla la extracción, igual intentamos construir la bibliografía */
      }
      // 2. Construir la bibliografía APA 7 a partir del store actualizado.
      const res = await backend.buildBibliography()
      setReferences(res.references || [])
      setBibText(res.bibliography_text || '')
      const drafts = (res.references || []).filter((r) => r.is_draft).length
      showToast(`Bibliografía actualizada: ${res.total} referencia(s)`, 'success')
      if (newCount > 0) {
        showToast(`${newCount} cita(s) nueva(s) detectada(s)`, 'info')
      } else if (drafts > 0) {
        showToast(`${drafts} referencia(s) borrador: completá los datos`, 'info')
      }
    } catch {
      showToast('No se pudo re-extraer las citas', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const insertBibliography = useCallback(async () => {
    if (!bibText.trim()) {
      showToast('No hay bibliografía para insertar. Extraé citas primero.', 'error')
      return
    }
    setInserting(true)
    try {
      await insertBibliographyAPA(bibText)
      showToast('Bibliografía APA 7 insertada al final del documento', 'success')
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`, 'error')
    } finally {
      setInserting(false)
    }
  }, [bibText, showToast])

  const removeRef = useCallback(async (id: string) => {
    try {
      await backend.deleteReference(id)
      setReferences((prev) => prev.filter((r) => r.id !== id))
      setBibText((prev) =>
        prev
          .split('\n')
          .filter((line) => {
            const ref = references.find((r) => r.id === id)
            return ref ? !line.includes((ref.formatted_apa || '').slice(0, 30)) : true
          })
          .join('\n')
      )
      showToast('Referencia eliminada', 'info')
    } catch {
      showToast('No se pudo eliminar', 'error')
    }
  }, [references, showToast])

  const clearAll = useCallback(async () => {
    try {
      await backend.clearReferences()
      setReferences([])
      setBibText('')
      showToast('Bibliografía vaciada', 'info')
    } catch {
      showToast('No se pudo vaciar', 'error')
    }
  }, [showToast])

  const drafts = references.filter((r) => r.is_draft).length
  const complete = references.length - drafts

  return (
    <>
      <div className="card">
        <div className="card__simple-header">Bibliografía sugerida (APA 7)</div>
        <div className="card__body">
          <div className="stats-grid stats-grid--compact">
            <div className="stat-box">
              <div className="stat-box__value">{references.length}</div>
              <div className="stat-box__label">Total</div>
            </div>
            <div className="stat-box">
              <div className="stat-box__value" style={{ color: 'var(--color-success)' }}>{complete}</div>
              <div className="stat-box__label">Completas</div>
            </div>
            <div className="stat-box">
              <div className="stat-box__value" style={{ color: 'var(--color-warning)' }}>{drafts}</div>
              <div className="stat-box__label">Borrador</div>
            </div>
          </div>

          <div className="row-2">
            <button className="btn btn--secondary" onClick={reextract} disabled={loading}>
              {loading ? <span className="spinner" /> : null} Re-extraer
            </button>
            <button className="btn btn--ghost" onClick={clearAll} disabled={references.length === 0}>
              Vaciar
            </button>
          </div>

          <button className="btn btn--primary btn--full" onClick={insertBibliography} disabled={inserting || !bibText}>
            {inserting ? <span className="spinner" /> : null} 📚 Insertar bibliografía
          </button>
        </div>
      </div>

      {/* Preview de la bibliografía */}
      {bibText && (
        <div className="card">
          <div className="card__simple-header">Vista previa</div>
          <div className="card__body">
            <pre className="bib-preview">{bibText}</pre>
          </div>
        </div>
      )}

      {/* Lista de referencias */}
      {references.length > 0 && (
        <div className="card">
          <div className="card__simple-header">Referencias detectadas</div>
          <div className="card__body">
            {references.map((ref) => (
              <div key={ref.id} className="ref-item">
                <div className="ref-item__text">{ref.formatted_apa || ref.raw_text || '(sin formato)'}</div>
                <div className="ref-item__meta">
                  {ref.is_draft ? (
                    <span className="badge badge--warning">borrador</span>
                  ) : (
                    <span className="badge badge--success">completa</span>
                  )}
                  <button
                    className="ref-item__delete"
                    onClick={() => removeRef(ref.id)}
                    title="Eliminar referencia"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {references.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-state__icon">📚</div>
          <div className="empty-state__title">Sin referencias aún</div>
          <div className="empty-state__text">
            Escribí citas como (García, 2023) en tu documento y el asistente las detectará
            automáticamente. Luego volvé acá y pulsá "Re-extraer".
          </div>
        </div>
      )}
    </>
  )
}

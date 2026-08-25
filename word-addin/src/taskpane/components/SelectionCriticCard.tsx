import React, { useState, useEffect, useCallback } from 'react'
import {
  subscribeSelectionChanges,
  getSelectedText,
  applyAPA7ToSelection,
  applyHeadingStyle,
} from '../office/wordHelper'
import {
  ZapIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  DocumentTextIcon,
  TableIcon,
  QuoteIcon,
} from './Icons'

interface SelectionAnalysis {
  text: string
  wordCount: number
  category: 'heading_numbered' | 'heading_h1' | 'heading_h2' | 'heading_h3' | 'toc_line' | 'citation' | 'body_paragraph' | 'empty'
  label: string
  critique: string
  suggestedAction: string
  actionType: 'h1' | 'h2' | 'h3' | 'body' | 'citation' | 'none'
}

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export const SelectionCriticCard: React.FC<Props> = ({ showToast }) => {
  const [analysis, setAnalysis] = useState<SelectionAnalysis | null>(null)
  const [inspecting, setInspecting] = useState(false)
  const [applying, setApplying] = useState(false)

  const inspectSelection = useCallback(async () => {
    try {
      setInspecting(true)
      const text = await getSelectedText()
      const trimmed = text.trim()

      if (!trimmed) {
        setAnalysis({
          text: '',
          wordCount: 0,
          category: 'empty',
          label: 'Sin selección activa',
          critique: 'Haz clic o selecciona un párrafo en tu documento de Word para recibir diagnóstico y corrección APA 7 al instante.',
          suggestedAction: '',
          actionType: 'none',
        })
        return
      }

      const words = trimmed.split(/\s+/).length

      // 1. Línea de Índice / TOC
      if (/(?:\.{2,}|_{2,}|\t|\s{4,})\s*\d+\s*$/.test(trimmed)) {
        setAnalysis({
          text: trimmed,
          wordCount: words,
          category: 'toc_line',
          label: 'Línea de Índice / Contenido',
          critique: 'Línea con puntos guía y número de página. Se debe mantener sin sangría de primera línea para no desalinear los números.',
          suggestedAction: 'Mantener formato alineado a la izquierda sin sangría.',
          actionType: 'none',
        })
        return
      }

      // 2. Título con numeración manual (1.1., 1.2., 2.1., etc.)
      if (/^\d+\.\d+\.?[\s\t]+[a-zÁÉÍÓÚÑ]/i.test(trimmed) && trimmed.length < 100) {
        setAnalysis({
          text: trimmed,
          wordCount: words,
          category: 'heading_numbered',
          label: 'Título con Numeración Decimal (Nivel 2)',
          critique: 'En APA 7 los títulos de Nivel 2 van alineados a la izquierda en negrita, sin sangría de párrafo.',
          suggestedAction: 'Formatear como Título Nivel 2 APA 7 (Izquierda, Negrita)',
          actionType: 'h2',
        })
        return
      }

      // 3. Título Romano o Principal (I., II., Introducción, etc.)
      if (/^(?:cap[ií]tulo\s+[ivxlcdm\d]+|[ivxlcdm]+\.[\s\t]+[a-zÁÉÍÓÚÑ]|introducci[oó]n|m[eé]todo|metodolog[ií]a|resultados|discusi[oó]n|conclusiones|referencias)/i.test(trimmed) && trimmed.length < 80) {
        setAnalysis({
          text: trimmed,
          wordCount: words,
          category: 'heading_h1',
          label: 'Título Principal (Nivel 1)',
          critique: 'En APA 7 los títulos principales de sección van centrados en negrita y sin sangría.',
          suggestedAction: 'Formatear como Título Nivel 1 APA 7 (Centrado, Negrita)',
          actionType: 'h1',
        })
        return
      }

      // 4. Subtítulo corto (Situación problemática, Objetivos, etc.)
      if (trimmed.length < 60 && !trimmed.endsWith('.') && !trimmed.includes(',') && words <= 7) {
        setAnalysis({
          text: trimmed,
          wordCount: words,
          category: 'heading_h3',
          label: 'Subtítulo / Encabezado (Nivel 3)',
          critique: 'Subtítulo detectado. En APA 7 los encabezados de Nivel 3 van alineados a la izquierda en negrita y cursiva.',
          suggestedAction: 'Formatear como Título Nivel 3 APA 7 (Negrita + Cursiva)',
          actionType: 'h3',
        })
        return
      }

      // 5. Cita parentética en el texto
      if (/\([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+et al\.)?,\s*\d{4}\)/.test(trimmed)) {
        setAnalysis({
          text: trimmed,
          wordCount: words,
          category: 'citation',
          label: 'Cita Académica en Texto',
          critique: 'Cita en formato parentético (Autor, Año) detectada correctamente según norma APA 7.',
          suggestedAction: 'Asegurar que la fuente esté incluida en la sección de Referencias final.',
          actionType: 'citation',
        })
        return
      }

      // 6. Párrafo normal de cuerpo
      setAnalysis({
        text: trimmed,
        wordCount: words,
        category: 'body_paragraph',
        label: 'Párrafo de Cuerpo',
        critique: 'Párrafo estándar de cuerpo. Requiere Times New Roman 12pt, interlineado doble (2.0) y sangría de primera línea de 1.27 cm (0.5 pulgadas).',
        suggestedAction: 'Aplicar Formato APA 7 Estricto (Sangría 0.5" + Interlineado Doble)',
        actionType: 'body',
      })
    } catch {
      /* ignore */
    } finally {
      setInspecting(false)
    }
  }, [])

  useEffect(() => {
    inspectSelection()
    const unsubscribe = subscribeSelectionChanges(() => {
      inspectSelection()
    })
    return () => {
      unsubscribe()
    }
  }, [inspectSelection])

  const handleApplyFix = async () => {
    if (!analysis || analysis.actionType === 'none') return
    setApplying(true)
    try {
      if (analysis.actionType === 'h1') {
        await applyHeadingStyle(1)
        showToast('Título Nivel 1 (Centrado, Negrita) aplicado', 'success')
      } else if (analysis.actionType === 'h2') {
        await applyHeadingStyle(2)
        showToast('Título Nivel 2 (Izquierda, Negrita) aplicado', 'success')
      } else if (analysis.actionType === 'h3') {
        await applyHeadingStyle(3)
        showToast('Título Nivel 3 (Izquierda, Negrita + Cursiva) aplicado', 'success')
      } else if (analysis.actionType === 'body') {
        await applyAPA7ToSelection(true)
        showToast('Formato de cuerpo APA 7 (sangría 0.5") aplicado', 'success')
      }
      setTimeout(inspectSelection, 200)
    } catch (err: any) {
      showToast(err.message || 'Error al aplicar formato en Word', 'error')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="card" style={{ borderLeft: '3px solid var(--accent-primary)', background: 'var(--surface, var(--surface, #fff)fff)' }}>
      <div className="card__header">
        <div className="card__title" style={{ fontSize: 12.5 }}>
          <ZapIcon size={14} color="var(--accent-primary)" />
          <span>Crítico y Apoyo en Vivo</span>
        </div>
        <button
          type="button"
          className="btn-sm btn-secondary"
          onClick={inspectSelection}
          disabled={inspecting}
          title="Actualizar análisis de la selección"
        >
          {inspecting ? 'Analizando...' : 'Inspeccionar'}
        </button>
      </div>

      {analysis && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
              {analysis.label}
            </span>
            {analysis.wordCount > 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>
                {analysis.wordCount} palabras
              </span>
            )}
          </div>

          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.35, background: 'var(--surface-subtle, #f8fafc)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-subtle, #e2e8f0)' }}>
            {analysis.critique}
          </div>

          {analysis.suggestedAction && analysis.actionType !== 'none' && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleApplyFix}
              disabled={applying}
              style={{ marginTop: 2, padding: '7px 10px', fontSize: 11.5 }}
            >
              <ZapIcon size={12} color="var(--surface, var(--surface, #fff)fff)" />
              <span>{applying ? 'Aplicando...' : analysis.suggestedAction}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

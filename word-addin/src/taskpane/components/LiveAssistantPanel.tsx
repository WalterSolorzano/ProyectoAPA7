import React, { useState, useEffect, useCallback } from 'react'
import type { AssistantOptions } from '../liveAssistant'
import type { DocumentStats } from '../office/wordHelper'
import type { AuditDocumentResult, AuditFinding } from '../api/backend'
import { backend } from '../api/backend'
import {
  autoFormatAllTablesAPA,
  autoCaptionAllFiguresAPA,
  highlightAndJumpToParagraph,
} from '../office/proactiveEngine'
import {
  normalizeEntireDocumentAPA7,
  type NormalizationReport,
} from '../office/masterNormalizer'
import {
  applyHighlights,
  clearAllHighlights,
} from '../office/highlighter'
import { insertBibliographyAPA, getDocumentText, getSelectedText } from '../office/wordHelper'
import { SelectionCriticCard } from './SelectionCriticCard'
import {
  ZapIcon,
  SearchIcon,
  EyeIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  TableIcon,
  ImageIcon,
  BookOpenIcon,
  DocumentTextIcon,
  SparklesIcon,
} from './Icons'

interface LiveAssistantPanelProps {
  running: boolean
  options: AssistantOptions
  stats: DocumentStats | null
  citationsCount: number
  onToggle: () => void
  onOptionChange: (key: keyof AssistantOptions, value: boolean | number) => void
  onScanNow: () => void
  onFormatAll: () => void
  auditStatus: 'idle' | 'running' | 'done'
  auditResult: AuditDocumentResult | null
  auditNotice: string | null
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export const LiveAssistantPanel: React.FC<LiveAssistantPanelProps> = ({
  running,
  options,
  stats,
  citationsCount,
  onToggle,
  onOptionChange,
  onScanNow,
  auditStatus,
  auditResult,
  auditNotice,
  showToast,
}) => {
  const [working, setWorking] = useState<string | null>(null)
  const [progressMsg, setProgressMsg] = useState<string>('')
  const [progressPct, setProgressPct] = useState<number>(0)
  const [lastReport, setLastReport] = useState<NormalizationReport | null>(null)
  const [highlightedInWord, setHighlightedInWord] = useState(false)
  const [bibWorking, setBibWorking] = useState(false)

  // 1-CLIC MASTER: Normaliza todo el documento en vivo en Word
  const handleMasterNormalize = async () => {
    setWorking('master')
    setProgressPct(10)
    setProgressMsg('Limpiando espacios y mapeando documento...')
    try {
      const report = await normalizeEntireDocumentAPA7((step, pct) => {
        setProgressMsg(step)
        setProgressPct(pct)
      })
      setLastReport(report)
      showToast('Documento normalizado a APA 7 con éxito', 'success')
    } catch (err: any) {
      showToast(err.message || 'Error al normalizar documento en Word', 'error')
    } finally {
      setWorking(null)
      setTimeout(() => {
        setProgressPct(0)
        setProgressMsg('')
      }, 4000)
    }
  }

  // SEÑALAR FALLOS EN WORD EN VIVO
  const handleHighlightInWord = async () => {
    setWorking('highlight')
    try {
      let findingsToHighlight: AuditFinding[] = auditResult?.findings || []
      if (findingsToHighlight.length === 0) {
        const text = await getDocumentText()
        if (text.trim()) {
          const res = await backend.auditDocument(text)
          findingsToHighlight = res.findings || []
        }
      }
      if (findingsToHighlight.length === 0) {
        showToast('Documento 100% conforme a APA 7: sin errores detectados', 'success')
        return
      }
      const count = await applyHighlights(findingsToHighlight)
      setHighlightedInWord(true)
      showToast(`${count} fragmento(s) señalados con resaltado en Word`, 'success')
    } catch (err: any) {
      showToast(err.message || 'Error al resaltar en Word', 'error')
    } finally {
      setWorking(null)
    }
  }

  // LIMPIAR TODAS LAS MARCAS DE RESALTADO
  const handleClearHighlights = async () => {
    setWorking('clear_highlight')
    try {
      await clearAllHighlights()
      setHighlightedInWord(false)
      showToast('Todas las marcas de resaltado retiradas de Word', 'success')
    } catch (err: any) {
      showToast(err.message || 'Error al limpiar resaltados', 'error')
    } finally {
      setWorking(null)
    }
  }

  // INSERTAR BIBLIOGRAFÍA EN 1-CLIC
  const handleInsertBibliography = async () => {
    setBibWorking(true)
    try {
      const text = await getDocumentText()
      const bibRes = await backend.buildBibliography(text)
      if (!bibRes.bibliography_text || !bibRes.bibliography_text.trim()) {
        showToast('No se detectaron citas en el texto para generar bibliografía', 'info')
        return
      }
      await insertBibliographyAPA(bibRes.bibliography_text)
      showToast(`Bibliografía APA 7 insertada al final (${bibRes.total} referencias)`, 'success')
    } catch (err: any) {
      showToast(err.message || 'Error al generar bibliografía', 'error')
    } finally {
      setBibWorking(false)
    }
  }

  const handleJumpToFinding = async (finding: AuditFinding) => {
    try {
      const snippet = (finding.where?.excerpt || finding.message || '').slice(0, 40)
      const found = await highlightAndJumpToParagraph(finding.where?.paragraph_index, snippet)
      if (found) {
        showToast('Párrafo ubicado en Word', 'info')
      }
    } catch {
      /* ignore */
    }
  }

  const findings = auditResult?.findings || []
  const errorCount = findings.filter((f) => f.severity === 'error').length
  const warnCount = findings.filter((f) => f.severity === 'warn').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── SECCIÓN 1: CENTRO DE ACCIÓN PROACTIVA 1-CLIC ── */}
      <div className="card card--hero">
        <div className="card__header">
          <div className="card__title">
            <ZapIcon size={16} color="var(--accent-primary)" />
            <span>Asistente APA 7 en Vivo</span>
          </div>
          <button
            type="button"
            className={`btn-sm ${running ? 'btn-success' : 'btn-secondary'}`}
            onClick={onToggle}
            title={running ? 'Pausar asistente' : 'Activar asistente'}
          >
            {running ? 'Activo' : 'Pausado'}
          </button>
        </div>

        <p className="card__subtitle">
          Normaliza y corrige tu trabajo en vivo dentro de Word: conserva tu portada original intacta, protege índices, jerarquiza títulos (H1 en página nueva) y formatea sangrías y tablas.
        </p>

        {/* BARRA DE PROGRESO DE NORMALIZACIÓN */}
        {working === 'master' && (
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--accent-primary)' }}>
              <span>{progressMsg}</span>
              <span>{progressPct}%</span>
            </div>
            <div style={{ height: 6, width: '100%', background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--accent-primary)', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleMasterNormalize}
            disabled={working !== null}
            style={{ fontSize: 13, padding: '11px 16px' }}
          >
            <ZapIcon size={15} color="#ffffff" />
            <span>{working === 'master' ? 'Normalizando en Word...' : 'Normalizar Todo a APA 7 en Vivo'}</span>
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleHighlightInWord}
              disabled={working !== null}
            >
              <EyeIcon size={13} />
              <span>Señalar en Word</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearHighlights}
              disabled={working !== null}
            >
              <CheckCircleIcon size={13} />
              <span>Limpiar Marcas</span>
            </button>
          </div>
        </div>

        {/* REPORTE RESUMIDO DEL ÚLTIMO PROCESO */}
        {lastReport && (
          <div style={{ marginTop: 6, padding: '8px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 11.5, color: '#166534', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircleIcon size={13} color="#16a34a" />
              <span>Normalización completada con éxito:</span>
            </div>
            <div>• Portada: {lastReport.coverDetected ? 'Detectada y conservada intacta' : 'Sin portada'}</div>
            <div>• Índice: {lastReport.tocProtected ? 'Protegido sin sangría' : 'Sin índice'}</div>
            <div>• Títulos: {lastReport.headingsCount} jerarquizados a APA 7</div>
            <div>• Viñetas/Listas: {lastReport.listsCount} con margen de 0.5"</div>
            <div>• Tablas: {lastReport.tablesCount} formateadas a APA 7</div>
            <div>• Referencias: {lastReport.referencesCount} con sangría francesa</div>
          </div>
        )}
      </div>

      {/* ── SECCIÓN 2: CRÍTICO Y APOYO EN VIVO (AL CURSOR EN WORD) ── */}
      <SelectionCriticCard showToast={showToast} />

      {/* ── SECCIÓN 3: BIBLIOGRAFÍA AUTOMÁTICA EN 1-CLIC ── */}
      <div className="card">
        <div className="card__header">
          <div className="card__title">
            <BookOpenIcon size={16} color="var(--accent-primary)" />
            <span>Bibliografía y Referencias</span>
          </div>
        </div>

        <p className="card__subtitle">
          Extrae todas las citas (Autor, Año) detectadas en tu documento y genera la lista de referencias en orden alfabético con sangría francesa reglamentaria al final del archivo.
        </p>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleInsertBibliography}
          disabled={bibWorking}
        >
          <BookOpenIcon size={14} />
          <span>{bibWorking ? 'Generando bibliografía...' : 'Insertar Referencias APA 7 al Final'}</span>
        </button>
      </div>

      {/* ── SECCIÓN 4: HALLAZGOS Y SEÑALIZACIÓN EN EL DOCUMENTO ── */}
      {findings.length > 0 && (
        <div className="card">
          <div className="card__header">
            <div className="card__title">
              <span>Hallazgos Señalados ({findings.length})</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {errorCount} errores · {warnCount} avisos
            </span>
          </div>

          <div className="finding-list">
            {findings.slice(0, 6).map((f, idx) => (
              <div
                key={f.id || idx}
                className={`finding-item finding-item--${f.severity === 'error' ? 'error' : f.severity === 'warn' ? 'warn' : 'info'}`}
              >
                <div className="finding-item__header">
                  <span className="finding-item__msg">{f.message}</span>
                  <span className={`finding-item__badge finding-item__badge--${f.severity}`}>
                    {f.severity}
                  </span>
                </div>

                {f.fix && (
                  <div className="finding-item__fix" style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                    <span style={{ fontWeight: 600 }}>Sugerencia:</span>
                    <span>{f.fix}</span>
                  </div>
                )}

                <div className="finding-item__actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleJumpToFinding(f)}
                  >
                    <EyeIcon size={12} />
                    <span>Ver en Word</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState, useEffect, useCallback } from 'react'
import type { AssistantOptions } from '../liveAssistant'
import type { DocumentStats } from '../office/wordHelper'
import type { AuditDocumentResult, AuditFinding } from '../api/backend'
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

  // 1-CLIC MASTER: Normaliza todo el documento en vivo en Word
  const handleMasterNormalize = async () => {
    setWorking('master')
    setProgressPct(5)
    setProgressMsg('Analizando estructura del documento...')
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

  const handleFormatTables = async () => {
    setWorking('tables')
    try {
      const res = await autoFormatAllTablesAPA()
      if (res.count === 0) {
        showToast('No se detectaron tablas en el documento', 'info')
      } else {
        showToast(`${res.count} tabla(s) formateadas con bordes APA 7`, 'success')
      }
    } catch (err: any) {
      showToast(err.message || 'Error al formatear tablas', 'error')
    } finally {
      setWorking(null)
    }
  }

  const handleFormatFigures = async () => {
    setWorking('figures')
    try {
      const res = await autoCaptionAllFiguresAPA()
      if (res.count === 0) {
        showToast('No se detectaron figuras en el documento', 'info')
      } else {
        showToast(`${res.count} figura(s) centradas y rotuladas a APA 7`, 'success')
      }
    } catch (err: any) {
      showToast(err.message || 'Error al rotular figuras', 'error')
    } finally {
      setWorking(null)
    }
  }

  const handleHighlightInWord = async () => {
    if (!auditResult || auditResult.findings.length === 0) {
      showToast('Primero audita el documento para encontrar hallazgos', 'info')
      return
    }
    setWorking('highlight')
    try {
      await applyHighlights(auditResult.findings)
      setHighlightedInWord(true)
      showToast('Hallazgos señalados con resaltado en tu documento de Word', 'success')
    } catch (err: any) {
      showToast(err.message || 'Error al resaltar en Word', 'error')
    } finally {
      setWorking(null)
    }
  }

  const handleClearHighlights = async () => {
    setWorking('clear_highlight')
    try {
      await clearAllHighlights()
      setHighlightedInWord(false)
      showToast('Marcas de resaltado retiradas del documento', 'success')
    } catch (err: any) {
      showToast(err.message || 'Error al limpiar resaltados', 'error')
    } finally {
      setWorking(null)
    }
  }

  const handleJumpToFinding = async (finding: AuditFinding) => {
    try {
      const found = await highlightAndJumpToParagraph(
        finding.where?.paragraph_index,
        finding.where?.excerpt || finding.message,
      )
      if (found) {
        showToast('Párrafo localizado en Word', 'info')
      } else {
        showToast('No se localizó la posición exacta en Word', 'info')
      }
    } catch (err: any) {
      showToast(err.message || 'Error al saltar al párrafo', 'error')
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
          Normaliza y arregla tu trabajo en vivo dentro de Word: conserva tu portada, jerarquiza títulos, formatea sangrías y tablas sin formularios manuales.
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

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onScanNow}
            disabled={auditStatus === 'running'}
          >
            <SearchIcon size={14} />
            <span>{auditStatus === 'running' ? 'Auditando en tiempo real...' : 'Auditar Documento en Vivo'}</span>
          </button>
        </div>

        {/* REPORTE RESUMIDO DEL ÚLTIMO PROCESO */}
        {lastReport && (
          <div style={{ marginTop: 6, padding: '8px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 11.5, color: '#166534', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircleIcon size={13} color="#16a34a" />
              <span>Normalización aplicada con éxito:</span>
            </div>
            <div>• Portada: {lastReport.coverDetected ? 'Detectada y conservada' : 'Sin portada'}</div>
            <div>• Índice: {lastReport.tocProtected ? 'Detectado y protegido (sin sangría)' : 'Sin índice'}</div>
            <div>• Títulos: {lastReport.headingsCount} jerarquizados a APA 7</div>
            <div>• Viñetas/Listas: {lastReport.listsCount} con margen de 0.5"</div>
            <div>• Tablas: {lastReport.tablesCount} formateadas</div>
            <div>• Referencias: {lastReport.referencesCount} con sangría francesa</div>
          </div>
        )}
      </div>

      {/* ── SECCIÓN 2: CRÍTICO Y APOYO EN VIVO (AL SELECCIONAR EN WORD) ── */}
      <SelectionCriticCard showToast={showToast} />

      {/* ── SECCIÓN 3: SEÑALIZACIÓN DIRECTA EN WORD ── */}
      {findings.length > 0 && (
        <div className="card">
          <div className="card__header">
            <div className="card__title">
              <span>Señalar Errores en Word</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {errorCount} errores · {warnCount} avisos
            </span>
          </div>

          <p className="card__subtitle">
            Resalta en amarillo los fallos directamente en tu documento de Word para que los veas mientras lees, y retira las marcas con un clic antes de exportar.
          </p>

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

          <div className="finding-list" style={{ marginTop: 6 }}>
            {findings.slice(0, 8).map((f, idx) => (
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
                    <EyeIcon size={13} />
                    <span>Ver en Word</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECCIÓN 4: ACCIONES DIRECTAS EN WORD ── */}
      <div className="card">
        <div className="card__title">Acciones Directas en Word</div>
        <div className="proactive-grid">
          <button
            type="button"
            className="proactive-action-card"
            onClick={handleFormatTables}
            disabled={working !== null}
          >
            <div className="proactive-action-card__icon-box">
              <TableIcon size={18} color="var(--accent-primary)" />
            </div>
            <div className="proactive-action-card__title">Tablas APA 7</div>
            <div className="proactive-action-card__desc">Bordes 0.5pt y rótulos Tabla 1, 2...</div>
          </button>

          <button
            type="button"
            className="proactive-action-card"
            onClick={handleFormatFigures}
            disabled={working !== null}
          >
            <div className="proactive-action-card__icon-box">
              <ImageIcon size={18} color="var(--accent-primary)" />
            </div>
            <div className="proactive-action-card__title">Figuras APA 7</div>
            <div className="proactive-action-card__desc">Centrado y rótulos Figura 1, 2...</div>
          </button>
        </div>
      </div>
    </div>
  )
}

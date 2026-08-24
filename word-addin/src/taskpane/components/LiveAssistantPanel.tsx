import React, { useState } from 'react'
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
import { applyCaptions } from '../office/jarvisLive'
import { SelectionCriticCard } from './SelectionCriticCard'
import {
  DocumentTextIcon,
  TableIcon,
  ImageIcon,
  QuoteIcon,
  ZapIcon,
  SearchIcon,
  EyeIcon,
  CheckCircleIcon,
  AlertCircleIcon,
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

  // 1-CLIC MASTER: Normaliza todo el documento en vivo en Word
  const handleMasterNormalize = async () => {
    setWorking('master')
    setProgressPct(5)
    setProgressMsg('Iniciando normalización APA 7...')
    try {
      try { await applyCaptions() } catch {}
    const report = await normalizeEntireDocumentAPA7((step, pct) => {
        setProgressMsg(step)
        setProgressPct(pct)
      })
      setLastReport(report)
      showToast('Documento normalizado a APA 7 exitosamente', 'success')
    } catch (err: any) {
      showToast(err.message || 'Error al normalizar documento en Word', 'error')
    } finally {
      setWorking(null)
      setTimeout(() => {
        setProgressPct(0)
        setProgressMsg('')
      }, 3500)
    }
  }

  const handleFormatTables = async () => {
    setWorking('tables')
    try {
      const res = await autoFormatAllTablesAPA()
      if (res.count === 0) {
        showToast('No se encontraron tablas en el documento', 'info')
      } else {
        showToast(`${res.count} tabla(s) formateadas a APA 7 en Word`, 'success')
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
        showToast('No se encontraron imágenes en el documento', 'info')
      } else {
        showToast(`${res.count} figura(s) numeradas y centradas en Word`, 'success')
      }
    } catch (err: any) {
      showToast(err.message || 'Error al numerar figuras', 'error')
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
        showToast('Párrafo localizado y resaltado en Word', 'info')
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
      {/* CRÍTICO Y APOYO EN VIVO — INSPECCIÓN Y CORRECCIÓN DE LA SELECCIÓN */}
      <SelectionCriticCard showToast={showToast} />

      {/* HERO CARD — NORMALIZACIÓN MAESTRA DE 1 CLIC */}
      <div className="card card--hero">
        <div className="card__header">
          <div className="card__title">
            <ZapIcon size={16} color="var(--accent-primary)" />
            <span>Normalizador Global APA 7</span>
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#0f172a', marginBottom:6 }}>
        <input type="checkbox" defaultChecked={localStorage.getItem('wordapa7_jarvis') !== '0'}
          onChange={(e) => localStorage.setItem('wordapa7_jarvis', e.target.checked ? '1':'0')} />
        Jarvis (normaliza mientras escribes)
      </label>
      <button type="button" style={{ fontSize:11, color:'#64748b', background:'none', border:'none', cursor:'pointer', padding:'0 0 6px' }}
        onClick={() => { try { localStorage.removeItem('wordapa7_locks') } catch {} }}>
        Reiniciar preferencias aprendidas
      </button>
      <details style={{ fontSize:11.5, color:'#334155', margin:'4px 0 8px' }}>
        <summary style={{ cursor:'pointer' }}>Vista previa</summary>
        <div style={{ padding:'4px 6px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6 }}>
          &laquo;texto actual&hellip;&raquo; &rarr; H2 &middot; negrilla &middot; izquierda
        </div>
      </details>
      <button
            type="button"
            className={`btn-sm ${running ? 'btn-success' : 'btn-secondary'}`}
            onClick={onToggle}
            title={running ? 'Pausar asistente' : 'Activar asistente'}
          >
            {running ? 'En Vivo' : 'Pausado'}
          </button>
        </div>

        <p className="card__subtitle">
          Normaliza el documento completo en vivo dentro de Word: portada, títulos, sangrías, tablas y bibliografía respetando índices y estructura.
        </p>

        {/* BARRA DE PROGRESO EN VIVO */}
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
            style={{ fontSize: 13, padding: '10px 16px' }}
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

        {/* REPORTE DE LA ÚLTIMA NORMALIZACIÓN */}
        {lastReport && (
          <div style={{ marginTop: 6, padding: '8px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 11.5, color: '#166534', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircleIcon size={13} color="#16a34a" />
              <span>Normalización aplicada en Word:</span>
            </div>
            <div>• Portada: {lastReport.coverDetected ? 'Detectada y centrada' : 'Sin portada inicial'}</div>
            <div>• Índice: {lastReport.tocProtected ? 'Detectado y protegido (sin sangría)' : 'Sin índice detectado'}</div>
            <div>• Títulos: {lastReport.headingsCount} jerarquizados</div>
            <div>• Tablas: {lastReport.tablesCount} formateadas a APA 7</div>
            <div>• Referencias: {lastReport.referencesCount} con sangría francesa</div>
          </div>
        )}
      </div>

      {/* STATS DEL DOCUMENTO CON ICONOS CLAROS Y DIFERENCIADOS */}
      {stats && (
        <div className="stats-row">
          <div className="stat-chip">
            <div className="stat-chip__icon">
              <DocumentTextIcon size={15} color="var(--accent-primary)" />
            </div>
            <div className="stat-chip__value">{stats.words}</div>
            <div className="stat-chip__label">Palabras</div>
          </div>
          <div className="stat-chip">
            <div className="stat-chip__icon">
              <TableIcon size={15} color="var(--accent-primary)" />
            </div>
            <div className="stat-chip__value">{stats.tables}</div>
            <div className="stat-chip__label">Tablas</div>
          </div>
          <div className="stat-chip">
            <div className="stat-chip__icon">
              <ImageIcon size={15} color="var(--accent-primary)" />
            </div>
            <div className="stat-chip__value">{stats.figures || stats.inlinePictures}</div>
            <div className="stat-chip__label">Figuras</div>
          </div>
          <div className="stat-chip">
            <div className="stat-chip__icon">
              <QuoteIcon size={15} color="var(--accent-primary)" />
            </div>
            <div className="stat-chip__value">{citationsCount}</div>
            <div className="stat-chip__label">Citas</div>
          </div>
        </div>
      )}

      {/* ACCIONES RÁPIDAS DIRECTAS EN WORD */}
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

      {/* LISTADO DE HALLAZGOS Y SEÑALIZACIÓN EN WORD */}
      {auditNotice && (
        <div style={{ fontSize: 11, color: 'var(--accent-warning)', padding: '6px 10px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircleIcon size={14} color="var(--accent-warning)" />
          <span>{auditNotice}</span>
        </div>
      )}

      {auditResult && (
        <div className="card">
          <div className="card__header">
            <div className="card__title">
              <span>Hallazgos de Auditoría</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {findings.length === 0 ? '0 problemas' : `${errorCount} errores · ${warnCount} avisos`}
            </span>
          </div>

          {findings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 8px', color: 'var(--accent-success)', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <CheckCircleIcon size={16} color="var(--accent-success)" />
              <span>El documento cumple con las reglas APA 7 auditadas.</span>
            </div>
          ) : (
            <div className="finding-list">
              {findings.map((f, idx) => (
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
          )}
        </div>
      )}
    </div>
  )
}

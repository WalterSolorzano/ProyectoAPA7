/**
 * WordAPA7 Add-in — Panel de Detección de IA
 * ===========================================
 *
 *   1. Chips de proveedores de IA (GET /api/addin/ai-providers)
 *   2. Acción principal: "Escanear texto IA" (documento completo por párrafos)
 *   3. Análisis de selección + reescritura con IA
 *
 * Sin emojis: solo SVG inline y etiquetas de texto plano.
 */

import React, { useState, useCallback, useEffect } from 'react'
import {
  backend,
  type AIProvidersResult,
  type AIAnalysisResult,
  type AIDocumentResult,
  type AIRewriteResult,
  type AIFinding,
} from '../api/backend'
import { getSelectedText, getDocumentText } from '../office/wordHelper'

/** Evento global para re-consultar proveedores tras guardar ajustes. */
export const AI_PROVIDERS_REFRESH_EVENT = 'wordapa7_addin_refresh_ai_providers'

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

// == HELPERS ==================================================================

function riskColor(scorePct: number): string {
  if (scorePct >= 50) return 'var(--color-error)'
  if (scorePct >= 20) return 'var(--color-warning)'
  return 'var(--color-success)'
}

function severityToIssueClass(severity: AIFinding['severity']): string {
  switch (severity) {
    case 'HIGH': return 'issue--error'
    case 'MEDIUM': return 'issue--warning'
    default: return 'issue--info'
  }
}

function categoryLabel(category: string): string {
  switch (category.toUpperCase()) {
    case 'HIGH': return 'Alto riesgo'
    case 'MEDIUM': return 'Riesgo medio'
    case 'LOW': return 'Bajo riesgo'
    default: return category
  }
}

function categoryColor(category: string): string {
  switch (category.toUpperCase()) {
    case 'HIGH': return 'var(--color-error)'
    case 'MEDIUM': return 'var(--color-warning)'
    case 'LOW': return 'var(--color-success)'
    default: return 'var(--text-tertiary)'
  }
}

function categoryBg(category: string): string {
  switch (category.toUpperCase()) {
    case 'HIGH': return 'var(--color-error-soft)'
    case 'MEDIUM': return 'var(--color-warning-soft)'
    case 'LOW': return 'var(--color-success-soft)'
    default: return 'var(--accent-soft)'
  }
}

function truncate(text: string, maxLen = 120): string {
  const t = text.trim()
  return t.length > maxLen ? t.slice(0, maxLen) + '…' : t
}

// == ICONOS SVG ===============================================================

const ScanIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
)

const DocScanIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M9 13h6M9 17h4" />
  </svg>
)

const EditIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
)

const SparklesIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
    <path d="M19 15l.8 2.7L22.5 18.5l-2.7.8L19 22l-.8-2.7-2.7-.8 2.7-.8L19 15z" />
  </svg>
)

// == SUBCOMPONENTES ===========================================================

function ScoreBar({ scorePct, label }: { scorePct: number; label: string }) {
  return (
    <div className="card">
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span className="field-label" style={{ marginBottom: 0 }}>{label}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: riskColor(scorePct) }}>
            {scorePct}%
          </span>
        </div>
        <div className="score-bar">
          <div
            className="score-bar__fill"
            style={{ width: `${scorePct}%`, background: riskColor(scorePct) }}
          />
        </div>
      </div>
    </div>
  )
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className="badge"
      style={{ background: categoryBg(category), color: categoryColor(category) }}
    >
      {categoryLabel(category)}
    </span>
  )
}

function FindingsList({ findings }: { findings: AIFinding[] }) {
  if (!findings || findings.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {findings.map((f, i) => (
        <div key={i} className={`issue ${severityToIssueClass(f.severity)}`}>
          <div className="issue__text">
            {f.detail}
            {f.count > 1 && (
              <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>×{f.count}</span>
            )}
            {f.phrase && (
              <div className="issue__suggestion">→ &ldquo;{f.phrase}&rdquo;</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Chips de proveedores: punto verde/gris + nombre. count==0 → hint a Ajustes. */
function ProviderChips({ showToast }: { showToast: Props['showToast'] }) {
  const [providers, setProviders] = useState<AIProvidersResult | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await backend.aiProviders()
      setProviders(res)
    } catch {
      setProviders(null)
    }
  }, [])

  // Fetch al abrir la pestaña (el panel se monta al entrar) + evento externo.
  useEffect(() => {
    load()
    const onRefresh = () => load()
    window.addEventListener(AI_PROVIDERS_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(AI_PROVIDERS_REFRESH_EVENT, onRefresh)
  }, [load])

  const copy = useCallback((name: string) => {
    navigator.clipboard?.writeText(name).then(() => showToast(`Proveedor ${name}`, 'info')).catch(() => {})
  }, [showToast])

  if (!providers) {
    return (
      <div className="card">
        <div className="card__body">
          <div className="hint">Verificando proveedores…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card__body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="field-label" style={{ marginBottom: 0 }}>
            Proveedores de IA
          </span>
          <span className="badge badge--count">{providers.count}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {providers.providers.map((p) => (
            <button
              key={p.name}
              type="button"
              className={`provider-chip ${p.active ? 'provider-chip--on' : ''}`}
              onClick={() => copy(p.name)}
              title={p.active ? `${p.name}: activo` : `${p.name}: sin clave`}
            >
              <span className="provider-chip__dot" />
              {p.name}
            </button>
          ))}
        </div>
        {providers.count === 0 && (
          <div className="hint">Sin claves de IA. Configuralas en Ajustes de la app WordAPA7.</div>
        )}
      </div>
    </div>
  )
}

// == COMPONENTE PRINCIPAL =====================================================

export function AIPanel({ showToast }: Props) {
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzingDoc, setAnalyzingDoc] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [result, setResult] = useState<AIAnalysisResult | null>(null)
  const [docResult, setDocResult] = useState<AIDocumentResult | null>(null)
  const [docParagraphs, setDocParagraphs] = useState<string[]>([])
  const [rewrite, setRewrite] = useState<AIRewriteResult | null>(null)
  const [copied, setCopied] = useState(false)

  // ── Escanear texto IA (acción principal del tab) ──────────────────────────
  const scanDocument = useCallback(async () => {
    setAnalyzingDoc(true)
    setDocResult(null)
    try {
      const text = await getDocumentText()
      if (!text.trim()) {
        showToast('El documento está vacío', 'error')
        return
      }
      const paragraphs = text.split(/\r?\n/).map((p) => p.trim()).filter(Boolean)
      if (paragraphs.length === 0) {
        showToast('No se encontraron párrafos para analizar', 'error')
        return
      }
      setDocParagraphs(paragraphs)
      const res = await backend.analyzeAIDocument(paragraphs)
      setDocResult(res)
      const pct = Math.round(res.overall_score * 100)
      showToast(`${res.high_risk_count} párrafo(s) de alto riesgo — ${pct}% IA`, 'info')
    } catch {
      showToast('No se pudo analizar el documento. ¿Está el backend activo?', 'error')
    } finally {
      setAnalyzingDoc(false)
    }
  }, [showToast])

  // ── Analizar selección ────────────────────────────────────────────────────
  const analyzeSelection = useCallback(async () => {
    setAnalyzing(true)
    setResult(null)
    try {
      const text = await getSelectedText()
      if (!text.trim()) {
        showToast('Seleccioná texto en el documento para analizar', 'error')
        return
      }
      const res = await backend.analyzeAI(text)
      setResult(res)
      const pct = Math.round(res.score * 100)
      if (res.findings.length === 0) {
        showToast('Sin patrones de IA en la selección', 'success')
      } else {
        showToast(`${res.findings.length} patrón(es) — ${pct}% IA`, 'info')
      }
    } catch {
      showToast('No se pudo conectar con el backend de IA. ¿Está WordAPA7 abierto?', 'error')
    } finally {
      setAnalyzing(false)
    }
  }, [showToast])

  // ── Reescribir con IA ─────────────────────────────────────────────────────
  const aiRewrite = useCallback(async () => {
    setRewriting(true)
    setRewrite(null)
    try {
      const text = await getSelectedText()
      if (!text.trim()) {
        showToast('Seleccioná texto en el documento para reescribir', 'error')
        return
      }
      const res = await backend.aiRewrite(text)
      setRewrite(res)
      showToast('Texto reescrito con IA', 'success')
    } catch {
      showToast('No se pudo reescribir el texto. ¿Está el backend activo?', 'error')
    } finally {
      setRewriting(false)
    }
  }, [showToast])

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      showToast('No se pudo copiar el texto', 'error')
    })
  }, [showToast])

  const riskyParagraphs = docResult
    ? docResult.results
        .map((r, i) => ({ ...r, text: docParagraphs[i] || r.matches.join(' ') || '(sin texto)' }))
        .filter((r) => r.category.toUpperCase() === 'HIGH' || r.category.toUpperCase() === 'MEDIUM')
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
    : []

  const busy = analyzing || analyzingDoc || rewriting

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── CHIPS DE PROVEEDORES ───────────────────────────────────────────── */}
      <ProviderChips showToast={showToast} />

      {/* ── ACCIÓN PRINCIPAL: ESCANEAR TEXTO IA ───────────────────────────── */}
      <button
        className="btn btn--primary btn--full action-card__btn"
        onClick={scanDocument}
        disabled={busy}
      >
        {analyzingDoc ? (
          <><span className="spinner" /> Escaneando documento…</>
        ) : (
          <><DocScanIcon /> Escanear texto IA</>
        )}
      </button>

      {/* ── ACCIONES SECUNDARIAS ───────────────────────────────────────────── */}
      <div className="row-2">
        <button className="btn btn--secondary" onClick={analyzeSelection} disabled={busy}>
          {analyzing ? <span className="spinner" /> : <ScanIcon size={14} />} Selección
        </button>
        <button className="btn btn--secondary" onClick={aiRewrite} disabled={busy}>
          {rewriting ? <span className="spinner" /> : <EditIcon size={14} />} Reescribir
        </button>
      </div>

      {/* ── RESULTADO: ANÁLISIS DE SELECCIÓN ──────────────────────────────── */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ScoreBar scorePct={Math.round(result.score * 100)} label="Probabilidad de IA" />

          <div className="card">
            <div className="card__body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="field-label" style={{ marginBottom: 0 }}>Categoría</span>
                <CategoryBadge category={result.category} />
              </div>
            </div>
          </div>

          {result.findings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="field-label">Patrones detectados</div>
              <FindingsList findings={result.findings} />
            </div>
          )}

          {result.findings.length === 0 && (
            <div className="card">
              <div className="card__body">
                <div className="empty-text">
                  Sin patrones típicos de IA en el texto seleccionado.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RESULTADO: ESCANEO DE DOCUMENTO ───────────────────────────────── */}
      {docResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ScoreBar
            scorePct={Math.round(docResult.overall_score * 100)}
            label="Probabilidad de IA (documento)"
          />

          <div className="stats-grid stats-grid--compact">
            <div className="stat-box">
              <div className="stat-box__value" style={{ color: 'var(--color-error)' }}>
                {docResult.high_risk_count}
              </div>
              <div className="stat-box__label">Alto riesgo</div>
            </div>
            <div className="stat-box">
              <div className="stat-box__value" style={{ color: 'var(--color-warning)' }}>
                {docResult.medium_risk_count}
              </div>
              <div className="stat-box__label">Medio riesgo</div>
            </div>
            <div className="stat-box">
              <div className="stat-box__value" style={{ color: 'var(--color-success)' }}>
                {docResult.low_risk_count}
              </div>
              <div className="stat-box__label">Bajo riesgo</div>
            </div>
          </div>

          <div className="hint" style={{ textAlign: 'center' }}>
            {docResult.total_paragraphs} párrafo(s) · categoría:{' '}
            <strong>{categoryLabel(docResult.overall_category)}</strong>
          </div>

          {riskyParagraphs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="field-label">Párrafos con más riesgo</div>
              {riskyParagraphs.map((p, i) => (
                <div key={i} className="card">
                  <div className="card__body" style={{ gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <CategoryBadge category={p.category} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: riskColor(Math.round(p.score * 100)) }}>
                        {Math.round(p.score * 100)}%
                      </span>
                    </div>
                    <div
                      className="ref-item__text"
                      style={{ fontStyle: 'italic', opacity: 0.85 }}
                    >
                      {truncate(p.text)}
                    </div>
                    <FindingsList findings={p.findings} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {riskyParagraphs.length === 0 && (
            <div className="card">
              <div className="card__body">
                <div className="empty-text">
                  Ningún párrafo con riesgo medio o alto.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RESULTADO: REESCRITURA CON IA ─────────────────────────────────── */}
      {rewrite && (
        <div className="card">
          <div className="card__simple-header">Reescritura con IA</div>
          <div className="card__body">
            <div className="field">
              <span className="field-label">Texto original</span>
              <pre className="bib-preview">{rewrite.original}</pre>
            </div>
            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="field-label">Texto reescrito</span>
                <button
                  className="btn btn--ghost"
                  style={{ padding: '4px 10px', fontSize: 11 }}
                  onClick={() => copyToClipboard(rewrite.rewritten)}
                >
                  {copied ? 'Copiado ✓' : 'Copiar'}
                </button>
              </div>
              <pre className="bib-preview" style={{ borderColor: 'var(--accent-primary)', background: 'var(--accent-soft)' }}>
                {rewrite.rewritten}
              </pre>
            </div>
            {rewrite.provider && (
              <div className="hint">Proveedor: {rewrite.provider}</div>
            )}
          </div>
        </div>
      )}

      {/* ── ESTADO VACÍO ──────────────────────────────────────────────────── */}
      {!result && !docResult && !rewrite && (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ color: 'var(--accent-primary)' }}>
            <SparklesIcon />
          </div>
          <div className="empty-state__title">Detección de IA</div>
          <div className="step-chips step-chips--vertical" aria-label="Cómo funciona la detección de IA">
            <span className="step-chips__chip"><b>1</b> Pulsá Escanear texto IA</span>
            <span className="step-chips__chip"><b>2</b> Revisá los párrafos en riesgo</span>
            <span className="step-chips__chip"><b>3</b> Seleccioná y reescribí</span>
          </div>
        </div>
      )}
    </div>
  )
}

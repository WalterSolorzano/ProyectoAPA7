/**
 * WordAPA7 Add-in — Panel de Detección de IA
 * ===========================================
 *
 * Permite al usuario:
 *   1. Ver el estado de los proveedores de IA del backend (salud + nombres)
 *   2. Analizar la selección actual en busca de patrones de IA generada
 *   3. Analizar todo el documento (por párrafos) y ver el riesgo general
 *   4. Reescribir texto con IA para humanizarlo, con botón de copiar
 *
 * Usa los endpoints de detección de IA del backend de Python y reutiliza las
 * mismas clases CSS que el resto de los paneles (.card, .btn, .issue,
 * .score-bar, .stat-box, .spinner, etc.).
 */

import React, { useState, useCallback, useEffect } from 'react'
import {
  backend,
  type AIHealthResult,
  type AIAnalysisResult,
  type AIDocumentResult,
  type AIRewriteResult,
  type AIFinding,
} from '../api/backend'
import { getSelectedText, getDocumentText } from '../office/wordHelper'

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

// == HELPERS DE COLOR =========================================================

/** Color del score según el nivel de riesgo de IA (verde < 20, amarillo 20-50, rojo > 50). */
function riskColor(scorePct: number): string {
  if (scorePct >= 50) return 'var(--color-error)'
  if (scorePct >= 20) return 'var(--color-warning)'
  return 'var(--color-success)'
}

/** Convierte el severity de un AIFinding a una clase CSS de issue. */
function severityToIssueClass(severity: AIFinding['severity']): string {
  switch (severity) {
    case 'HIGH': return 'issue--error'
    case 'MEDIUM': return 'issue--warning'
    default: return 'issue--info'
  }
}

/** Ícono según el severity del hallazgo. */
function severityIcon(severity: AIFinding['severity']): string {
  return severity === 'HIGH' ? '⚠️' : 'ℹ️'
}

/** Etiqueta legible para la categoría de riesgo. */
function categoryLabel(category: string): string {
  switch (category.toUpperCase()) {
    case 'HIGH': return 'Alto riesgo'
    case 'MEDIUM': return 'Riesgo medio'
    case 'LOW': return 'Bajo riesgo'
    default: return category
  }
}

/** Color de texto para una categoría de riesgo. */
function categoryColor(category: string): string {
  switch (category.toUpperCase()) {
    case 'HIGH': return 'var(--color-error)'
    case 'MEDIUM': return 'var(--color-warning)'
    case 'LOW': return 'var(--color-success)'
    default: return 'var(--text-tertiary)'
  }
}

/** Color de fondo (soft) para una categoría de riesgo. */
function categoryBg(category: string): string {
  switch (category.toUpperCase()) {
    case 'HIGH': return 'var(--color-error-soft)'
    case 'MEDIUM': return 'var(--color-warning-soft)'
    case 'LOW': return 'var(--color-success-soft)'
    default: return 'var(--accent-soft)'
  }
}

/** Recorta un texto largo para mostrarlo como preview de párrafo. */
function truncate(text: string, maxLen = 120): string {
  const t = text.trim()
  return t.length > maxLen ? t.slice(0, maxLen) + '…' : t
}

// == SUBCOMPONENTES ===========================================================

/** Barra de score de riesgo de IA (0-100%) con color dinámico. */
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

/** Badge de categoría de riesgo con color dinámico. */
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

/** Lista de hallazgos de IA, cada uno con su ícono de severity y frase. */
function FindingsList({ findings }: { findings: AIFinding[] }) {
  if (!findings || findings.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {findings.map((f, i) => (
        <div key={i} className={`issue ${severityToIssueClass(f.severity)}`}>
          <span className="issue__icon">{severityIcon(f.severity)}</span>
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

// == COMPONENTE PRINCIPAL =====================================================

export function AIPanel({ showToast }: Props) {
  const [health, setHealth] = useState<AIHealthResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzingDoc, setAnalyzingDoc] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [result, setResult] = useState<AIAnalysisResult | null>(null)
  const [docResult, setDocResult] = useState<AIDocumentResult | null>(null)
  const [docParagraphs, setDocParagraphs] = useState<string[]>([])
  const [rewrite, setRewrite] = useState<AIRewriteResult | null>(null)
  const [copied, setCopied] = useState(false)

  // ── Cargar estado de los proveedores de IA al montar ──────────────────────
  useEffect(() => {
    let cancelled = false
    const loadHealth = async () => {
      try {
        const h = await backend.aiHealth()
        if (!cancelled) setHealth(h)
      } catch {
        // Backend sin endpoints de IA o sin conexión — no es crítico
      }
    }
    loadHealth()
    return () => { cancelled = true }
  }, [])

  // ── Analizar selección ─────────────────────────────────────────────────────
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
        showToast('No se detectaron patrones de IA en la selección', 'success')
      } else {
        showToast(`${res.findings.length} patrón(es) detectado(s) — ${pct}% IA`, 'info')
      }
    } catch {
      showToast('No se pudo conectar con el backend de IA. ¿Está WordAPA7 abierto?', 'error')
    } finally {
      setAnalyzing(false)
    }
  }, [showToast])

  // ── Analizar documento completo ────────────────────────────────────────────
  const analyzeDocument = useCallback(async () => {
    setAnalyzingDoc(true)
    setDocResult(null)
    try {
      const text = await getDocumentText()
      if (!text.trim()) {
        showToast('El documento está vacío', 'error')
        return
      }
      // Dividir en párrafos por saltos de línea y descartar vacíos
      const paragraphs = text.split(/\r?\n/).map((p) => p.trim()).filter(Boolean)
      if (paragraphs.length === 0) {
        showToast('No se encontraron párrafos para analizar', 'error')
        return
      }
      setDocParagraphs(paragraphs)
      const res = await backend.analyzeAIDocument(paragraphs)
      setDocResult(res)
      const pct = Math.round(res.overall_score * 100)
      showToast(`Documento analizado: ${res.high_risk_count} alto riesgo — ${pct}% IA`, 'info')
    } catch {
      showToast('No se pudo analizar el documento. ¿Está el backend activo?', 'error')
    } finally {
      setAnalyzingDoc(false)
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

  // ── Copiar texto al portapapeles ───────────────────────────────────────────
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      showToast('Texto copiado al portapapeles', 'success')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      showToast('No se pudo copiar el texto', 'error')
    })
  }, [showToast])

  // Resultados del documento: combinar con el texto del párrafo y ordenar por riesgo
  const riskyParagraphs = docResult
    ? docResult.results
        .map((r, i) => ({ ...r, text: docParagraphs[i] || r.matches.join(' ') || '(sin texto)' }))
        .filter((r) => r.category.toUpperCase() === 'HIGH' || r.category.toUpperCase() === 'MEDIUM')
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
    : []

  const healthActive = health && health.providers_active > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── ESTADO DE PROVEEDORES DE IA ────────────────────────────────────── */}
      <div className="card">
        <div className="card__simple-header">Estado de IA</div>
        <div className="card__body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: healthActive ? 'var(--color-success)' : 'var(--color-error)',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              {health
                ? `${health.providers_active} proveedor(es) de IA activo(s)`
                : 'Verificando proveedores…'}
            </span>
          </div>
          {health && health.providers.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {health.providers.map((p) => (
                <span key={p} className="chip">{p}</span>
              ))}
            </div>
          )}
          {health && !healthActive && (
            <div className="hint">
              No hay proveedores de IA activos. Iniciá WordAPA7 para habilitar la detección.
            </div>
          )}
        </div>
      </div>

      {/* ── BOTONES DE ACCIÓN ──────────────────────────────────────────────── */}
      <button
        className="btn btn--primary btn--full"
        onClick={analyzeSelection}
        disabled={analyzing || analyzingDoc || rewriting}
      >
        {analyzing ? (
          <><span className="spinner" /> Analizando…</>
        ) : (
          <>🔍 Analizar selección</>
        )}
      </button>

      <button
        className="btn btn--secondary btn--full"
        onClick={analyzeDocument}
        disabled={analyzing || analyzingDoc || rewriting}
      >
        {analyzingDoc ? (
          <><span className="spinner" /> Analizando documento…</>
        ) : (
          <>📄 Analizar documento</>
        )}
      </button>

      <button
        className="btn btn--secondary btn--full"
        onClick={aiRewrite}
        disabled={analyzing || analyzingDoc || rewriting}
      >
        {rewriting ? (
          <><span className="spinner" /> Reescribiendo…</>
        ) : (
          <>✍️ Reescribir con IA</>
        )}
      </button>

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
                  No se detectaron patrones típicos de IA en el texto seleccionado.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RESULTADO: ANÁLISIS DE DOCUMENTO ──────────────────────────────── */}
      {docResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ScoreBar
            scorePct={Math.round(docResult.overall_score * 100)}
            label="Probabilidad de IA (documento)"
          />

          {/* Stats de párrafos por nivel de riesgo */}
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
            de {docResult.total_paragraphs} párrafo(s) analizado(s)
            {' · '}categoría general: <strong>{categoryLabel(docResult.overall_category)}</strong>
          </div>

          {/* Lista de párrafos más riesgosos (top 10) */}
          {riskyParagraphs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="field-label">Párrafos con más riesgo</div>
              {riskyParagraphs.map((p, i) => (
                <div key={i} className="card">
                  <div className="card__body" style={{ gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        className="badge"
                        style={{ background: categoryBg(p.category), color: categoryColor(p.category) }}
                      >
                        {categoryLabel(p.category)}
                      </span>
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
                  Ningún párrafo presenta riesgo medio o alto de IA. 👍
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
                  {copied ? '✓ Copiado' : '📋 Copiar'}
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
          <div className="empty-state__icon">🤖</div>
          <div className="empty-state__title">Detección de IA</div>
          <div className="empty-state__text">
            Seleccioná texto y pulsá &ldquo;Analizar selección&rdquo; para detectar patrones
            de texto generado por IA (muletillas, estructura repetitiva, transiciones
            artificiales). También podés analizar todo el documento o reescribir texto
            para humanizarlo.
          </div>
        </div>
      )}
    </div>
  )
}

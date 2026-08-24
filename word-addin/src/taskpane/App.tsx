/**
 * WordAPA7 Add-in — App Principal (Asistente APA 7 en Vivo)
 * =========================================================
 *
 * Panel lateral proactivo integrado en Microsoft Word 365.
 * Vistas dedicadas para cada función del Ribbon, cero emojis y crítico activo en vivo.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  liveAssistant,
  type AssistantEvent,
  type AssistantOptions,
  type AssistantCallbacks,
} from './liveAssistant'
import { type DocumentStats, formatDocumentAPA7, getDocumentText } from './office/wordHelper'
import { LiveAssistantPanel } from './components/LiveAssistantPanel'
import { HeadingPanel } from './components/HeadingPanel'
import { TablesFiguresPanel } from './components/TablesFiguresPanel'
import { ReferencesPanel } from './components/ReferencesPanel'
import { CoverPagePanel } from './components/CoverPagePanel'
import { AIPanel } from './components/AIPanel'
import { backend, OFFLINE_TOAST_MESSAGE, type AuditDocumentResult } from './api/backend'
import {
  SearchIcon,
  DocumentTextIcon,
  TableIcon,
  BookOpenIcon,
  FileTextIcon,
  SparklesIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from './components/Icons'

type TabId = 'auditoria' | 'titulos' | 'tablas' | 'referencias' | 'portada' | 'ia'
type LegacyTabId = 'live' | 'insert' | 'references' | 'cover' | 'comments' | 'ai'
type RibbonAction = 'refresh' | 'build_bibliography' | ''
type AuditStatus = 'idle' | 'running' | 'done'

const LEGACY_TAB_MAP: Record<LegacyTabId, TabId> = {
  live: 'auditoria',
  insert: 'tablas',
  comments: 'auditoria',
  references: 'referencias',
  cover: 'portada',
  ai: 'ia',
}

interface TabDef {
  id: TabId
  label: string
  IconComponent: React.FC<{ size?: number; color?: string }>
}

const TABS: TabDef[] = [
  { id: 'auditoria', label: 'Auditoría', IconComponent: SearchIcon },
  { id: 'titulos', label: 'Títulos', IconComponent: DocumentTextIcon },
  { id: 'tablas', label: 'Tablas', IconComponent: TableIcon },
  { id: 'referencias', label: 'Citas', IconComponent: BookOpenIcon },
  { id: 'portada', label: 'Portada', IconComponent: FileTextIcon },
  { id: 'ia', label: 'IA', IconComponent: SparklesIcon },
]

function normalizeTab(raw: string): TabId | null {
  if (TABS.some((t) => t.id === raw)) return raw as TabId
  return LEGACY_TAB_MAP[raw as LegacyTabId] ?? null
}

const AUDIT_MAX_CHARS = 200_000

interface ToastState {
  msg: string
  type: 'success' | 'error' | 'info' | 'warning'
  id: number
}

const LS_TAB = 'wordapa7_addin_active_tab'
const LS_ACTION = 'wordapa7_addin_action'

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('auditoria')
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const [stats, setStats] = useState<DocumentStats | null>(null)
  const [citationsCount, setCitationsCount] = useState(0)
  const [mascotMessage, setMascotMessage] = useState<string>('Asistente APA 7 activo')
  const [running, setRunning] = useState(true)
  const [options, setOptions] = useState<AssistantOptions>(liveAssistant.getOptions())
  const [toast, setToast] = useState<ToastState | null>(null)
  const [pendingAction, setPendingAction] = useState<RibbonAction>('')
  const [auditStatus, setAuditStatus] = useState<AuditStatus>('idle')
  const [auditResult, setAuditResult] = useState<AuditDocumentResult | null>(null)
  const [auditNotice, setAuditNotice] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ msg, type, id: Date.now() })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    if (type !== 'error') {
      toastTimer.current = setTimeout(() => setToast(null), 3200)
    }
  }, [])

  const executeRibbonAction = useCallback((action: RibbonAction) => {
    if (!action) return
    if (action === 'refresh') {
      showToast('Re-escaneando el documento...', 'info')
      liveAssistant.scanNow()
    }
    if (action === 'build_bibliography') {
      setActiveTab('referencias')
      setPendingAction('build_bibliography')
    }
    try {
      localStorage.removeItem(LS_ACTION)
    } catch {
      /* ignore */
    }
  }, [showToast])

  useEffect(() => {
    fetch('http://127.0.0.1:8742/api/addin/heartbeat', { method: 'POST' }).catch(() => {})
    const hb = setInterval(() => fetch('http://127.0.0.1:8742/api/addin/heartbeat', { method: 'POST' }).catch(() => {}), 60000)
    try {
      const tab = localStorage.getItem(LS_TAB)
      const mapped = tab ? normalizeTab(tab) : null
      if (mapped) setActiveTab(mapped)
      const action = localStorage.getItem(LS_ACTION) as RibbonAction | null
      if (action) setTimeout(() => executeRibbonAction(action), 300)
    } catch {
      /* ignore */
    }
    return () => clearInterval(hb)
  }, [executeRibbonAction])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_TAB && e.newValue) {
        const mapped = normalizeTab(e.newValue)
        if (mapped) setActiveTab(mapped)
      }
      if (e.key === LS_ACTION && e.newValue) {
        executeRibbonAction(e.newValue as RibbonAction)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [executeRibbonAction])

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        await backend.health()
        if (!cancelled) setBackendOk(true)
      } catch {
        if (!cancelled) setBackendOk(false)
      }
    }
    check()
    const interval = setInterval(check, 8000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const assistantCallbacks = useMemo<AssistantCallbacks>(
    () => ({
      onEvent: (ev: AssistantEvent) => {
        if (ev.type === 'mascot') {
          setMascotMessage(ev.message)
          return
        }
        if (ev.type === 'citation') {
          setCitationsCount(liveAssistant.getCitationsCount())
        }
        if (ev.type === 'citation' || ev.type === 'figure' || ev.type === 'table' || ev.type === 'error') {
          showToast(
            ev.message,
            ev.tone === 'error' ? 'error' : ev.tone === 'success' ? 'success' : 'info',
          )
        }
      },
      onStats: (s: DocumentStats) => setStats(s),
    }),
    [showToast],
  )

  useEffect(() => {
    liveAssistant.start(assistantCallbacks, {
      autoFormat: true,
      autoCaption: true,
      autoExtractCitations: true,
    })
    setRunning(true)
    setOptions(liveAssistant.getOptions())
    return () => {
      liveAssistant.stop()
    }
  }, [assistantCallbacks])

  const handleToggle = useCallback(() => {
    if (liveAssistant.isRunning()) {
      liveAssistant.stop()
      setRunning(false)
      showToast('Asistente en vivo pausado', 'info')
    } else {
      liveAssistant.start(assistantCallbacks)
      setRunning(true)
      setOptions(liveAssistant.getOptions())
      showToast('Asistente en vivo activado', 'success')
    }
  }, [assistantCallbacks, showToast])

  const handleOptionChange = useCallback((key: keyof AssistantOptions, value: boolean | number) => {
    liveAssistant.setOptions({ [key]: value } as Partial<AssistantOptions>)
    setOptions(liveAssistant.getOptions())
  }, [])

  const handleScanNow = useCallback(async () => {
    if (auditStatus === 'running') return
    setAuditStatus('running')
    setAuditNotice(null)
    try {
      let text = ''
      try {
        text = await getDocumentText()
      } catch {
        showToast('No se pudo leer el documento de Word', 'error')
        setAuditStatus('idle')
        return
      }
      if (!text.trim()) {
        showToast('El documento está vacío', 'error')
        setAuditStatus('idle')
        return
      }
      if (text.length > AUDIT_MAX_CHARS) {
        text = text.slice(0, AUDIT_MAX_CHARS)
        setAuditNotice(`Documento extenso: auditado hasta ${AUDIT_MAX_CHARS.toLocaleString('es')} caracteres`)
      }
      const result = await backend.auditDocument(text)
      setAuditResult(result)
      setAuditStatus('done')
      const errors = result.findings.filter((f) => f.severity === 'error').length
      const warns = result.findings.filter((f) => f.severity === 'warn').length
      showToast(
        result.findings.length === 0
          ? 'Auditoría completa: 100% APA 7'
          : `Auditoría lista: ${errors} error(es), ${warns} aviso(s)`,
        result.findings.length === 0 ? 'success' : 'info',
      )
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : ''
      showToast(msg || OFFLINE_TOAST_MESSAGE, 'error')
    } finally {
      setAuditStatus((s) => (s === 'running' ? 'done' : s))
    }
  }, [auditStatus, showToast])

  const handleFormatAll = useCallback(async () => {
    showToast('Formateando a APA 7...', 'info')
    try {
      await formatDocumentAPA7()
      showToast('Documento formateado a APA 7', 'success')
    } catch (err: any) {
      showToast(err.message || 'Error al formatear documento', 'error')
    }
  }, [showToast])

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab)
    try {
      localStorage.setItem(LS_TAB, tab)
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <div className="app-container">
      {/* HEADER COMPACTO Y PROFESIONAL */}
      <div className="app-header">
        <div className="app-header__brand">
          <span className="app-header__logo-badge">W7</span>
          <span className="app-header__title">WordAPA7</span>
        </div>
        <div className="app-header__status">
          <span className={`status-dot ${backendOk ? 'status-dot--online' : backendOk === false ? 'status-dot--offline' : ''}`} />
          <span>{backendOk ? 'Online' : backendOk === false ? 'Offline' : '...'}</span>
        </div>
      </div>

      {/* PESTAÑAS DEDICADAS (CERO EMOJIS) */}
      <div className="tab-bar">
        {TABS.map((t) => {
          const Icon = t.IconComponent
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              className={`tab ${isActive ? 'tab--active' : ''}`}
              onClick={() => handleTabChange(t.id)}
            >
              <Icon size={13} color={isActive ? '#ffffff' : 'var(--text-secondary)'} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="app-content">
        {activeTab === 'auditoria' && (
          <LiveAssistantPanel
            running={running}
            options={options}
            stats={stats}
            citationsCount={citationsCount}
            onToggle={handleToggle}
            onOptionChange={handleOptionChange}
            onScanNow={handleScanNow}
            onFormatAll={handleFormatAll}
            auditStatus={auditStatus}
            auditResult={auditResult}
            auditNotice={auditNotice}
            showToast={showToast}
          />
        )}

        {activeTab === 'titulos' && <HeadingPanel showToast={showToast} />}

        {activeTab === 'tablas' && <TablesFiguresPanel showToast={showToast} />}

        {activeTab === 'referencias' && (
          <ReferencesPanel
            showToast={showToast}
            pendingAction={pendingAction}
            onActionConsumed={() => setPendingAction('')}
          />
        )}

        {activeTab === 'portada' && <CoverPagePanel showToast={showToast} />}

        {activeTab === 'ia' && <AIPanel showToast={showToast} />}

        {/* NOTIFICACIÓN DISCRETA DEL ASISTENTE */}
        <div className="mascot-bubble" role="status" aria-live="polite">
          <div className="mascot-bubble__avatar">
            <SparklesIcon size={15} color="var(--accent-primary)" />
          </div>
          <div className="mascot-bubble__text">{mascotMessage}</div>
        </div>
      </div>

      {/* TOAST FLOTANTE */}
      {toast && (
        <div className={`toast toast--${toast.type}`} key={toast.id} role="status">
          {toast.type === 'success' ? (
            <CheckCircleIcon size={16} color="var(--accent-success)" />
          ) : (
            <AlertCircleIcon size={16} color={toast.type === 'error' ? 'var(--accent-danger)' : 'var(--accent-primary)'} />
          )}
          <span style={{ flex: 1 }}>{toast.msg}</span>
          {toast.type === 'error' && (
            <button type="button" onClick={() => setToast(null)} style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default App

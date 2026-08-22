/**
 * WordAPA7 Add-in — App Principal (Asistente APA 7 en Vivo)
 * =========================================================
 *
 * Panel lateral que vive dentro de Microsoft Word. Implementa el
 * "Asistente en Vivo" que audita el documento en tiempo real:
 *   - Chupa citas y notifica "¡Cita procesada con éxito!"
 *   - Aplica formato APA 7 al vuelo
 *   - Auto-numera figuras y tablas al pegar
 *   - Sugiere bibliografía y portada
 *
 * El asistente se conecta al backend de Python que viaja con el instalador
 * (127.0.0.1:8742). Funciona igual offline (detección local de citas y
 * formato directo vía Office.js).
 *
 * Los botones del Ribbon (10 botones en 4 grupos) abren este panel
 * en la sección correcta usando localStorage como puente de comunicación.
 * Algunos botones también disparan acciones (refresh, build_bibliography).
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  liveAssistant,
  type AssistantEvent,
  type AssistantOptions,
  type AssistantCallbacks,
} from './liveAssistant'
import { type DocumentStats, formatDocumentAPA7 } from './office/wordHelper'
import { LiveAssistantPanel } from './components/LiveAssistantPanel'
import { CommentsPanel } from './components/CommentsPanel'
import { ReferencesPanel } from './components/ReferencesPanel'
import { CoverPagePanel } from './components/CoverPagePanel'
import { FigurePanel } from './components/FigurePanel'
import { HeadingPanel } from './components/HeadingPanel'
import { TablePanel } from './components/TablePanel'
import { ValidatePanel } from './components/ValidatePanel'
import { AIPanel } from './components/AIPanel'
import { WelcomeTour } from './components/WelcomeTour'
import { backend } from './api/backend'

type TabId = 'live' | 'insert' | 'references' | 'cover' | 'comments' | 'ai'
type InsertSection = 'table' | 'figure' | 'heading' | ''
type RibbonAction = 'refresh' | 'build_bibliography' | ''

interface ToastState {
  msg: string
  type: 'success' | 'error' | 'info'
  id: number
}

// Claves del puente localStorage (escritas por commands.ts)
const LS_TAB = 'wordapa7_addin_active_tab'
const LS_SECTION = 'wordapa7_addin_insert_section'
const LS_ACTION = 'wordapa7_addin_action'

// ── Iconos SVG inline ────────────────────────────────────────────────────────
const Icon: React.FC<{ name: string; size?: number }> = ({ name, size = 16 }) => {
  const icons: Record<string, string> = {
    live: 'M12 2a10 10 0 100 20 10 10 0 000-20zM5.05 7.5l2.5 1.45a5 5 0 000 6.1L5.05 16.5a8 8 0 010-9zM12 8a4 4 0 110 8 4 4 0 010-8z',
    insert: 'M12 5v14M5 12h14',
    book: 'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z',
    page: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6',
    chat: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z',
    check: 'M5 13l4 4L19 7',
    alert: 'M12 2L1 22h22L12 2zM12 9v5M12 18v.01',
    sparkles: 'M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z',
    table: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
    image: 'M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 11.5l2.5 3 3.5-4.5 4.5 6H5z',
    heading: 'M6 4v16M6 12h12M18 4v16',
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={icons[name] || icons.sparkles} />
    </svg>
  )
}

const OwlMascot: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
    <ellipse cx="16" cy="17" rx="11" ry="12" fill="var(--accent-soft)" stroke="var(--accent-primary)" strokeWidth="1.5" />
    <path d="M7 7L5 3L9 5Z" fill="var(--accent-primary)" />
    <path d="M25 7L27 3L23 5Z" fill="var(--accent-primary)" />
    <circle cx="12" cy="13" r="3.5" fill="var(--accent-primary)" />
    <circle cx="20" cy="13" r="3.5" fill="var(--accent-primary)" />
    <circle cx="12" cy="13" r="1.3" fill="#fff" />
    <circle cx="20" cy="13" r="1.3" fill="#fff" />
    <path d="M16 16L14 19L18 19Z" fill="var(--accent-secondary)" />
  </svg>
)

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'live', label: 'En Vivo', icon: 'live' },
  { id: 'insert', label: 'Insertar', icon: 'insert' },
  { id: 'references', label: 'Referencias', icon: 'book' },
  { id: 'cover', label: 'Portada', icon: 'page' },
  { id: 'comments', label: 'Comentarios', icon: 'chat' },
  { id: 'ai', label: 'IA', icon: 'sparkles' },
]

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('live')
  const [insertSection, setInsertSection] = useState<InsertSection>('table')
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const [events, setEvents] = useState<AssistantEvent[]>([])
  const [stats, setStats] = useState<DocumentStats | null>(null)
  const [citationsCount, setCitationsCount] = useState(0)
  const [mascotMessage, setMascotMessage] = useState<string>('¡Hola! Soy tu asistente APA 7')
  const [running, setRunning] = useState(false)
  const [options, setOptions] = useState<AssistantOptions>(liveAssistant.getOptions())
  const [toast, setToast] = useState<ToastState | null>(null)
  const [pendingAction, setPendingAction] = useState<RibbonAction>('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type, id: Date.now() })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  // ── Ejecutar acción del ribbon (refresh, build_bibliography) ─────────────
  const executeRibbonAction = useCallback((action: RibbonAction) => {
    if (!action) return

    if (action === 'refresh') {
      showToast('Re-escaneando el documento...', 'info')
      liveAssistant.scanNow()
    }

    if (action === 'build_bibliography') {
      // Navegar a la pestaña de referencias y disparar la acción
      setActiveTab('references')
      setPendingAction('build_bibliography')
    }

    // Limpiar la acción de localStorage para que no se re-ejecute
    try {
      localStorage.removeItem(LS_ACTION)
    } catch {
      /* ignore */
    }
  }, [showToast])

  // ── Puente con el Ribbon: leer localStorage al montar ────────────────────
  useEffect(() => {
    try {
      const tab = localStorage.getItem(LS_TAB) as TabId | null
      if (tab && TABS.some((t) => t.id === tab)) {
        setActiveTab(tab)
      }
      const section = localStorage.getItem(LS_SECTION) as InsertSection | null
      if (section) {
        setInsertSection(section)
      }
      const action = localStorage.getItem(LS_ACTION) as RibbonAction | null
      if (action) {
        setTimeout(() => executeRibbonAction(action), 300)
      }
    } catch {
      /* localStorage puede no estar disponible */
    }
  }, [executeRibbonAction])

  // ── Puente con el Ribbon: escuchar cambios en localStorage ──────────────
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_TAB && e.newValue) {
        const tab = e.newValue as TabId
        if (TABS.some((t) => t.id === tab)) {
          setActiveTab(tab)
        }
      }
      if (e.key === LS_SECTION) {
        setInsertSection((e.newValue as InsertSection) || 'table')
      }
      if (e.key === LS_ACTION && e.newValue) {
        executeRibbonAction(e.newValue as RibbonAction)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [executeRibbonAction])

  // Verificar conexión con el backend al arrancar
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

  // Callbacks del asistente en vivo (memoizados como objeto)
  const assistantCallbacks = useMemo<AssistantCallbacks>(
    () => ({
      onEvent: (ev: AssistantEvent) => {
        if (ev.type === 'mascot') {
          setMascotMessage(ev.message)
          return
        }
        setEvents((prev) => [...prev.slice(-120), ev])
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

  // Iniciar el asistente en vivo al montar
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

  const handleScanNow = useCallback(() => {
    showToast('Auditando el documento...', 'info')
    liveAssistant.scanNow()
  }, [showToast])

  const handleFormatAll = useCallback(async () => {
    showToast('Formateando el documento...', 'info')
    try {
      await formatDocumentAPA7()
      showToast('Documento formateado a APA 7', 'success')
    } catch (err: any) {
      showToast(err.message || 'Error al formatear documento', 'error')
    }
  }, [showToast])

  // Cuando el usuario cambia de pestaña manualmente, limpiar la sección
  // pendiente del ribbon para no sobrescribir su selección.
  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab)
    try {
      localStorage.setItem(LS_TAB, tab)
    } catch {
      /* ignore */
    }
  }, [])

  // ── Mascota contextual: primera vez que se visita cada pestaña ─────────────
  useEffect(() => {
    const tabMessages: Partial<Record<TabId, { msg: string; key: string }>> = {
      insert: { msg: 'Tablas y figuras con numeracion APA. Vos subi, yo me ocupo del formato.', key: 'wordapa7_insert_seen' },
      references: { msg: 'Escribi (Autor, Año) y los chupo solito.', key: 'wordapa7_refs_seen' },
      cover: { msg: '5 campos y te hago la portada. Mas facil que pedirte prestado.', key: 'wordapa7_cover_seen' },
      ai: { msg: 'Selecciona texto y te digo si suena a ChatGPT.', key: 'wordapa7_ai_seen' },
    }

    const entry = tabMessages[activeTab]
    if (!entry) return

    try {
      if (!localStorage.getItem(entry.key)) {
        localStorage.setItem(entry.key, 'true')
        setMascotMessage(entry.msg)
      }
    } catch {
      /* ignore */
    }
  }, [activeTab])

  return (
    <div className="app-container">
      {/* HEADER */}
      <div className="app-header">
        <div className="app-header__logo">W7</div>
        <div className="app-header__titles">
          <div className="app-header__title">WordAPA7</div>
          <div className="app-header__subtitle">Asistente APA 7 en vivo</div>
        </div>
        <div className="app-header__status">
          <span className={`status-badge ${backendOk ? 'status-badge--ok' : backendOk === false ? 'status-badge--off' : 'status-badge--idle'}`}>
            {backendOk ? 'Online' : backendOk === false ? 'Offline' : '...'}
          </span>
        </div>
      </div>

      {/* TABS */}
      <div className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${activeTab === t.id ? 'tab--active' : ''}`}
            onClick={() => handleTabChange(t.id)}
          >
            <Icon name={t.icon} size={14} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="app-content">
        {activeTab === 'live' && (
          <LiveAssistantPanel
            running={running}
            options={options}
            stats={stats}
            citationsCount={citationsCount}
            onToggle={handleToggle}
            onOptionChange={handleOptionChange}
            onScanNow={handleScanNow}
            onFormatAll={handleFormatAll}
          />
        )}

        {activeTab === 'insert' && (
          <InsertTabContent
            showToast={showToast}
            openSection={insertSection}
            onOpenSection={setInsertSection}
          />
        )}

        {activeTab === 'references' && (
          <ReferencesPanel
            showToast={showToast}
            pendingAction={pendingAction}
            onActionConsumed={() => setPendingAction('')}
          />
        )}
        {activeTab === 'cover' && <CoverPagePanel showToast={showToast} />}

        {activeTab === 'comments' && (
          <CommentsPanel events={events} onClear={() => setEvents([])} showToast={showToast} />
        )}

        {activeTab === 'ai' && <AIPanel showToast={showToast} />}
      </div>

      {/* MASCOTA — globo flotante con mensaje rotativo */}
      <div className="mascot-bubble" role="status" aria-live="polite">
        <div className="mascot-bubble__avatar"><OwlMascot /></div>
        <div className="mascot-bubble__text">{mascotMessage}</div>
      </div>

      {/* TOAST */}
      {toast && (
        <div className={`toast toast--${toast.type}`} key={toast.id}>
          <Icon name={toast.type === 'success' ? 'check' : toast.type === 'error' ? 'alert' : 'sparkles'} size={16} />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Nota pequena: servicio automatico */}
      <div className="watcher-note">
        <span className="watcher-note__dot" />
        Servicio automatico - Se inicia al abrir Word
      </div>

      {/* WELCOME TOUR (primera vez) */}
      <WelcomeTour />
    </div>
  )
}

// ── Pestaña Insertar: figuras, tablas y títulos ──────────────────────────────

const InsertTabContent: React.FC<{
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  openSection: InsertSection
  onOpenSection: (s: InsertSection) => void
}> = ({ showToast, openSection, onOpenSection }) => {
  return (
    <>
      <div className="card">
        <button className="card__header" onClick={() => onOpenSection(openSection === 'table' ? '' : 'table')}>
          <span className="card__icon"><Icon name="table" size={14} /></span>
          <span className="card__title">Tabla APA 7</span>
          <span className={`chevron ${openSection === 'table' ? 'chevron--open' : ''}`}>▾</span>
        </button>
        {openSection === 'table' && (
          <div className="card__body">
            <TablePanel showToast={showToast} />
          </div>
        )}
      </div>

      <div className="card">
        <button className="card__header" onClick={() => onOpenSection(openSection === 'figure' ? '' : 'figure')}>
          <span className="card__icon"><Icon name="image" size={14} /></span>
          <span className="card__title">Figura APA 7</span>
          <span className={`chevron ${openSection === 'figure' ? 'chevron--open' : ''}`}>▾</span>
        </button>
        {openSection === 'figure' && (
          <div className="card__body">
            <FigurePanel showToast={showToast} />
          </div>
        )}
      </div>

      <div className="card">
        <button className="card__header" onClick={() => onOpenSection(openSection === 'heading' ? '' : 'heading')}>
          <span className="card__icon"><Icon name="heading" size={14} /></span>
          <span className="card__title">Título APA 7</span>
          <span className={`chevron ${openSection === 'heading' ? 'chevron--open' : ''}`}>▾</span>
        </button>
        {openSection === 'heading' && (
          <div className="card__body">
            <HeadingPanel showToast={showToast} />
          </div>
        )}
      </div>

      {/* Validación rápida dentro de Insertar */}
      <div className="card">
        <div className="card__simple-header">Análisis APA 7</div>
        <div className="card__body">
          <ValidatePanel showToast={showToast} />
        </div>
      </div>
    </>
  )
}

export default App

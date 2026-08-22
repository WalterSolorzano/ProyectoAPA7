/**
 * WordAPA7 Add-in — Panel del Asistente en Vivo
 * =============================================
 *
 * Control maestro del asistente: encendido/apagado, opciones de automatismo
 * (formato al vuelo, auto-caption, chupar citas), estadísticas rápidas y
 * botón de auditoría manual.
 */

import React from 'react'
import type { AssistantOptions } from '../liveAssistant'
import type { DocumentStats } from '../office/wordHelper'

interface Props {
  running: boolean
  options: AssistantOptions
  stats: DocumentStats | null
  citationsCount: number
  onToggle: () => void
  onOptionChange: (key: keyof AssistantOptions, value: boolean | number) => void
  onScanNow: () => void
}

const SearchIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
)

function Toggle({ checked, onChange, label, desc }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  desc: string
}) {
  return (
    <label className="toggle-row">
      <div className="toggle-row__text">
        <div className="toggle-row__label">{label}</div>
        <div className="toggle-row__desc">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`switch ${checked ? 'switch--on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="switch__thumb" />
      </button>
    </label>
  )
}

export function LiveAssistantPanel({
  running, options, stats, citationsCount, onToggle, onOptionChange, onScanNow,
}: Props) {
  return (
    <div className="live">
      {/* Big toggle */}
      <div className={`live__hero ${running ? 'live__hero--on' : ''}`}>
        <div className="live__hero-left">
          <div className={`live__pulse ${running ? 'live__pulse--on' : ''}`} />
          <div>
            <div className="live__hero-title">
              {running ? 'Asistente ACTIVO' : 'Asistente pausado'}
            </div>
            <div className="live__hero-sub">
              {running ? 'Auditando tu documento en tiempo real' : 'Pulsá para empezar a auditar'}
            </div>
          </div>
        </div>
        <button className={`live__big-toggle ${running ? 'live__big-toggle--on' : ''}`} onClick={onToggle}>
          {running ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatBox label="Palabras" value={stats?.words ?? 0} />
        <StatBox label="Figuras" value={stats?.figures ?? 0} />
        <StatBox label="Tablas" value={stats?.tables ?? 0} />
        <StatBox label="Citas" value={citationsCount} highlight />
      </div>

      {/* Options */}
      <div className="card">
        <div className="card__header card__header--static">
          <span className="card__title">Automatismos</span>
        </div>
        <div className="card__body card__body--padded">
          <Toggle
            checked={options.autoExtractCitations}
            onChange={(v) => onOptionChange('autoExtractCitations', v)}
            label="Chupar citas"
            desc="Detecta (Autor, Año) y las guarda en la bibliografía"
          />
          <Toggle
            checked={options.autoFormat}
            onChange={(v) => onOptionChange('autoFormat', v)}
            label="Formato al vuelo"
            desc="Times New Roman 12, doble interlineado, sangría 0.5&quot;"
          />
          <Toggle
            checked={options.autoCaption}
            onChange={(v) => onOptionChange('autoCaption', v)}
            label="Caption de figuras/tablas"
            desc="Si pegás una imagen, le pone su &quot;Figura N&quot; + nota"
          />
          <Toggle
            checked={options.autoDetectAI}
            onChange={(v) => onOptionChange('autoDetectAI', v)}
            label="Detectar texto de IA"
            desc="Analiza patrones de IA mientras escribís (muletillas, estructura, etc.)"
          />
        </div>
      </div>

      {/* Manual scan */}
      <button className="btn btn--primary btn--full" onClick={onScanNow} data-tour="audit-button">
        <SearchIcon /> Auditar documento ahora
      </button>

      <div className="live__hint">
        El asistente viene incluido con el instalador de WordAPA7 y se conecta
        al motor local. Funciona aunque el backend esté offline (detección local
        de citas + formato APA 7 directo en Word).
      </div>
    </div>
  )
}

function StatBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`stat-box ${highlight ? 'stat-box--highlight' : ''}`}>
      <div className="stat-box__value">{value}</div>
      <div className="stat-box__label">{label}</div>
    </div>
  )
}

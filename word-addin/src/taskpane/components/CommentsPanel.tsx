/**
 * WordAPA7 Add-in — Panel de Comentarios (estilo WhatsApp)
 * ========================================================
 *
 * Muestra el feed de actividad del asistente en vivo como burbujas de chat:
 * citas procesadas, figuras captionadas, formato aplicado, errores, etc.
 *
 * Es el "WhatsApp-style comments panel" que se mantiene del diseño original.
 */

import React, { useEffect, useRef } from 'react'
import type { AssistantEvent } from '../liveAssistant'

interface Props {
  events: AssistantEvent[]
  onClear: () => void
}

const TYPE_META: Record<string, { icon: string; tone: 'success' | 'info' | 'warning' | 'error' }> = {
  citation: { icon: '💬', tone: 'success' },
  figure: { icon: '🖼️', tone: 'success' },
  table: { icon: '📊', tone: 'success' },
  format: { icon: '🔤', tone: 'info' },
  mascot: { icon: '🦉', tone: 'info' },
  info: { icon: 'ℹ️', tone: 'info' },
  summary: { icon: '📑', tone: 'info' },
  error: { icon: '⚠️', tone: 'error' },
}

function timeLabel(t: number): string {
  const d = new Date(t)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
}

export function CommentsPanel({ events, onClear }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  const reversed = [...events].reverse().slice(0, 80)

  return (
    <div className="chat">
      <div className="chat__header">
        <div className="chat__avatar">W7</div>
        <div className="chat__header-text">
          <div className="chat__name">WordAPA7</div>
          <div className="chat__status">Asistente en vivo · auditoría APA 7</div>
        </div>
        {events.length > 0 && (
          <button className="chat__clear" onClick={onClear} title="Limpiar conversación">
            Limpiar
          </button>
        )}
      </div>

      <div className="chat__body">
        {events.length === 0 ? (
          <div className="chat__empty">
            <div className="chat__empty-icon">🦉</div>
            <div className="chat__empty-title">Aún no hay comentarios</div>
            <div className="chat__empty-text">
              Activa el asistente en vivo y empezá a escribir. Cada cita que pongas,
              cada imagen que pegues y cada formato que apliques aparecerá acá como
              un mensaje.
            </div>
          </div>
        ) : (
          reversed.map((ev, i) => {
            const meta = TYPE_META[ev.type] || TYPE_META.info
            const isMascot = ev.type === 'mascot'
            return (
              <div key={`${ev.time}-${i}`} className={`bubble bubble--${meta.tone} ${isMascot ? 'bubble--mascot' : ''}`}>
                <div className="bubble__content">
                  <span className="bubble__icon">{meta.icon}</span>
                  <div className="bubble__text">
                    {ev.message}
                    {ev.detail && <div className="bubble__detail">{ev.detail}</div>}
                  </div>
                </div>
                <div className="bubble__time">{timeLabel(ev.time)}</div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}

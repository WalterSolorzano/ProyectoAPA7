/* WordAPA7 — Acordeón de un hallazgo. Cerrado = tema; abierto = caso exacto (cita + análisis + propuesta).
   Regla de motores: objetivo → Aceptar; probabilístico (IA) → solo Marcar; portada read-only → ninguna acción. */
import React from 'react';
import { ChevronDown, ChevronRight, Check, Bookmark, X, Lock } from 'lucide-react';
import type { AuditItem } from '../../lib/auditItems';

export interface FindingAction {
  label: 'Aceptar' | 'Marcar para revisar' | 'Descartar';
  onRun: () => void;
}

/** Regla de motores: IA nunca ofrece 'Aceptar'; read-only no ofrece acciones; objetivos aceptan sugerencia. */
export function actionsForItem(item: AuditItem): FindingAction['label'][] {
  if (item.readOnly) return [];
  if (item.category === 'ai') return ['Marcar para revisar', 'Descartar'];
  if (item.suggestedText || item.category === 'structure' || item.category === 'spelling') {
    return ['Aceptar', 'Descartar'];
  }
  return ['Descartar'];
}

interface Props {
  item: AuditItem;
  open: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onMark: () => void;
  onDismiss: () => void;
  /** Posición dentro del conjunto (1-based) y total, para el pie "n de M · Siguiente". */
  index?: number;
  total?: number;
  onNext?: () => void;
}

export const FindingAccordion: React.FC<Props> = ({
  item, open, onToggle, onAccept, onMark, onDismiss, index, total, onNext,
}) => {
  const acciones = actionsForItem(item);
  const mostrarPie = typeof index === 'number' && typeof total === 'number' && total > 1 && Boolean(onNext);

  return (
    <section
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 12px',
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-main)' }}>
          {item.summary}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Pág. {item.pageNumber}</span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 12px 36px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.detail}</p>

          <div
            style={{
              padding: '8px 10px',
              borderLeft: '2px solid var(--border-subtle)',
              backgroundColor: 'var(--sidebar-bg)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-main)',
            }}
          >
            {item.originalText}
          </div>

          {item.suggestedText && (
            <div
              style={{
                padding: '8px 10px',
                borderLeft: '2px solid var(--accent-primary)',
                backgroundColor: 'var(--color-accent-soft)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-main)',
              }}
            >
              {item.suggestedText}
            </div>
          )}

          {item.readOnly ? (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
              }}
            >
              <Lock size={12} /> Zona protegida: se revisa, no se escribe.
            </span>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {acciones.includes('Descartar') && (
                <button type="button" onClick={onDismiss} style={ghostBtn}>
                  <X size={12} /> Descartar
                </button>
              )}
              {acciones.includes('Marcar para revisar') && (
                <button type="button" onClick={onMark} style={ghostBtn}>
                  <Bookmark size={12} /> Marcar para revisar
                </button>
              )}
              {acciones.includes('Aceptar') && (
                <button type="button" onClick={onAccept} style={solidBtn}>
                  <Check size={12} /> Aceptar
                </button>
              )}
            </div>
          )}

          {mostrarPie && (
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderTop: '1px solid var(--border-subtle)', paddingTop: '8px',
              }}
            >
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                {index} de {total}
              </span>
              <button type="button" onClick={onNext} style={ghostBtn}>
                Siguiente <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer',
};

const solidBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
  border: 'none', background: 'var(--accent-primary)',
  color: 'var(--paper-white)', fontSize: 'var(--text-xs)', fontWeight: 800, cursor: 'pointer',
};

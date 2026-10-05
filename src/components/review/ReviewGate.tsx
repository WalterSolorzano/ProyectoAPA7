/* WordAPA7 — Capa 1: puerta de estado. Cifra principal, sub-cifras y matriz de calor fase × motor.
   Placeholder de mascota reservado (componente futuro); sin emoji, slot vacío. */
import React, { useMemo } from 'react';
import { ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import type { AuditItem, ToolWindowId } from '../../lib/auditItems';
import { CATEGORY_META } from './CategoryRail';

/** Matriz de calor: cuenta hallazgos por motor/categoría. Función pura. */
export function heatMatrix(items: AuditItem[]): Record<ToolWindowId, number> {
  const m: Record<ToolWindowId, number> = { ai: 0, style: 0, spelling: 0, citations: 0, structure: 0 };
  items.forEach((it) => { m[it.category] += 1; });
  return m;
}

/* Etiquetas de motor: única fuente de verdad en CategoryRail.CATEGORY_META. */

interface Props {
  items: AuditItem[];
  aiScore: number;
  isScanning: boolean;
  onScan: () => void;
  onStart: () => void;
  onOpenAiRoom: () => void;
}

export const ReviewGate: React.FC<Props> = ({ items, aiScore, isScanning, onScan, onStart, onOpenAiRoom }) => {
  const matrix = useMemo(() => heatMatrix(items), [items]);
  const total = items.length;
  const aiCount = matrix.ai;

  if (total === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '40px' }}>
        <div style={{ color: 'var(--accent-primary)' }}><ShieldCheck size={32} /></div>
        <h2 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--text-main)' }}>Aún no hay una revisión</h2>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Ejecutá el escaneo para medir ortografía, voz, estructura y voz sintética.
        </p>
        <button type="button" onClick={onScan} disabled={isScanning} style={solidBtn}>
          <Sparkles size={14} /> Escanear documento
        </button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '40px 48px' }}>
      <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: 'var(--text-main)' }}>Estado de tu documento</h1>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '8px' }}>
        <span data-testid="review-gate-total" style={{ fontSize: '40px', fontWeight: 900, lineHeight: 1, color: 'var(--accent-primary)' }}>{total}</span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>observaciones por revisar</span>
      </div>

      <p style={{ margin: '6px 0 28px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        Voz sintética {Math.round(aiScore * 100)}% · {aiCount} fragmentos con IA
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '520px', marginBottom: '28px' }}>
        {CATEGORY_META.map(({ id, label, Icon }) => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <Icon size={16} />
            <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--text-main)' }}>{label}</span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: matrix[id] > 0 ? 'var(--text-main)' : 'var(--text-secondary)' }}>{matrix[id]}</span>
          </div>
        ))}
      </div>

      {/* Slot de mascota — componente futuro. Placeholder sin emoji. */}
      <div aria-hidden="true" data-slot="mascot" style={{ height: 0 }} />

      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="button" onClick={onStart} style={solidBtn}>
          Empezar revisión <ArrowRight size={14} />
        </button>
        {aiCount > 0 && (
          <button type="button" onClick={onOpenAiRoom} style={ghostBtn}>
            <Sparkles size={14} /> Ver mapa de IA
          </button>
        )}
      </div>
    </div>
  );
};

const solidBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '10px 18px', borderRadius: 'var(--radius-sm)',
  border: 'none', background: 'var(--accent-primary)', color: 'var(--paper-white)',
  fontSize: 'var(--text-sm)', fontWeight: 800, cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '10px 18px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)', background: 'transparent',
  color: 'var(--text-main)', fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer',
};

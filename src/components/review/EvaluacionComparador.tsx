// src/components/review/EvaluacionComparador.tsx
import React, { useState } from 'react';
import type { AuditItem } from '../../lib/auditItems';
import { Layers, Copy, Flag, X } from 'lucide-react';

export interface EvaluacionComparadorProps {
  item: AuditItem;
  onMark?: (item: AuditItem) => void;
  onDismiss?: (item: AuditItem) => void;
  onApplyParaphrase?: (item: AuditItem, newText: string) => Promise<void>;
  busy?: boolean;
}

export function EvaluacionComparador({
  item,
  onMark,
  onDismiss,
  onApplyParaphrase,
  busy,
}: EvaluacionComparadorProps) {
  const [proposal, setProposal] = useState(item.suggestedText ?? '');
  const [copiado, setCopiado] = useState(false);

  /* La confianza viaja en `aiScore` como fracción (0..1); la insignia la lee
     como porcentaje. Sin score no hay insignia: nunca se inventa un número. */
  const crudo = item.aiScore;
  const confianza = typeof crudo === 'number'
    ? Math.min(100, Math.round(crudo <= 1 ? crudo * 100 : crudo))
    : null;

  const aplicar = async () => {
    if (busy || !onApplyParaphrase || !proposal.trim()) return;
    await onApplyParaphrase(item, proposal);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <div>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-tertiary)' }}>
            Texto Original (Fórmula LLM Detectada)
          </span>
          <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
            <mark
              data-testid="ia-fragmento"
              style={{
                backgroundColor: 'var(--color-engine-ia-a30)',
                borderBottom: '2px solid var(--color-engine-ia-a65)',
                color: 'inherit',
                padding: '0 2px',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              {item.originalText}
            </mark>
            {confianza !== null && (
              <span
                data-testid="ia-confianza"
                aria-label={`Confianza ${confianza}%`}
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  color: 'var(--color-engine-ia)',
                  verticalAlign: 'super',
                  marginLeft: 2,
                }}
              >
                {confianza}%
              </span>
            )}
          </p>
        </div>
        <div>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-tertiary)' }}>
            Propuesta con Voz de Autor Humana
          </span>
          <textarea
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
            aria-label="Propuesta con Voz de Autor Humano"
            style={{
              marginTop: 6,
              width: '100%',
              minHeight: 90,
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--text-sm)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(item.originalText).then(() => setCopiado(true))}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 11px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          <Copy size={14} aria-hidden /> {copiado ? 'Copiado' : 'Copiar'}
        </button>
        <button
          type="button"
          onClick={() => onMark?.(item)}
          disabled={item.readOnly}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 11px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          <Flag size={14} aria-hidden /> Marcar para revisar
        </button>
        <button
          type="button"
          onClick={() => onDismiss?.(item)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 11px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          <X size={14} aria-hidden /> Descartar
        </button>
        <button
          type="button"
          onClick={aplicar}
          disabled={busy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-accent)',
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-text-on-accent)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Layers size={14} aria-hidden /> Reemplazar en Manuscrito
        </button>
      </div>
    </div>
  );
}

export default EvaluacionComparador;

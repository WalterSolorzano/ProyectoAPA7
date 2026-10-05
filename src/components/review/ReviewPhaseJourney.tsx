/* WordAPA7 — Capa 2: recorrido por fase. Categoría activa + riel + dashboard vertical. */
import React, { useMemo, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { AuditItem, ToolWindowId } from '../../lib/auditItems';
import { CategoryRail, CATEGORY_META } from './CategoryRail';
import { CategoryDashboard } from './CategoryDashboard';

interface Props {
  items: AuditItem[];
  phaseLabel: string;
  onAccept: (item: AuditItem) => void;
  onMark: (item: AuditItem) => void;
  onDismiss: (item: AuditItem) => void;
  onBack: () => void;
  onOpenAiRoom: () => void;
}

export const ReviewPhaseJourney: React.FC<Props> = ({
  items, phaseLabel, onAccept, onMark, onDismiss, onBack, onOpenAiRoom,
}) => {
  const counts = useMemo(() => {
    const c: Record<ToolWindowId, number> = { ai: 0, style: 0, spelling: 0, citations: 0, structure: 0 };
    items.forEach((it) => { c[it.category] += 1; });
    return c;
  }, [items]);

  const disponibles = useMemo(
    () => CATEGORY_META.filter((c) => counts[c.id] > 0).map((c) => c.id),
    [counts],
  );
  const [active, setActive] = useState<ToolWindowId>(disponibles[0] ?? 'style');

  const visibles = useMemo(() => items.filter((it) => it.category === active), [items, active]);
  const aiCount = counts.ai;

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', backgroundColor: 'var(--color-bg-canvas)' }}>
      <CategoryRail active={active} counts={counts} onSelect={setActive} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 24px', borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          <button type="button" onClick={onBack} style={backBtn}>
            <ArrowLeft size={14} /> Estado del documento
          </button>
          <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {phaseLabel}
          </span>
          {aiCount > 0 && (
            <button type="button" onClick={onOpenAiRoom} style={backBtn}>
              <Sparkles size={14} /> Sala de IA · {aiCount}
            </button>
          )}
        </header>

        <CategoryDashboard
          category={active}
          items={visibles}
          onAccept={onAccept}
          onMark={onMark}
          onDismiss={onDismiss}
        />
      </div>
    </div>
  );
};

const backBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border-subtle)', background: 'transparent',
  color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer',
};

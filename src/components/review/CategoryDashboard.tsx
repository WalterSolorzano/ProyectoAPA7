/* WordAPA7 — Dashboard vertical de una categoría: cifra grande, temas, y acordeones de corrección. */
import React, { useMemo, useState } from 'react';
import type { AuditItem, ToolWindowId } from '../../lib/auditItems';
import { CATEGORY_META } from './CategoryRail';
import { FindingAccordion } from './FindingAccordion';

export interface FindingTheme {
  key: string;
  title: string;
  items: AuditItem[];
}

/** Agrupa por tema. El tema se deriva del tipo real de hallazgo (categoría + subtema);
    preserva TODOS los items: cada item cae en exactamente un grupo. */
export function groupByTheme(items: AuditItem[]): FindingTheme[] {
  const temaDe = (it: AuditItem): { key: string; title: string } => {
    if (it.category === 'spelling') return { key: 'spelling', title: 'Ortografía y texto pegado' };
    if (it.category === 'structure') return { key: 'structure', title: 'Jerarquía y rotulación' };
    if (it.category === 'ai') return { key: 'ai', title: 'Voz sintética detectada' };
    if (it.category === 'citations') return { key: 'citations', title: 'Citas y referencias' };
    // Categoría 'style': separa objetivos Bloom del resto de redacción y voz.
    if (/objetivo|verbo/i.test(it.summary)) return { key: 'style-objetivos', title: 'Objetivos y verbos' };
    return { key: 'style-voz', title: 'Redacción y voz' };
  };

  const order: string[] = [];
  const buckets = new Map<string, FindingTheme>();
  items.forEach((it) => {
    const { key, title } = temaDe(it);
    if (!buckets.has(key)) {
      buckets.set(key, { key, title, items: [] });
      order.push(key);
    }
    buckets.get(key)!.items.push(it);
  });
  return order.map((k) => buckets.get(k)!);
}

interface Props {
  category: ToolWindowId;
  items: AuditItem[];
  onAccept: (item: AuditItem) => void;
  onMark: (item: AuditItem) => void;
  onDismiss: (item: AuditItem) => void;
  activeItemId?: string | null;
  onOpenItem?: (id: string) => void;
}

export const CategoryDashboard: React.FC<Props> = ({
  category, items, onAccept, onMark, onDismiss, activeItemId, onOpenItem,
}) => {
  const temas = useMemo(() => groupByTheme(items), [items]);
  const meta = CATEGORY_META.find((c) => c.id === category);
  const [localOpen, setLocalOpen] = useState<string | null>(null);
  const openId = activeItemId !== undefined ? activeItemId : localOpen;

  const toggle = (id: string) => {
    if (onOpenItem) onOpenItem(openId === id ? '' : id);
    else setLocalOpen(openId === id ? null : id);
  };

  if (items.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
        {meta ? <meta.Icon size={22} /> : null}
        <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>Esta categoría no tiene observaciones.</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
      <header style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
          {meta?.label}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '44px', fontWeight: 900, lineHeight: 1, color: 'var(--accent-primary)' }}>{items.length}</span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>observaciones en esta categoría</span>
        </div>
      </header>

      {temas.map((tema) => (
        <section key={tema.key} style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
            {tema.title} · {tema.items.length}
          </h3>
          <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {tema.items.map((it) => (
              <FindingAccordion
                key={it.id}
                item={it}
                open={openId === it.id}
                onToggle={() => toggle(it.id)}
                onAccept={() => onAccept(it)}
                onMark={() => onMark(it)}
                onDismiss={() => onDismiss(it)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

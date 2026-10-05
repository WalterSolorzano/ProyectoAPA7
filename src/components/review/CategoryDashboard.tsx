/* WordAPA7 — Dashboard vertical de una categoría: cifra grande, temas, y acordeones de corrección. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

  /* Foco al avanzar: al aceptar o descartar, el ítem se va de la lista y su botón
     se desmonta. Movemos el foco al vecino para no devolverlo al body. */
  const btnRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const el = btnRefs.current.get(id);
    if (el) {
      el.focus();
      pendingFocus.current = null;
    }
  }, [items]);

  const focusTrasQuitar = (id: string) => {
    const i = items.findIndex((x) => x.id === id);
    const next = items[i + 1] ?? items[i - 1] ?? null;
    pendingFocus.current = next ? next.id : null;
  };

  const toggle = (id: string) => {
    if (onOpenItem) onOpenItem(openId === id ? '' : id);
    else setLocalOpen(openId === id ? null : id);
  };

  if (items.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--color-text-secondary)' }}>
        {meta ? <meta.Icon size={22} aria-hidden /> : null}
        <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>Esta categoría no tiene observaciones.</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
      <header style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
          {meta?.label}
          <span role="status" aria-atomic="true" style={{ marginLeft: '8px', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            {items.length} observaciones
          </span>
        </h2>
      </header>

      {temas.map((tema) => (
        <section key={tema.key} style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {tema.title}
            <span style={{ marginLeft: '6px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{tema.items.length}</span>
          </h3>
          <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
            {tema.items.map((it) => (
              <FindingAccordion
                key={it.id}
                item={it}
                open={openId === it.id}
                onToggle={() => toggle(it.id)}
                onAccept={() => { focusTrasQuitar(it.id); onAccept(it); }}
                onMark={() => onMark(it)}
                onDismiss={() => { focusTrasQuitar(it.id); onDismiss(it); }}
                buttonRef={(el) => {
                  if (el) btnRefs.current.set(it.id, el);
                  else btnRefs.current.delete(it.id);
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

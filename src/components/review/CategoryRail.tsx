/* WordAPA7 — Riel de iconos de categorías internas del H1 activo.
   Cambiar de icono reemplaza todo el dashboard derecho. Citas queda fuera del módulo. */
import React from 'react';
import { Bot, PenTool, SpellCheck, Layout } from 'lucide-react';
import type { ToolWindowId } from '../../lib/auditItems';

export interface CategoryMeta {
  id: ToolWindowId;
  label: string;
  Icon: React.ElementType;
}

/* Ruling Task 4: el riel interno expone solo las 4 categorías del módulo (ai/style/spelling/structure).
   'citations' existe en ToolWindowId pero es dueño de la fase 4 de Referencias; se excluye acá. */
export const CATEGORY_META: CategoryMeta[] = [
  { id: 'ai', label: 'Voz sintética', Icon: Bot },
  { id: 'style', label: 'Redacción y estilo', Icon: PenTool },
  { id: 'spelling', label: 'Ortografía y formato', Icon: SpellCheck },
  { id: 'structure', label: 'Estructura', Icon: Layout },
];

interface Props {
  active: ToolWindowId;
  counts: Record<ToolWindowId, number>;
  onSelect: (id: ToolWindowId) => void;
}

export const CategoryRail: React.FC<Props> = ({ active, counts, onSelect }) => (
  <nav
    aria-label="Categorías de revisión"
    style={{
      width: '56px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 0',
      borderRight: '1px solid var(--border-subtle)',
      backgroundColor: 'var(--sidebar-bg)',
    }}
  >
    {CATEGORY_META.map(({ id, label, Icon }) => {
      const isActive = id === active;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          aria-label={label}
          aria-pressed={isActive}
          title={label}
          style={{
            width: '40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            padding: '6px 0',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid transparent',
            backgroundColor: isActive ? 'var(--color-accent-soft)' : 'transparent',
            color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <Icon size={18} />
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800 }}>{counts[id] ?? 0}</span>
        </button>
      );
    })}
  </nav>
);

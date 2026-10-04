import React from 'react';
import { LayoutGrid, Check, AlertCircle, LucideIcon } from 'lucide-react';

export type ReferenceFilterType = 'all' | 'verified' | 'issues';

export interface ReferenceRailFilterProps {
  filter: ReferenceFilterType;
  counts: {
    total: number;
    verified: number;
    issues: number;
  };
  onSelectFilter: (f: ReferenceFilterType) => void;
}

export const ReferenceRailFilter: React.FC<ReferenceRailFilterProps> = ({
  filter,
  counts,
  onSelectFilter,
}) => {
  const items: Array<{
    id: ReferenceFilterType;
    label: string;
    icon: LucideIcon;
    count: number;
    iconColor?: string;
    showBadge?: boolean;
    badgeBg?: string;
  }> = [
    {
      id: 'all',
      label: 'Todas las referencias',
      icon: LayoutGrid,
      count: counts.total,
      showBadge: true,
      badgeBg: 'var(--primary, #4361ee)',
    },
    {
      id: 'verified',
      label: 'Verificadas contra DOI/CrossRef',
      icon: Check,
      count: counts.verified,
      iconColor: 'var(--status-verified, #10b981)',
      showBadge: false,
    },
    {
      id: 'issues',
      label: 'Por revisar (huérfanas o incompletas)',
      icon: AlertCircle,
      count: counts.issues,
      iconColor: 'var(--status-warning, #f59e0b)',
      showBadge: counts.issues > 0,
      badgeBg: 'var(--status-warning, #f59e0b)',
    },
  ];

  return (
    <aside
      className="rail-icons"
      aria-label="Filtro de referencias"
      style={{
        width: '56px',
        flexShrink: 0,
        background: 'var(--surface-sidebar, #ffffff)',
        borderRight: '1px solid var(--border-light, #e2e8f0)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '14px 0',
        gap: '14px',
      }}
    >
      {items.map((item) => {
        const isActive = filter === item.id;
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            type="button"
            id={`btn-rail-${item.id}`}
            className={`rail-btn ${isActive ? 'active' : ''}`}
            data-active={isActive ? 'true' : 'false'}
            aria-pressed={isActive}
            title={`${item.label} (${item.count})`}
            aria-label={`${item.label} (${item.count})`}
            onClick={() => onSelectFilter(item.id)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md, 10px)',
              border: isActive ? '1px solid rgba(67, 97, 238, 0.3)' : '1px solid transparent',
              background: isActive ? 'var(--primary-soft, #edf2ff)' : 'transparent',
              color: isActive ? 'var(--primary, #4361ee)' : 'var(--color-text-secondary, #64748b)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              transition: 'all 0.24s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: isActive ? 'scale(1.08)' : 'scale(1)',
              boxShadow: isActive ? '0 3px 10px rgba(67, 97, 238, 0.18)' : 'none',
            }}
          >
            <Icon
              size={18}
              stroke={isActive ? 'var(--primary, #4361ee)' : item.iconColor || 'currentColor'}
              strokeWidth={item.id === 'verified' ? 2.5 : 2}
            />
            {item.showBadge && (
              <span
                className="rail-badge"
                id={item.id === 'all' ? 'badgeAll' : undefined}
                style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-3px',
                  fontSize: '9.5px',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '9999px',
                  background: item.badgeBg || 'var(--primary, #4361ee)',
                  color: '#ffffff',
                  lineHeight: '13px',
                }}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
};

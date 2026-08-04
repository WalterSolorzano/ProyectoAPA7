/* WordAPA7 — Panel derecho unificado (Layer 4)
   Dos pestañas: Actividad (feed unificado) e Inspector (inspector de elemento).
   Reemplaza al panel fijo de solo-inspector y a los elementos flotantes. */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ResizablePanel } from '../shared/ResizablePanel';
import { ElementInspector } from '../inspector/ElementInspector';
import { ActivityFeed } from './ActivityFeed';
import { Activity, SlidersHorizontal } from 'lucide-react';

export const RightSidePanel: React.FC = () => {
  const { forceRightPanelOpen, rightPanelTab, setRightPanelTab, activityUnseen } = useDocStore();

  if (!forceRightPanelOpen) return null;

  return (
    <ResizablePanel side="right" defaultWidth={320} minWidth={250} maxWidth={600} localStorageKey="wordapa7-inspector-width">
      <div style={{
        flexShrink: 0, display: 'flex', flexDirection: 'column',
        height: '100%', overflow: 'hidden',
        background: 'var(--sidebar-bg)', borderLeft: '1px solid var(--border-subtle)',
      }}>
        {/* Pestañas: Actividad | Inspector */}
        <div style={{
          display: 'flex', flexShrink: 0, borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--sidebar-bg)',
        }}>
          <TabButton
            active={rightPanelTab === 'activity'}
            onClick={() => setRightPanelTab('activity')}
            icon={<Activity size={13} />}
            label="Actividad"
            badge={rightPanelTab === 'activity' ? 0 : activityUnseen}
          />
          <TabButton
            active={rightPanelTab === 'inspector'}
            onClick={() => setRightPanelTab('inspector')}
            icon={<SlidersHorizontal size={13} />}
            label="Inspector"
          />
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          {rightPanelTab === 'activity' ? <ActivityFeed /> : <ElementInspector />}
        </div>
      </div>
    </ResizablePanel>
  );
};

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}> = ({ active, onClick, icon, label, badge = 0 }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
      padding: '9px 8px', cursor: 'pointer', fontFamily: 'inherit',
      background: 'transparent', border: 'none',
      color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
      fontSize: '12px', fontWeight: active ? 700 : 600,
      borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
    }}
  >
    {icon}
    {label}
    {badge > 0 && (
      <span style={{
        minWidth: '16px', height: '16px', borderRadius: '999px',
        backgroundColor: 'var(--accent-primary)', color: '#fff',
        fontSize: '9px', fontWeight: 800,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
      }}>
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);

export default RightSidePanel;

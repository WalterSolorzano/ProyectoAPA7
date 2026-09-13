import React, { useState } from 'react';
import { FileText, ListTree, Image as ImageIcon, BookOpen, ShieldCheck, Download, Check, Map, ChevronDown, ChevronUp, ChevronRight, ChevronLeft } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { OutlineTree } from './OutlineTree';

const STEPS = [
  { step: 1, label: 'Portada', Icon: FileText },
  { step: 2, label: 'Estructura', Icon: ListTree },
  { step: 3, label: 'Figuras', Icon: ImageIcon },
  { step: 4, label: 'Referencias', Icon: BookOpen },
  { step: 5, label: 'Auditoría & IA', Icon: ShieldCheck },
  { step: 6, label: 'Exportar', Icon: Download },
] as const;

export function StepRail() {
  const wizardStep = useDocStore((s) => s.wizardStep);
  const setWizardStep = useDocStore((s) => s.setWizardStep);
  const doc = useDocStore((s) => s.doc);
  const coverSetupDone = useDocStore((s) => s.coverSetupDone);
  const leftSidebarWidth = useDocStore((s) => s.leftSidebarWidth) || 280;
  const setLeftSidebarWidth = useDocStore((s) => s.setLeftSidebarWidth);
  const proofreadFindings = useDocStore((s) => s.proofreadFindings || []);
  const citationAuditResult = useDocStore((s) => s.citationAuditResult);
  const [mapOpen, setMapOpen] = useState(true);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = leftSidebarWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      setLeftSidebarWidth(startWidth + delta);
    };

    const onPointerUp = () => {
      setIsResizing(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const showMap = wizardStep === 2 || wizardStep === 3 || wizardStep === 4;

  const elements = doc?.elements || [];
  const pendingHeadings = elements.filter((e) => e.type === 'heading' && e.needs_review).length;
  const pendingFigures = elements.filter(
    (e) => (e.type === 'image' || e.type === 'table') && e.needs_review,
  ).length;
  const hasReferences = (doc?.referencias?.length || 0) > 0;
  const pendingAuditCount = proofreadFindings.length + (citationAuditResult?.ghost_citations?.length || 0);

  const doneByStep: Record<number, boolean> = {
    1: coverSetupDone,
    2: !!doc && pendingHeadings === 0,
    3: !!doc && pendingFigures === 0,
    4: hasReferences,
    5: !!doc && pendingAuditCount === 0,
  };

  const badgeByStep: Record<number, number> = {
    2: pendingHeadings,
    3: pendingFigures,
    5: pendingAuditCount,
  };

  const isCollapsed = leftSidebarWidth < 100;
  const toggleCollapse = () => {
    setLeftSidebarWidth(isCollapsed ? 240 : 56);
  };

  return (
    <nav
      aria-label="Pasos del asistente"
      style={{
        width: `${leftSidebarWidth}px`,
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
        borderRight: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--sidebar-bg)',
        padding: isCollapsed ? '14px 6px' : '14px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        position: 'relative',
        userSelect: isResizing ? 'none' : 'auto',
        transition: isResizing ? 'none' : 'width 0.15s ease',
      }}
    >
      {/* Asa de arrastre para cambiar ancho */}
      <div
        onPointerDown={handleResizePointerDown}
        title="Arrastrar para ajustar ancho del panel"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '5px',
          height: '100%',
          cursor: 'col-resize',
          zIndex: 20,
          backgroundColor: isResizing ? 'var(--accent-primary)' : 'transparent',
          transition: 'background-color 0.15s ease',
        }}
      />
      <div
        style={{
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          padding: isCollapsed ? '4px 0 10px' : '4px 12px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
        }}
      >
        {!isCollapsed && <span>Pasos</span>}
        <button
          type="button"
          onClick={toggleCollapse}
          title={isCollapsed ? 'Expandir panel de pasos' : 'Colapsar panel de pasos'}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
      {STEPS.map(({ step, label, Icon }) => {
        const active = wizardStep === step;
        const done = doneByStep[step];
        const badge = badgeByStep[step] || 0;
        return (
          <button
            key={step}
            type="button"
            onClick={() => setWizardStep(step)}
            title={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: isCollapsed ? '0' : '10px',
              padding: isCollapsed ? '10px 0' : '10px 12px',
              borderRadius: 'var(--radius-sm)',
              border: active ? '1px solid var(--accent-primary)' : '1px solid transparent',
              background: active ? 'var(--color-accent-soft)' : 'transparent',
              color: active ? 'var(--accent-primary)' : 'var(--text-main)',
              cursor: 'pointer',
              textAlign: isCollapsed ? 'center' : 'left',
              fontSize: '13px',
              fontWeight: active ? 700 : 500,
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.background = 'var(--surface-subtle)';
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.background = 'transparent';
            }}
          >
            <Icon size={15} style={{ flexShrink: 0 }} />
            {!isCollapsed && <span style={{ flex: 1, minWidth: 0 }}>{label}</span>}
            {!isCollapsed && done ? (
              <Check size={13} color="var(--accent-success)" style={{ flexShrink: 0 }} />
            ) : !isCollapsed && badge > 0 ? (
              <span
                style={{
                  minWidth: '18px',
                  height: '18px',
                  borderRadius: 999,
                  padding: '0 5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 800,
                  background: 'var(--accent-warning, #b45309)',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                {badge}
              </span>
            ) : null}
          </button>
        );
      })}

      {!isCollapsed && showMap && (
        <div
          style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setMapOpen((v) => !v)}
            title={mapOpen ? 'Cerrar mapa del documento' : 'Abrir mapa del documento'}
            aria-expanded={mapOpen}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 10px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-subtle)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Map size={13} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
              Mapa del documento
            </span>
            {mapOpen
              ? <ChevronUp size={13} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
              : <ChevronDown size={13} color="var(--text-secondary)" style={{ flexShrink: 0 }} />}
          </button>
          {mapOpen && (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <OutlineTree />
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

export default StepRail;

/* WordAPA7 — Panel derecho flotante (overlay sobre el canvas).
   No compite por espacio con el EditorRail: se monta con position: absolute
   y box-shadow para no aplastar el documento central.
   - ActionBar + Inspector según contexto.
   - Sin bloques de "Resumen" ni "Revision IA" repetidos. */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ElementInspector } from '../inspector/ElementInspector';
import { ReferenceForm } from '../referencias/ReferenceForm';
import { ActionBar } from './ActionBar';
import { ReferencesPanel } from '../referencias/ReferencesPanel';
import { Activity, X, FileText, ListChecks, BookOpen } from 'lucide-react';

const EVENT_ICONS: Record<string, React.ReactNode> = {
  success: <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>&#x2714;</span>,
  error: <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>&#x2716;</span>,
  info: <span style={{ color: 'var(--color-info)', fontWeight: 700 }}>i</span>,
  warning: <span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>!</span>,
};

function timeAgo(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 10) return 'ahora';
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

const DEFAULT_WIDTH = 310;
const MIN_WIDTH = 260;
const MAX_WIDTH = 620;
const LOCAL_STORAGE_KEY = 'wordapa7-inspector-width';

export const RightSidePanel: React.FC = () => {
  const {
    forceRightPanelOpen, setForceRightPanelOpen,
    selectedElementId, selectedReferenceId, doc, wizardStep,
  } = useDocStore();

  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Se abre automaticamente al seleccionar un elemento
  useEffect(() => {
    if ((selectedElementId || selectedReferenceId) && doc) setForceRightPanelOpen(true);
  }, [selectedElementId, selectedReferenceId, doc, setForceRightPanelOpen]);

  // En paso 5 (Referencias) el panel siempre se abre al entrar, porque ahi vive
  // el editor principal de esa seccion.
  useEffect(() => {
    if (!doc) return;
    if (wizardStep === 5) setForceRightPanelOpen(true);
  }, [wizardStep, doc, setForceRightPanelOpen]);

  // Guardar ancho en localStorage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, panelWidth.toString());
  }, [panelWidth]);

  // Resize via drag en el borde izquierdo
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX));
      setPanelWidth(newW);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [isResizing]);

  if (!forceRightPanelOpen) return null;

  const hasSelection = !!selectedElementId && !!doc;
  const hasReference = !hasSelection && !!selectedReferenceId;

  const sectionNames: Record<number, string> = {
    1: 'Portada', 2: 'Estructura', 3: 'Figuras y tablas', 4: 'Cuerpo', 5: 'Referencias',
  };
  const currentSection = sectionNames[wizardStep] || '';

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: panelWidth,
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--sidebar-bg)',
        borderLeft: '1px solid var(--border-subtle)',
        boxShadow: '-6px 0 20px rgba(0,0,0,0.12)',
      }}
    >
      {/* Resize handle en el borde izquierdo */}
      <div
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 5, cursor: 'col-resize', zIndex: 26,
        }}
      />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
        padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--sidebar-bg)',
      }}>
        {hasSelection ? (
          <ListChecks size={14} color="var(--accent-primary)" />
        ) : hasReference ? (
          <BookOpen size={14} color="var(--accent-primary)" />
        ) : (
          <FileText size={14} color="var(--accent-primary)" />
        )}
        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
          {hasSelection ? 'Inspector' : hasReference ? 'Referencia' : `Documento${currentSection ? ` / ${currentSection}` : ''}`}
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setForceRightPanelOpen(false)}
          aria-label="Cerrar panel"
          title="Cerrar panel"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
        >
          <X size={14} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {hasSelection ? (
          <ElementInspector />
        ) : hasReference ? (
          <ReferenceForm key={selectedReferenceId} />
        ) : wizardStep === 5 ? (
          <ReferencesPanel />
        ) : (
          <DocumentPanel />
        )}
      </div>
    </div>
  );
};

// ── Panel "Documento": solo ActionBar + Actividad (sin Resumen ni Revisión IA) ──

const DocumentPanel: React.FC = () => {
  const { doc, activityEvents } = useDocStore();

  if (!doc) return null;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <ActionBar />

      {activityEvents.length > 0 && (
        <div style={{
          border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--surface-elevated)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <Activity size={15} color="var(--accent-secondary)" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>Actividad</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activityEvents.slice(0, 8).map((ev: any) => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ flexShrink: 0, marginTop: '1px' }}>{EVENT_ICONS[ev.kind] || EVENT_ICONS.info}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.4 }}>{ev.title}</div>
                  {ev.detail && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '2px' }}>{ev.detail}</div>}
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>{timeAgo(ev.time)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RightSidePanel;

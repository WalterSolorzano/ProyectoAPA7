/* WordAPA7 — toolbar: la barra mínima del mockup (48px).
   Izquierda: logo/Archivo, título y chip "Guardado". Derecha: Copiloto,
   botón de más acciones y avatar. Todo lo demas vive en ToolbarOverflowMenu. */

import React, { useState } from 'react';
import { BookOpen, Check, AlertCircle, MoreHorizontal, Sparkles } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { ToolbarOverflowMenu } from './ToolbarOverflowMenu';

type ChromeStyle = React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };
const noDragRegion = { WebkitAppRegion: 'no-drag' } as ChromeStyle;

export function UnifiedToolbar() {
  const doc = useDocStore((s) => s.doc);
  const hasUnsavedChanges = useDocStore((s) => s.hasUnsavedChanges);
  const showFileMenu = useDocStore((s) => s.showFileMenu);
  const setShowFileMenu = useDocStore((s) => s.setShowFileMenu);
  const liveChatOpen = useDocStore((s) => s.liveChatOpen);
  const setLiveChatOpen = useDocStore((s) => s.setLiveChatOpen);
  const setSettingsStudioOpen = useDocStore((s) => s.setSettingsStudioOpen);
  const [overflowOpen, setOverflowOpen] = useState(false);

  // Badge del Copiloto: hallazgos pendientes. Sigue en la barra porque el
  // Copiloto es la funcion principal del producto y se queda visible.
  const citationAudit = useDocStore((s) => s.citationAuditResult);
  const proofreadFindings = useDocStore((s) => s.proofreadFindings || []);
  const copilotIssueCount =
    (citationAudit?.ghost_citations?.length || 0) + (proofreadFindings.length > 0 ? 1 : 0);

  // Electron dibuja los botones nativos de ventana sobre la esquina superior
  // derecha, asi que la barra reserva ese ancho.
  const isElectron = !!(window as any).electronAPI;

  return (
    <header
      className="app-drag"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 48,
        flexShrink: 0,
        padding: isElectron ? '0 150px 0 16px' : '0 16px',
        backgroundColor: 'var(--color-bg-surface)',
        borderBottom: '1px solid var(--color-border-subtle)',
        position: 'relative',
        zIndex: 'var(--z-sticky)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <button
          type="button"
          onClick={() => setShowFileMenu(!showFileMenu)}
          aria-label="Menú Archivo"
          title="Archivo"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            background: 'none', border: 'none', padding: '4px 6px',
            cursor: 'pointer', borderRadius: 'var(--radius-sm)',
            ...noDragRegion,
          }}
        >
          <BookOpen size={16} strokeWidth={1.75} aria-hidden style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            WordAPA7
          </span>
        </button>

        {doc && (
          <>
            {/* El nombre viene del .docx que subio el usuario: no hay setter ni
                endpoint para renombrarlo, asi que se muestra, no se edita. */}
            <span
              title="Nombre del documento activo"
              style={{
                maxWidth: 420,
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {doc.file_name || 'Documento sin título'}
            </span>
            {/* El chip afirma lo que el store afirma: hasUnsavedChanges lo levanta
                documentSlice en cada cambio de historial y lo bajan las
                exportaciones, y FileMenu lo lee antes de descartar el documento.
                Mostrar "Guardado" sin mirar ese campo seria mentir. */}
            <span
              title={hasUnsavedChanges ? 'Hay cambios sin guardar. Se guardan automáticamente.' : 'Progreso guardado automáticamente.'}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: hasUnsavedChanges ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }}
            >
              {hasUnsavedChanges
                ? <AlertCircle size={11} strokeWidth={1.75} aria-hidden />
                : <Check size={11} strokeWidth={1.75} aria-hidden style={{ color: 'var(--color-success)' }} />}
              {hasUnsavedChanges ? 'Sin guardar' : 'Guardado'}
            </span>
          </>
        )}
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={() => setLiveChatOpen(!liveChatOpen)}
          aria-label="Copiloto Editorial IA"
          title="Copiloto Editorial IA"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border-subtle)',
            background: 'var(--color-accent-soft)', color: 'var(--color-accent)',
            fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
            ...noDragRegion,
          }}
        >
          <Sparkles size={14} strokeWidth={1.75} aria-hidden />
          Copiloto
          {copilotIssueCount > 0 && (
            <span
              title={`${copilotIssueCount} observaciones pendientes`}
              style={{
                minWidth: 16, height: 16, borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-danger)', color: 'var(--color-text-on-accent)',
                fontSize: 9, fontWeight: 800, lineHeight: 1,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px',
              }}
            >
              {copilotIssueCount > 99 ? '99+' : copilotIssueCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setOverflowOpen((v) => !v)}
          aria-label="Más acciones"
          aria-expanded={overflowOpen}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-sm)', background: 'transparent',
            color: 'var(--color-text-secondary)', cursor: 'pointer',
            ...noDragRegion,
          }}
        >
          <MoreHorizontal size={15} strokeWidth={1.75} aria-hidden />
        </button>
        {overflowOpen && <ToolbarOverflowMenu onClose={() => setOverflowOpen(false)} />}

        <button
          type="button"
          onClick={() => setSettingsStudioOpen(true)}
          aria-label="Cuenta"
          title="Cuenta"
          style={{
            width: 28, height: 28, borderRadius: 'var(--radius-full)',
            border: 'none', backgroundColor: 'var(--color-accent)',
            color: 'var(--color-text-on-accent)', fontSize: 'var(--text-xs)',
            fontWeight: 700, cursor: 'pointer', ...noDragRegion,
          }}
        >
          W
        </button>
      </div>
    </header>
  );
}

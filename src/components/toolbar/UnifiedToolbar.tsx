/* WordAPA7 — toolbar: la barra mínima del mockup (48px).
   Izquierda: logo/Archivo, título y chip "Guardado". Derecha: Copiloto,
   botón de más acciones y avatar. Todo lo demas vive en ToolbarOverflowMenu. */

import React, { useEffect, useRef, useState } from 'react';
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
  const overflowRef = useRef<HTMLDivElement>(null);
  const overflowButtonRef = useRef<HTMLButtonElement>(null);

  /* El menú de desborde se cerraba solo con un segundo clic en su botón. Un
     `mousedown` afuera lo cierra —como el overflow de `ProjectTabs`—, `Escape`
     lo cierra aunque el foco esté dentro, y al abrirse el foco entra a la
     primera entrada: sin eso, un usuario de teclado abre el menú con Enter y se
     va con Tab dejando 260px flotando sobre el documento. La barra no puede
     conmutar el estado del menú: vive local, y solo este componente lo cierra. */
  useEffect(() => {
    if (!overflowOpen) return;
    const onDown = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOverflowOpen(false);
        overflowButtonRef.current?.focus();
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [overflowOpen]);

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
          aria-expanded={showFileMenu}
          aria-haspopup="dialog"
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
          aria-expanded={liveChatOpen}
          aria-haspopup="dialog"
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

        <div ref={overflowRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            ref={overflowButtonRef}
            type="button"
            onClick={() => setOverflowOpen((v) => !v)}
            aria-label="Más acciones"
            aria-expanded={overflowOpen}
            aria-haspopup="menu"
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
        </div>

        {/* Sin cuenta en el store, este botón no puede anunciar una sesión: la
            "W" de WordAPA7 es la marca, y lo que abre son Ajustes. Se nombra
            por lo que hace. */}
        <button
          type="button"
          onClick={() => setSettingsStudioOpen(true)}
          aria-label="Ajustes y vista previa"
          title="Ajustes y vista previa"
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

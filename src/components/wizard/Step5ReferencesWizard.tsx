/* WordAPA7 — Paso 5: Referencias con contexto absoluto.
   El documento (PaperCanvas) SIEMPRE está visible, auto-desplazado hasta la
   hoja de bibliografía. Las herramientas de referencias viven en el panel
   derecho (ReferencesPanel). El validador completo se abre como drawer NO
   bloqueante sobre el canvas.

   Si el documento NO tiene un encabezado de Referencias/Bibliografía, no
   enviamos al usuario a un elemento aleatorio (el último del documento).
   En su lugar mostramos un aviso claro y dejamos el panel derecho abierto
   para que agregue referencias manualmente. */

import React, { useEffect, useMemo } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { PaperCanvas } from '../layout/PaperCanvas';
import { ValidatorView } from '../validator/ValidatorView';
import { X, BookOpen } from 'lucide-react';

const isRefHeading = (txt: string): boolean => {
  const n = (txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /^(referencias?|bibliografia|obras consultadas|works cited)\b/.test(n.trim());
};

export const Step5ReferencesWizard: React.FC = () => {
  const validatorOpen = useDocStore((s) => s.validatorOpen);
  const setValidatorOpen = useDocStore((s) => s.setValidatorOpen);
  const setScrollTargetId = useDocStore((s) => s.setScrollTargetId);
  const setForceRightPanelOpen = useDocStore((s) => s.setForceRightPanelOpen);
  // Suscripción reactiva al documento: si el usuario agrega un encabezado de
  // Referencias mientras está en este paso, el aviso desaparece solo.
  const doc = useDocStore((s) => s.doc);

  // ¿Existe un encabezado de bibliografía en el documento actual?
  const hasRefHeading = useMemo(
    () => !!doc?.elements.some((e) => e.type === 'heading' && isRefHeading(e.text || '')),
    [doc],
  );
  // El aviso solo tiene sentido cuando hay documento cargado pero sin sección
  // de referencias (si no hay documento, no mostramos nada).
  const showNoBibBanner = !!doc && !hasRefHeading;

  // Al entrar, llevar el canvas hasta la hoja de Bibliografía y abrir el panel
  // derecho. SOLO desplazamos si existe un encabezado de referencias: si no
  // existe, no mandamos al usuario al último elemento (que sería un lugar
  // aleatorio del documento).
  useEffect(() => {
    setForceRightPanelOpen(true);
    const d = useDocStore.getState().doc;
    if (!d) return;
    const refEl = d.elements.find((e) => e.type === 'heading' && isRefHeading(e.text || ''));
    if (refEl) {
      setScrollTargetId(refEl.id);
    }
    // Sin encabezado de referencias: no hacemos scroll a un elemento al azar.
  }, [setScrollTargetId, setForceRightPanelOpen]);

  return (
    <div style={{ position: 'relative', flex: 1, height: '100%', overflow: 'hidden', backgroundColor: 'var(--canvas-bg)' }}>
      <PaperCanvas />

      {/* Aviso no bloqueante: el documento no tiene sección de Referencias.
          Se ancla arriba a la izquierda del canvas para no chocar con el
          drawer del validador (que ocupa la franja derecha). */}
      {showNoBibBanner && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            zIndex: 30,
            maxWidth: 'min(440px, calc(100% - 28px))',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '12px 14px',
            backgroundColor: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderLeft: '3px solid var(--accent-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              width: 34,
              height: 34,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(79,124,255,0.10)',
              color: 'var(--accent-primary)',
            }}
          >
            <BookOpen size={18} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', marginBottom: 3 }}>
              Este documento no tiene una sección de Referencias/Bibliografía
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Puedes agregar referencias manualmente usando el panel de la derecha, o tu documento simplemente no requiere bibliografía.
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 6 }}>
              El panel de referencias ya está abierto a la derecha.
            </div>
          </div>
        </div>
      )}

      {/* Validador como drawer no bloqueante (el canvas sigue a la vista) */}
      {validatorOpen && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: 'min(640px, 64%)', zIndex: 40,
          display: 'flex', flexDirection: 'column',
          backgroundColor: 'var(--sidebar-bg)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: '-10px 0 28px rgba(0,0,0,0.25)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 14px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
          }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', flex: 1 }}>
              Validador de citas y referencias
            </span>
            <button
              type="button"
              onClick={() => setValidatorOpen(false)}
              aria-label="Cerrar validador"
              title="Cerrar (Esc)"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
            >
              <X size={14} />
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <ValidatorView />
          </div>
        </div>
      )}
    </div>
  );
};

export default Step5ReferencesWizard;

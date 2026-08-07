/* WordAPA7 — Paso 5: Referencias con contexto absoluto.
   El documento (PaperCanvas) SIEMPRE está visible, auto-desplazado hasta la
   hoja de bibliografía. Las herramientas de referencias viven en el panel
   derecho (ReferencesPanel). El validador completo se abre como drawer NO
   bloqueante sobre el canvas. */

import React, { useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { PaperCanvas } from '../layout/PaperCanvas';
import { ValidatorView } from '../validator/ValidatorView';
import { X } from 'lucide-react';

const isRefHeading = (txt: string): boolean => {
  const n = (txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /^(referencias?|bibliografia|obras consultadas|works cited)\b/.test(n.trim());
};

export const Step5ReferencesWizard: React.FC = () => {
  const validatorOpen = useDocStore((s) => s.validatorOpen);
  const setValidatorOpen = useDocStore((s) => s.setValidatorOpen);
  const setScrollTargetId = useDocStore((s) => s.setScrollTargetId);

  // Al entrar, llevar el canvas hasta la hoja de Bibliografía (sin abrir inspector)
  useEffect(() => {
    const doc = useDocStore.getState().doc;
    if (!doc) return;
    const refEl = doc.elements.find((e) => e.type === 'heading' && isRefHeading(e.text || ''));
    const fallback = doc.elements[doc.elements.length - 1];
    const target = refEl?.id || fallback?.id || null;
    if (target) setScrollTargetId(target);
  }, [setScrollTargetId]);

  return (
    <div style={{ position: 'relative', flex: 1, height: '100%', overflow: 'hidden', backgroundColor: 'var(--canvas-bg)' }}>
      <PaperCanvas />

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

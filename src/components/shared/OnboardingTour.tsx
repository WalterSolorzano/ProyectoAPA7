/* WordAPA7 — Onboarding como tooltips (Layer 4)
   Reemplaza el modal de bienvenida por tooltips no bloqueantes que explican
   dónde vive la actividad del documento (panel derecho Actividad) y el flujo
   guiado. No rebrandea paneles: solo orienta la primera vez. */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { X } from 'lucide-react';

const TOOLTIP_STYLE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 9990,
  maxWidth: '280px',
  backgroundColor: 'var(--surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: '12px 14px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
  fontSize: '12px',
  color: 'var(--text-main)',
  lineHeight: 1.5,
};

export const OnboardingTour: React.FC = () => {
  const { doc, hasSeenTour, setHasSeenTour } = useDocStore();
  const [dismissed, setDismissed] = useState(false);

  if (!doc || hasSeenTour || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    setHasSeenTour(true);
  };

  return (
    <>
      {/* Tooltip 1: panel Actividad (esquina inferior derecha, sobre la barra de estado) */}
      <div style={{ ...TOOLTIP_STYLE, bottom: '48px', right: '16px' }} role="tooltip">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', marginBottom: '4px' }}>Panel Actividad</strong>
            Clasificación, validación, auditoría de citas, revisiones y notificaciones viven en el panel
            derecho, en la pestaña <strong>Actividad</strong>. Nada flota sobre tu documento.
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Cerrar sugerencia"
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tooltip 2: flujo guiado (esquina superior derecha) */}
      <div style={{ ...TOOLTIP_STYLE, top: '64px', right: '16px' }} role="tooltip">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', marginBottom: '4px' }}>Flujo guiado</strong>
            Portada → Estructura → Figuras y tablas → Cuerpo → Referencias. Podés saltar entre pasos
            desde la barra superior o usar el Modo Rápido desde el inicio.
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Cerrar sugerencia"
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </>
  );
};

export default OnboardingTour;

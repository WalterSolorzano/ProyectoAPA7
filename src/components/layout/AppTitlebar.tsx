import React from 'react';

/**
 * Cuando usamos titleBarStyle: 'hidden' y titleBarOverlay en Electron (Windows),
 * los botones nativos (Cerrar, Maximizar, Minimizar) son dibujados por el SO.
 * Sin embargo, necesitamos un área que podamos "arrastrar" (drag) para mover la ventana.
 * Este componente provee esa zona de arrastre transparente en la parte superior.
 */
export const AppTitlebar: React.FC = () => {
  return (
    <div
      style={{
        height: '34px',
        width: '100%',
        backgroundColor: 'rgba(15, 23, 42, 0.18)',
        WebkitAppRegion: 'drag', // This is what allows the window to be moved!
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '18px',
        paddingRight: '180px',
        userSelect: 'none',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 9999, // Keep it above everything so we can drag it
        pointerEvents: 'none' // Don't block clicks to things underneath unless we specifically need it
      } as React.CSSProperties}
    >
      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.02em' }}>WordAPA7</span>
    </div>
  );
};

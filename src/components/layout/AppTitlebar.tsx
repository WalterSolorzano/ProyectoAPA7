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
        height: '32px',
        width: '100%',
        backgroundColor: 'transparent', // The background color is handled by App.tsx or titleBarOverlay
        WebkitAppRegion: 'drag', // This is what allows the window to be moved!
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '16px',
        userSelect: 'none',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 9999, // Keep it above everything so we can drag it
        pointerEvents: 'none' // Don't block clicks to things underneath unless we specifically need it
      } as React.CSSProperties}
    >
      {/* Opcional: Podemos poner un texto de título si queremos */}
      <span style={{ fontSize: '12px', color: '#605e5c', fontWeight: 600 }}>WordAPA7</span>
    </div>
  );
};

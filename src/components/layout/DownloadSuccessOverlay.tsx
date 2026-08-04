/* WordAPA7 — Micro-animación de cierre.
 * Cuando el DOCX/PDF termina de generarse con éxito, un spinner se convierte
 * en un check con un mini-rebote (200ms, nada exagerado). Transmite
 * "personalidad" sin ser un chiste. Auto-se oculta a los ~1.8s.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';

export const DownloadSuccessOverlay: React.FC = () => {
  const exportSuccessAt = useDocStore((s) => s.exportSuccessAt);
  const [show, setShow] = useState(false);
  const lastSeenRef = useRef<number | null>(null);

  useEffect(() => {
    if (!exportSuccessAt) return;
    if (lastSeenRef.current === exportSuccessAt) return; // mismo evento
    lastSeenRef.current = exportSuccessAt;
    setShow(true);
    const t = setTimeout(() => setShow(false), 1800);
    return () => clearTimeout(t);
  }, [exportSuccessAt]);

  if (!show) return null;

  return (
    <div className="download-success" role="status" aria-live="polite">
      <div className="download-success-icon">
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
          <circle cx="17" cy="17" r="15" className="download-success-ring" />
          <path d="M10 17.5 L15 22.5 L24 12" className="download-success-check" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
      <span className="download-success-text">¡Listo, a entregar!</span>
    </div>
  );
};

export default DownloadSuccessOverlay;

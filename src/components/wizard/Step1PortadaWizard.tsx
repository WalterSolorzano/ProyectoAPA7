/* WordAPA7 — Paso 1: Portada (vista simplificada).
   El editor de portada vive en el RightSidePanel (CoverPanel). Acá solo
   queda el PaperCanvas, donde el usuario ve la portada actualizandose en vivo
   mientras completa los campos. */

import React from 'react';
import { PaperCanvas } from '../layout/PaperCanvas';

export const Step1PortadaWizard: React.FC = () => {
  return (
    <div style={{ position: 'relative', flex: 1, height: '100%', overflow: 'hidden', backgroundColor: 'var(--canvas-bg)' }}>
      <PaperCanvas />
    </div>
  );
};

export default Step1PortadaWizard;

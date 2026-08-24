/* WordAPA7 — DocumentOutline: wrapper del mapa del documento.
   Desde la unificación de mapas, la implementación única vive en
   OutlineTree.tsx (mismo módulo/diseño que el "Mapa de títulos" del
   paso Estructura). Este wrapper mantiene el punto de uso existente. */

import React from 'react';
import { OutlineTree } from './OutlineTree';

export const DocumentOutline: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <OutlineTree />
    </div>
  );
};

export default DocumentOutline;

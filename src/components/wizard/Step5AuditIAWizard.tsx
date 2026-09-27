/* WordAPA7 — review: punto de entrada del paso 5.
   La implementación vive en src/components/review/. Este archivo sobrevive
   para no cambiar el import desde App.tsx ni los tests que lo referencian.

   Aquí murió también la segunda fuente de paginas: el mapa de caracteres por
   elemento que este archivo llevaba contra la paginacion real del lienzo.
   Un hallazgo caia en una hoja que el minimapa no marcaba; ahora las tres
   cosas que nombran una pagina (la cuenta de la tira, las marcas del minimapa
   y la etiqueta del bloque) salen de `usePageIndex`. */

import React from 'react';
import { ReviewWorkbench } from '../review/ReviewWorkbench';

export function Step5AuditIAWizard() {
  return <ReviewWorkbench />;
}

export default Step5AuditIAWizard;

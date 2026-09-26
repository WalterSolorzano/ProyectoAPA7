/* WordAPA7 — auto-ajuste tipografico de la tarjeta de lectura.
   El parrafo se encoge si es enorme y crece si es corto, siempre entre 13 y
   19px. El piso de 13px no es negociable: por debajo, la revision se vuelve
   inutilizable, y preferimos que la tarjeta scrollee. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export const MIN_FONT_PX = 13;
export const MAX_FONT_PX = 19;
/** Cuantas lineas caben sin scroll interno antes de empezar a encoger. */
export const MAX_LINES = 26;

/** Lo que la tarjeta de lectura (T14) necesita: a quien mide, el cuerpo elegido y
 *  el interlineado DERIVADO de ese cuerpo, para que nunca se apliquen sueltos. */
export interface AutoFitText {
  containerRef: RefObject<HTMLDivElement>;
  fontSize: number;
  lineHeight: number;
}

export function lineHeightFor(fontPx: number): number {
  const t = (fontPx - MIN_FONT_PX) / (MAX_FONT_PX - MIN_FONT_PX);
  return 1.85 - 0.10 * Math.min(1, Math.max(0, t));
}

/** Ajuste directo sobre un elemento medible. Exportado para poder testearlo
    sin montar React ni depender de un layout real del navegador. */
export function computeFit(el: HTMLElement): number {
  const alto = el.clientHeight;
  const altoTexto = el.scrollHeight;
  if (alto <= 0) return MAX_FONT_PX;

  // Un parrafo que ya es corto se queda en el techo aunque la caja sea baja:
  // es preferible que scrollee a encogerlo (ver el piso de 13px).
  const lineas = altoTexto / MAX_FONT_PX / lineHeightFor(MAX_FONT_PX);
  if (lineas <= MAX_LINES) return MAX_FONT_PX;

  // Tamano al que el texto, medido al cuerpo maximo, entraria en MAX_LINES.
  // Unico clamp del archivo: por aca no sale ningun valor fuera de [13, 19].
  const objetivo = (MAX_LINES * lineHeightFor(MAX_FONT_PX) * alto) / altoTexto;
  const px = Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, objetivo));
  return px;
}

export function useAutoFitText(): AutoFitText {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const [fontSize, setFontSize] = useState(MAX_FONT_PX);

  const medir = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setFontSize(computeFit(el));
  }, []);

  useLayoutEffect(medir, [medir]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      rafRef.current = requestAnimationFrame(medir);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      // Un frame pendiente despues del desmontaje mediria un arbol muerto.
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [medir]);

  return { containerRef, fontSize, lineHeight: lineHeightFor(fontSize) };
}

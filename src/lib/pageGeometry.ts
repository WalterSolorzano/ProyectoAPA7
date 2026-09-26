/**
 * WordAPA7 — pageGeometry: traduce las reglas APA del documento (pt, cm)
 * a píxeles de hoja reales a 96 DPI. Única fuente de verdad de dimensiones
 * para el lienzo (fase 1 del motor de render híbrido: el canvas deja de
 * pintar una hoja genérica).
 *
 * Nota: valores en PÍXELES sin zoom — el zoom del lienzo se aplica encima.
 */
export const PX_PER_PT = 96 / 72;
export const PX_PER_CM = 96 / 2.54;
export const PT_TO_PX = (pt: number): number => pt * PX_PER_PT;
export const CM_TO_PX = (cm: number): number => cm * PX_PER_CM;

/** Tamaños de hoja en puntos (Word: Letter 8.5x11in, A4 210x297mm). */
const PAGE_PT: Record<string, { w: number; h: number }> = {
  letter: { w: 612, h: 792 },
  a4: { w: 595, h: 842 },
};

export interface PageGeometry {
  /** Ancho de hoja en px (sin zoom). */
  pageW: number;
  /** Alto de hoja en px (sin zoom). */
  pageH: number;
  /** Margen uniforme en px (Word: mismo valor en los 4 lados). */
  marginPx: number;
  /** Ancho útil = pageW - 2 * marginPx. */
  contentW: number;
  /** Alto útil = pageH - 2 * marginPx - headerH. */
  contentH: number;
  /** Alto de línea base = font_size_pt * line_spacing (px). */
  lineHeightPx: number;
  /** Alto reservado al encabezado APA de página (px). */
  headerH: number;
}

export function getPageGeometry(rules: {
  margins_cm?: number;
  font_size_pt?: number;
  line_spacing?: number;
  page_size?: string;
  professional_running_head?: boolean;
}): PageGeometry {
  const sizeKey = String(rules.page_size || 'letter').toLowerCase().includes('a4')
    ? 'a4'
    : 'letter';
  const { w, h } = PAGE_PT[sizeKey];
  const pageW = PT_TO_PX(w);
  const pageH = PT_TO_PX(h);
  const marginPx = CM_TO_PX(rules.margins_cm ?? 2.54);
  const fontPx = PT_TO_PX(rules.font_size_pt ?? 12);
  const spacing = rules.line_spacing ?? 2;
  // Encabezado APA: 2 líneas base (running head + espacio), 2.5 si es profesional.
  const headerH = rules.professional_running_head ? fontPx * 2.5 : fontPx * 2;
  return {
    pageW,
    pageH,
    marginPx,
    contentW: pageW - marginPx * 2,
    contentH: pageH - marginPx * 2 - headerH,
    lineHeightPx: fontPx * spacing,
    headerH,
  };
}

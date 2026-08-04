/* WordAPA7 — Chistes de estudiante (contextuales).
 * Categorías que se disparan por contexto real:
 *  - Nombre de archivo (al subir): detecta "final", "definitivo", "v3"…
 *  - Racha / reincidencia (segundo documento en la sesión).
 *  - Tamaño del documento (páginas / figuras / tablas).
 *  - Hora / temporada (madrugada, domingo a la noche).
 * Los mensajes van SIN emojis: son UI de sistema, no comentarios.
 */

// ── Nombre de archivo ────────────────────────────────────────────────────────

const FILENAME_PATTERN_RE = /(final|definitiv|ultim|_v\d|entrega|\bv2\b|\bv3\b|\b(?:^|_|-)final\b)/i;

const FILENAME_JOKES: string[] = [
  'el clásico de todo estudiante: "final" y una versión más.',
  'ya perdimos la cuenta de cuántos "final" llevás en el nombre.',
  '"definitivo"... por ahora.',
  'esa nomenclatura de archivo ya es parte del folklore universitario.',
  'entre "final" y "FINAL_v3" seguro hubo varias noches sin dormir.',
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Detector del nombre: devuelve un chiste si parece "versión final eterna". */
export function getFilenameComment(fileName: string): string | null {
  const base = (fileName || '').replace(/\.(docx|doc)$/i, '');
  if (!FILENAME_PATTERN_RE.test(base)) return null;
  return FILENAME_JOKES[hashStr(base) % FILENAME_JOKES.length];
}

// ── Racha / reincidencia (por sesión) ────────────────────────────────────────

const REPEAT_JOKES: string[] = [
  'otra vez por acá... ¿cuántos trabajos tenés pendientes?',
  'segundo documento en la sesión. La productividad te respeta.',
  'ya van varios por hoy... ¿estamos armando una tesis o un expediente?',
];

/** Incrementa el contador de la sesión y devuelve un chiste si es reincidencia. */
export function getRepeatComment(): string | null {
  let count = Number(sessionStorage.getItem('wordapa7-uploads') || '0');
  count += 1;
  sessionStorage.setItem('wordapa7-uploads', String(count));
  if (count < 2) return null;
  return REPEAT_JOKES[Math.min(count - 2, REPEAT_JOKES.length - 1)];
}

// ── Tamaño del documento ─────────────────────────────────────────────────────

/** Reacción al volumen real del documento. Retorna null si no hay nada llamativo. */
export function getSizeComment(pageCount: number, figureCount: number, tableCount: number): string | null {
  if (pageCount >= 150) return 'esto ya es tesis, no trabajo.';
  if (pageCount >= 100) return 'esto no es un trabajo, es una novela.';
  if (pageCount > 0 && pageCount <= 2) return 'directo al grano, así me gusta.';
  if (figureCount + tableCount >= 30) return 'documento bien ilustrado, eh.';
  return null;
}

// ── Hora / temporada ─────────────────────────────────────────────────────────

/** Detecta franjas típicas de entrega (madrugada, domingo a la noche). */
export function getTimeOfWeekComment(now: Date = new Date()): string | null {
  const h = now.getHours();
  const day = now.getDay();
  const lateNight = h >= 1 && h < 5;
  const sundayNight = day === 0 && h >= 18;
  if (lateNight) return 'madrugada y todavía formateando... el horario sagrado de las entregas.';
  if (sundayNight) return 'domingo a la noche... el horario sagrado de las entregas.';
  return null;
}

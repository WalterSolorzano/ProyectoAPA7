/* WordAPA7 — Shared portada author helpers.
   Single source of truth for parsing/serializing the author list so the
   preview and the author panel never diverge (Corrección 3: no mirror form).
*/

export interface AuthorEntry {
  nombre: string;
  carnet: string;
}

export function parseAuthorEntries(raw: string | undefined | null): AuthorEntry[] {
  if (!raw) return [];
  const entries: AuthorEntry[] = [];
  // Formato actual del parser: "Br. Nombre Apellido | Carnet: 2023-XXXX" por línea
  // o dos líneas "Br. Nombre" + "Carnet: 2023-XXXX".
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let pendingName = '';
  for (const line of lines) {
    if (line.toLowerCase().startsWith('carnet:') || /^\d{4}-\d+/.test(line)) {
      const carnet = line.replace(/^carnet:\s*/i, '').trim();
      if (pendingName) {
        entries.push({ nombre: pendingName, carnet });
        pendingName = '';
      } else if (entries.length > 0) {
        entries[entries.length - 1].carnet = carnet;
      }
      continue;
    }
    const pipe = line.split('|');
    if (pipe.length >= 2) {
      const nombre = pipe[0].trim();
      const carnetPart = pipe.slice(1).join('|').trim().replace(/^carnet:\s*/i, '');
      entries.push({ nombre, carnet: carnetPart });
      continue;
    }
    pendingName = line;
  }
  if (pendingName) entries.push({ nombre: pendingName, carnet: '' });

  // Dedupe duro: mismo carnet O mismo nombre normalizado = misma persona.
  // (Los textboxes duplicados del original llegan dos veces — bug reportado.)
  const seenCarnets = new Set<string>();
  const seenNames = new Set<string>();
  return entries.filter((e) => {
    const nameKey = e.nombre.toLowerCase().replace(/\s+/g, ' ').trim().replace(/^(br|ing|lic|m\.sc|sr|sra)\.?\s+/i, '');
    const carnetKey = (e.carnet || '').toLowerCase().replace(/\s+/g, '');
    if (carnetKey && seenCarnets.has(carnetKey)) return false;
    if (!carnetKey && seenNames.has(nameKey)) return false;
    if (carnetKey) seenCarnets.add(carnetKey);
    if (!carnetKey && !seenNames.has(nameKey)) seenNames.add(nameKey);
    return true;
  });
}

export function serializeAuthorEntries(entries: AuthorEntry[]): string {
  return entries.map((a) => (a.carnet ? `${a.nombre} | Carnet: ${a.carnet}` : a.nombre)).join('\n');
}

/* ── Highlight sync preview <-> author panel ──────────────────────────────── */

export const COVER_AUTHOR_HIGHLIGHT_EVENT = 'wordapa7:cover-highlight-author';

export function requestAuthorHighlight(index: number): void {
  window.dispatchEvent(
    new CustomEvent(COVER_AUTHOR_HIGHLIGHT_EVENT, { detail: { index } })
  );
}

/* ── Highlight sync preview <-> portada field (Título, Curso, Fecha...) ──── */

export const COVER_FIELD_HIGHLIGHT_EVENT = 'wordapa7:cover-highlight-field';

/** Dispara el highlight azul de ~1s sobre un campo en la hoja de portada. */
export function requestCoverFieldHighlight(field: string): void {
  window.dispatchEvent(
    new CustomEvent(COVER_FIELD_HIGHLIGHT_EVENT, { detail: { field } })
  );
}

/* ── Classification confidence helper (Corrección 2) ─────────────────────── */

export const CONFIDENCE_REVIEW_THRESHOLD = 0.85;

export function needsReview(e: {
  confidence: number;
  needs_review?: boolean;
  is_user_modified?: boolean;
}): boolean {
  if (e.is_user_modified) return false;
  return Boolean(e.needs_review) || e.confidence < CONFIDENCE_REVIEW_THRESHOLD;
}

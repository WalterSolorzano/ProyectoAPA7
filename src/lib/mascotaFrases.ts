/* WordAPA7 — voz de la mascota en las dos salas.
   Determinista por seed (nada de Math.random): la misma sección dice la misma
   frase entre renders, y por eso es testeable. Sin emojis (AGENTS.md §1). */

export type BandaRevision = 'solida' | 'buena' | 'media' | 'baja';
export type BandaIA = 'bajo' | 'medio' | 'alto';

/** Banda de color del % de revisión: verde ≥90 · azul 80–89 · ámbar 60–79 · rojo <60. */
export function bandaRevision(score: number): BandaRevision {
  if (score >= 90) return 'solida';
  if (score >= 80) return 'buena';
  if (score >= 60) return 'media';
  return 'baja';
}

/** Banda de frase de IA, alineada a `BANDAS_IA` (cortes 20/50/75). <20 no habla. */
export function bandaFraseIA(score: number): BandaIA | null {
  if (score >= 75) return 'alto';
  if (score >= 50) return 'medio';
  if (score >= 20) return 'bajo';
  return null;
}

export function colorDeRevision(score: number): string {
  switch (bandaRevision(score)) {
    case 'solida': return 'var(--color-success)';
    case 'buena': return 'var(--color-accent)';
    case 'media': return 'var(--color-warning)';
    default: return 'var(--color-danger)';
  }
}

export const frasesRevision: Record<BandaRevision, readonly string[]> = {
  solida: ['Esto está sólido, sigue así.'],
  buena: ['Vas bien, pero hay tela que cortar.'],
  media: ['Esto pide una pasada en serio.'],
  baja: ['Así no lo entregues.'],
};

export const frasesIA: Record<BandaIA, readonly string[]> = {
  bajo: ['Hay un poco de IA en tu párrafo.'],
  medio: ['Hay un poco de párrafo en tu IA.'],
  alto: ['Lo copiaste tal cual, hermano.'],
};

/** Estado del analizador de objetivos. Cada combinación real de fallas habla
 *  distinto: no es lo mismo que falle el ancla, que la jerarquía o la variable. */
export type EstadoObjetivos =
  | 'sin_objetivos'
  | 'sin_general'
  | 'todo_cumple'
  | 'general_falla'
  | 'jerarquia_rota'
  | 'sin_variable'
  | 'dos_verbos'
  | 'verbo_vago'
  | 'nivel_bajo';

export const frasesObjetivos: Record<EstadoObjetivos, readonly string[]> = {
  sin_objetivos: [
    'Todavía no veo objetivos en el documento.',
    'Sin objetivos no hay brújula. Escribí el general y sus específicos.',
  ],
  sin_general: [
    'Hay específicos, pero les falta el ancla: el objetivo general.',
    'Sin objetivo general, los específicos flotan sin jerarquía.',
  ],
  todo_cumple: [
    'Objetivos sólidos: verbo medible y variable a la vista.',
    'El ancla y sus específicos están en nivel. Nada que corregir.',
    'Así se escribe: un verbo medible por objetivo y su variable.',
  ],
  general_falla: [
    'El objetivo general no aguanta el nivel: empezá por ahí.',
    'Si el ancla floja, todo lo que cuelga de ella también.',
  ],
  jerarquia_rota: [
    'Un específico apunta más alto que el general. Ajustá la jerarquía.',
    'Los específicos no pueden superar al ancla: revisá el nivel.',
  ],
  sin_variable: [
    'Falta el objeto de estudio: sin variable, el verbo no se mide.',
    'Un verbo sin variable es una promesa sin forma de comprobarla.',
  ],
  dos_verbos: [
    'Un objetivo, un verbo rector. Soltá el segundo.',
    'Dos verbos en un objetivo es hacer dos tareas a medias.',
  ],
  verbo_vago: [
    '«Conocer» no se mide: ni tú sabés cuándo terminaste.',
    'Ese verbo no deja huella comprobable. Cambialo por uno medible.',
  ],
  nivel_bajo: [
    'El verbo arranca por debajo del nivel que exige la rúbrica.',
    'Subí el verbo a Analizar o más: compréndelo, no lo describas.',
  ],
};

/** FNV-1a: hash estable de string a índice. Sin azar, sin dependencias. */
function indiceEstable(seed: string, largo: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % Math.max(1, largo);
}

export function fraseDeRevision(score: number, seed = 'doc'): string {
  const lista = frasesRevision[bandaRevision(score)];
  return lista[indiceEstable(seed, lista.length)];
}

export function fraseDeIA(score: number, seed = 'doc'): string {
  const banda = bandaFraseIA(score);
  if (banda === null) return '';
  const lista = frasesIA[banda];
  return lista[indiceEstable(seed, lista.length)];
}

/** Frase de la mascota en el analizador de objetivos, por estado derivado. */
export function fraseDeObjetivos(estado: EstadoObjetivos, seed = 'objetivos'): string {
  const lista = frasesObjetivos[estado];
  return lista[indiceEstable(seed, lista.length)];
}

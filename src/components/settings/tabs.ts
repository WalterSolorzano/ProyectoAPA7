/* WordAPA7 — el catálogo de las cinco pestañas de Ajustes.
 *
 * Este archivo es la respuesta a la pregunta "este ajuste, ¿de quién es?". La
 * respuesta es `ambito`, y por eso vive en la PESTAÑA y no repetido en cada
 * control: dos ajustes de la misma pestaña que escribe en lugares distintos son
 * un defecto, no una excepción.
 *
 * La promesa que hace esta tabla —"Documento y Formato viajan con el documento,
 * Conexión, Revisión y App valen para toda la app"— no está sostenida por este
 * texto: la sostiene `src/__tests__/ambitoDeAjustes.test.ts`. Si mañana alguien
 * mete un ajuste de documento en la pestaña Conexión, ese test se cae.
 */
import type { MascotKind } from '../layout/EditorialMascot';

/** Si el ajuste viaja con el documento o con la app. */
export type AmbitoAjuste = 'documento' | 'app';

export type PestanaId = 'documento' | 'formato' | 'conexion' | 'revision' | 'app';

export interface Pestana {
  id: PestanaId;
  etiqueta: string;
  /** Si el ajuste viaja con el documento o con la app. NO es decorativo:
   *  `ambitoDeAjustes.test.ts` falla si un control de una pestaña de `documento`
   *  escribe en localStorage, o al revés. */
  ambito: AmbitoAjuste;
  /** Una línea, en palabras. Se escribe UNA vez por pestaña, no por control. */
  subtitulo: string;
  /** De la familia `EditorialMascot`. El kind se RESUELVE en `mascotDePestana`
   *  antes de dibujarse, así que un kind sin dibujo no deja la mascota en
   *  blanco. */
  mascotKind: MascotKind;
}

export const PESTANAS: Pestana[] = [
  { id: 'documento', etiqueta: 'Documento', ambito: 'documento', mascotKind: 'reference',
    subtitulo: 'Estos ajustes se guardan con el documento. No cambian los demás que tengas abiertos.' },
  { id: 'formato', etiqueta: 'Formato', ambito: 'documento', mascotKind: 'ruler',
    subtitulo: 'Estos ajustes se guardan con el documento. No cambian los demás que tengas abiertos.' },
  { id: 'conexion', etiqueta: 'Conexión', ambito: 'app', mascotKind: 'highlighter',
    subtitulo: 'Estos ajustes valen para toda la app, en todos tus documentos.' },
  { id: 'revision', etiqueta: 'Revisión', ambito: 'app', mascotKind: 'strike',
    subtitulo: 'Estos ajustes valen para toda la app, en todos tus documentos.' },
  /* `reference` también para App, como pide el plan. La Fase 6 le da un kind
   * propio (`gear`) dibujado en `EditorialMascot.tsx`, que es un archivo que hoy
   * es trabajo sin commitear de otra sesión: mientras tanto se reusa uno que sí
   * está dibujado en vez de apuntar a un kind que no existe. */
  { id: 'app', etiqueta: 'App', ambito: 'app', mascotKind: 'reference',
    subtitulo: 'Estos ajustes valen para toda la app, en todos tus documentos.' },
];

export const PESTANA_POR_DEFECTO: PestanaId = 'documento';

/** Busca una pestaña por id. Devuelve la primera si el id no está en el catálogo,
 *  para que un id desconocido no deje la pantalla sin barra de pestañas. */
export function pestanaPorId(id: string | undefined): Pestana {
  return PESTANAS.find((p) => p.id === id) || PESTANAS[0];
}

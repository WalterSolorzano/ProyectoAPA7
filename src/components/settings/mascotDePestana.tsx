/* WordAPA7 — qué cara pone la mascota de cada pestaña.
 *
 * La expresión sale del ESTADO, no del decorado. El caso que lo pide: la
 * pestaña Conexión sin ninguna clave puesta no puede mostrar trece campos
 * vacíos; tiene que decirlo, y la forma de decirlo es la cara preocupada.
 *
 * Mitad de la Fase 6: acá está el mapeo y sus pruebas. La Fase 6 agrega el kind
 * `gear` a `EditorialMascot.tsx` y la Specialización por pestaña.
 */
import type { MascotExpression, MascotKind } from '../layout/EditorialMascot';
import type { Pestana } from './tabs';

export interface EstadoDePestana {
  /** Cuántas claves de proveedor hay puestas. El VALOR de la clave no viaja
   *  hasta acá: la función solo necesita saber si hay. */
  clavesDeProveedor: number;
  /** Si el autor eligió un proveedor. Hoy se detecta por cuál clave está puesta;
   *  la Fase 2 lo vuelve elegible, y esta bandera pasa a leer esa elección. */
  proveedorElegido: boolean;
  /** Hallazgos ya resueltos en este documento. */
  hallazgosResueltos: number;
}

/** Los kinds que `EditorialMascot` sabe DIBUJAR hoy. Un kind que esté en el
 *  union type pero no en esta tabla no falla: cae en `KIND_SIN_DIBUJO`. La Fase
 *  6 suma `gear`; si el SVG todavía no estuviera, la mascota quedaría en blanco
 *  sin avisar, y un blanco no se ve. */
const KIND_DIBUJADO: Record<string, MascotKind> = {
  highlighter: 'highlighter',
  ruler: 'ruler',
  reference: 'reference',
  strike: 'strike',
};

export const KIND_SIN_DIBUJO: MascotKind = 'reference';

/** El kind que se dibuja, que no es siempre el kind que pide la pestaña. */
export function kindDePestana(mascotKind: MascotKind): MascotKind {
  return KIND_DIBUJADO[mascotKind] || KIND_SIN_DIBUJO;
}

/**
 * La cara de la mascota de una pestaña. La firma recibe la pestaña porque cada
 * una lee su propio estado; hoy las cuatro reglas son las mismas para todas y
 * la Fase 6 las especializa.
 */
export function expresionDePestana(
  _pestana: Pestana,
  estado: EstadoDePestana,
): MascotExpression {
  if (estado.clavesDeProveedor === 0) return 'worried';
  if (!estado.proveedorElegido) return 'curious';
  if (estado.hallazgosResueltos > 0) return 'happy';
  return 'neutral';
}

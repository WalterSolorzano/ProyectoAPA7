/**
 * El cielo de Inicio no tiene personajes de dibujos.
 *
 * La Task 1 sacó la carita del sol. Quedaban cuatro cosas que son del mismo
 * registro y del mismo tamaño: un OVNI, un GLOBO AEROSTÁTICO, un AVIÓN DE PAPEL
 * y un RAYO con cara de nube. Un personaje animado no se vuelve cinematográfico
 * poniéndole otra forma: o es geometría o no es nada.
 *
 * El criterio de la línea, y por qué no es "todo lo que se mueve":
 *
 *   - La ESTRELLA FUGAZ y el SATÉLITE se quedan. Son geometría pura —una línea y
 *     un punto, un cuerpo con dos alas rectas— y se leen como luz. No tienen
 *     intención y por eso no se les atribuya una.
 *   - El ovni tiene una cabina y un borde, el globo tiene una cesta, el avión de
 *     papel tiene un pliegue, y el rayo tiene una nube con gesto. Todos son
 *     objetos con intención. Todos son el mismo error.
 *
 * La luna y las nubes se quedan: no son personajes, son cielo.
 *
 * Estas pruebas leen el archivo en vez de montar el componente, y eso es
 * deliberado: `drawUFO` no se puede observar desde afuera sin dibujar un
 * fotograma de cada banda horaria, y una prueba que tiene que liarse con eso
 * deja de ser una prueba. Lo que se verifica aquí es una decisión de diseño —
 * qué está escrito en el archivo— y no un comportamiento observable, así que se
 * lee el archivo.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fuente = readFileSync(
  resolve(__dirname, '../components/layout/HomeHero.tsx'),
  'utf8',
);

describe('el cielo no tiene personajes', () => {
  it('no queda ni un personaje de dibujos en el archivo', () => {
    /* Cada uno de estos es un objeto con intención dibujado en el fondo de la
       pantalla de inicio de una herramienta de tesis. */
    for (const personaje of [
      'drawUFO',
      'drawHotAirBalloon',
      'drawPaperAirplane',
      'drawLightningCloud',
    ]) {
      expect(fuente, `${personaje} sigue en HomeHero.tsx`).not.toContain(personaje);
    }
  });

  it('no queda ni el nombre del tipo en el estado', () => {
    /* No alcanza con borrar las funciones: si `'ufo'` sigue en el tipo de
       `EasterEggState` o en el `switch`, el código muerto sigue siendo código,
       y el próximo que lea el archivo cree que hay un ovni en algún lado. */
    for (const nombre of ["'ufo'", "'balloon'", "'plane'", "'lightning'"]) {
      expect(fuente, `${nombre} sigue en el estado del huevo`).not.toContain(nombre);
    }
  });

  it('lo que queda es luz, no gente', () => {
    /* La estrella fugaz y el satélite se leen como luz y se quedan. Si mañana
       caen también, el cielo queda sin nada que mirar y la pregunta es si
       entonces el canvas sirve. */
    expect(fuente).toContain('drawShootingStar');
    expect(fuente).toContain('drawSatellite');
  });

  it('el cielo sigue teniendo luna y nubes', () => {
    /* Quitar personajes no es vaciar el cielo. La luna y las nubes son
       estructura, y un cielo sin ellas es un rectángulo con un sol. */
    expect(fuente).toContain('drawCrescentMoon');
    expect(fuente).toContain('drawFluffyCloud');
  });
});

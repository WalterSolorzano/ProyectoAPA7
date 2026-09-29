/**
 * La guarda de la fase: ningún nodo de la estructura tiene su nombre fuera de
 * pantalla, y el mapa noossa ninguna librería de grafo.
 *
 * POR QUÉ ES UNA GUARDA Y NO UNA PRUEBA MÁS. El defecto del que protege ya
 * ocurrió: en el mosaico de la revisión, el nombre de la sección iba al `title`
 * de hover y dentro del botón no había nada más que un porcentaje. Veinte
 * bloques sin nombre y con una cifra no son un mapa. La regla se escribe
 * cuando el defecto está fresco, porque en dos años nadie la va a romper a
 * propósito: alguien la va a romper por descuido, en un commit que "solo"
 * agrega un dato más.
 *
 * Y SE LEE EL CÓDIGO, NO EL DOM. Un DOM se puede montar con un nombre puesto en
 * el lugar correcto mientras el fuente lo pone en el `title` y lo borra después;
 * lo que se vigila aquí es la línea que escribe el nombre, que es donde la
 * volverían a escribir.
 *
 * La fuente se lee con `?raw` y no con `node:fs`: el shim de `nodePolyfills()` de
 * vite resuelve `readFileSync` a un stub de browser. Con un `.tsx` el `?raw`
 * funciona; con un `.css` NO —el runner tiene `css: false` y devuelve la cadena
 * vacía—, y por eso la rampa de `--ia-nivel-*` se prueba en `aiMosaic.test.ts`
 * con el import dinámico que ya usa el repo.
 */

import { describe, it, expect } from 'vitest';

const FUENTES = import.meta.glob('../components/structure/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('la estructura no miente', () => {
  it('la guarda tiene archivos que mirar', () => {
    /* Sin esta cuenta, un `glob` que no matchea nada hace que las dos pruebas de
     * abajo pasen sin mirar un solo archivo: es el modo de fallo más barato que
     * tiene una guarda de código. */
    expect(Object.keys(FUENTES).length).toBeGreaterThanOrEqual(5);
  });

  it('ningún nodo de la estructura tiene su nombre fuera de pantalla', () => {
    /* Ni en el `title`, ni en el `aria-label`, ni en un hover: EN PANTALLA. Un
     * nombre que solo vive en un `title` es un nombre que no existe. */
    for (const [ruta, fuente] of Object.entries(FUENTES)) {
      expect(fuente, `${ruta}: un nombre solo en el title`).not.toMatch(/title=\{[^}]*label/i);
      expect(fuente, `${ruta}: un nombre solo en el aria-label`).not.toMatch(
        /aria-label=\{[^}]*label/i,
      );
    }
  });

  it('el mapa pinta el nombre de cada nodo, no solo lo esconde en un <title>', () => {
    /* La otra forma del mismo defecto: en SVG el nombre íntegro va en el
     * elemento `<title>`, que es un hover. Si el `<text>` desaparece, el mapa
     * queda con veinte cajas numeradas y ningún nombre. */
    const mapa = FUENTES['../components/structure/MapaEstructura.tsx'];
    expect(mapa, 'el mapa no está entre los fuentes').toBeTruthy();
    expect(mapa).toMatch(/<text/);
    expect(mapa).toMatch(/\{\s*n\.etiqueta\s*\}/);
  });

  it('el mapa no usa ninguna librería de grafo', async () => {
    /* Si aparece una, es porque alguien decidió que dibujar cajas era difícil.
     * No lo es. */
    const pkg = await import('../../package.json?raw');
    for (const dep of ['reactflow', 'dagre', 'elkjs', 'cytoscape', 'mermaid', 'vis-network']) {
      expect(pkg.default, `el mapa no puede depender de ${dep}`).not.toContain(dep);
    }
  });
});

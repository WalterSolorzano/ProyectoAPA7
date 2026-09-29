/**
 * El mapa de la estructura: SVG escrito a mano, y con el nombre DENTRO.
 *
 * Lo que se prueba acá no es que se vea bonito. Es lo mismo que se probó del
 * `AiMosaic` y que salió mal: un nodo cuyo nombre solo existe en el `title` es
 * un nodo sin nombre. Con veinte nodos y un hover, eso es un mapa que no se
 * puede leer, y el nombre tiene que estar EN PANTALLA aunque se recorte.
 *
 * Y el layout es ARITMÉTICA, no una librería. El árbol por niveles son tres
 * cuentas, y una dependencia de 300 kB para dibujar cuarenta cajas es un mal
 * negocio.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import {
  MapaEstructura,
  posicionesDe,
  etiquetaCortada,
  ANCHO_NODO,
  ALTO_NODO,
} from '../components/structure/MapaEstructura';
import { construirJerarquia } from '../lib/jerarquia';
import type { ElementModel } from '../types';

let secuencia = 0;
const el = (o: Partial<ElementModel> & { type: ElementModel['type']; text: string }): ElementModel =>
  ({
    id: `e${++secuencia}`,
    style_name: '',
    alignment: 'left',
    font_name: 'Times New Roman',
    font_size: 12,
    is_bold: false,
    is_italic: false,
    is_bullet: false,
    left_indent_cm: 0,
    confidence: 1,
    is_user_modified: false,
    cita_ids: [],
    needs_review: false,
    auto_applied: false,
    ...o,
  }) as ElementModel;

const h1 = (t: string): ElementModel => el({ type: 'heading', heading_level: 1, text: t });
const h2 = (t: string): ElementModel => el({ type: 'heading', heading_level: 2, text: t });
const parrafo = (n: number): ElementModel =>
  el({ type: 'paragraph', text: Array.from({ length: n }, (_, i) => `w${i}`).join(' ') });

const ARBOL = construirJerarquia([
  h1('1. Introducción'),
  parrafo(1200),
  h1('2. Metodología del estudio sobre la implementación de un sistema'),
  h2('2.1 Instrumentos'),
  parrafo(300),
  h1('3. Resultados'),
  parrafo(80),
]);

describe('el layout del mapa es aritmética, no una librería', () => {
  it('un nodo por encabezado, y solo encabezados', () => {
    const pos = posicionesDe(ARBOL);
    expect(pos).toHaveLength(4);
    expect(pos.map((p) => p.nivel)).toEqual([1, 1, 2, 1]);
  });

  it('el nivel manda la columna y el orden manda la fila', () => {
    const pos = posicionesDe(ARBOL);
    const h1s = pos.filter((p) => p.nivel === 1);
    /* Un árbol por niveles: la columna es la profundidad y las filas van en el
     * orden del documento, que es la memoria espacial que tiene la persona. */
    expect(new Set(h1s.map((p) => p.x)).size).toBe(1);
    expect(h1s[0].y).toBeLessThan(h1s[1].y);
    expect(h1s[1].y).toBeLessThan(h1s[2].y);
    const h2 = pos.find((p) => p.nivel === 2)!;
    expect(h2.x).toBeGreaterThan(h1s[0].x);
  });

  it('una hoja y su padre no se pisan: el padre queda entre sus hijas', () => {
    /* La cuenta del árbol es "el padre va al promedio de sus hijas". Sin eso,
     * un padre con dos hijas queda pegado a una de las dos y el mapa se lee
     * como si la rama tuviera una sola hoja. */
    const arbol = construirJerarquia([
      h1('1. Introducción'),
      parrafo(10),
      h1('2. Metodología'),
      h2('2.1 Instrumentos'),
      h2('2.2 Muestra'),
      parrafo(10),
    ]);
    const pos = posicionesDe(arbol);
    const padre = pos.find((p) => p.nodo.id === arbol[1].id)!;
    const hijas = pos.filter((p) => p.nivel === 2);
    expect(hijas.length).toBe(2);
    expect(padre.y).toBeGreaterThan(Math.min(...hijas.map((h) => h.y)));
    expect(padre.y).toBeLessThan(Math.max(...hijas.map((h) => h.y)));
  });

  it('la etiqueta se recorta con elipsis, y el entero se conserva', () => {
    const largo = etiquetaCortada('2. Metodología del estudio sobre la implementación de un sistema');
    expect(largo.endsWith('…')).toBe(true);
    expect(largo.length).toBeLessThan('2. Metodología del estudio sobre la implementación de un sistema'.length);
    /* Y un nombre corto no se toca: recortarlo por prudencia sería tirar
     * información sin motivo. */
    expect(etiquetaCortada('2. Metodología')).toBe('2. Metodología');
  });
});

describe('el mapa dibujado', () => {
  it('todo nodo tiene su etiqueta DENTRO, no en el hover', () => {
    /* La regla dura. El bug del `AiMosaic` fue exactamente esto: el nombre iba
     * al `title` y dentro del botón había un porcentaje. */
    const { container } = render(<MapaEstructura raices={ARBOL} />);
    const grupos = container.querySelectorAll('g[data-nodo]');
    expect(grupos.length).toBe(4);
    for (const g of grupos) {
      const texto = g.querySelector('text')?.textContent ?? '';
      expect(texto.length, 'un nodo sin nombre en pantalla').toBeGreaterThan(0);
    }
    expect(container.textContent).toContain('1. Introducción');
    expect(container.textContent).toContain('2.1 Instrumentos');
  });

  it('el texto íntegro del nombre recortado queda en el title del nodo', () => {
    const { container } = render(<MapaEstructura raices={ARBOL} />);
    const titulos = [...container.querySelectorAll('title')].map((t) => t.textContent);
    expect(titulos.some((t) => (t || '').includes('sistema'))).toBe(true);
  });

  it('el conteo de hijos acompaña al nodo, para que se sepa que hay más', () => {
    const { container } = render(<MapaEstructura raices={ARBOL} />);
    expect(container.textContent).toMatch(/\+/);
  });

  it('es SVG, y no una capa flotante encima del contenido', () => {
    /* El mapa es un toggle DENTRO de la vista de índice. Nunca tapa nada: una
     * capa que se superpone al contenido se lee como un estorbo, que es
     * exactamente lo que pidió el usuario al pedir sacarla. */
    const { container } = render(<MapaEstructura raices={ARBOL} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    /* `className` en un `<svg>` sale como `class` en el DOM: la marca de
     * "esto es una ilustración y no un ícono de lucide". */
    expect(svg!.getAttribute('class')).toBeTruthy();
    const estilo = svg!.getAttribute('style') || '';
    expect(estilo).not.toMatch(/position:\s*fixed|position:\s*absolute/);
  });

  it('sin nodos, el hueco se dice y no se dibuja un svg vacío', () => {
    const { container } = render(<MapaEstructura raices={[]} />);
    expect(container.querySelector('svg')).toBeNull();
    expect(screen().textContent).toMatch(/no hay nodos/i);
  });
});

/* El texto del contenedor, que `render` no devuelve en esta versión. */
function screen() {
  return document.body;
}

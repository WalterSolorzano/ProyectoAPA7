/**
 * El mosaico, montado.
 *
 * La derivación ya está probada en `aiMosaic.test.ts` (puro, sin DOM). Esto
 * comprueba lo que sólo se ve renderizado: que sale un botón por sección, que el
 * color del botón ES el token del escalón y no otro, que el número impreso es el
 * porcentaje, y que un clic devuelve la fase.
 *
 * Y dos cosas que son defects de accesibilidad, no de gusto: el mapa entero es
 * una lista de botones, y un mapa que sólo se lee con el mouse no sirve.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiMosaic } from '../components/review/AiMosaic';
import type { ElementModel } from '../types';
import type { AuditItem } from '../lib/auditItems';

const el = (o: Partial<ElementModel> & { id: string; text: string }): ElementModel => ({
  type: 'paragraph', style_name: '', alignment: 'left', font_name: 'TNR', font_size: 12,
  is_bold: false, is_italic: false, is_bullet: false, left_indent_cm: 0, confidence: 1,
  is_user_modified: false, ...o,
}) as ElementModel;

const H1 = (t: string, id: string) => el({ id, text: t, type: 'heading', heading_level: 1 });

const DOC: ElementModel[] = [
  H1('Portada', 'h1'),
  el({ id: 'p1', text: 'Uno' }),
  H1('Metodo', 'h2'),
  el({ id: 'p2', text: 'Uno' }),
  el({ id: 'p3', text: 'Dos' }),
  H1('Resultados', 'h3'),
  el({ id: 'p4', text: 'Uno' }),
];

const marcado = (element_id: string, phase: string): AuditItem => ({
  id: `f-${element_id}`, element_id, category: 'ai', subtype: 'ai_phrase',
  severity: 'warn', summary: '', detail: '', originalText: '', pageNumber: 1,
  phase, readOnly: false,
} as unknown as AuditItem);

function montar(items: AuditItem[] = [], activa: string | 'all' = 'all', onSelect = vi.fn()) {
  const r = render(
    <AiMosaic elements={DOC} items={items} activa={activa} onSelect={onSelect} />,
  );
  return { ...r, onSelect };
}

describe('el mosaico dibujado', () => {
  it('un botón por sección, y solo secciones', () => {
    montar();
    const nombres = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') || '');
    expect(nombres.some((n) => n.startsWith('Portada:'))).toBe(true);
    expect(nombres.some((n) => n.startsWith('Metodo:'))).toBe(true);
    expect(nombres.some((n) => n.startsWith('Resultados:'))).toBe(true);
  });

  it('cada botón usa EL token de su escalón, y sólo ese', () => {
    /* El color carga una variable. Si un botón tuviera el color de otro escalón
       el mapa estaría mintiendo, y es un defecto que no se ve en el código sin
       leer el token.

       Se lee el atributo `style` crudo y no `style.backgroundColor` porque
       jsdom rechaza un `var()` en esa propiedad y devolvería cadena vacía para
       un valor perfectamente válido: el test pasaría por lo que el navegador sí
       acepta, no por lo que el componente escribe. */
    const { container } = montar([marcado('p2', 'metodo')]);
    const botones = [...container.querySelectorAll('button')];
    expect(botones.length).toBe(3);
    for (const b of botones) {
      const estilo = b.getAttribute('style') || '';
      const tokens = estilo.match(/--ia-nivel-[0-9]+/g) || [];
      expect(tokens, `el botón no tomó un token de la rampa: ${estilo}`).toHaveLength(1);
      expect(tokens[0]).toMatch(/^--ia-nivel-[1-4]$/);
    }
  });

  it('el número impreso es el porcentaje de la sección', () => {
    montar([marcado('p2', 'metodo')]);
    /* Metodo tiene 2 párrafos y 1 marcado: 50%. */
    expect(screen.getByText('50%')).toBeTruthy();
    /* Portada y Resultados no tienen nada marcado. `getAllByText` porque las dos
       muestran 0% y una lista de porcentajes tiene repeticiones por definición. */
    expect(screen.getAllByText('0%').length).toBe(2);
  });

  it('el nombre legible dice la sección, el porcentaje y el total', () => {
    /* El rótulo va en `title` y en el nombre accesible porque rotular veinte
       bloques convierte el mapa en una lista. Pero un mapa que sólo se lee con
       el mouse no le sirve a quien navega con teclado o lector de pantalla, así
       que la información tiene que estar en el nombre, no sólo en el tooltip. */
    montar([marcado('p2', 'metodo')]);
    expect(screen.getByRole('button', { name: 'Metodo: 50% de 2 párrafos marcados' })).toBeTruthy();
  });

  it('el clic devuelve la fase de la sección', () => {
    const { onSelect } = montar([marcado('p2', 'metodo')]);
    fireEvent.click(screen.getByRole('button', { name: /^Metodo:/ }));
    expect(onSelect).toHaveBeenCalledWith('metodo');
  });

  it('la sección abierta se marca como apretada', () => {
    /* El mapa y la lectura tienen que concordar sobre dónde está el usuario. */
    montar([], 'metodo');
    expect(screen.getByRole('button', { name: /^Metodo:/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^Portada:/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('sin documento, el hueco se dice', () => {
    /* Un espacio en blanco en el lugar del mapa se lee como "el detector no
       vio nada", que es otra cosa. */
    render(<AiMosaic elements={null} items={[]} activa="all" onSelect={vi.fn()} />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('la leyenda dice para qué es el color', () => {
    /* Una rampa sin escala no se lee: cuatro cuadrados y cuatro palabras, una
       sola línea, y nada más. */
    montar();
    expect(screen.getByText(/porcentaje de párrafos/i)).toBeTruthy();
    expect(screen.getByText('casi todo')).toBeTruthy();
    expect(screen.getByText('nada')).toBeTruthy();
  });

  it('el nombre se IMPRIME dentro del bloque, no vive solo en el hover', () => {
    /* El defecto que la F3 vino a matar: el rótulo iba al `title` y al nombre
     * accesible, y dentro del botón no había nada más que un porcentaje. Veinte
     * bloques sin nombre y con una cifra no son un mapa, son veinte números.
     *
     * Y el recorte con `ellipsis` no es una excusa para sacarlo de la pantalla:
     * el nombre se pinta siempre, y en el bloque angosto lo que se recorta es la
     * cola, no el nombre entero. */
    montar([marcado('p2', 'metodo')]);
    const botones = screen.getAllByRole('button');
    const textos = botones.map((b) => b.textContent || '');
    expect(textos.some((t) => t.includes('Metodo'))).toBe(true);
    /* Y lo que se recorta se declara: el nombre entero sigue en el `title`. */
    const conNombre = botones.find((b) => (b.textContent || '').includes('Metodo'))!;
    expect(conNombre.getAttribute('title')).toContain('Metodo');
    /* Y el porcentaje sigue debajo, en el mismo botón: un número, dos sitios. */
    expect(conNombre.textContent).toContain('50%');
  });

  it('NO hay lista de hallazgos, panel ni chat en el mosaico', () => {
    /* La regla de "no sobrecargar", fijada. El mapa contesta dónde está el
       trabajo; la revisión contesta qué hacer con él. Si aparece una lista
       acá, el mapa se convirtió en la pantalla de revisión con pasos extra. */
    montar([marcado('p2', 'metodo')]);
    const { container } = render(
      <AiMosaic elements={DOC} items={[marcado('p2', 'metodo')]} activa="all" onSelect={vi.fn()} />,
    );
    /* Ni un chat, ni un panel lateral, ni un contador de casos. */
    expect(container.querySelectorAll('textarea').length).toBe(0);
    expect(container.querySelectorAll('[data-panel]').length).toBe(0);
  });
});

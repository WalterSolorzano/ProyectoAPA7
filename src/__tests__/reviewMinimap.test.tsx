/**
 * F1 · Task 4 — el minimapa se puede leer.
 *
 * El defecto NO era un color hardcodeado: el color salía de `ENGINE_META`, que son
 * tokens, y eso no es un defecto. El defecto era la FORMA: una columna de 19 px con
 * un botón de 4 px de alto, sin texto y sin leyenda, con `--border-subtle` sobre
 * `--sidebar-bg` en tema claro — un borde de 9% de negro sobre blanco, que en
 * pantalla es gris sobre blanco, y a 4 px de alto no es un símbolo: es un pelo.
 *
 * Estas pruebas fijan las dos mitades de la arreglada: que el color deje de ser el
 * ÚNICO portador del significado (el número y el motor van en el texto, en el
 * `aria-label` y en el `title`), y que la columna mida lo que tiene que medir para
 * que eso entre.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ReviewMinimap, type MinimapMark } from '../components/review/ReviewMinimap';

const ANCHO_ORIGINAL = window.innerWidth;
const fijarAncho = (px: number) =>
  Object.defineProperty(window, 'innerWidth', { value: px, configurable: true, writable: true });

const MARCA_IA: MinimapMark = {
  color: 'var(--color-danger)',
  count: 3,
  label: 'Detector & Calidad IA',
};
const MARCA_ORTOGRAFIA: MinimapMark = {
  color: 'var(--color-accent)',
  count: 1,
  label: 'Ortografía',
};

/** Monta el minimapa con las páginas que se le pidan. */
function montar(op: { paginas?: number; marcas?: Array<[number, MinimapMark]>; actual?: number; ancho?: number } = {}) {
  if (op.ancho) fijarAncho(op.ancho);
  const onPageClick = vi.fn();
  const { container } = render(
    <ReviewMinimap
      totalPages={op.paginas ?? 3}
      marks={new Map(op.marcas ?? [])}
      currentPage={op.actual ?? 1}
      onPageClick={onPageClick}
    />,
  );
  return { container, onPageClick, botones: Array.from(container.querySelectorAll('button')) };
}

afterEach(() => {
  cleanup();
  fijarAncho(ANCHO_ORIGINAL);
  vi.restoreAllMocks();
});

describe('ReviewMinimap — cada página se puede leer, no solo distinguir por color', () => {
  it('cada página lleva su NÚMERO en el texto, no solo en el title', () => {
    /* El defecto: botones de 4 px sin texto. Un control sin texto no se puede
       leer, no se puede traducir y no se puede buscar; el color era el único
       portador del significado, y el color es lo único que no sobrevive a un
       tema, a una impresión en gris o a quien no distingue. */
    const { botones } = montar({ paginas: 3 });
    expect(botones).toHaveLength(3);
    expect((botones[0].textContent ?? '').trim()).toBe('1');
    expect((botones[2].textContent ?? '').trim()).toBe('3');
  });

  it('cada página tiene un nombre accesible que dice página, total y hallazgos', () => {
    const { botones } = montar({ paginas: 3, marcas: [[2, MARCA_ORTOGRAFIA]] });
    for (const b of botones) expect(b.getAttribute('aria-label')).toBeTruthy();
    expect(botones[0].getAttribute('aria-label')).toBe('Página 1 de 3 de la revisión, 0 hallazgos');
    expect(botones[1].getAttribute('aria-label')).toBe('Página 2 de 3 de la revisión, 1 hallazgo, Ortografía');
  });

  it('el motor dominante se NOMBRA en el texto y en el title, no solo en el color', () => {
    /* Con el color como único portador, dos páginas con distinto motor y distinto
       tono eran indistinguibles para quien no distingue el tono. Con el nombre,
       el color pasa a ser un refuerzo. */
    const { botones } = montar({
      paginas: 2,
      marcas: [[1, MARCA_IA], [2, MARCA_ORTOGRAFIA]],
    });
    const etiquetas = botones.map((b) => `${b.textContent} ${b.getAttribute('aria-label')} ${b.getAttribute('title')}`).join(' ');
    expect(etiquetas).toMatch(/ortograf/i);
    expect(etiquetas).toMatch(/calidad ia/i);
  });

  it('la columna mide lo suficiente para que un número entre', () => {
    /* 19 px no alcanzan ni para el número de una página de tres dígitos. Y 4 px
       de alto no son un botón: son un pelo, y un pelo no es un blanco de
       pulsación. */
    const { container, botones } = montar({ paginas: 3 });
    expect((container.firstElementChild as HTMLElement).style.width).toBe('44px');
    for (const b of botones) {
      expect(parseFloat(b.style.minHeight)).toBeGreaterThanOrEqual(6);
    }
  });

  it('la página sin hallazgos NO es invisible en tema claro', () => {
    /* El defecto de contraste: los niveles bajos usaban `--border-subtle`, que
       sobre la superficie clara no se ve. La guarda no mira el color —jsdom no
       calcula contraste— sino que el token sea uno que tenga presencia en los
       dos temas, y que el numeral siga presente: sin número, un gris claro es
       indistinguible de un hueco. */
    const { botones } = montar({ paginas: 2 });
    for (const b of botones) {
      const color = b.style.backgroundColor;
      expect(color).toBeTruthy();
      expect(color).not.toBe('var(--color-border-subtle)');
      expect((b.textContent ?? '').trim()).not.toBe('');
    }
  });

  it('con la ventana más angosta que la columna, el minimapa desaparece', () => {
    /* Una columna ilegible es peor que ninguna columna. La función no se pierde:
       queda en el flyout del rail. */
    const angosta = montar({ paginas: 3, ancho: 480 });
    expect(angosta.container.querySelector('button')).toBeNull();
    cleanup();
    const ancha = montar({ paginas: 3, ancho: 1440 });
    expect(ancha.container.querySelector('button')).not.toBeNull();
  });

  it('sigue siendo navegable con teclado y sigue siendo un <button> nativo', () => {
    /* Lo que ya funcionaba no se rompe al cambiar la forma: el roving tabindex,
       el `role="group"` con nombre y el Enter/Space nativo son la razón por la
       que esta columna existe en lugar de un adorno. */
    const { botones, onPageClick } = montar({ paginas: 4, actual: 2 });
    expect(container0(botones)).toBeTruthy();
    expect(botones.filter((b) => b.getAttribute('tabindex') === '0')).toHaveLength(1);
    fireEvent.click(botones[2]);
    expect(onPageClick).toHaveBeenCalledWith(3);
  });
});

/** El grupo del minimapa, por su rol y su nombre. */
const container0 = (botones: HTMLElement[]) => botones[0]?.closest('[role="group"]');

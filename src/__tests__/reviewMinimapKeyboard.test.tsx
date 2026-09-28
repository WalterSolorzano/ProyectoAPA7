/**
 * Accesibilidad de teclado del minimapa (crítica P0 — "300+ botones de 2px
 * sin roving tabindex"):
 * - UNA sola parada de tab en todo el minimapa (solo la marca activa con
 *   tabIndex 0; el resto -1).
 * - Las flechas ←/→/↑/↓ mueven la marca activa y el foco, con envoltura.
 * - El contenedor es un role="group" con aria-label.
 * - Cada marca expone página, total de páginas y hallazgos en su aria-label,
 *   y es un <button> nativo (Enter/Space lo activan en el navegador).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ReviewMinimap, MinimapMark } from '../components/review/ReviewMinimap';

const marks = new Map<number, MinimapMark>([
  [2, { color: 'var(--color-danger)', count: 3, label: 'Detector & Calidad IA' }],
]);

const setup = (currentPage = 3, totalPages = 5) => {
  const onPageClick = vi.fn();
  const utils = render(
    <ReviewMinimap
      totalPages={totalPages}
      marks={marks}
      currentPage={currentPage}
      onPageClick={onPageClick}
    />
  );
  const buttons = Array.from(utils.container.querySelectorAll('button'));
  return { ...utils, onPageClick, buttons };
};

describe('ReviewMinimap — teclado (roving tabindex)', () => {
  it('contenedor = role group con aria-label y UNA sola parada de tab', () => {
    const { container, buttons } = setup();
    const group = container.querySelector('[role="group"]');
    expect(group).toBeTruthy();
    expect(group!.getAttribute('aria-label')).toBe('Minimap de páginas');
    expect(buttons).toHaveLength(5);
    const tabbable = buttons.filter((b) => b.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    // La marca activa aterriza en la página actual
    expect(tabbable[0]).toBe(buttons[2]);
  });

  it('las flechas mueven la marca activa y el foco (con envoltura)', () => {
    const { buttons } = setup();
    buttons[2].focus();
    expect(document.activeElement).toBe(buttons[2]);

    fireEvent.keyDown(buttons[2], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(buttons[3]);
    expect(buttons[3].getAttribute('tabindex')).toBe('0');
    expect(buttons[2].getAttribute('tabindex')).toBe('-1');

    fireEvent.keyDown(buttons[3], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(buttons[2]);

    // Envolver: subir desde la primera marca lleva a la última
    fireEvent.keyDown(buttons[2], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(buttons[1]);
    fireEvent.keyDown(buttons[1], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(buttons[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(buttons[4]);
  });

  it('las marcas son <button> nativos (Enter/Space) y al activarlas navegan', () => {
    const { buttons, onPageClick } = setup();
    fireEvent.click(buttons[1]);
    expect(onPageClick).toHaveBeenCalledWith(2);
  });

  it('cada marca anuncia página, total, hallazgos y el motor dominante', () => {
    /* El motor entra en el `aria-label` y no solo en el `title`. Con el color
       como único portador del significado, el `title` era el único sitio donde
       se nombraba el motor, y el `title` no se anuncia siempre ni es visible para
       quien lee con lector de pantalla. El nombre del motor tiene que estar en
       el texto de la marca. */
    const { buttons } = setup();
    expect(buttons[0].getAttribute('aria-label')).toBe('Página 1 de 5 de la revisión, 0 hallazgos');
    expect(buttons[1].getAttribute('aria-label')).toBe('Página 2 de 5 de la revisión, 3 hallazgos, Detector & Calidad IA');
    expect(buttons[2].getAttribute('aria-label')).toBe('Página 3 de 5 de la revisión, 0 hallazgos');
  });

  it('el número de página dice DE QUÉ revisión es, como la tira', () => {
    /* El conteo sale de `usePageIndex` (el índice de revisión), no del reflujo
       medido del lienzo, y en modo Hoja el minimapa está al lado de la hoja con
       la que puede discrepar. La tira ya lo decía ("de la revisión"); el
       minimapa no, y ese es el que la persona tiene al lado. La calibración de
       la paginación del lienzo sigue siendo un trabajo aparte: esto declara de
       qué número se trata, no borra la diferencia. */
    const { buttons } = setup();
    for (const b of buttons) expect(b.getAttribute('aria-label')).toContain('de la revisión');
    expect(buttons[0].getAttribute('title') || '').toContain('de la revisión');
  });

  it('las marcas usan un radio del sistema, no un literal', () => {
    const { buttons } = setup();
    for (const b of buttons) expect(b.getAttribute('style') || '').toContain('border-radius: var(--radius-sm)');
  });

  it('el número de página va en el TEXTO de la marca, no solo en el title', () => {
    /* La columna pasó de 19 px a 44 px para que el número entre, así que el
       número tiene que estar. Un botón de 14 px de alto con el número dentro es
       legible; el mismo botón con el número solo en el `title` es el defecto que
       esta fase vino a arreglar. */
    const { buttons } = setup();
    expect(buttons.map((b) => (b.textContent ?? '').trim())).toEqual(['1', '2', '3', '4', '5']);
  });
});

/**
 * WordAPA7 — T11: el parrafo de lectura se auto-ajusta, con piso duro.
   El usuario pidio que se adapte si es inmenso, pero no a costa de la
   legibilidad: 13px es el piso y ningun camino lo cruza.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { createElement } from 'react';
import { useAutoFitText, computeFit, MIN_FONT_PX, MAX_FONT_PX, MAX_LINES, lineHeightFor } from '../hooks/useAutoFitText';

/* jsdom reporta clientHeight y scrollHeight como 0 en todos los elementos, asi
   que medimos a traves del prototipo: es el unico punto por donde el navegador
   real no nos deja pasar. El hook se monta sobre un elemento de verdad, y no
   sobre un ref asignado a mano, porque asignar un ref no re-renderiza y la
   medida inicial ocurre en un layout effect. */
let resizeCb: (() => void) | null = null;
let rafCola: FrameRequestCallback[] = [];
let rafUltimoId = 0;
const rafCancelados: number[] = [];
let restaurar: Array<() => void> = [];

function espiar(obj: object, prop: string, descriptor: PropertyDescriptor) {
  const previo = Object.getOwnPropertyDescriptor(obj, prop);
  Object.defineProperty(obj, prop, { configurable: true, ...descriptor });
  restaurar.push(() => {
    if (previo) Object.defineProperty(obj, prop, previo);
    else delete (obj as Record<string, unknown>)[prop];
  });
}

function medirCon(c: number, s: number) {
  espiar(Element.prototype, 'clientHeight', { get: () => c });
  espiar(Element.prototype, 'scrollHeight', { get: () => s });
}

/** La tarjeta real de Task 14: un contenedor medido que se pinta al tamano
    que el hook decidio. Sin JSX para poder vivir en un .test.ts. */
function Tarjeta() {
  const { containerRef, fontSize, lineHeight } = useAutoFitText();
  return createElement(
    'div',
    { ref: containerRef, 'data-testid': 'tarjeta' },
    createElement('span', { 'data-testid': 'salida' }, `${fontSize}|${lineHeight}`),
  );
}

function salida(): string {
  return document.querySelector('[data-testid="salida"]')!.textContent!;
}
function leerPx(): number {
  return Number(salida().split('|')[0]);
}

beforeEach(() => {
  resizeCb = null;
  rafCola = [];
  rafUltimoId = 0;
  rafCancelados.length = 0;
  restaurar = [];

  espiar(globalThis, 'ResizeObserver', { value: class {
    constructor(cb: () => void) {
      resizeCb = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } });
  espiar(globalThis, 'requestAnimationFrame', { value: (cb: FrameRequestCallback) => {
    rafCola.push(cb);
    return ++rafUltimoId;
  } });
  espiar(globalThis, 'cancelAnimationFrame', { value: (id: number) => {
    rafCancelados.push(id);
  } });
});

afterEach(() => {
  restaurar.forEach((f) => f());
  restaurar = [];
  vi.useRealTimers();
});

describe('T11 — useAutoFitText', () => {
  it('los limites son 13 y 19, en ese orden', () => {
    expect(MIN_FONT_PX).toBe(13);
    expect(MAX_FONT_PX).toBe(19);
    expect(MAX_LINES).toBe(26);
  });

  it('el interlineado crece con el cuerpo, entre 1.75 y 1.85', () => {
    expect(lineHeightFor(13)).toBeGreaterThanOrEqual(1.75);
    expect(lineHeightFor(19)).toBeLessThanOrEqual(1.85);
    expect(lineHeightFor(13)).toBeGreaterThan(lineHeightFor(19));
  });

  it('arranca en el techo cuando el texto cabe holgado', () => {
    medirCon(2000, 200);
    render(createElement(Tarjeta));
    expect(leerPx()).toBe(MAX_FONT_PX);
  });

  it('baja de tamano pero NUNCA del piso, con un texto enorme', () => {
    medirCon(120, 100000);
    render(createElement(Tarjeta));
    // Ratio que exigiria 0.05px si no estuviera el piso.
    expect(leerPx()).toBe(MIN_FONT_PX);
    expect(leerPx()).toBeGreaterThanOrEqual(MIN_FONT_PX);
  });

  it('el valor devuelto nunca sale del rango en ninguna circunstancia', () => {
    // Los cuatro ratios del brief, mas uno que si ejercita el OTRO extremo del
    // clamp: caja enormousemente alta con el texto justo por encima de
    // MAX_LINES, donde el ratio pediria 5055px. Sin el, quitar el `Math.min`
    // del techo deja la suite en verde igual.
    for (const [c, s] of [[10, 10], [10, 100000], [100000, 10], [0, 0], [100000, 900]] as const) {
      const el = document.createElement('div');
      Object.defineProperty(el, 'clientHeight', { value: c, configurable: true });
      Object.defineProperty(el, 'scrollHeight', { value: s, configurable: true });
      expect(() => { computeFit(el); }).not.toThrow();
      const px = computeFit(el);
      expect(px).toBeGreaterThanOrEqual(MIN_FONT_PX);
      expect(px).toBeLessThanOrEqual(MAX_FONT_PX);
    }
  });

  it('el interlineado que acompaña al tamano elegido viene del mismo cuerpo', () => {
    medirCon(120, 100000);
    render(createElement(Tarjeta));
    const [px, lh] = salida().split('|');
    expect(Number(lh)).toBeCloseTo(lineHeightFor(Number(px)), 10);
  });

  it('vuelve a crecer cuando sobra hueco: el ResizeObserver vuelve a medir', () => {
    medirCon(120, 100000);
    render(createElement(Tarjeta));
    expect(leerPx()).toBe(MIN_FONT_PX);

    // El parrafo siguiente es mucho mas corto y el contenedor no cambia: lo
    // que dispara la remedicion es el ResizeObserver, no un re-render.
    espiar(Element.prototype, 'scrollHeight', { get: () => 400 });
    act(() => {
      resizeCb?.();
      rafCola.splice(0).forEach((cb) => cb(0));
    });
    expect(leerPx()).toBe(MAX_FONT_PX);
  });

  it('al desmontar, cancela el frame pendiente en vez de medir un arbol muerto', () => {
    medirCon(120, 100000);
    const { unmount } = render(createElement(Tarjeta));
    act(() => { resizeCb?.(); });
    expect(rafCola).toHaveLength(1);
    unmount();
    expect(rafCancelados).toEqual([rafUltimoId]);
  });
});

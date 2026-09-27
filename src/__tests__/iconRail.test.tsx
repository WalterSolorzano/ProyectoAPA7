/**
 * WordAPA7 — T4: el rail es de 56px fijos con solo iconos. El detalle no se
 * gana estirando la columna, se gana en el flyout.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { IconRail } from '../components/shell/IconRail';
import { EDITOR_RAIL_ITEMS } from '../components/shell/railItems';
import type { RailDestination } from '../components/shell/railItems';
import { useDocStore } from '../store/useDocStore';

// El rail pinta la fase activa leyendo el store, no por props: el test pone la
// fase a mano para poder afirmar cuál (y solo cuál) queda marcada.
const stepInicial = useDocStore.getState().wizardStep;
beforeEach(() => act(() => useDocStore.setState({ wizardStep: 1 })));
afterEach(() => act(() => useDocStore.setState({ wizardStep: stepInicial })));

const mkItems = (over: Partial<RailDestination> = {}): RailDestination[] =>
  EDITOR_RAIL_ITEMS.map(({ step, label, Icon, showOutline }) => ({
    id: `step-${step}`, step, label, Icon, status: 'idle', pending: 0, showOutline, ...over,
  }));

const setup = (items = mkItems()) => {
  const onHoverItem = vi.fn();
  const onTogglePin = vi.fn();
  const onSelect = vi.fn();
  const utils = render(
    <IconRail items={items} onHoverItem={onHoverItem} onTogglePin={onTogglePin} onSelect={onSelect} pinned={false} />,
  );
  return { ...utils, onHoverItem, onTogglePin, onSelect };
};

describe('T4 — IconRail', () => {
  it('muestra un botón por fase, con nombre accesible y sin texto visible', () => {
    setup();
    for (const label of ['Portada', 'Estructura', 'Figuras', 'Referencias', 'Revisión & IA', 'Exportar']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    // Solo iconos: el detalle se gana en el flyout, no imprimiendo etiquetas.
    expect(screen.getByTestId('icon-rail').textContent).toBe('');
  });

  it('el botón de anclar expone su estado por `aria-pressed`, con nombre fijo', () => {
    // El nombre de un toggle no cambia con el estado: `aria-pressed` ya lo
    // lleva, y mutar el nombre hace que el control se anuncie como otro. El
    // pin del flyout y este son el mismo flag global y se nombran igual.
    const { onTogglePin, unmount } = setup();
    const pin = screen.getByRole('button', { name: 'Anclar panel' });
    expect(pin.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(pin);
    expect(onTogglePin).toHaveBeenCalledTimes(1);
    unmount();

    const onTogglePin2 = vi.fn();
    render(
      <IconRail items={mkItems()} onHoverItem={vi.fn()} onTogglePin={onTogglePin2} onSelect={vi.fn()} pinned={true} />,
    );
    const anclado = screen.getByRole('button', { name: 'Anclar panel' });
    expect(anclado.getAttribute('aria-pressed')).toBe('true');
  });

  it('anclado, el pin NO se pinta con la superficie de acento: ahí vive "fase actual"', () => {
    // En esta misma columna de 56px, `--color-accent-soft` significa fase
    // activa. El pin no es una fase, y a ocho píxeles no puede usar su tinta.
    const { unmount } = setup();
    const pin = screen.getByRole('button', { name: 'Anclar panel' });
    expect(pin.style.backgroundColor).toBe('transparent');
    unmount();

    render(
      <IconRail items={mkItems()} onHoverItem={vi.fn()} onTogglePin={vi.fn()} onSelect={vi.fn()} pinned={true} />,
    );
    const anclado = screen.getByRole('button', { name: 'Anclar panel' });
    expect(anclado.style.backgroundColor).not.toBe('var(--color-accent-soft)');
    // Contorno de acento, sin relleno: se distingue de la fase activa por
    // forma y no solo por color.
    expect(anclado.style.border).toBe('1px solid var(--color-accent)');
  });

  it('avisa al hover y avisa al salir con null', () => {
    const { onHoverItem } = setup();
    const btn = screen.getByRole('button', { name: 'Revisión & IA' });
    fireEvent.mouseEnter(btn);
    expect(onHoverItem).toHaveBeenCalledWith(expect.objectContaining({ step: 5 }));
    fireEvent.mouseLeave(btn);
    expect(onHoverItem).toHaveBeenLastCalledWith(null);
  });

  it('el clic de una fase navega, y no ancla: anclar es el pin de abajo', () => {
    // T4 fijó el clic como "solo ancla" y el hover como el que abría el detalle.
    // Con el rail permanente, el hover no puede cambiar de fase (barrer el
    // borde izquierdo desmontaría el documento que se está leyendo), así que
    // el clic pasó a ser la navegación: es el único camino con teclado.
    const { onSelect, onTogglePin } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Portada' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ step: 1 }));
    expect(onTogglePin).not.toHaveBeenCalled();
  });

  it('el clic del pin ancla y no navega', () => {
    const { onSelect, onTogglePin } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Anclar panel' }));
    expect(onTogglePin).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('las fases son botones de verdad, alcanzables con teclado', () => {
    // El clic de teclado no se puede simular en jsdom, pero un <button> nativo
    // sí lo dispara: lo que hay que garantizar aquí es que no sea un div con
    // role, porque entonces el Enter no llegaría nunca.
    setup();
    const btn = screen.getByRole('button', { name: 'Figuras' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.getAttribute('tabindex')).toBeNull();
  });

  it('marca como activo solo la fase actual, y la sigue cuando cambia', () => {
    const { unmount } = setup(mkItems());
    const activos = () =>
      screen.getAllByRole('button').filter((b) => b.getAttribute('data-active') === 'true');
    expect(activos()).toHaveLength(1);
    expect(activos()[0]).toBe(screen.getByRole('button', { name: 'Portada' }));
    unmount();

    setup(mkItems());
    act(() => useDocStore.setState({ wizardStep: 3 }));
    expect(activos()).toHaveLength(1);
    expect(activos()[0]).toBe(screen.getByRole('button', { name: 'Figuras' }));
  });

  it('nunca marca un destino que no es una fase, aunque la fase coincida', () => {
    act(() => useDocStore.setState({ wizardStep: 5 }));
    setup(mkItems().map((i) => (i.step === 5 ? { ...i, step: null, id: 'home' } : i)));
    const activos = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('data-active') === 'true');
    expect(activos).toHaveLength(0);
  });

  // `current` es la señal de los destinos que NO son fases (Inicio ⇄ Recientes):
  // el rail acepta las dos, pero cada una en su carril.
  const homeDestino = (over: Partial<RailDestination> = {}): RailDestination => ({
    ...mkItems()[0],
    id: 'home-inicio',
    step: null,
    label: 'Inicio',
    current: true,
    ...over,
  });

  it('`current` enciende un destino que no es fase, y lo anuncia como la página actual', () => {
    setup([homeDestino(), homeDestino({ id: 'home-recientes', label: 'Recientes', current: false })]);
    const inicio = screen.getByRole('button', { name: 'Inicio' });
    const recientes = screen.getByRole('button', { name: 'Recientes' });
    // A lo visto: la superficie de acento, como el sidebar que este rail reemplaza.
    expect(inicio.getAttribute('data-active')).toBe('true');
    expect(inicio.style.backgroundColor).toBe('var(--color-accent-soft)');
    expect(inicio.style.color).toBe('var(--color-accent)');
    // Y a lo leído por un lector de pantalla, que si no solo vería el color.
    expect(inicio.getAttribute('aria-current')).toBe('page');
    expect(recientes.getAttribute('data-active')).toBe('false');
    expect(recientes.getAttribute('aria-current')).toBeNull();
  });

  it('la fase del editor la sigue mandando el store, aunque haya un `current` al lado', () => {
    // El editor no fija `current`: si el rail lo tomara como prioridad, dejaría de
    // seguir a `wizardStep` y el icono se desincronizaría de la barra.
    const { unmount } = setup([homeDestino(), ...mkItems()]);
    const activos = () =>
      screen.getAllByRole('button').filter((b) => b.getAttribute('data-active') === 'true');
    expect(activos()).toHaveLength(2);
    expect(activos()[1]).toBe(screen.getByRole('button', { name: 'Portada' }));
    // Una fase del asistente es un "step" del recorrido, no una página.
    expect(activos()[1].getAttribute('aria-current')).toBe('step');
    unmount();

    setup([homeDestino(), ...mkItems()]);
    act(() => useDocStore.setState({ wizardStep: 3 }));
    const tras = screen.getAllByRole('button').filter((b) => b.getAttribute('data-active') === 'true');
    expect(tras).toHaveLength(2);
    expect(tras[1]).toBe(screen.getByRole('button', { name: 'Figuras' }));
  });

  it('sin `current` y sin fase, ningún destino se anuncia como actual', () => {
    setup([homeDestino({ current: undefined })]);
    expect(screen.getByRole('button', { name: 'Inicio' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('button', { name: 'Inicio' }).getAttribute('data-active')).toBe('false');
  });

  it('el hueco entre destinos es de 8px, el que dice la spec 4.2', async () => {
    // Specifiers en variables + imports dinámicos: Vite no debe pasar estos
    // módulos por nodePolyfills (mismo motivo que designTokens.test.ts).
    const NODE_FS = 'node:fs';
    const NODE_PATH = 'node:path';
    const NODE_URL = 'node:url';
    const { readFileSync } = await import(/* @vite-ignore */ NODE_FS);
    const { resolve } = await import(/* @vite-ignore */ NODE_PATH);
    const { fileURLToPath } = await import(/* @vite-ignore */ NODE_URL);
    const testDir = fileURLToPath(import.meta.url).replace(/[^/\\]+$/, '');
    const css = readFileSync(resolve(testDir, '../styles/design-system.css'), 'utf8');
    const raiz = css.slice(css.indexOf(':root,'), css.indexOf(':root[data-theme="dark"]'));

    setup();
    const token = screen.getByTestId('icon-rail').style.gap.match(/var\((--[\w-]+)/)?.[1];
    expect(token).toBeTruthy();
    // El token se resuelve contra la hoja real: un `var(--space-1, 8px)` se
    // vería correcto en el código y valdría 4px.
    expect(raiz.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1].trim()).toBe('8px');
  });

  it('el hover de una fase usa la superficie alternativa y se revierte al salir', () => {
    setup();
    const btn = screen.getByRole('button', { name: 'Figuras' });
    expect(btn.style.backgroundColor).toBe('transparent');
    expect(btn.style.color).toBe('var(--color-text-secondary)');
    fireEvent.mouseEnter(btn);
    expect(btn.style.backgroundColor).toBe('var(--color-bg-surface-alt)');
    expect(btn.style.color).toBe('var(--color-text-primary)');
    fireEvent.mouseLeave(btn);
    expect(btn.style.backgroundColor).toBe('transparent');
    expect(btn.style.color).toBe('var(--color-text-secondary)');
  });

  it('el hover no borra la marca de la fase activa', () => {
    setup();
    const activa = screen.getByRole('button', { name: 'Portada' });
    fireEvent.mouseEnter(activa);
    expect(activa.style.backgroundColor).toBe('var(--color-accent-soft)');
    expect(activa.style.color).toBe('var(--color-accent)');
  });

  it('salir del rail por su borde suelta el hover, aunque no se cruce ningún botón', () => {
    setup();
    const btn = screen.getByRole('button', { name: 'Figuras' });
    fireEvent.mouseEnter(btn);
    expect(btn.style.backgroundColor).toBe('var(--color-bg-surface-alt)');
    fireEvent.mouseLeave(screen.getByTestId('icon-rail'));
    expect(btn.style.backgroundColor).toBe('transparent');
  });

  it('el hover del botón de anclar usa la misma superficie', () => {
    setup();
    const pin = screen.getByRole('button', { name: 'Anclar panel' });
    expect(pin.style.backgroundColor).toBe('transparent');
    fireEvent.mouseEnter(pin);
    expect(pin.style.backgroundColor).toBe('var(--color-bg-surface-alt)');
    expect(pin.style.color).toBe('var(--color-text-primary)');
    fireEvent.mouseLeave(pin);
    expect(pin.style.backgroundColor).toBe('transparent');
    expect(pin.style.color).toBe('var(--color-text-secondary)');
  });

  it('el conteo de pendientes llega al NOMBRE del botón, no a un span por dentro', () => {
    // Un `aria-label` en un <span> dentro de un botón no suma nada al nombre
    // accesible: el nombre lo da el botón. El punto es decorativo; el número
    // tiene que estar en el `aria-label` del botón.
    const onHoverItem = vi.fn();
    const onTogglePin = vi.fn();
    const { unmount } = render(
      <IconRail items={mkItems()} onHoverItem={onHoverItem} onTogglePin={onTogglePin} onSelect={vi.fn()} pinned={false} />,
    );
    expect(screen.queryByRole('button', { name: /pendientes/ })).toBeNull();
    unmount();

    render(
      <IconRail
        items={mkItems().map((i) => (i.step === 5 ? { ...i, pending: 7, status: 'pending' as const } : i))}
        onHoverItem={onHoverItem}
        onTogglePin={onTogglePin}
        onSelect={vi.fn()}
        pinned={false}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Revisión & IA, 7 pendientes' });
    expect(btn.getAttribute('aria-label')).toBe('Revisión & IA, 7 pendientes');
  });

  it('"Listo" también es parte del nombre, y solo en la fase completada', () => {
    const { unmount } = setup(mkItems());
    expect(screen.queryByRole('button', { name: /listo/ })).toBeNull();
    unmount();

    setup(mkItems().map((i) => (i.step === 2 ? { ...i, status: 'done' as const } : i)));
    const listos = screen.getAllByRole('button', { name: /, listo$/ });
    expect(listos).toHaveLength(1);
    expect(listos[0]).toHaveAccessibleName('Estructura, listo');
  });

  it('sin estado, el nombre es el de la fase pelado: un destino que no se completa no dice nada', () => {
    setup(mkItems().map(({ pending, status, ...rest }) => rest));
    for (const label of ['Portada', 'Figuras', 'Revisión & IA']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });
});

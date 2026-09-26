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

  it('el botón de anclar expone su estado, y lo refleja desde props', () => {
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
    const anclado = screen.getByRole('button', { name: 'Anclado' });
    expect(anclado.getAttribute('aria-pressed')).toBe('true');
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

  it('el punto de pendientes aparece solo si hay pendientes', () => {
    const onHoverItem = vi.fn();
    const onTogglePin = vi.fn();
    const { unmount } = render(
      <IconRail items={mkItems()} onHoverItem={onHoverItem} onTogglePin={onTogglePin} onSelect={vi.fn()} pinned={false} />,
    );
    expect(screen.queryByLabelText(/pendientes/)).toBeNull();
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
    expect(screen.getByLabelText('7 pendientes')).toBeTruthy();
  });

  it('el punto de listo aparece solo en la fase completada', () => {
    const { unmount } = setup(mkItems());
    expect(screen.queryByLabelText('Listo')).toBeNull();
    unmount();

    setup(mkItems().map((i) => (i.step === 2 ? { ...i, status: 'done' as const } : i)));
    expect(screen.getAllByLabelText('Listo')).toHaveLength(1);
  });
});

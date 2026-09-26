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
  const utils = render(
    <IconRail items={items} onHoverItem={onHoverItem} onTogglePin={onTogglePin} pinned={false} />,
  );
  return { ...utils, onHoverItem, onTogglePin };
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
      <IconRail items={mkItems()} onHoverItem={vi.fn()} onTogglePin={onTogglePin2} pinned={true} />,
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

  it('el clic no navega, solo ancla: la navegación vive en el workbench', () => {
    const { onTogglePin } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Portada' }));
    expect(onTogglePin).toHaveBeenCalledTimes(1);
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

  it('el punto de pendientes aparece solo si hay pendientes', () => {
    const onHoverItem = vi.fn();
    const onTogglePin = vi.fn();
    const { unmount } = render(
      <IconRail items={mkItems()} onHoverItem={onHoverItem} onTogglePin={onTogglePin} pinned={false} />,
    );
    expect(screen.queryByLabelText(/pendientes/)).toBeNull();
    unmount();

    render(
      <IconRail
        items={mkItems().map((i) => (i.step === 5 ? { ...i, pending: 7, status: 'pending' as const } : i))}
        onHoverItem={onHoverItem}
        onTogglePin={onTogglePin}
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

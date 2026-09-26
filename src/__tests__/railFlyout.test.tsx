/**
 * WordAPA7 — T5: el flyout se abre al hover y se cierra con 120ms de gracia
 * para que el puntero pueda cruzar el hueco sin perderlo (Review Focus #3).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { RailFlyout, FLYOUT_CLOSE_GRACE_MS } from '../components/shell/RailFlyout';
import { EDITOR_RAIL_ITEMS } from '../components/shell/railItems';
import type { RailDestination } from '../components/shell/railItems';

const item: RailDestination = {
  id: 'step-2',
  step: 2,
  label: 'Estructura',
  Icon: EDITOR_RAIL_ITEMS[1].Icon,
  status: 'pending',
  pending: 4,
  showOutline: true,
};

describe('T5 — RailFlyout', () => {
  // Los temporizadores falsos se arman en cada test, no una vez a nivel de módulo:
  // el afterEach los devuelve a reales y una llamada de módulo solo alcanzaría
  // para el primer test del archivo.
  beforeEach(() => {
    vi.useFakeTimers();
    useDocStore.setState({ railPinned: false });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('no monta nada sin destino', () => {
    const { container } = render(<RailFlyout item={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('muestra la etiqueta y el estado del destino', () => {
    render(<RailFlyout item={item} onClose={vi.fn()} />);
    expect(screen.getByText('Estructura')).toBeTruthy();
    expect(screen.getByText('4 pendientes')).toBeTruthy();
  });

  it('el conteo solo acompaña al estado pending, no a "Listo" ni a "Sin pendientes"', () => {
    const { unmount } = render(
      <RailFlyout item={{ ...item, status: 'done', pending: 3 }} onClose={vi.fn()} />,
    );
    expect(screen.getByText('Listo')).toBeTruthy();
    expect(screen.queryByText('3 Listo')).toBeNull();
    unmount();

    render(<RailFlyout item={{ ...item, status: 'idle', pending: 3 }} onClose={vi.fn()} />);
    expect(screen.getByText('Sin pendientes')).toBeTruthy();
    expect(screen.queryByText('3 Sin pendientes')).toBeNull();
  });

  it('sin destino, el componente es inerte: Esc no cierra ni suelta el ancla', () => {
    // AppShell lo monta siempre; con `item: null` no hay panel que Esc pueda
    // cerrar, y el ancla de la próxima apertura debe sobrevivir intacta.
    const onClose = vi.fn();
    act(() => useDocStore.setState({ railPinned: true }));
    render(<RailFlyout item={null} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(useDocStore.getState().railPinned).toBe(true);
  });

  it('la gracia de cierre son 120ms exactos', () => {
    expect(FLYOUT_CLOSE_GRACE_MS).toBe(120);
  });

  it('un clic ancla el flyout y Esc lo suelta', () => {
    render(<RailFlyout item={item} onClose={vi.fn()} />);
    const pin = screen.getByRole('button', { name: 'Anclar panel' });
    expect(pin.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(pin);
    expect(useDocStore.getState().railPinned).toBe(true);
    expect(pin.getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useDocStore.getState().railPinned).toBe(false);
  });

  it('el mapa del documento solo aparece en las fases de sección', () => {
    const { unmount } = render(<RailFlyout item={item} onClose={vi.fn()} />);
    expect(screen.getByText('Sin títulos detectados')).toBeTruthy();
    unmount();

    // Portada no es fase de sección: el rail no promete un mapa que no hay.
    render(<RailFlyout item={{ ...item, showOutline: false }} onClose={vi.fn()} />);
    expect(screen.queryByText('Sin títulos detectados')).toBeNull();
  });

  it('flota sobre el workbench: absoluto, a 64px del rail y de 240px', () => {
    // El centro de Revisión no puede estrecharse porque el usuario lea una
    // etiqueta: por eso esto es `absolute` y no un hermano flex.
    render(<RailFlyout item={item} onClose={vi.fn()} />);
    const fly = screen.getByTestId('rail-flyout');
    expect(fly.style.position).toBe('absolute');
    expect(fly.style.left).toBe('64px');
    expect(fly.style.width).toBe('240px');
  });

  it('mientras está anclado, salir con el puntero no lo cierra', () => {
    const onClose = vi.fn();
    render(<RailFlyout item={item} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anclar panel' }));
    fireEvent.mouseLeave(screen.getByTestId('rail-flyout'));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sin anclar, el cierre se aplaza 120ms para que el puntero cruce el hueco', () => {
    const onClose = vi.fn();
    render(<RailFlyout item={item} onClose={onClose} />);
    fireEvent.mouseLeave(screen.getByTestId('rail-flyout'));
    // 119/120 en literal, no desde la constante: si el retardo real se moviera,
    // este test tiene que caer por sí mismo y no porque ambas se muevan juntas.
    act(() => { vi.advanceTimersByTime(119); });
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reentrar antes de la gracia cancela el cierre', () => {
    const onClose = vi.fn();
    render(<RailFlyout item={item} onClose={onClose} />);
    const fly = screen.getByTestId('rail-flyout');
    fireEvent.mouseLeave(fly);
    act(() => { vi.advanceTimersByTime(80); });
    fireEvent.mouseEnter(fly);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('la gracia no sobrevive al desmontaje: el timer se limpia', () => {
    const onClose = vi.fn();
    const { unmount } = render(<RailFlyout item={item} onClose={onClose} />);
    fireEvent.mouseLeave(screen.getByTestId('rail-flyout'));
    unmount();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Esc además de soltar el ancla, cierra el panel', () => {
    const onClose = vi.fn();
    render(<RailFlyout item={item} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

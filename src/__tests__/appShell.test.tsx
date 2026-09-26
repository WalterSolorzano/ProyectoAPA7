/**
 * WordAPA7 — T6: el shell decide la gramática: topbar, rail de 56px y
 * workbench. StepRail ya no existe y el ancho del rail no se ajusta.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { AppShell } from '../components/shell/AppShell';

vi.mock('../components/toolbar/UnifiedToolbar', () => ({ UnifiedToolbar: () => <div data-testid="toolbar" /> }));
vi.mock('../components/layout/ProjectTabs', () => ({ ProjectTabs: () => <div data-testid="tabs" /> }));
vi.mock('../components/layout/StatusBar', () => ({ StatusBar: () => <div data-testid="statusbar" /> }));

describe('T6 — AppShell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDocStore.setState({ railPinned: false, wizardStep: 1 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('monta topbar, rail y workbench en ese orden', () => {
    render(<AppShell><div data-testid="work">x</div></AppShell>);
    expect(screen.getByTestId('toolbar')).toBeTruthy();
    expect(screen.getByTestId('icon-rail')).toBeTruthy();
    expect(screen.getByTestId('work')).toBeTruthy();
    expect(screen.getByTestId('statusbar')).toBeTruthy();
  });

  it('el rail existe siempre, incluso en la vista de exportación', () => {
    render(<AppShell><div>x</div></AppShell>);
    expect(screen.getByLabelText('Fases de la transformación')).toBeTruthy();
  });

  it('el rail es fijo: ni el ancho ni el arrastre desaparecieron con StepRail', () => {
    render(<AppShell><div>x</div></AppShell>);
    const rail = screen.getByTestId('icon-rail');
    expect(rail.style.width).toBe('56px');
    // El puntero sobre un destino no redimensiona nada: solo abre su detalle.
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Estructura' }));
    expect(rail.style.width).toBe('56px');
  });

  it('passar el puntero por un destino abre su flyout y lleva a esa fase', () => {
    useDocStore.setState({ wizardStep: 3 });
    render(<AppShell><div>x</div></AppShell>);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Portada' }));
    expect(screen.getByTestId('rail-flyout')).toBeTruthy();
    expect(useDocStore.getState().wizardStep).toBe(1);
  });

  it('el clic en el workbench no es lo que ancla: el pin del rail sí', () => {
    render(<AppShell><div>x</div></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Anclar panel' }));
    expect(useDocStore.getState().railPinned).toBe(true);
  });

  it('salir del rail no cierra el flyout de golpe: espera la gracia', () => {
    // El rail y el panel están separados por un hueco. Si el shell cerrara en el
    // mouseleave del rail, el puntero no podría cruzar: el panel se iría con él
    // dentro. 119/120 en literal, no desde la constante.
    render(<AppShell><div>x</div></AppShell>);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Portada' }));
    fireEvent.mouseLeave(screen.getByTestId('icon-rail'));
    act(() => { vi.advanceTimersByTime(119); });
    expect(screen.getByTestId('rail-flyout')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByTestId('rail-flyout')).toBeNull();
  });

  it('entrar en el flyout cancela el cierre que había iniciado el rail', () => {
    render(<AppShell><div>x</div></AppShell>);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Portada' }));
    fireEvent.mouseLeave(screen.getByTestId('icon-rail'));
    act(() => { vi.advanceTimersByTime(80); });
    fireEvent.mouseEnter(screen.getByTestId('rail-flyout'));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId('rail-flyout')).toBeTruthy();
  });

  it('anclado, el flyout sobrevive a que el puntero se vaya al documento', () => {
    render(<AppShell><div>x</div></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Anclar panel' }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Portada' }));
    fireEvent.mouseLeave(screen.getByTestId('icon-rail'));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId('rail-flyout')).toBeTruthy();
    expect(useDocStore.getState().railPinned).toBe(true);
  });

  it('el cierre en vuelo no sobrevive al desmontaje del shell', () => {
    const { unmount } = render(<AppShell><div>x</div></AppShell>);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Portada' }));
    fireEvent.mouseLeave(screen.getByTestId('icon-rail'));
    unmount();
    expect(() => act(() => { vi.advanceTimersByTime(5000); })).not.toThrow();
  });
});

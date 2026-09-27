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
    useDocStore.setState({ railPinned: false, wizardStep: 1, viewMode: 'edit' });
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

  it('el hover abre el flyout pero no cambia de fase', () => {
    // Barrer el puntero por el rail no puede desmontar la fase que se está
    // leyendo: el hover solo hace aparecer el detalle.
    useDocStore.setState({ wizardStep: 3 });
    render(<AppShell><div>x</div></AppShell>);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Portada' }));
    expect(screen.getByTestId('rail-flyout')).toBeTruthy();
    expect(useDocStore.getState().wizardStep).toBe(3);
  });

  it('el clic lleva a la fase y ancla el panel', () => {
    useDocStore.setState({ wizardStep: 1 });
    render(<AppShell><div>x</div></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Figuras' }));
    expect(useDocStore.getState().wizardStep).toBe(3);
    expect(useDocStore.getState().railPinned).toBe(true);
    // El clic también abre el detalle: con teclado no hay hover que lo abra.
    expect(screen.getByTestId('rail-flyout')).toBeTruthy();
  });

  it('el bloque contenedor del flyout es `.app-main`, positioned: el panel arranca en el primer botón', () => {
    // El bug de geometría: `.app-main` era `static`, así que el `top: 12` del
    // flyout se medía desde el BORDE DE LA VENTANA, no desde el rail —cuyo
    // primer botón está 48 (barra) + 12 (padding) = 60px más abajo—. Con la
    // barra de 48px opaca y `z-index: 200` contra los 100 del panel, los
    // primeros ~36px del panel quedaban debajo: la fila con la etiqueta del
    // destino y el único pin visible.
    //
    // jsdom no hace layout, así que esto prueba la DECLARACIÓN que decide la
    // relación: sin ancestro posicionado, esos 12px no son los 12 del rail.
    render(<AppShell><div>x</div></AppShell>);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Portada' }));
    const fly = screen.getByTestId('rail-flyout');
    const parent = fly.parentElement as HTMLElement;
    expect(parent.className).toContain('app-main');
    expect(getComputedStyle(parent).position).toBe('relative');
    // Y el número sigue siendo el del padding del rail, no 60.
    expect(fly.style.top).toBe('12px');
  });

  it('el flyout está detrás de la barra, no encima: su z-index es el de un desplegable', () => {
    // No es que el panel tapara la barra: es que la barra lo tapaba a él. Por
    // eso el arreglo es de geometría, no de `z-index` —subir el panel lo
    // pondría por encima de la barra y taparía el título del documento.
    render(<AppShell><div>x</div></AppShell>);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Portada' }));
    expect(screen.getByTestId('rail-flyout').style.zIndex).toBe('var(--z-dropdown)');
  });

  it('con el túnel de export abierto, un clic en otra fase vuelve al editor', () => {
    // El rail vive en todas las vistas, incluso en la de exportación. Un clic
    // en "Figuras" que solo cambiara `wizardStep` repintaría el acento sobre
    // una fase cuya vista no se monta: el rail afirmaría dónde está el
    // trabajo mientras la pantalla muestra el túnel. Reachable hoy por la
    // paleta de comandos ("Abrir túnel de exportación").
    useDocStore.setState({ wizardStep: 2, viewMode: 'export' });
    render(<AppShell><div>x</div></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Figuras' }));
    expect(useDocStore.getState().viewMode).toBe('edit');
    expect(useDocStore.getState().wizardStep).toBe(3);
  });

  it('en la vista nativa de PDF el mismo clic también vuelve al editor', () => {
    useDocStore.setState({ wizardStep: 2, viewMode: 'native-pdf' });
    render(<AppShell><div>x</div></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Referencias' }));
    expect(useDocStore.getState().viewMode).toBe('edit');
    expect(useDocStore.getState().wizardStep).toBe(4);
  });

  it('ya en el editor, un clic de fase NO toca la vista', () => {
    useDocStore.setState({ wizardStep: 1, viewMode: 'edit' });
    render(<AppShell><div>x</div></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Estructura' }));
    expect(useDocStore.getState().viewMode).toBe('edit');
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

  it('volver al rail desde el flyout cancela el cierre: el panel sobrevive a la gracia', () => {
    // El timer es de la unión. Si el flyout se cerrara con el suyo, el puntero
    // que vuelve al rail vería desaparecer el panel 120ms después, con el
    // icono todavía resaltado y sin detalle que lo explique.
    render(<AppShell><div>x</div></AppShell>);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Portada' }));
    const fly = screen.getByTestId('rail-flyout');
    fireEvent.mouseEnter(fly);
    fireEvent.mouseLeave(fly);
    act(() => { vi.advanceTimersByTime(80); });
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Estructura' }));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId('rail-flyout')).toBeTruthy();
  });

  it('salir del flyout hacia el workbench sí cierra, tras la gracia', () => {
    // El otro sentido de la unión: si el puntero se va de verdad, el panel se va.
    render(<AppShell><div>x</div></AppShell>);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Portada' }));
    fireEvent.mouseLeave(screen.getByTestId('rail-flyout'));
    act(() => { vi.advanceTimersByTime(120); });
    expect(screen.queryByTestId('rail-flyout')).toBeNull();
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

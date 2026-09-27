/**
 * WordAPA7 — T19: Inicio usa el mismo rail que el editor. Dos gramaticas de
   navegación conviviendo era justo lo que se queria eliminar.
 */
import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HOME_RAIL_ITEMS } from '../components/shell/railItems';
import { IconRail } from '../components/shell/IconRail';
import { Step0QuickStart } from '../components/wizard/Step0QuickStart';
import { useDocStore } from '../store/useDocStore';

vi.mock('../api/backend', () => ({
  listSessions: vi.fn().mockResolvedValue([]),
  listProfiles: vi.fn().mockResolvedValue([]),
  downloadTemplate: vi.fn(),
  downloadTemplateAsync: vi.fn(),
  applyTemplate: vi.fn().mockResolvedValue({ status: 'ok' }),
  getSideloadStatus: vi.fn().mockResolvedValue({ installed: true, up_to_date: true, path: '', installed_at: null }),
  repairSideload: vi.fn().mockResolvedValue({ status: 'ok' }),
  getApiBase: () => 'http://localhost:8742',
}));

const montarInicio = async () => {
  await act(async () => {
    render(<Step0QuickStart />);
  });
  return screen.getByTestId('icon-rail');
};

// Estado global que el rail y los destinos tocan: `beforeEach` lo deja en un
// estado conocido y `afterEach` devuelve el ancla y el estudio, para que el orden
// de los tests no dependa del que los dejó.
const wizardStepInicial = useDocStore.getState().wizardStep;
beforeEach(() => {
  act(() => useDocStore.setState({
    isBackendReady: true,
    error: null,
    railPinned: false,
    settingsStudioOpen: false,
    settingsStudioTab: 'format',
    theme: 'light',
  } as never));
});

afterEach(() => {
  act(() => useDocStore.setState({
    railPinned: false,
    settingsStudioOpen: false,
    wizardStep: wizardStepInicial,
  } as never));
});

/** Deja correr el reloj real: la gracia del flyout son 120ms de verdad. */
const esperar = (ms: number) => act(async () => {
  await new Promise((r) => setTimeout(r, ms));
});

describe('T19 — rail de Inicio', () => {
  it('tiene sus propios destinos, sin emojis', () => {
    expect(HOME_RAIL_ITEMS.length).toBeGreaterThan(0);
    for (const i of HOME_RAIL_ITEMS) {
      expect(i.label).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('ningún destino de Inicio es una fase: sin `step` no se puede encender', () => {
    // El rail pinta la fase activa leyendo `wizardStep` del store. Un destino de
    // Inicio no es una fase, así que todos llevan step null y ninguno se marca.
    expect(HOME_RAIL_ITEMS.map((i) => i.step)).toEqual(HOME_RAIL_ITEMS.map(() => null));
    expect(new Set(HOME_RAIL_ITEMS.map((i) => i.id)).size).toBe(HOME_RAIL_ITEMS.length);
  });

  it('monta en el mismo componente de 56px que el editor', () => {
    render(
      <IconRail
        items={HOME_RAIL_ITEMS}
        ariaLabel="Navegación principal"
        onHoverItem={() => {}}
        onSelect={() => {}}
        onTogglePin={() => {}}
        pinned={false}
      />,
    );
    expect(screen.getByLabelText('Navegación principal')).toBeTruthy();
  });

  it('Inicio monta ese rail y su sidebar de 64px ya no existe', async () => {
    await montarInicio();
    // El nav del rail es el que se anuncia; el sidebar viejo se reconocía por su
    // botón "Configuraciones", que ya no debe existir.
    expect(screen.getByLabelText('Navegación principal')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Configuraciones' })).toBeNull();
    for (const label of HOME_RAIL_ITEMS.map((i) => i.label)) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('con el rail de Inicio nada queda encendido, aunque haya una fase activa', async () => {
    act(() => useDocStore.setState({ wizardStep: 3 } as never));
    const rail = await montarInicio();
    expect(rail.querySelectorAll('[data-active="true"]')).toHaveLength(0);
  });

  it('Recientes del rail cambia el contenido, igual que el botón del sidebar viejo', async () => {
    await montarInicio();
    expect(screen.queryByRole('heading', { name: 'Documentos Recientes' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Recientes' }));
    expect(screen.getByRole('heading', { name: 'Documentos Recientes' })).toBeTruthy();
  });

  it('Ajustes abre el panel de Configuraciones, con sus secciones propias', async () => {
    await montarInicio();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    // "Mantenimiento y Desinstalación" solo existe en SettingsMenu: es lo que
    // distingue esta superficie de SettingsPreviewStudio.
    expect(screen.getByRole('button', { name: 'Mantenimiento y Desinstalación' })).toBeTruthy();
  });

  it('Complemento de Word abre su sección del estudio, como el menú de la barra', async () => {
    await montarInicio();
    fireEvent.click(screen.getByRole('button', { name: 'Complemento de Word' }));
    expect(useDocStore.getState().settingsStudioOpen).toBe(true);
    expect(useDocStore.getState().settingsStudioTab).toBe('addin');
  });

  it('Tema alterna el tema sin abrir ningún panel', async () => {
    await montarInicio();
    const antes = useDocStore.getState().theme;
    fireEvent.click(screen.getByRole('button', { name: 'Tema' }));
    expect(useDocStore.getState().theme).toBe(antes === 'light' ? 'dark' : 'light');
    expect(screen.queryByTestId('rail-flyout')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mantenimiento y Desinstalación' })).toBeNull();
  });

  it('Nueva transformación abre el selector de archivo', async () => {
    await montarInicio();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Nueva transformación' }));
    expect(click).toHaveBeenCalled();
  });

  it('Nueva transformación respeta el motor apagado, y no una marca vieja', async () => {
    // El handler del destino no puede guardar el `isBackendReady` del primer
    // render: si lo guardara, "Nueva transformación" seguiría diciendo que el
    // motor está iniciando mucho después de que arrancó.
    act(() => useDocStore.setState({ isBackendReady: false } as never));
    await montarInicio();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Nueva transformación' }));
    expect(click).not.toHaveBeenCalled();

    act(() => useDocStore.setState({ isBackendReady: true } as never));
    fireEvent.click(screen.getByRole('button', { name: 'Nueva transformación' }));
    expect(click).toHaveBeenCalled();
  });

  it('el hover de un destino abre su detalle y salir del rail lo deja ir', async () => {
    await montarInicio();
    expect(screen.queryByTestId('rail-flyout')).toBeNull();
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Recientes' }));
    expect(screen.getByTestId('rail-flyout')).toBeTruthy();
    fireEvent.mouseLeave(screen.getByTestId('icon-rail'));
    // Hay una gracia de 120ms: el puntero cruza el hueco entre rail y panel.
    expect(screen.queryByTestId('rail-flyout')).toBeTruthy();
    await esperar(200);
    expect(screen.queryByTestId('rail-flyout')).toBeNull();
  });

  it('anclar el panel lo deja abierto aunque el puntero salga del rail', async () => {
    const rail = await montarInicio();
    fireEvent.click(screen.getByRole('button', { name: 'Anclar panel' }));
    expect(useDocStore.getState().railPinned).toBe(true);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Ajustes' }));
    fireEvent.mouseLeave(rail);
    await esperar(200);
    // El pin del rail y el del panel comparten el flag del store: si el panel
    // leyera otro, cerraría en spite del ancla.
    expect(screen.getByTestId('rail-flyout')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Anclar panel' })); // el del panel
    expect(useDocStore.getState().railPinned).toBe(false);
  });
});

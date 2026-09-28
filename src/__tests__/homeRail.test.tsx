/**
 * WordAPA7 — T19: Inicio usa el mismo rail que el editor. Dos gramaticas de
   navegación conviviendo era justo lo que se queria eliminar.
 */
import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
  let utils!: ReturnType<typeof render>;
  await act(async () => {
    utils = render(<Step0QuickStart />);
  });
  return utils;
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
    settingsHubOpen: false,
    settingsHubTab: 'documento',
    theme: 'light',
  } as never));
});

afterEach(() => {
  act(() => useDocStore.setState({
    railPinned: false,
    settingsHubOpen: false,
    wizardStep: wizardStepInicial,
  } as never));
});

/** Deja correr el reloj real: la gracia del flyout son 120ms de verdad. */
const esperar = (ms: number) => act(async () => {
  await new Promise((r) => setTimeout(r, ms));
});

/* Todo lo del rail se busca DENTRO del rail: un botón de Inicio que se llamara
   "Inicio" en el hero no debe romper estos tests, y el nombre del destino es lo
   que se está probando. */
const enRail = () => within(screen.getByTestId('icon-rail'));
const destino = (label: string) => enRail().getByRole('button', { name: label });

/** El picker de .docx, no el de carpeta: se distinguen por su `accept`. */
const pickerDeDocumento = () =>
  document.querySelector('input[type="file"][accept=".docx"]') as HTMLInputElement;

describe('T19 — rail de Inicio', () => {
  it('tiene sus propios destinos, sin emojis', () => {
    expect(HOME_RAIL_ITEMS.length).toBeGreaterThan(0);
    for (const i of HOME_RAIL_ITEMS) {
      expect(i.label).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('el catálogo no inventa fases ni un "donde estás": eso lo aplica la pantalla', () => {
    // La decisión sigue siendo `step: null` para todo destino de Inicio. El
    // "dónde estás" no es una fase: lo marca `current`, y lo pone la pantalla al
    // montar, no el catálogo estático.
    expect(HOME_RAIL_ITEMS.map((i) => i.step)).toEqual(HOME_RAIL_ITEMS.map(() => null));
    expect(HOME_RAIL_ITEMS.every((i) => i.current === undefined)).toBe(true);
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
      expect(destino(label)).toBeTruthy();
    }
  });

  it('el rail dice dónde estás: la pestaña actual se enciende y se anuncia', async () => {
    // El sidebar de 64px llevaba `aria-current` y el acento en la pestaña viva.
    // Sin esto, Inicio ⇄ Recientes no dejaba ni rastro visual ni de lector de
    // pantalla, y la gramática nueva era más débil que la que reemplaza.
    await montarInicio();
    const encendidos = () =>
      enRail().getAllByRole('button').filter((b) => b.getAttribute('data-active') === 'true');
    expect(encendidos().map((b) => b.getAttribute('aria-label'))).toEqual(['Inicio']);
    expect(destino('Inicio').getAttribute('aria-current')).toBe('page');
    expect(destino('Inicio').style.backgroundColor).toBe('var(--color-accent-soft)');
    expect(destino('Inicio').style.color).toBe('var(--color-accent)');
    expect(destino('Recientes').getAttribute('aria-current')).toBeNull();
    expect(destino('Recientes').style.backgroundColor).toBe('transparent');

    fireEvent.click(destino('Recientes'));
    expect(encendidos().map((b) => b.getAttribute('aria-label'))).toEqual(['Recientes']);
    expect(destino('Recientes').getAttribute('aria-current')).toBe('page');
    expect(destino('Inicio').getAttribute('aria-current')).toBeNull();
    expect(destino('Inicio').style.backgroundColor).toBe('transparent');
  });

  it('el único encendido es la pestaña actual, no la fase que marque el store', async () => {
    // `wizardStep` sigue siendo del editor: un destino de Inicio no es una fase y
    // no tiene por qué encenderse porque haya una fase 3 abierta detrás.
    act(() => useDocStore.setState({ wizardStep: 3 } as never));
    await montarInicio();
    const encendidos = enRail().getAllByRole('button').filter((b) => b.getAttribute('data-active') === 'true');
    expect(encendidos.map((b) => b.getAttribute('aria-label'))).toEqual(['Inicio']);
  });

  it('Recientes del rail cambia el contenido, igual que el botón del sidebar viejo', async () => {
    await montarInicio();
    expect(screen.queryByRole('heading', { name: 'Documentos Recientes' })).toBeNull();
    fireEvent.click(destino('Recientes'));
    expect(screen.getByRole('heading', { name: 'Documentos Recientes' })).toBeTruthy();
  });

  it('Ajustes abre el hub, y es el único destino de configuración del rail', async () => {
    // Tres destinos de configuración ('home-addin', 'home-ajustes', 'home-tema')
    // eran un menú disfrazado de iconos, y cada uno abría una pantalla distinta.
    // Ahora hay uno, y abre el hub en Conexión: es donde vive el complemento de
    // Word, que era lo que el icono del engranaje no decía.
    await montarInicio();
    const deConfiguracion = HOME_RAIL_ITEMS.filter((i) => i.id.startsWith('home-'));
    expect(deConfiguracion.map((i) => i.id)).toContain('home-ajustes');
    expect(deConfiguracion.filter((i) => ['home-addin', 'home-tema'].includes(i.id))).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Complemento de Word' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tema' })).toBeNull();

    fireEvent.click(destino('Ajustes'));
    expect(useDocStore.getState().settingsHubOpen).toBe(true);
    expect(useDocStore.getState().settingsHubTab).toBe('conexion');
  });

  it('Nueva transformación abre el selector de archivo', async () => {
    await montarInicio();
    const click = vi.spyOn(pickerDeDocumento(), 'click');
    fireEvent.click(destino('Nueva transformación'));
    expect(click).toHaveBeenCalled();
  });

  it('Nueva transformación respeta el motor apagado, y no una marca vieja', async () => {
    // El handler del destino no puede guardar el `isBackendReady` del primer
    // render: si lo guardara, "Nueva transformación" seguiría diciendo que el
    // motor está iniciando mucho después de que arrancó.
    act(() => useDocStore.setState({ isBackendReady: false } as never));
    await montarInicio();
    const click = vi.spyOn(pickerDeDocumento(), 'click');
    fireEvent.click(destino('Nueva transformación'));
    expect(click).not.toHaveBeenCalled();

    act(() => useDocStore.setState({ isBackendReady: true } as never));
    fireEvent.click(destino('Nueva transformación'));
    expect(click).toHaveBeenCalled();
  });

  it('el clic también abre el detalle y lo ancla, como en el editor', async () => {
    // `AppShell.handleSelect` abre y ancla el panel, porque con teclado no hay
    // hover que lo haya abierto. Si Inicio no lo hiciera, el flyout y su pin
    // quedarían solo con ratón: dos comportamientos para el mismo componente.
    await montarInicio();
    expect(screen.queryByTestId('rail-flyout')).toBeNull();
    fireEvent.click(destino('Recientes'));
    expect(screen.getByTestId('rail-flyout')).toBeTruthy();
    expect(useDocStore.getState().railPinned).toBe(true);
    // Y con el ancla puesto, salir del rail ya no lo cierra.
    fireEvent.mouseLeave(screen.getByTestId('icon-rail'));
    await esperar(200);
    expect(screen.queryByTestId('rail-flyout')).toBeTruthy();
  });

  it('si el pin venía del editor, Inicio entra con el pin suelto', async () => {
    // Toda fase del editor se ancla al hacer clic (`AppShell.handleSelect`), así
    // que volver con `goHome` monta Inicio con `railPinned` en true. Sin soltar
    // el flag al entrar, el rail dibujaba "Anclado" sin panel y el hover no
    // cerraba nunca: `scheduleClose` no programa nada mientras está anclado.
    act(() => useDocStore.setState({ railPinned: true } as never));
    await montarInicio();
    expect(useDocStore.getState().railPinned).toBe(false);
    expect(enRail().queryByRole('button', { name: 'Anclarado' })).toBeNull();
    expect(enRail().getByRole('button', { name: 'Anclar panel' })).toBeTruthy();

    fireEvent.mouseEnter(destino('Recientes'));
    fireEvent.mouseLeave(screen.getByTestId('icon-rail'));
    await esperar(200);
    expect(screen.queryByTestId('rail-flyout')).toBeNull();
  });

  it('al salir de Inicio suelta el ancla: no se la lleva al editor', async () => {
    // `railPinned` es global y este rail es su segundo escritor. Un pin puesto
    // acá significaba un panel que no seguía ahí y aparecía en el editor al
    // abrir el siguiente documento.
    const { unmount } = await montarInicio();
    fireEvent.click(destino('Recientes'));
    expect(useDocStore.getState().railPinned).toBe(true);
    unmount();
    expect(useDocStore.getState().railPinned).toBe(false);
  });

  it('el hover de un destino abre su detalle y salir del rail lo deja ir', async () => {
    await montarInicio();
    expect(screen.queryByTestId('rail-flyout')).toBeNull();
    fireEvent.mouseEnter(destino('Recientes'));
    expect(screen.getByTestId('rail-flyout')).toBeTruthy();
    fireEvent.mouseLeave(screen.getByTestId('icon-rail'));
    // Hay una gracia de 120ms: el puntero cruza el hueco entre rail y panel.
    expect(screen.queryByTestId('rail-flyout')).toBeTruthy();
    await esperar(200);
    expect(screen.queryByTestId('rail-flyout')).toBeNull();
  });

  it('el detalle de un destino de Inicio no inventa un estado de trabajo', async () => {
    // Ajustes no se completa ni se pospone.
    // Con `status` obligatorio, el catálogo tenía que mentir con un `idle` y el
    // flyout imprimía "Sin pendientes" encima de un botón.
    await montarInicio();
    fireEvent.mouseEnter(destino('Ajustes'));
    const fly = within(screen.getByTestId('rail-flyout'));
    expect(fly.queryByText('Sin pendientes')).toBeNull();
    expect(fly.queryByText('Listo')).toBeNull();
    // Pero sí dice qué es y qué se puede hacer con él.
    expect(fly.getByText('Ajustes')).toBeTruthy();
  });

  it('el bloque contenedor del flyout es el `position: relative` del contenido', async () => {
    // El mismo bug de geometría que en el editor: sin ancestro posicionado, el
    // `top: 12` del panel se mide desde el borde de la ventana y la franja de
    // arriba se come su primera fila. Acá la franja son 44px.
    await montarInicio();
    fireEvent.mouseEnter(destino('Ajustes'));
    const padre = screen.getByTestId('rail-flyout').parentElement as HTMLElement;
    expect(getComputedStyle(padre).position).toBe('relative');
  });

  it('anclar el panel lo deja abierto aunque el puntero salga del rail', async () => {
    await montarInicio();
    const rail = screen.getByTestId('icon-rail');
    fireEvent.click(enRail().getByRole('button', { name: 'Anclar panel' }));
    expect(useDocStore.getState().railPinned).toBe(true);
    fireEvent.mouseEnter(destino('Ajustes'));
    fireEvent.mouseLeave(rail);
    await esperar(200);
    // El pin del rail y el del panel comparten el flag del store: si el panel
    // leyera otro, cerraría en spite del ancla.
    expect(screen.getByRole('complementary', { name: 'Detalle de Ajustes' })).toBeTruthy();
    const flyout = within(screen.getByTestId('rail-flyout'));
    fireEvent.click(flyout.getByRole('button', { name: 'Anclar panel' }));
    expect(useDocStore.getState().railPinned).toBe(false);
  });
});

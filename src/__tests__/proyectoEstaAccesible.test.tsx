/**
 * F7 Task 5 — el Explorador de Proyecto es alcanzable, y el rail no lo contradice.
 *
 * EL DEFECTO, EN DOS PARTES QUE SON UNA SOLA.
 *
 * `ProjectTabs.tsx:48` hace `if (tabs.length === 0) return null`, y ese
 * componente es el ÚNICO montaje de `ProjectFolderModal` en toda la app. Con cero
 * documentos no hay barra, y el Explorador —un módulo que `AGENTS.md` §5 lista
 * como principal— no se puede abrir. Un módulo que no se puede abrir no es un
 * módulo.
 *
 * Y la cura no puede ser "que la barra se dibuje siempre": la barra de pestañas
 * con cero pestañas es una lista vacía, y una lista vacía no es un acceso. El
 * acceso va en el rail, que vive siempre (AGENTS.md §1), y con un destino propio.
 *
 * SEGUNDA PARTE, Y ES LA QUE HACE IMPORTANTE LA PRIMA: el destino nuevo NO lleva
 * conteo de pendientes. No es una fase, no tiene trabajo que completar, y un
 * cero inventado sobre un botón es la clase de mentira que este repo vino a
 * matar — es el mismo motivo por el que `status` es opcional en `RailDestination`
 * y por el que Ajustes no lo lleva. Este archivo lo verifica para que nadie lo
 * "complete" después.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { useRailDestinations } from '../hooks/useRailDestinations';
import { EDITOR_RAIL_ITEMS } from '../components/shell/railItems';
import { AppShell } from '../components/shell/AppShell';
import { readPhaseStates } from '../lib/railPending';

// El Explorador pesa: no hace falta el modal real para medir si se ALCANZA.
vi.mock('../components/project/ProjectFolderModal', () => ({
  ProjectFolderModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="explorador" /> : null,
}));

beforeEach(() => {
  /* `exploradorAbierto` y `viewMode` tambien se limpian, y no por prolijidad:
     el store es un singleton y esta bandera sobrevive entre tests. Sin resetearla
     el primer test la deja en `true`, el siguiente arranca con el Explorador
     abierto y su PRIMER clic lo cierra — o sea, el test pasa midiendo el camino
     equivocado. Un guardián que depende del orden no es un guardián. */
  useDocStore.setState({
    proyecto: null,
    projectImages: [],
    tabs: [],
    activeTabIndex: 0,
    doc: null,
    exploradorAbierto: false,
    viewMode: 'edit',
  });
});

describe('con cero documentos, el Explorador igual se alcanza', () => {
  it('el rail ofrece el destino del proyecto', () => {
    // El defecto: con `tabs.length === 0` el unico montaje del Explorador no
    // existe, y no hay ningun otro camino a el.
    render(<AppShell><div>centro</div></AppShell>);
    const rail = screen.getByTestId('icon-rail');
    expect(rail.textContent?.toLowerCase() || '').not.toBe('');
    expect(rail.querySelector('[aria-label*="royecto" i]')).not.toBeNull();
  });

  it('un clic en el destino abre el Explorador', () => {
    // Reachability de verdad: el boton existe Y abre algo. Un destino que no
    // abre nada es un boton que promete.
    render(<AppShell><div>centro</div></AppShell>);
    const boton = screen.getByTestId('icon-rail').querySelector('[aria-label*="royecto" i]') as HTMLElement;
    fireEvent.click(boton);
    expect(screen.getByTestId('explorador')).toBeTruthy();
  });

  it('cerrar el Explorador lo saca de pantalla', () => {
    // Y no se queda pegado abierto: un modal que no cierra es otra promesa rota,
    // en la dirección contraria.
    render(<AppShell><div>centro</div></AppShell>);
    fireEvent.click(screen.getByTestId('icon-rail').querySelector('[aria-label*="royecto" i]') as HTMLElement);
    fireEvent.click(screen.getByTestId('icon-rail').querySelector('[aria-label*="royecto" i]') as HTMLElement);
    expect(screen.queryByTestId('explorador')).toBeNull();
  });

  it('el estado del Explorador vive en el store y no en el componente', () => {
    // Si el "abierto" fuera `useState` del componente que lo monta, el rail no
    // podria abrirlo: serian dos verdades, y la del rail no llegaria.
    useDocStore.getState().abrirExplorador();
    expect(useDocStore.getState().exploradorAbierto).toBe(true);
    useDocStore.getState().cerrarExplorador();
    expect(useDocStore.getState().exploradorAbierto).toBe(false);
  });
});

describe('el destino del proyecto no inventa trabajo pendiente', () => {
  it('no lleva conteo de pendientes', () => {
    // NO es una fase del asistente: no hay nada que completar ni que posponer.
    // Un cero aqui seria un "Listo" sobre un boton, que es exactamente lo que
    // `RailFlyout` evita dibujar cuando `status` no viene.
    const item = EDITOR_RAIL_ITEMS.find((i) => i.id === 'proyecto');
    expect(item, 'el destino del proyecto no esta en el catalogo del rail').toBeTruthy();
    expect(item!.step).toBeNull();
    expect('pending' in (item as Record<string, unknown>)).toBe(false);
    expect('status' in (item as Record<string, unknown>)).toBe(false);
  });

  it('el rail pintado tampoco le inventa pendientes', () => {
    // El catalogo es una cosa y lo que se pinta es otra. Un `pending` que se
    // agrega en `useRailDestinations` reproduciria el defecto que `railPending`
    // vino a matar: un conteo que no puede contradecir a la pantalla a la que
    // lleva porque no viene de ella.
    const { result } = renderHookDestinos();
    const proyecto = result.find((d) => d.id === 'proyecto');
    expect(proyecto).toBeTruthy();
    expect(proyecto!.status).toBeUndefined();
    /* `undefined` y NO `0`. La diferencia importa: `IconRail` dibuja la pastilla
       con `pending > 0`, así que un 0 no se ve, pero `RailFlyout` usa
       `item.status` para decidir si imprime fila — y `undefined` es lo que hace
       que NO la imprima. Un 0 inventado dejaría al modulo forbidding un "0
       pendientes" si alguien agrega despues un `?? 0` por costumbre. */
    expect(proyecto!.pending).toBeUndefined();
  });

  it('las fases siguen contando, y el proyecto no las contamine', () => {
    // El control: si el proyecto no tiene conteo pero las fases sí, el derivado
    // esta bien. Si las fases tampoco contaran, el guardián de arriba pasaría
    // por la razón equivocada — con el rail entero sin contar.
    const estados = readPhaseStates({
      hasDoc: true,
      portada: { title: '', apa_format: 'student' } as never,
      coverSetupDone: false,
      elements: [],
      hasReferences: false,
      reviewResult: null,
      proofreadFindings: [],
      citationAuditResult: null,
    });
    expect(Object.keys(estados).length).toBeGreaterThan(0);
    expect(estados[1].pending).toBeGreaterThan(0);
  });
});

describe('abrir el Explorador es una capa, no un salto de pantalla', () => {
  it('no expulsa del túnel de exportación', () => {
    /* ESTE TEST CORRIGE UNA EXPECTATIVA MIA, Y EL MOTIVO ESTA EN EL CODIGO.
       Escribi primero que un clic en el proyecto "vuelve a viewMode: edit", por
       la regla de AGENTS.md de que un destino del rail es una fase. Copiada tal
       cual, esa regla EXPULSA a la persona del túnel de exportación: estaba a
       punto de exportar, abre la carpeta para ver un archivo y pierde elExportar
       que estaba a medio preparar.

       El Explorador no es una fase: es un MODAL ENCIMA de lo que hay. Abrir una
       carpeta no reemplaza la pantalla de abajo. Por eso NO se toca `viewMode`,
       y por eso el unico lugar de esta seccion que si mira `viewMode` es el de
       los destinos que si son fases (ver `AppShell`). */
    useDocStore.setState({ viewMode: 'export' });
    render(<AppShell><div>centro</div></AppShell>);
    fireEvent.click(screen.getByTestId('icon-rail').querySelector('[aria-label*="royecto" i]') as HTMLElement);
    expect(useDocStore.getState().exploradorAbierto).toBe(true);
    expect(useDocStore.getState().viewMode).toBe('export');
  });

  it('el rail no marca DOS destinos como "estás acá"', () => {
    /* Y el costo de no tocar `viewMode`: el túnel sigue abierto debajo, así que
       hay dos candidatos a "destino a la vista" — Exportar y el Explorador. Si
       los dos se marcan `current`, el rail afirma DOS destinos a la vez, que es
       justo lo que `AGENTS.md` prohibe. Gana el Explorador porque es lo que está
       ENCIMA: la capa superior es la que la persona ve.

       SE AFIRMA SOBRE `current` Y NO SOBRE CUANTOS `aria-current` HAY. El rail
       ilumina además la fase del `wizardStep` —eso es lo que hace `IconRail` con
       `isActive`, y es correcto—, así que el número de `aria-current` en el DOM
       es 2 aunque solo uno sea `current`. Contar etiquetas mide una regla
       distinta a la que importa. */
    useDocStore.setState({ viewMode: 'export' });
    const { result } = renderHookDestinos();
    useDocStore.setState({ exploradorAbierto: true });
    const { result: conExplorador } = renderHookDestinos();

    const marcados = conExplorador.filter((d) => d.current === true);
    expect(marcados.map((d) => d.id)).toEqual(['proyecto']);
    // El control: sin el Explorador abierto, el que se marca es Exportar.
    expect(result.filter((d) => d.current === true).map((d) => d.id)).toEqual(['step-6']);
  });

  it('al cerrar el Explorador, el acento vuelve al túnel', () => {
    useDocStore.setState({ viewMode: 'export' });
    render(<AppShell><div>centro</div></AppShell>);
    const boton = () => screen.getByTestId('icon-rail').querySelector('[aria-label*="royecto" i]') as HTMLElement;
    fireEvent.click(boton());
    fireEvent.click(boton());
    expect(useDocStore.getState().exploradorAbierto).toBe(false);
    const { result } = renderHookDestinos();
    expect(result.filter((d) => d.current === true).map((d) => d.id)).toEqual(['step-6']);
  });
});

/** Los destinos tal como los pinta el rail, sin montar el componente. */
function renderHookDestinos() {
  let captured: ReturnType<typeof useRailDestinations> = [];
  function Probe() {
    captured = useRailDestinations();
    return null;
  }
  render(<Probe />);
  return { result: captured };
}

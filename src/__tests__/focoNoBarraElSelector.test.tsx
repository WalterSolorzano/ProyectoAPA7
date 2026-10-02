/**
 * EL MODO FOCO NO PUEDE DEJAR UNA PANTALLA SIN SELECTOR.
 *
 * El defecto: en el paso 2, `App.tsx` montaba `StructureTabBar` con
 * `wizardStep === 2 && !focusMode`, y elegía el contenido con `structureTab`
 * sin mirar `focusMode`. Con el foco prendido, `Índice` quedaba sin selector
 * visible: no había forma de volver a `Títulos` ni a `Cuerpo`, y el diseño
 * viejo se volvía inalcanzable. El usuario pidió explícitamente que no se
 * pierda, y un diseño que no se puede alcanzar está perdido.
 *
 * LO QUE SE AFIRMA, Y POR QUÉ NO ES UNA PRUEBA DE TEXTO DE FUENTE
 *
 * Hay pruebas en este repo que leen `App.tsx` con `?raw` y buscan un patrón.
 * Una de esas no distingue "monta la barra siempre" de "monta la barra con
 * otra condición que también es cierta en el caso que importa". Esta prueba
 * MONTA la fase 2 con el foco prendido y aprieta el botón, que es lo que hace
 * una persona.
 *
 * Y no se reimplementa `App`: se monta el de verdad, con el store real y las
 * piezas pesadas sustituidas por su lugar. Reimplementar el árbol dentro de la
 * prueba probaría la prueba.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

/* Los visores de PDF piden `DOMMatrix` en el import y no tienen nada que ver con
   el selector de la fase 2. Se los cambia por su lugar. */
vi.mock('../components/layout/PDFPreview', () => ({ PDFPreview: () => null }));
vi.mock('../components/layout/ReactPDFPreview', () => ({ ReactPDFPreview: () => null }));

/* La barra lateral de actividad, el mapa y los lienzos de cada fase: son
   hermanos de la barra que se está probando, y ninguno participa de la
   navegación. Un fallo de ellos no puede ser el fallo de esta prueba.

   Los mocks DICEN que están montados, con un `data-testid`. Un mock que
   devuelve `null` hace que "no aparece en pantalla" sea cierto siempre, y con
   él una prueba que afirma que algo NO se monta pasa sin haber nada que no se
   montara: es una guarda que vigila y no vigila. */
vi.mock('../components/activity/RightSidePanel', () => ({
  RightSidePanel: () => <div data-testid="panel-actividad" />,
}));
vi.mock('../components/layout/PaperCanvas', () => ({
  PaperCanvas: () => <div data-testid="lienzo" />,
  computePages: () => [],
}));
vi.mock('../components/wizard/Step2HeadingsWizard', () => ({
  Step2HeadingsWizard: () => <div data-testid="fase-titulos" />,
}));
vi.mock('../components/wizard/Step5BodyWizard', () => ({
  Step5BodyWizard: () => <div data-testid="fase-cuerpo" />,
}));

import { useDocStore } from '../store/useDocStore';
import App from '../App';

const DOC = {
  session_id: 's-foco',
  file_name: 'tesis.docx',
  elements: [
    {
      id: 'e1', type: 'heading', heading_level: 1, text: '1. Introducción', page_number: 1,
      style_name: 'Normal', alignment: 'left', font_name: 'Times New Roman', font_size: 12,
      is_bold: true, is_italic: false, is_bullet: false, left_indent_cm: 0, confidence: 1,
      is_user_modified: false, needs_review: false, auto_applied: false, cita_ids: [],
    },
  ],
  referencias: [],
  meta: { page_count: 1 },
  portada: { fields: {}, use_original_cover: false },
} as never;

const Poner = (estado: Record<string, unknown>) => act(() => {
  useDocStore.setState({
    doc: DOC,
    atHome: false,
    isBackendReady: true,
    viewMode: 'edit',
    wizardStep: 2,
    structureTab: 'indice',
    focusMode: false,
    showFileMenu: false,
    settingsHubOpen: false,
    commandPaletteOpen: false,
    error: null,
    ...estado,
  } as never);
});

/** El botón de `Títulos` de la barra de la fase 2. */
const pestanaTitulos = () => screen.getByRole('button', { name: /Revisor de T[ií]tulos/ });

beforeEach(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Poner({});
});

describe('el modo foco deja la fase de Estructura con su selector', () => {
  it('con el foco prendido, "Títulos" sigue siendo alcanzable', () => {
    /* El caso central, y el que se perdía. Con el foco prendido, el contenido
       de la fase seguía respondiendo a `structureTab`, pero el selector no
       estaba: `Índice` era un callejón sin salida, y con él se perdían el
       revisor de títulos y el editor de prosa. */
    Poner({ focusMode: true });
    render(<App />);

    expect(pestanaTitulos()).toBeTruthy();
    fireEvent.click(pestanaTitulos());
    expect(screen.getByTestId('fase-titulos')).toBeTruthy();
    expect(useDocStore.getState().structureTab).toBe('headings');
  });

  it('con el foco prendido se puede volver a "Índice" y a "Cuerpo"', () => {
    /* No alcanza con que `Títulos` sea alcanzable una vez: un selector que solo
       deja avanzar es un selector roto. Las tres pestañas del paso 2 tienen que
       seguir siendo alcanzables con el foco prendido. */
    Poner({ focusMode: true, structureTab: 'headings' });
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Esquema Jer[aá]rquico/ }));
    expect(useDocStore.getState().structureTab).toBe('indice');

    fireEvent.click(screen.getByRole('button', { name: /Editor de Prosa/ }));
    expect(useDocStore.getState().structureTab).toBe('body');
    expect(screen.getByTestId('fase-cuerpo')).toBeTruthy();
  });

  it('el foco sigue apagando lo que SÍ es suyo, y esa diferencia es real', () => {
    /* El arreglo no es "el modo foco no hace nada". La barra nunca fue del foco:
       lo que el foco apaga es el panel lateral y el mapa, que se montan en el
       mismo `div` que la fase. Si el foco dejara de apagarlos, el arreglo
       estaría apagando el modo foco entero.

       Y la primera mitad de esta prueba es la que hace que la segunda diga algo:
       sin el foco, el panel ESTÁ. Un `queryByTestId(...).toBeNull()` sobre un
       panel que nunca se monta pasa sin mirar nada. */
    const { unmount } = render(<App />);
    expect(screen.getByTestId('panel-actividad'), 'sin foco el panel tiene que estar').toBeTruthy();
    unmount();

    Poner({ focusMode: true });
    render(<App />);
    expect(screen.queryByTestId('panel-actividad')).toBeNull();
  });

  it('sin foco, el paso 2 se comporta igual: el selector nunca se fue', () => {
    /* La otra mitad de no romper nada. La barra con `!focusMode` solo se
       notaba cuando el foco estaba prendido, así que la forma de no romper el
       caso común es comprobar que sigue siendo el mismo. */
    Poner({ focusMode: false });
    render(<App />);
    fireEvent.click(pestanaTitulos());
    expect(screen.getByTestId('fase-titulos')).toBeTruthy();
  });
});

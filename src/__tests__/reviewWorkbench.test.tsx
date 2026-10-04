/**
 * WordAPA7 — T16: el workbench de Revision ARMA las tres columnas y es
 * honesto con lo que no sabe.
 *
 * Este archivo no prueba que existan las piezas (eso lo hacen T12 a T15), sino
 * que la vista que las junta no miente: no pone una caja sin alto donde el
 * auto-ajuste necesita una, no deja un boton encendido que no hace nada, no
 * ofrece "Aceptar" sobre el motor probabilistico, y cuando una accion en masa
 * cubre menos que el motor entero, lo dice en la cabecera en vez de dejar que
 * se descubra a medias.
 *
 * `PaperCanvas` va simulado con `importOriginal` y no con un objeto vacio: el
 * indice de paginas (`usePageIndex`) importa `computeRenderedPages` de ESE
 * modulo, y un mock sin esa exportacion revienta el hook que publica los
 * numeros de pagina.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { ReviewWorkbench } from '../components/review/ReviewWorkbench';
import { Step5AuditIAWizard } from '../components/wizard/Step5AuditIAWizard';

/* El lienzo va simulado, pero NO como una caja vacía: se registra la prop con
   la que lo montaron, porque el lavado de acento de "qué bloques tienen
   hallazgos" SOLO existe si el workbench le pasa el conjunto, y una caja que
   ignora sus props no puede decir si lo hizo. El `importOriginal` conserva las
   exportaciones reales porque el índice de páginas (`usePageIndex`) importa
   `computeRenderedPages` de ese módulo. */
const highlightedInCanvas: Array<Set<string> | undefined> = [];
vi.mock('../components/layout/PaperCanvas', async (importOriginal) => {
  const real = await importOriginal<typeof import('../components/layout/PaperCanvas')>();
  return {
    ...real,
    PaperCanvas: (props: { reviewHighlightIds?: Set<string> }) => {
      highlightedInCanvas.push(props.reviewHighlightIds);
      return <div data-testid="canvas" />;
    },
  };
});
/* El mock trae las CONSTANTES tambien, no solo el componente: la grilla del
   workbench decide si reserva la columna del minimapa con el mismo numero que el
   componente, y un mock que solo devuelve el componente deja a la grilla sin
   regla, que es como una grilla reserva una columna que nadie pinta. */
vi.mock('../components/review/ReviewMinimap', () => ({
  ReviewMinimap: () => <div data-testid="minimap" />,
  MINIMAP_WIDTH: 44,
  MINIMAP_ANCHO_MINIMO: 640,
}));

/* ── Utilidades de datos ──────────────────────────────────────────────────── */

/** El código sin comentarios: una regla que habla de "no comparar" no puede
 *  encontrar su comparación en un comentario que la explica. */
const codigoDe = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Comparar la CATEGORÍA de un hallazgo es re-derivar el predicado del filtro, y
 *  el predicado es del hook. Se busca el campo, no el nombre de la variable: una
 *  re-derivación con otro nombre (`f.category === filtro`) tiene que caer
 *  también. */
const COMPARA_CATEGORIA = (codigo: string): string[] =>
  [...codigo.matchAll(/[\w$]+\.category\s*(===|!==)/g)].map((m) => m[0]);

const elemento = (over: Record<string, unknown> = {}) => ({
  id: 'e1', type: 'paragraph', text: 'primer parrafo', style_name: 'Normal',
  alignment: 'left', font_name: 'Times New Roman', font_size: 12, is_bold: false,
  is_italic: false, is_bullet: false, left_indent_cm: 0, confidence: 1,
  is_user_modified: false, needs_review: false, auto_applied: false, cita_ids: [],
  ...over,
});

const documento = (elements: unknown[]) => ({
  session_id: 's-t16', file_name: 't.docx', apa_format: 'student',
  referencias: [], meta: { page_count: 1 }, elements,
});

const hallazgo = (over: Record<string, unknown> = {}) => ({
  element_id: 'e1', start: 0, end: 7, excerpt: 'tambien', kind: 'ortografia',
  severity: 'error', message: 'Falta tilde', suggestion: 'también',
  source: 'local', ...over,
});

/** Hallazgo de IA: el motor PROBABILISTICO, el unico que nunca acepta. */
const fraseIA = (over: Record<string, unknown> = {}) =>
  hallazgo({ kind: 'ai_phrase', severity: 'warn', message: 'Frase de plantilla', suggestion: '', ...over });

/** Párrafo del REVISOR de IA: el que produce los hallazgos del motor 'ai'
 *  (`collectAuditItems` los toma de `reviewResult.paragraphs`, no del
 *  corrector). Un `ai_phrase` del corrector también es del motor 'ai', pero
 *  por otra ruta; este es el que hace falta cuando el test habla del
 *  revisor. */
const fraseIAIA = (element_id: string) => ({
  element_id, index: 0, type: 'paragraph', text: 'texto', ai_score: 82,
  ai_category: 'HIGH', findings: [], spelling: [],
});

const store = (extra: Record<string, unknown> = {}) => {
  useDocStore.setState({
    doc: null, reviewResult: null, proofreadFindings: [], citationAuditResult: null,
    aiIndices: null, validationIssues: [], sugerenciasProactivas: true,
    dismissedCommentIds: [],
    /* El estado de corrida se limpia con el resto. Sin esto, un test que deje
       un globo prendido contaminaría todos los que vienen: el store es global
       y estos tests comparten módulo. */
    isAuditing: false, motoresAuditando: [],
    ...extra,
  } as never);
};

const ANCHO_ORIGINAL = window.innerWidth;
const fijarAncho = (px: number) =>
  Object.defineProperty(window, 'innerWidth', { value: px, configurable: true, writable: true });

/** El rack de hallazgos, por su rol y su nombre: la columna de la derecha. */
const rack = (): HTMLElement => screen.getByRole('complementary', { name: 'Hallazgos por motor' });
const tarjeta = (): HTMLElement => screen.getByLabelText('Párrafo en revisión');

beforeEach(() => {
  // jsdom no trae ResizeObserver y la tarjeta de lectura lo necesita.
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  fijarAncho(1440);
  highlightedInCanvas.length = 0;
});

afterEach(() => {
  fijarAncho(ANCHO_ORIGINAL);
  vi.restoreAllMocks();
});

/* ── Las tres columnas ────────────────────────────────────────────────────── */

describe('T16 — ReviewWorkbench: las tres columnas', () => {
  it('monta minimapa, lectura y rack de hallazgos', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    render(<ReviewWorkbench />);
    expect(screen.getByTestId('minimap')).toBeTruthy();
    expect(tarjeta()).toBeTruthy();
    // El motor vive en `ENGINE_META` y el boton de la cabecera lo nombra: el
    // chip de la tira lleva el mismo nombre, asi que se busca DENTRO del rack.
    expect(within(rack()).getByRole('button', { name: /Ortografía/ })).toBeTruthy();
  });

  it('arranca en la tarjeta de lectura, no en la hoja', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    render(<ReviewWorkbench />);
    expect(tarjeta()).toBeTruthy();
    expect(screen.queryByTestId('canvas')).toBeNull();
  });

  it('la hoja sustituye a la tarjeta cuando se pide el modo Hoja', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    render(<ReviewWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Hoja' }));
    expect(screen.getByTestId('canvas')).toBeTruthy();
    expect(screen.queryByLabelText('Párrafo en revisión')).toBeNull();
  });

  it('en modo Hoja, el lienzo recibe los bloques que tienen hallazgos', () => {
    /* El lavado de acento es la única señal de "mira acá" que el modo Hoja
       tiene, y sin él la hoja es un documento limpio: el que lo abrió
       precisamente para ver dónde están los problemas. El conjunto lo publica
       el hook y lo recorta el filtro, así que tampoco se re-deriva acá. */
    store({
      doc: documento([elemento(), elemento({ id: 'e2', text: 'segundo parrafo' })]) as never,
      proofreadFindings: [
        hallazgo(),
        hallazgo({ element_id: 'e2', start: 0, end: 3, excerpt: 'seg' }),
      ] as never,
    });
    render(<ReviewWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Hoja' }));
    const pasado = highlightedInCanvas[highlightedInCanvas.length - 1];
    expect(pasado).toBeInstanceOf(Set);
    expect([...(pasado as Set<string>)].sort()).toEqual(['e1', 'e2']);
  });

  it('el lavado del lienzo sigue al filtro, como el resto de la vista', () => {
    // El mismo conjunto que cuenta `visibleCount`: con el filtro en un motor, el
    // lienzo no puede seguir teñiendo bloques de un motor que no se está
    // mirando.
    store({
      doc: documento([elemento(), elemento({ id: 'e2', text: 'segundo parrafo' })]) as never,
      proofreadFindings: [hallazgo()] as never,
      reviewResult: { paragraphs: [fraseIAIA('e2')] } as never,
    });
    render(<ReviewWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Patrones IA 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hoja' }));
    const pasado = highlightedInCanvas[highlightedInCanvas.length - 1] as Set<string>;
    expect([...pasado]).toEqual(['e2']);
  });

  it('la tira de arriba es la unica barra de la vista', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    const { container } = render(<ReviewWorkbench />);
    /* La asercion va ACOTADA a los hijos directos del workbench: la tarjeta de
       lectura tambien usa <header> para el encabezado de su seccion, y contar
       <header> en todo el arbol encontraria dos barras donde hay una. */
    const raiz = container.firstElementChild as HTMLElement;
    const barras = [...raiz.children].filter((c) => (c.getAttribute('style') || '').includes('height: 44px'));
    expect(barras).toHaveLength(1);
    expect(raiz.children[0]).toBe(barras[0]);
    expect([...raiz.children].some((c) => c.tagName === 'HEADER')).toBe(false);
  });

  it('el centro tiene una caja acotada: sin eso el auto-ajuste no significa nada', () => {
    // `FocusReadingCard` decide el cuerpo del parrafo comparando scrollHeight
    // contra clientHeight de un hijo con `flex: 1` + `minHeight: 0`. Los dos
    // son inertes sin un padre de alto DEFINIDO: si la pista de la grilla no
    // esta acotada a minmax(0, 1fr) y el contenedor no recorta, la caja se
    // midio contra un padre que crece con el texto y el ajuste no decide nada.
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    render(<ReviewWorkbench />);
    const centro = tarjeta().parentElement as HTMLElement;
    expect(centro.style.gridTemplateRows).toBe('minmax(0, 1fr)');
    expect(centro.style.minHeight).toBe('0px');
    expect(centro.style.overflow).toBe('hidden');
  });

  it('la RAÍZ declara su alto: sin eso la cadena de alturas no cierra', () => {
    /* El aserto de arriba mira la PISTA de la grilla, que es donde se rompe la
       cadena hacia arriba, no donde se rompe. El padre de esta vista
       (`App.tsx`) es una caja de BLOQUE, así que el `flex: 1` de la raíz no
       la estira: sin un `height` explícito su alto sale del contenido, la
       pista `minmax(0, 1fr)` resuelve contra max-content, y las dos cajas que
       sí se desplazan crecen con lo que contienen. Lo que se rompe entonces es
       el AUTO-AJUSTE: `cabe()` compara `scrollHeight` contra `clientHeight` de
       una caja que nunca desborda, así que siempre "cabe" a 19px y el tope de
       26 líneas nunca llega a morder — la función que da nombre a la rama
       midiendo un nombre, no una altura.

       jsdom no hace layout, así que esto no prueba geometría: ata la
       DECLARACIÓN de la que la geometría depende. La medición en navegador se
       reporta aparte. */
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    const { container } = render(<ReviewWorkbench />);
    const raiz = container.firstElementChild as HTMLElement;
    expect(raiz.style.height).toBe('100%');
    /* Y la cadena entera, de arriba abajo: raíz → pista → centro. Las tres
       mitades, porque basta que caiga una para que el auto-ajuste sea inerte. */
    expect(raiz.style.minHeight).toBe('0px');
    const pista = raiz.children[1] as HTMLElement;
    expect(pista.style.gridTemplateRows).toBe('minmax(0, 1fr)');
  });

  it('en ventana estrecha el rack se retira y el centro conserva el ancho', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    fijarAncho(900);
    render(<ReviewWorkbench />);
    expect(screen.queryByRole('complementary', { name: 'Hallazgos por motor' })).toBeNull();
    expect(tarjeta()).toBeTruthy();
    /* Y la grilla pierde la tercera columna en vez de dejar una vacía. La
       primera es de 44 px, no de 19: el número de página tiene que entrar en la
       columna, y una columna de 19 px no lo admite. A 900 px el minimapa sigue
       visible, así que su columna sigue reservada. */
    const centro = tarjeta().parentElement as HTMLElement;
    expect(centro.style.gridTemplateColumns).toBe('44px minmax(0, 1fr)');
  });

  it('con la ventana mas angosta que el minimapa, la grilla NO reserva su columna', () => {
    /* La otra mitad de la regla: si la columna se reservara siempre, en ventana
       angosta quedaria un hueco de 44 px al lado del texto. Se veria que falta
       algo y no se sabria que, que es peor que no tener minimapa. El componente
       se esconde con `MINIMAP_ANCHO_MINIMO` y la grilla con el MISMO numero, y
       por eso las dos mitades no pueden desincronizarse. */
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    fijarAncho(600);
    render(<ReviewWorkbench />);
    expect(screen.queryByTestId('minimap')).toBeNull();
    const centro = tarjeta().parentElement as HTMLElement;
    expect(centro.style.gridTemplateColumns).toBe('minmax(0, 1fr)');
  });

  it('el rack vuelve a aparecer al ensanchar la ventana', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    fijarAncho(900);
    render(<ReviewWorkbench />);
    expect(screen.queryByRole('complementary', { name: 'Hallazgos por motor' })).toBeNull();
    fijarAncho(1440);
    fireEvent(window, new Event('resize'));
    expect(rack()).toBeTruthy();
  });
});

/* ── Lo que el workbench dice cuando no sabe ─────────────────────────────── */

describe('T16 — ReviewWorkbench: honestidad de los estados vacíos', () => {
  it('sin hallazgos ofrece Escanear en vez de una lista vacia', () => {
    store({ doc: documento([elemento()]) as never });
    render(<ReviewWorkbench />);
    /* DOS "Escanear": el de la tira y el del estado vacío. Antes había uno solo
       y estaba en la tira, y el estado vacío decía "pulsa Escanear" sin ofrecer
       el botón: un texto que manda a 44px de la grilla. Ahora el estado vacío
       trae la acción de verdad, y por eso el nombre no identifica uno. */
    expect(screen.getAllByRole('button', { name: 'Escanear' }).length).toBe(2);
    /* El mensaje ya NO vive en el rack. Vivir en el rack era el defecto: el rack
       se retira bajo 1180 px, y con el se retiraba el mensaje, así que en
       ventana angosta la pantalla no tenía explicación. Ahora está en la grilla
       principal, que siempre se renderiza — y por eso `within(rack())` lo
       BUSCA y no lo encuentra, que es la mitad de lo que esta prueba fija. */
    expect(within(rack()).queryByText(/Ningún motor reportó hallazgos/)).toBeNull();
    expect(screen.getByTestId('estado-vacio').textContent).toMatch(/Ningún motor reportó hallazgos/);
  });

  it('con la ventana angosta y sin hallazgos, el mensaje sigue en pantalla', () => {
    /* El cierre del Review Focus #1. Bajo 1180 px el rack no se renderiza, así
       que el mensaje que vivía adentro tampoco: pantalla vacía sin
       explicación. Ahora el estado vacío está en la grilla principal, y el rack
       no es su dueño. */
    store({ doc: documento([elemento()]) as never });
    fijarAncho(900);
    const { container } = render(<ReviewWorkbench />);
    expect(screen.queryByRole('complementary', { name: 'Hallazgos por motor' })).toBeNull();
    expect(container.textContent).toMatch(/Ningún motor reportó hallazgos/);
    expect(container.textContent).not.toBe('');
  });

  it('con la ventana angosta y sin documento, el mensaje sigue en pantalla', () => {
    /* El otro estado vacío, por el mismo motivo. Un texto que solo existe en una
       ventana ancha es un texto que miente en la angosta. */
    store({ doc: null });
    fijarAncho(900);
    const { container } = render(<ReviewWorkbench />);
    expect(container.textContent).toMatch(/documento/i);
    expect(container.textContent).not.toBe('');
  });

  it('sin documento, el centro lo dice en vez de mostrar un parrafo limpio', () => {
    // Sin `doc` el elemento del hallazgo no se puede resolver: la tarjeta
    // pintaria el texto sin una sola marca, indistinguible de "el motor no
    // encontro nada". El hueco tiene que tener nombre.
    store({ doc: null });
    render(<ReviewWorkbench />);
    expect(screen.queryByLabelText('Párrafo en revisión')).toBeNull();
    expect(screen.getByTestId('estado-vacio').textContent).toMatch(/documento/i);
  });

  it('el filtro que deja la pantalla vacia se NOMBRA, porque es lo que se puede tocar', () => {
    /* Hay hallazgos pero ninguno pasa el filtro: decirlo al revés ("el documento
       no tiene hallazgos") haría creer que el motor no corrió, que es otra
       cosa y otra acción. Y el filtro se nombra por nombre, porque "el filtro" a
       secas deja al usuario adivinando cuál de los cinco apretar. */
    store({
      doc: documento([elemento()]) as never,
      proofreadFindings: [hallazgo(), fraseIA()] as never,
    });
    render(<ReviewWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Ortografía 1' }));
    fireEvent.click(within(rack()).getByRole('button', { name: /Falta ortográfica o tilde/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    const texto = screen.getByTestId('estado-vacio').textContent ?? '';
    expect(texto).toMatch(/filtro/i);
    expect(texto).toMatch(/ortograf/i);
  });

  it('el motor probabilistico no ofrece Aceptar, ni en bloque ni en el detalle', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [fraseIA()] as never });
    render(<ReviewWorkbench />);
    // "Marcar todos" aparece en la cabecera del motor y en la fila del
    // subtipo: los dos existen y ninguno dice "Aceptar".
    expect(within(rack()).getAllByRole('button', { name: 'Marcar todos' }).length).toBeGreaterThan(0);
    expect(within(rack()).queryByRole('button', { name: /Aceptar/ })).toBeNull();
    fireEvent.click(within(rack()).getByRole('button', { name: /Frase típica de IA/ }));
    expect(screen.getByRole('button', { name: /Marcar para revisar/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Aplicar corrección/ })).toBeNull();
  });

  it('la UNICA acción del motor probabilístico deja marca de haber sido pulsada', () => {
    /* AGENTS.md §1 le concede al detector de IA exactamente una cosa: marcar
       para revisar. Si esa marca no se ve, la acción es un gesto sin
       consecuencia: se aprieta, sale un toast y la pantalla queda igual, así que
       se aprieta otra vez. Y el rótulo cambia de "Marcar" a "Marcado" porque es
       el estado, no otra acción. */
    store({ doc: documento([elemento()]) as never, proofreadFindings: [fraseIA()] as never });
    render(<ReviewWorkbench />);
    fireEvent.click(within(rack()).getByRole('button', { name: /Frase típica de IA/ }));
    const marcar = screen.getByRole('button', { name: 'Marcar para revisar' });
    expect(marcar.hasAttribute('disabled')).toBe(false);
    fireEvent.click(marcar);
    const marcado = screen.getByRole('button', { name: 'Marcado para revisar' });
    expect(marcado.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/Marcado para revisión manual/)).toBeTruthy();
  });

  it('la acción que solo ANOTA no lleva el acento sólido', () => {
    /* La regla del archivo: el acento sólido es de la acción que cambia el
       documento. En un hallazgo de IA el botón de marcar es el ÚNICO, así que
       con el sólido el motor que nunca acepta era el único con todo el peso
       visual de la rama. Los mecanismos de documento (rotular, resolver citas)
       tampoco lo llevan, por el mismo motivo que fijó la cabecera del motor. */
    store({ doc: documento([elemento()]) as never, proofreadFindings: [fraseIA()] as never });
    render(<ReviewWorkbench />);
    fireEvent.click(within(rack()).getByRole('button', { name: /Frase típica de IA/ }));
    const marcar = screen.getByRole('button', { name: 'Marcar para revisar' });
    expect(marcar.getAttribute('style') || '').not.toContain('background: var(--color-accent)');
  });

  it('los mecanismos de DOCUMENTO tampoco llevan el acento sólido en el detalle', () => {
    // La cabecera ya lo decidió (`EngineGroupCard`); el detalle es el mismo
    // criterio aplicado a la fila. Rotular y resolver redactan sobre todo el
    // archivo: no son la corrección de este texto, y con el acento sólido las
    // dos acciones de la fila se leían como la misma.
    store({
      doc: documento([elemento(), FIGURA_SIN_LEYENDA]) as never,
    });
    render(<ReviewWorkbench />);
    fireEvent.click(within(rack()).getByRole('button', { name: /Figura sin rotular/ }));
    const rotular = screen.getByRole('button', { name: 'Rotular todo' });
    expect(rotular.getAttribute('style') || '').not.toContain('background: var(--color-accent)');
  });
});

/* ── La accion en masa, cuando no cubre el motor entero ──────────────────── */

describe('T16 — la acción en masa dice hasta dónde llega', () => {
  it('una accion parcial lo declara en la cabecera del motor', () => {
    // `voz_pasiva` es 'mark' (el motor la detecta y no sabe corregirla) y
    // `first_person` es 'accept'. El botón del motor dice "Aceptar todas" y
    // `runGroupAction` solo toca los subtipos de acuerdo: sin este aviso, la
    // persona creería que se toco el motor entero.
    store({
      doc: documento([elemento()]) as never,
      proofreadFindings: [
        hallazgo({ kind: 'passive_voice', severity: 'info', message: 'voz pasiva', suggestion: '' }),
        hallazgo({ kind: 'first_person', severity: 'info', message: 'primera persona', suggestion: '' }),
      ] as never,
    });
    render(<ReviewWorkbench />);
    const cabecera = within(rack()).getByRole('button', { name: /Redacción & Bloom/ });
    expect(cabecera).toBeTruthy();
    expect(screen.getByText('1 de 2 hallazgos de este motor no tienen corrección automática.')).toBeTruthy();
  });

  it('un motor sin nada que aplicar en bloque lo declara antes de que se pulse', () => {
    // Todos los subtipos del motor son 'mark': el botón de cabecera queda
    // encendido y no hay ni un hallazgo que la acción cubra.
    store({
      doc: documento([elemento()]) as never,
      proofreadFindings: [hallazgo({ kind: 'passive_voice', severity: 'info', message: 'voz pasiva', suggestion: '' })] as never,
    });
    render(<ReviewWorkbench />);
    expect(screen.getByText(/no tiene nada que aplicar en bloque/)).toBeTruthy();
  });

  it('un motor cubierto entero no lleva aviso de cobertura', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    render(<ReviewWorkbench />);
    expect(screen.queryByText(/de este motor no tienen corrección automática/)).toBeNull();
    expect(screen.queryByText(/no tiene nada que aplicar en bloque/)).toBeNull();
  });

  it('la cobertura la CUENTA el hook, no la vuelve a derivar la vista', () => {
    /* `coberturaDeMotor` es la REDACCIÓN del aviso; los dos números que la
       sostienen (`covered` y `count`) los publica el hook, que es quien aplica
       el alcance. Si la vista los re-derivara, cambiar el alcance en el hook
       dejaría el aviso diciendo una cosa y la acción haciendo otra — y el aviso
       es lo que la persona lee antes de apretar. */
    expect(codigoDe(SRC)).not.toMatch(/group\.groups\.filter/);
    expect(codigoDe(SRC)).toMatch(/group\.covered/);
    expect(codigoDe(HOOK)).toMatch(/covered:/);
  });
});

/* ── La acción en masa no se puede repetir mientras corre ─────────────────── */

describe('T16 — "Aceptar todas" no es reentrante', () => {
  it('mientras la tanda corre, los controles de escribir están apagados', async () => {
    /* `acceptMany` recorre los hallazgos de uno en uno y hace una llamada de
       red por hallazgo. Sin cerrojo, un segundo "Aceptar todas" dispara las
       MISMAS llamadas sobre los MISMOS elementos y el documento queda con una
       de las dos correcciones, elegida por quién escribió último. El `busy`
       del detalle existía para esto y era `false` constante. */
    const pendientes: Array<() => void> = [];
    const updateElementText = vi.fn(
      () => new Promise<void>((resolve) => { pendientes.push(resolve); }),
    );
    store({
      doc: documento([elemento(), elemento({ id: 'e2', text: 'otro' })]) as never,
      proofreadFindings: [
        hallazgo(),
        hallazgo({ element_id: 'e2', start: 0, end: 3, excerpt: 'otr' }),
      ] as never,
      updateElementText: updateElementText as never,
    });
    render(<ReviewWorkbench />);

    const aceptarTodas = within(rack()).getAllByRole('button', { name: 'Aceptar todas' })[0];
    fireEvent.click(aceptarTodas);
    await act(async () => { await Promise.resolve(); });

    // La tanda está en vuelo: la cabecera se apaga, y con ella la fila.
    const cabeceras = within(rack()).getAllByRole('button', { name: 'Aceptar todas' });
    expect(cabeceras.length).toBeGreaterThan(0);
    expect(cabeceras.every((b) => b.hasAttribute('disabled'))).toBe(true);
    // Y un segundo clic no dispara OTRA tanda.
    fireEvent.click(cabeceras[0]);
    await act(async () => { await Promise.resolve(); });
    expect(updateElementText).toHaveBeenCalledTimes(1);

    // Al terminar vuelve a estar disponible: el cerrojo no es una puerta que
    // se queda cerrada.
    await act(async () => {
      for (let i = 0; i < 4; i += 1) {
        while (pendientes.length) (pendientes.shift() as () => void)();
        await Promise.resolve();
      }
    });
    const libres = within(rack()).queryAllByRole('button', { name: 'Aceptar todas' });
    if (libres.length) expect(libres[0].hasAttribute('disabled')).toBe(false);
  });

  it('dos pulsaciones en el mismo tick no escriben dos veces', async () => {
    /* El caso que un `useState` no cubre: dos clics en el mismo tick leen el
       mismo `isApplying` del render anterior. Por eso el cerrojo es un ref. */
    const pendientes: Array<() => void> = [];
    const updateElementText = vi.fn(
      () => new Promise<void>((resolve) => { pendientes.push(resolve); }),
    );
    store({
      doc: documento([elemento()]) as never,
      proofreadFindings: [hallazgo()] as never,
      updateElementText: updateElementText as never,
    });
    render(<ReviewWorkbench />);
    const [cabecera, fila] = within(rack()).getAllByRole('button', { name: 'Aceptar todas' });
    act(() => {
      fireEvent.click(cabecera);
      fireEvent.click(fila);
    });
    await act(async () => { await Promise.resolve(); });
    expect(updateElementText).toHaveBeenCalledTimes(1);
    await act(async () => {
      for (let i = 0; i < 4; i += 1) {
        while (pendientes.length) (pendientes.shift() as () => void)();
        await Promise.resolve();
      }
    });
  });
});

/* ── "Siguiente hallazgo" a traves del filtro ─────────────────────────────── */

describe('T16 — el filtro no deja botones encendidos que no hacen nada', () => {
  it('con el filtro sin hallazgos propios, "Siguiente hallazgo" se apaga', () => {
    // `hasFindings` cuenta TODOS los hallazgos, pero `nextFinding` recorre los
    // del filtro. Si el unico motor filtrado se queda sin hallazgos, el boton
    // queda encendido y no hace nada: hay hallazgos, pero no hay a donde ir.
    store({
      doc: documento([elemento()]) as never,
      proofreadFindings: [hallazgo(), fraseIA()] as never,
    });
    render(<ReviewWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Ortografía 1' }));
    fireEvent.click(within(rack()).getByRole('button', { name: /Falta ortográfica o tilde/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    // Queda el hallazgo de IA. "Escanear" sigue disponible —con hallazgos,
    // editar el documento y re-escanear es justo lo que hace falta—, y lo que
    // se apaga es el botón sin destino. Que haya dos "Escanear" (el de la tira
    // y el del estado vacío) es correcto: los dos ejecutan el mismo `scanAll`.
    expect(screen.getAllByRole('button', { name: 'Escanear' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Siguiente hallazgo' }).hasAttribute('disabled')).toBe(true);
    // Y el estado vacío lo dice, en vez de quedarse mudo con el filtro puesto.
    expect(within(rack()).queryByText(/vuelve a "Todo"/i)).toBeNull();
    expect(screen.getByTestId('estado-vacio').textContent).toMatch(/vuelve a "Todo"/i);
  });

  it('con hallazgos visibles del filtro, "Siguiente hallazgo" avanza', () => {
    store({
      doc: documento([elemento()]) as never,
      proofreadFindings: [hallazgo(), fraseIA()] as never,
    });
    render(<ReviewWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Ortografía 1' }));
    expect(screen.getByRole('button', { name: 'Siguiente hallazgo' }).hasAttribute('disabled')).toBe(false);
  });
});

/* ── El detalle: la accion la DECLARA el grupo ───────────────────────────── */

/* Una figura sin leyenda: el motor Estructura la reporta y su mecanismo es
   `autoCaption`, que redacta la leyenda de TODAS las figuras del documento. */
const FIGURA_SIN_LEYENDA = elemento({
  id: 'f1', type: 'image',
  image_info: { relative_url: 'f.png', caption: '', figure_number: 0, alignment: 'center' },
});

describe('T16 — el detalle ejecuta la acción que declara su grupo', () => {
  const FIGURA = FIGURA_SIN_LEYENDA;

  it('rotular figuras llama al mecanismo del motor, no a "aplicar corrección"', () => {
    const autoCaptionAll = vi.fn().mockResolvedValue(undefined);
    store({ doc: documento([elemento(), FIGURA]) as never, autoCaptionAll: autoCaptionAll as never });
    render(<ReviewWorkbench />);
    fireEvent.click(within(rack()).getByRole('button', { name: /Figura sin rotular/ }));
    // La accion del subtipo es 'autoCaption': la leyenda la redacta el motor
    // sobre el documento, no es un texto para pegar en el elemento.
    expect(screen.getByRole('button', { name: 'Rotular todo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Aplicar corrección/ })).toBeNull();
    expect(screen.getByText('Rotulación propuesta por el motor')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rotular todo' }));
    expect(autoCaptionAll).toHaveBeenCalled();
  });

  it('la cabecera y el detalle de un mecanismo de documento no se contradicen', () => {
    /* Estructura y Citas redactan legends y resuelven citas ausentes sobre TODO
       el documento. La cabecera del motor y el control de la aparición son el
       MISMO mecanismo: si se llaman distinto, la tarjeta muestra dos nombres
       para una acción, y "Aceptar todas" además promete corregir el texto del
       hallazgo, que es otra cosa. Este test ata las dos etiquetas: el mismo
       verbo, y el alcance ("documento") dicho en la que puede leerse de un
       vistazo. */
    const autoCaptionAll = vi.fn().mockResolvedValue(undefined);
    const autoResolveGhosts = vi.fn().mockResolvedValue(undefined);
    store({
      doc: documento([elemento(), FIGURA]) as never,
      citationAuditResult: {
        ghost_citations: [{ citation_text: 'García, 2020', element_id: 'e1' }],
        orphan_references: [],
      } as never,
      autoCaptionAll: autoCaptionAll as never,
      autoResolveGhosts: autoResolveGhosts as never,
    });
    render(<ReviewWorkbench />);

    const rotulo = (b: HTMLElement) => (b.textContent || '').trim();
    const verbo = (b: HTMLElement) => rotulo(b).split(/\s+/)[0].toLowerCase();
    /* La tarjeta del motor, no el rack entero: el botón de la cabecera y el de
       la fila de subtipo se llaman igual (mismo `massLabel`), y el que se busca
       es el primero. */
    const tarjetaDe = (motor: RegExp) =>
      within(rack()).getByRole('button', { name: motor }).closest('section') as HTMLElement;

    const cabeceraRotular = within(tarjetaDe(/Estructura \(/))
      .getAllByRole('button', { name: /Rotular/ })[0];
    expect(rotulo(cabeceraRotular)).toMatch(/documento/);
    expect(rotulo(cabeceraRotular)).not.toMatch(/Aceptar/);
    fireEvent.click(within(tarjetaDe(/Estructura \(/)).getByRole('button', { name: /Figura sin rotular/ }));
    expect(verbo(cabeceraRotular)).toBe(verbo(screen.getByRole('button', { name: 'Rotular todo' })));

    fireEvent.click(within(tarjetaDe(/Citas \(/)).getByRole('button', { name: /Citas \(/ }));
    const cabeceraCitas = within(tarjetaDe(/Citas \(/))
      .getAllByRole('button', { name: /Resolver citas/ })[0];
    expect(rotulo(cabeceraCitas)).toMatch(/documento/);
    expect(rotulo(cabeceraCitas)).not.toMatch(/Aceptar/);
    fireEvent.click(within(tarjetaDe(/Citas \(/)).getByRole('button', { name: /Cita ausente en bibliografía/ }));
    expect(verbo(cabeceraCitas)).toBe(verbo(screen.getByRole('button', { name: 'Resolver citas' })));
  });

  it('las flechas de aparición mueven la lectura a la siguiente del subtipo', () => {
    store({
      doc: documento([elemento(), elemento({ id: 'e2', text: 'segundo parrafo' })]) as never,
      proofreadFindings: [
        hallazgo(),
        hallazgo({ element_id: 'e2', start: 0, end: 3, excerpt: 'tambien' }),
      ] as never,
    });
    render(<ReviewWorkbench />);
    /* La tarjeta arranca con un hallazgo —la siembra— así que ya no hay que
       apretar "Siguiente hallazgo" solo para que deje de decir "Sin hallazgo
       seleccionado". Ver `reviewArranque.test.ts`.
     *
     * Y el grupo se abre explícitamente, en vez de confiar en cuál abre por
     * defecto: la prueba es de las flechas, no de qué grupo se despliega. */
    fireEvent.click(within(rack()).getByRole('button', { name: /Falta ortográfica o tilde/ }));
    expect(tarjeta().textContent).toContain('primer parrafo');
    fireEvent.click(screen.getAllByRole('button', { name: 'Siguiente aparición' })[0]);
    expect(tarjeta().textContent).toContain('segundo parrafo');
  });

  it('un hallazgo sin elemento no cuenta hallazgos de un bloque que no existe', () => {
    // Una referencia huerfana vive en la bibliografia: no tiene elemento, y
    // contarla contra `element_id === ''` sumaria TODAS las huerfanas del
    // documento y las haria pasar por un bloque comun. Con dos huerfanas se
    // nota: el bloque de cada una es ella misma.
    store({
      doc: documento([elemento()]) as never,
      citationAuditResult: {
        ghost_citations: [], orphan_references: [
          { authors: ['Pérez'], year: 2019, raw_text: 'Pérez, J. (2019).' },
          { authors: ['López'], year: 2021, raw_text: 'López, M. (2021).' },
        ],
      } as never,
    });
    render(<ReviewWorkbench />);
    fireEvent.click(within(rack()).getByRole('button', { name: /Referencia nunca citada/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente hallazgo' }));
    expect(tarjeta().textContent).toContain('1 hallazgo en este bloque');
  });
});

/* ── El filtro y el número de páginas: reglas que son del hook ───────────── */

describe('T16 — la vista no vuelve a escribir las reglas del hook', () => {
  it('el workbench no compara la categoría de un hallazgo con NADA', () => {
    /* El filtro POR MOTOR es del hook. Si la vista lo escribiera sobre `items`
       para contar lo que hay, la regla estaría en dos archivos: un cambio de
       semántica aquí dejaría "Siguiente hallazgo" encendido e inerte, que es el
       defecto exacto de la corrección 7. El conteo por ELEMENTO (`enElBloque`)
       sí es de la vista y no se toca: no es el filtro.

       T20 (fix round): la guarda era literal y solo conocía dos escrituras
       (`wb.filter === 'all'` e `i.category === wb.filter`); re-derivar el
       predicado con otro nombre de variable pasaba. Y el "anti-vacuity" que le
       puse encima —contar las comparaciones y esperar cero— era una tautología:
       la línea de arriba ya afirmaba lo mismo y no protegía nada. Eso se fue; en
       su lugar el DETECTOR se prueba con violaciones, que es lo que sí puede
       fallar.

       Y el alcance de la prohibición, que es más ancho de lo que parece: en esta
       vista está prohibido CUALQUIER `x.category === …`, no solo la que compara
       con el filtro. Si algún día hace falta
       `hallazgos.filter(h => h.category === 'cita_fantasma')`, esta prueba lo va a
       bloquear, y no es un falso positivo: el predicado de un filtro por
       categoría vive en el hook —`SUBTYPE_ACTION`, `engineAction`, `visibleCount`—
       y la regla nueva se escribe ahí, no aquí. */
    expect(COMPARA_CATEGORIA(codigoDe(SRC))).toEqual([]);
    expect(codigoDe(SRC)).not.toMatch(/wb\.filter\s*(===|!==|==|!=)/);
    /* Y la parte que de verdad importa: la vista CONSUME la cuenta del hook, no
       la re-deriva. Sin esto, "no compara" también lo cumpliría una vista vacía. */
    expect(SRC).toMatch(/wb\.visibleCount/);

    // El detector se enciende con dos escrituras que la guarda literal no veía.
    expect(COMPARA_CATEGORIA('items.filter((f) => f.category === wb.filter);')).toHaveLength(1);
    expect(COMPARA_CATEGORIA('hallazgos.filter((h) => h.category === filtro);')).toHaveLength(1);
    // Y NO se enciende con una comparación que no es de categoría: la regla es
    // sobre el campo, no sobre cualquier `===`.
    expect(COMPARA_CATEGORIA('items.filter((i) => i.pageNumber === 3);')).toEqual([]);
  });

  it('el filtro del hook es UNO, y la vista lo pasa sin reescribirlo', () => {
    /* La otra mitad de la misma regla: el predicado existe, pero en el hook. La
       vista recibe `filter` y lo entrega a la tira; no lo vuelve a aplicar. */
    expect(codigoDe(HOOK)).toMatch(/i\.category === filter/);
    expect(SRC).toMatch(/filter=\{wb\.filter\}/);
    expect(SRC).toMatch(/onFilter=\{wb\.setFilter\}/);
  });

  it('la severidad se ordena en UN solo archivo', () => {
    /* `SEVERITY_RANK` estaba copiada en `EngineGroupCard`: dos tablas de
       gravedad, y un nivel nuevo en el vocabulario entraba por la del hook
       mientras el badge se quedaba con la vieja, sin que nada lo dijera. Ahora
       la tarjeta la IMPORTA, y la tabla es `Record<Severity, number>`: agregar
       un nivel rompe la compilación en vez de romper el acuerdo. */
    expect(codigoDe(HOOK)).toMatch(/export const SEVERITY_RANK/);
    expect(codigoDe(fuentes['EngineGroupCard.tsx'])).not.toMatch(/SEVERITY_RANK\s*[:=]\s*\{/);
    expect(codigoDe(fuentes['EngineGroupCard.tsx'])).toMatch(/import \{[^}]*SEVERITY_RANK/);
  });

  it('el número de páginas dice DE QUÉ revisión es, en la línea y no en un tooltip', () => {
    // `FocusReadingCard` ya lo dice ("Página X de la revisión"): el conteo del
    // índice de revisión no es el de la hoja medida, y un `title` —invisible
    // para quien lee, y no siempre anunciado— no es la forma de decirlo.
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    render(<ReviewWorkbench />);
    expect(screen.getByText(/^Página \d+ de \d+$/)).toBeTruthy();
    expect(screen.getByText('de la revisión')).toBeTruthy();
  });
});

/* ── Tokens ──────────────────────────────────────────────────────────────── */

const NODE_FS = 'node:fs';
const NODE_PATH = 'node:path';
const NODE_URL = 'node:url';
let SRC = '';
let PASO5 = '';
/** Los tres archivos donde ESTE commit escribió copy y tokens: el workbench,
 *  la tira y la tarjeta de motor. El barrido de todo `src` es tarea de otra. */
const CON_COPY = [
  'ReviewWorkbench.tsx',
  'ReviewStrip.tsx',
  'EngineGroupCard.tsx',
] as const;
const fuentes: Record<string, string> = {};
/** T20: el hook, para las reglas que son SUyas (el predicado del filtro y la
 *  tabla de severidad). Antes estas guardas solo miraban la vista, y una regla
 *  que solo mira un lado no sabe cuál de los dos está mintiendo. */
let HOOK = '';
/** Tokens DECLARADOS en la hoja de estilos: una línea `--token:` **dentro de un
 *  bloque `:root`**. T20 (fix round): esto era un `/^\s*(--x)\s*:/gm` sobre la
 *  hoja entera, que daba por declarado un `--x:` escrito dentro de una regla de
 *  selector —y ahí no es un token: es un custom property de esa regla, que solo
 *  existe cuando esa regla está en pantalla. Con las dos definiciones
 *  conviviendo, un token declarado solo en `.wa-bubble` lo marcaba el lint de
 *  tokens y lo daba por bueno esta prueba. La DEFINICIÓN de "declarado" es una
 *  sola en el proyecto, y vive en `noHardcodedColors.test.ts` (`analizarHoja`);
 *  aquí se reproduce la misma, no una aproximada. */
const declaradosEnRaiz = (css: string): Set<string> => {
  const declarados = new Set<string>();
  for (const m of css.matchAll(/^\s*:root\b[^{]*\{/gm)) {
    const abierto = css.indexOf('{', m.index);
    let nivel = 0;
    let cierre = css.length;
    for (let i = abierto; i < css.length; i++) {
      if (css[i] === '{') nivel++;
      else if (css[i] === '}' && --nivel === 0) {
        cierre = i;
        break;
      }
    }
    for (const d of css.slice(abierto + 1, cierre).matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)) {
      declarados.add(d[1]);
    }
  }
  return declarados;
};
let declarados = new Set<string>();
beforeAll(async () => {
  const { readFileSync } = await import(/* @vite-ignore */ NODE_FS);
  const { resolve } = await import(/* @vite-ignore */ NODE_PATH);
  const { fileURLToPath } = await import(/* @vite-ignore */ NODE_URL);
  const testDir = fileURLToPath(import.meta.url).replace(/[^/\\]+$/, '');
  SRC = readFileSync(resolve(testDir, '../components/review/ReviewWorkbench.tsx'), 'utf8');
  PASO5 = readFileSync(resolve(testDir, '../components/wizard/Step5AuditIAWizard.tsx'), 'utf8');
  HOOK = readFileSync(resolve(testDir, '../hooks/useReviewWorkbench.ts'), 'utf8');
  for (const nombre of CON_COPY) {
    fuentes[nombre] = readFileSync(resolve(testDir, `../components/review/${nombre}`), 'utf8');
  }
  const css = readFileSync(resolve(testDir, '../styles/design-system.css'), 'utf8');
  declarados = declaradosEnRaiz(css);
});

describe('T16 — tokens y copy de lo que esta task escribió', () => {
  /* Lo que se busca es un color en un ESTILO, no en un comentario: el comentario
     que explica por qué `--color-info` y `--color-accent` son el mismo azul
     tiene que poder citar el valor. */
  const codigo = codigoDe;

  it.each(CON_COPY)('%s: sin hex literales', (nombre) => {
    expect(codigo(fuentes[nombre])).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it.each(CON_COPY)('%s: no le pone fallback a ningun token', (nombre) => {
    // `var(--x, 8px)` esconde un token mal escrito detrás de un valor que
    // funciona: el error no se ve, y el día que el token exista, el valor
    // equivocado se queda callado.
    expect(codigo(fuentes[nombre])).not.toMatch(/var\(\s*--[a-z0-9-]+\s*,/i);
  });

  it.each(CON_COPY)('%s: cada token que usa esta DECLARADO en design-system.css', (nombre) => {
    const usados = new Set<string>();
    for (const m of codigo(fuentes[nombre]).matchAll(/var\(\s*(--[a-z0-9-]+)/g)) usados.add(m[1]);
    expect(usados.size).toBeGreaterThan(0);
    for (const token of usados) {
      expect(declarados.has(token), `${token} (${nombre}) no esta declarado`).toBe(true);
    }
  });

  it('el conjunto de tokens declarados sale de declaraciones, no de valores', () => {
    // `--color-text-tertiary` está declarado; `--text-tertiary` aparece en la
    // hoja solo DENTRO de valores (`var(--text-tertiary)`) y no existe como
    // token. Un patrón que lo diera por definido aprobaría un `var(--x-typo)`.
    expect(declarados.has('--color-text-tertiary')).toBe(true);
    expect(declarados.has('--text-tertiary')).toBe(false);
    // T20 (fix round): y tampoco cuenta un `--x:` escrito dentro de una regla de
    // selector. Hoy la hoja no tiene ninguno, así que el caso se prueba sobre una
    // hoja sintética: es la guarda de la definición, que es lo que se arregló.
    const conRegla = [':root {', '  --token-real: #fff;', '}', '.wa {', '  --solo-aqui: 3px;', '}'].join('\n');
    expect([...declaradosEnRaiz(conRegla)]).toEqual(['--token-real']);
  });

  it('ninguna cadena del workbench lleva emojis', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo(), fraseIA()] as never });
    const { container } = render(<ReviewWorkbench />);
    expect(container.textContent || '').not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

/* ── El paso 5, orquestador de las tres capas ─────────────────────────────── */

describe('T16 — el paso 5 orquesta puerta, recorrido y sala de IA', () => {
  it('arranca en la puerta de estado, no en el workbench de columnas', () => {
    /* La fusión convirtió el paso 5 en la puerta (general) que lleva al
       recorrido por categoría (específico). El workbench de tres columnas con
       minimapa es la vista que se retiró: su minimapa no se reintroduce
       (AGENTS §1). */
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    render(<Step5AuditIAWizard />);
    expect(screen.getByText(/Estado de tu documento/i)).toBeTruthy();
    expect(screen.queryByTestId('minimap')).toBeNull();
    expect(screen.queryByLabelText('Párrafo en revisión')).toBeNull();
  });

  it('cuenta las observaciones en la cifra de entrada', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    render(<Step5AuditIAWizard />);
    expect(screen.getByTestId('review-gate-total').textContent).not.toBe('0');
  });

  it('sin hallazgos ofrece el escaneo en vez de una cola vacía', () => {
    store({ doc: documento([elemento()]) as never });
    render(<Step5AuditIAWizard />);
    expect(screen.getByText(/Aún no hay una revisión/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Escanear documento/i })).toBeTruthy();
  });

  it('la puerta lleva al recorrido por categoría', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    render(<Step5AuditIAWizard />);
    fireEvent.click(screen.getByRole('button', { name: /Empezar revisión/i }));
    expect(screen.getByText(/Recorrido de revisión/i)).toBeTruthy();
  });

  it('ya no trae el mapa heuristico de 1800 caracteres por pagina', () => {
    // Ese mapa era la SEGUNDA fuente de paginas: para el mismo elemento contaba
    // una hoja distinta de la del lienzo. La fusión lo reemplazo por `usePageIndex`
    // (la página REAL del índice), y las dos fuentes no pueden divergir.
    expect(PASO5).not.toMatch(/elementPageMap/);
    expect(PASO5).not.toMatch(/1800/);
    expect(PASO5).toMatch(/usePageIndex/);
  });

  it('el workbench de columnas tampoco reintroduce la heuristica que se acaba de borrar', () => {
    expect(SRC).not.toMatch(/elementPageMap/);
  });
});

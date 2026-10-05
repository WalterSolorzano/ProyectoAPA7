/**
 * WordAPA7 — T16: el workbench de Revision es UNA sola superficie secuencial y
 * es honesto con lo que no sabe.
 *
 * La revision es un hallazgo a la vez (AGENTS.md §1): la tira de arriba y la
 * tarjeta de lectura. No hay minimapa ni rack de motores —la lectura secuencial
 * es la decision de diseno— y estos tests fijan que la vista que junta las
 * piezas no miente: no pone una caja sin alto donde el auto-ajuste necesita una,
 * no deja un boton encendido que no hace nada, y los estados vacios dicen su
 * causa.
 *
 * `PaperCanvas` va simulado con `importOriginal` y no con un objeto vacio: el
 * indice de paginas (`usePageIndex`) importa `computeRenderedPages` de ESE
 * modulo, y un mock sin esa exportacion revienta el hook que publica los
 * numeros de pagina.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { ReviewWorkbench } from '../components/review/ReviewWorkbench';
import { Step5AuditIAWizard } from '../components/wizard/Step5AuditIAWizard';
import { useReviewWorkbench } from '../hooks/useReviewWorkbench';

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
    dismissedCommentIds: [], dismissedFindingIds: [],
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

/* ── Una sola superficie secuencial ───────────────────────────────────────── */

describe('T16 — ReviewWorkbench: una sola columna', () => {
  it('monta la tira y la tarjeta de lectura, sin minimapa ni rack', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    render(<ReviewWorkbench />);
    expect(tarjeta()).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Siguiente hallazgo' })).toBeTruthy();
    /* El minimapa y el rack de tres columnas NO se reintroducen (AGENTS.md §1):
       la revision es un hallazgo a la vez. */
    expect(screen.queryByTestId('minimap')).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Hallazgos por motor' })).toBeNull();
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

  it('la grilla es de UNA columna, sin minimapa ni rack que reserven la suya', () => {
    /* La regla de producto: la revision es un hallazgo a la vez (AGENTS.md §1).
       Una grilla de tres columnas con `ReviewMinimap` es exactamente lo que no
       se reintroduce, y por eso la pista es una sola. */
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    render(<ReviewWorkbench />);
    const centro = tarjeta().parentElement as HTMLElement;
    expect(centro.style.gridTemplateColumns).toBe('minmax(0, 1fr)');
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

  it('con `onExit`, la tira ofrece volver a la puerta', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    const onExit = vi.fn();
    render(<ReviewWorkbench onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onExit).toHaveBeenCalledTimes(1);
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
    expect(screen.getByTestId('estado-vacio').textContent).toMatch(/Ningún motor reportó hallazgos/);
  });

  it('con la ventana angosta y sin hallazgos, el mensaje sigue en pantalla', () => {
    /* El cierre del Review Focus #1. El estado vacío vive en la grilla
       principal, que se renderiza siempre, y por eso el ancho no lo esconde. */
    store({ doc: documento([elemento()]) as never });
    fijarAncho(900);
    const { container } = render(<ReviewWorkbench />);
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
});

/* ── "Siguiente hallazgo" a traves del filtro ─────────────────────────────── */

describe('T16 — el filtro no deja botones encendidos que no hacen nada', () => {
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

/* ── "Aceptar todas" no se puede repetir mientras corre ───────────────────── */

describe('T16 — "Aceptar todas" no es reentrante', () => {
  it('dos pulsaciones en el mismo tick no escriben dos veces', async () => {
    /* `acceptMany` recorre los hallazgos de uno en uno y hace una llamada de
       red por hallazgo. Sin cerrojo, un segundo "Aceptar todas" dispara las
       MISMAS llamadas sobre los MISMOS elementos y el documento queda con una
       de las dos correcciones, elegida por quién escribió último.

       La prueba monta la MISMA capa que usaba el rack: el hook. La vista ya no
       tiene botones de acción —la lógica vive en `useReviewActions`— así que se
       ejercita por su puerta pública (`runGroupAction`) y no por un control. */
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
    function Probe() {
      const wb = useReviewWorkbench();
      return (
        <button
          type="button"
          onClick={() => {
            const grupo = wb.groups.find((g) => g.engine === 'spelling');
            if (grupo) Promise.resolve(wb.runGroupAction(grupo)).catch(() => undefined);
          }}
        >
          aceptar-todas
        </button>
      );
    }
    render(<Probe />);
    const boton = screen.getByRole('button', { name: 'aceptar-todas' });
    act(() => {
      fireEvent.click(boton);
      fireEvent.click(boton);
    });
    await act(async () => { await Promise.resolve(); });
    expect(updateElementText).toHaveBeenCalledTimes(1);

    // Al terminar, el cerrojo se abre: no es una puerta que se queda cerrada.
    await act(async () => {
      for (let i = 0; i < 4; i += 1) {
        while (pendientes.length) (pendientes.shift() as () => void)();
        await Promise.resolve();
      }
    });
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

describe('T16 — el paso 5 orquesta puerta, workbench y sala de IA', () => {
  it('arranca en la puerta de estado, no en la superficie de revisión', () => {
    /* La puerta (general) lleva a la revisión secuencial (específico). El
       workbench de tres columnas con minimapa es la vista que se retiró: su
       minimapa no se reintroduce (AGENTS §1). */
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

  it('la puerta lleva al workbench secuencial, no a un informe', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    render(<Step5AuditIAWizard />);
    fireEvent.click(screen.getByRole('button', { name: /Empezar revisión/i }));
    expect(screen.getByRole('button', { name: 'Siguiente hallazgo' })).toBeTruthy();
    expect(tarjeta()).toBeTruthy();
    expect(screen.queryByText('Informe general')).toBeNull();
  });

  it('el workbench de revisión ofrece volver a la puerta', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    render(<Step5AuditIAWizard />);
    fireEvent.click(screen.getByRole('button', { name: /Empezar revisión/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByText(/Estado de tu documento/i)).toBeTruthy();
  });

  it('ya no trae el mapa heuristico de 1800 caracteres por pagina', () => {
    // Ese mapa era la SEGUNDA fuente de paginas: para el mismo elemento contaba
    // una hoja distinta de la del lienzo. La fusión lo reemplazo por `usePageIndex`
    // (la página REAL del índice), y las dos fuentes no pueden divergir.
    expect(PASO5).not.toMatch(/elementPageMap/);
    expect(PASO5).not.toMatch(/1800/);
    expect(PASO5).toMatch(/usePageIndex/);
  });

  it('el workbench tampoco reintroduce la heuristica que se acaba de borrar', () => {
    expect(SRC).not.toMatch(/elementPageMap/);
  });

  it('las citas entran a la revision: la pantalla y el rail cuentan lo mismo', () => {
    /* `reviewItems` no filtra por categoría: si la pantalla escondiera un motor
       que el rail cuenta, la fase 5 prometería trabajo sin destino. */
    store({
      doc: documento([elemento()]) as never,
      citationAuditResult: {
        ghost_citations: [{ citation_text: 'García, 2020', element_id: 'e1' }],
      } as never,
    });
    render(<Step5AuditIAWizard />);
    expect(screen.getByTestId('review-gate-total')).toBeTruthy();
    expect(screen.queryByText(/Aún no hay una revisión/i)).toBeNull();
  });

  it('las leyendas (figura/tabla sin rotular) tambien entran a la revision', () => {
    /* Su mecanismo es `autoCaption`, pero el hallazgo se cuenta: la pantalla no
       puede ocultar lo que el rail ya promete. */
    store({
      doc: documento([
        elemento({ id: 'img1', type: 'image', image_info: { caption: '' } }),
        elemento({ id: 'tbl1', type: 'table', table_info: { caption: '' } }),
      ]) as never,
    });
    render(<Step5AuditIAWizard />);
    expect(screen.getByTestId('review-gate-total')).toBeTruthy();
    expect(screen.queryByText(/Aún no hay una revisión/i)).toBeNull();
  });

  it('sacar la leyenda no se lleva el encabezado mal nivelado', () => {
    store({
      doc: documento([
        elemento({ id: 'h1', type: 'heading', heading_level: 1, needs_review: true, text: 'Metodo' }),
      ]) as never,
    });
    render(<Step5AuditIAWizard />);
    expect(screen.getByTestId('review-gate-total').textContent).toBe('1');
  });

  it('la sala de IA monta el dashboard jerarquico de H1, no el segmento suelto', () => {
    store({
      doc: documento([
        elemento({ id: 'h1', type: 'heading', heading_level: 1, text: 'Introduccion' }),
        elemento(),
      ]) as never,
      reviewResult: { ai_indices: { score: 0.8 }, paragraphs: [fraseIAIA('e1')] } as never,
    });
    render(<Step5AuditIAWizard />);
    fireEvent.click(screen.getByRole('button', { name: /Ver mapa de IA/i }));
    expect(screen.getByLabelText('Dashboard de Integridad Autoral')).toBeTruthy();
  });
});

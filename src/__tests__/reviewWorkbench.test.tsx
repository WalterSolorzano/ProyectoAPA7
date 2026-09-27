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
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { ReviewWorkbench } from '../components/review/ReviewWorkbench';
import { Step5AuditIAWizard } from '../components/wizard/Step5AuditIAWizard';

vi.mock('../components/layout/PaperCanvas', async (importOriginal) => {
  const real = await importOriginal<typeof import('../components/layout/PaperCanvas')>();
  return { ...real, PaperCanvas: () => <div data-testid="canvas" /> };
});
vi.mock('../components/wizard/ReviewMinimap', () => ({
  ReviewMinimap: () => <div data-testid="minimap" />,
}));

/* ── Utilidades de datos ──────────────────────────────────────────────────── */

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

const store = (extra: Record<string, unknown> = {}) => {
  useDocStore.setState({
    doc: null, reviewResult: null, proofreadFindings: [], citationAuditResult: null,
    aiIndices: null, validationIssues: [], sugerenciasProactivas: true,
    dismissedCommentIds: [], ...extra,
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

  it('en ventana estrecha el rack se retira y el centro conserva el ancho', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    fijarAncho(900);
    render(<ReviewWorkbench />);
    expect(screen.queryByRole('complementary', { name: 'Hallazgos por motor' })).toBeNull();
    expect(tarjeta()).toBeTruthy();
    // Y la grilla pierde la tercera columna en vez de dejar una vacía.
    const centro = tarjeta().parentElement as HTMLElement;
    expect(centro.style.gridTemplateColumns).toBe('19px minmax(0, 1fr)');
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
    expect(screen.getByRole('button', { name: 'Escanear' })).toBeTruthy();
    expect(within(rack()).getByText(/Ningún motor reportó hallazgos/)).toBeTruthy();
  });

  it('sin documento, el centro lo dice en vez de mostrar un parrafo limpio', () => {
    // Sin `doc` el elemento del hallazgo no se puede resolver: la tarjeta
    // pintaria el texto sin una sola marca, indistinguible de "el motor no
    // encontro nada". El hueco tiene que tener nombre.
    store({ doc: null });
    render(<ReviewWorkbench />);
    expect(screen.queryByLabelText('Párrafo en revisión')).toBeNull();
    expect(screen.getByText(/no hay ningun documento abierto|documento abierto/i)).toBeTruthy();
    expect(within(rack()).getByText(/Carga un documento/)).toBeTruthy();
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

    // Queda el hallazgo de IA: el documento tiene hallazgos, asi que no hay
    // nada que escanear.
    expect(screen.queryByRole('button', { name: 'Escanear' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Siguiente hallazgo' }).hasAttribute('disabled')).toBe(true);
    // Y el rack lo dice, en vez de quedarse mudo con el filtro puesto.
    expect(within(rack()).getByText(/Vuelve a "Todo"/)).toBeTruthy();
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

describe('T16 — el detalle ejecuta la acción que declara su grupo', () => {
  const FIGURA = elemento({
    id: 'f1', type: 'image',
    image_info: { relative_url: 'f.png', caption: '', figure_number: 0, alignment: 'center' },
  });

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
    // "Siguiente hallazgo" es lo que selecciona el primero: el rack abierto no
    // selecciona nada por su cuenta.
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente hallazgo' }));
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
  it('el workbench no re-aplica el predicado del filtro', () => {
    // El filtro POR MOTOR es del hook. Si la vista lo escribiera sobre `items`
    // para contar lo que hay, la regla estaría en dos archivos: un cambio de
    // semántica aquí dejaría "Siguiente hallazgo" encendido e inerte, que es el
    // defecto exacto de la corrección 7. El conteo por ELEMENTO (`enElBloque`)
    // sí es de la vista y no se toca: no es el filtro.
    expect(SRC).not.toMatch(/wb\.filter === 'all'/);
    expect(SRC).not.toMatch(/i\.category === wb\.filter/);
    expect(SRC).toMatch(/wb\.visibleCount/);
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
/** Tokens DECLARADOS en la hoja de estilos: una línea que empieza por
 *  `--token:`. Buscar el nombre "en algún lado" daba por definido lo que solo
 *  aparecía dentro del valor de otro token, y eso no es una declaración. */
let declarados = new Set<string>();
beforeAll(async () => {
  const { readFileSync } = await import(/* @vite-ignore */ NODE_FS);
  const { resolve } = await import(/* @vite-ignore */ NODE_PATH);
  const { fileURLToPath } = await import(/* @vite-ignore */ NODE_URL);
  const testDir = fileURLToPath(import.meta.url).replace(/[^/\\]+$/, '');
  SRC = readFileSync(resolve(testDir, '../components/review/ReviewWorkbench.tsx'), 'utf8');
  PASO5 = readFileSync(resolve(testDir, '../components/wizard/Step5AuditIAWizard.tsx'), 'utf8');
  for (const nombre of CON_COPY) {
    fuentes[nombre] = readFileSync(resolve(testDir, `../components/review/${nombre}`), 'utf8');
  }
  const css = readFileSync(resolve(testDir, '../styles/design-system.css'), 'utf8');
  declarados = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
});

describe('T16 — tokens y copy de lo que esta task escribió', () => {
  /* Lo que se busca es un color en un ESTILO, no en un comentario: el comentario
     que explica por qué `--color-info` y `--color-accent` son el mismo azul
     tiene que poder citar el valor. */
  const codigo = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

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
  });

  it('ninguna cadena del workbench lleva emojis', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo(), fraseIA()] as never });
    const { container } = render(<ReviewWorkbench />);
    expect(container.textContent || '').not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

/* ── El paso 5, reducido a envoltorio ─────────────────────────────────────── */

describe('T16 — el paso 5 es un envoltorio del workbench', () => {
  it('monta las mismas tres columnas que el workbench', () => {
    store({ doc: documento([elemento()]) as never, proofreadFindings: [hallazgo()] as never });
    render(<Step5AuditIAWizard />);
    expect(screen.getByTestId('minimap')).toBeTruthy();
    expect(tarjeta()).toBeTruthy();
    expect(within(rack()).getByRole('button', { name: /Ortografía/ })).toBeTruthy();
  });

  it('ya no trae el mapa heuristico de 1800 caracteres por pagina', () => {
    // Ese mapa era la SEGUNDA fuente de paginas: para el mismo elemento contaba
    // una hoja distinta de la del lienzo. Con el archivo reducido a envoltorio
    // la heuristica deja de existir, y las dos fuentes no pueden divergir.
    expect(PASO5).toContain('ReviewWorkbench');
    expect(PASO5).not.toMatch(/elementPageMap/);
    expect(PASO5).not.toMatch(/1800/);
  });

  it('el workbench tampoco reintroduce la heuristica que se acaba de borrar', () => {
    expect(SRC).not.toMatch(/elementPageMap/);
  });
});

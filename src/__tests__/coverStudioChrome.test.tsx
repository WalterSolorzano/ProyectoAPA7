/**
 * WordAPA7 — T18: la pantalla de portada entra al chrome del workbench: una
 * tira de 44px con las estrategias arriba, el carrusel con la vista previa al
 * centro y el editor de portada a 320px a la derecha.
 *
 * Lo que este archivo protege, en orden de importancia:
 *
 *  1. La tira lista las CINCO estrategias REALES del componente —las de `cards`:
 *     original, APA 7, UNI, Pro y la de subir plantilla—, no una lista
 *     inventada. Un chip de más es un modo que no se puede elegir; uno de menos
 *     es un modo inalcanzable, que es el mismo defecto que un filtro que se
 *     reduce a un solo chip.
 *  2. Tira y carrusel eligen LO MISMO: son dos controles del mismo estado
 *     derivado de `portada`, y el chip tiene que seguir a la tarjeta.
 *  3. El editor de 320px es `CoverEditorPanel` de verdad, no una caja vacía con
 *     el ancho correcto, y la cadena de alto llega hasta él: sin alto definido
 *     en la raíz, el panel crece, su cuerpo nunca se desplaza y
 *     `Step1PortadaWizard` recorta el botón "Continuar a Estructura" fuera de
 *     pantalla. OJO: eso lo que se comprueba aquí son DECLARACIONES. jsdom no
 *     calcula layout; el tamaño real se verificó en un navegador (ver el
 *     reporte de T18), no aquí.
 *  4. La portada sigue siendo INDIVISIBLE porque este componente NO pagina ni
 *     vuelve a medir el documento: la paginación es de `PaperCanvas`
 *     (`computeRenderedPages`, geometría del documento), y un `overflow` de un
 *     ancestro no la cambia —`offsetHeight` es alto de contenido y
 *     `PaperCanvas` no lee `clientHeight` en ningún lado. Lo que sí rompería la
 *     invariante es un SEGUNDO paginador o una re-medición, y por eso el test
 *     buscaImports y llamadas de medición en este archivo, no estilos.
 *  5. La tira no enciende un chip para un modo que no reconoce, y lo dice.
 *
 * `PaperCanvas` va simulado (como en T16) porque no hace falta la hoja real para
 * probar el chrome, y porque medirse a sí mismo en jsdom no significa nada.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { defaultPortada } from '../store/slices/coverSlice';
import { CoverCarouselStudio } from '../components/wizard/CoverCarouselStudio';

vi.mock('../api/backend', () => ({
  getApiBase: vi.fn().mockReturnValue('http://localhost:8742'),
  getApiBaseAsync: vi.fn().mockResolvedValue('http://localhost:8742'),
  fetchWithTrace: vi.fn(),
  resolveAssetUrl: vi.fn(),
  syncAllProviderKeys: vi.fn().mockResolvedValue({ ok: true, applied: [] }),
}));

vi.mock('../components/layout/PaperCanvas', () => ({
  PaperCanvas: () => <div data-testid="canvas" />,
}));

/* ── Utilidades ───────────────────────────────────────────────────────────── */

const portada = (over: Record<string, unknown> = {}) => {
  useDocStore.setState({
    portada: { ...defaultPortada, ...over },
    doc: null,
    wizardStep: 1,
  } as never);
};

const estado = () => useDocStore.getState().portada as unknown as Record<string, unknown>;

/** La tira: la barra de 44px. El grupo de estrategias es lo único de arriba
 *  que son chips: la barra lleva además la salida del paso. */
const grupo = (): HTMLElement => screen.getByRole('group', { name: 'Estrategias de portada' });
const tira = (): HTMLElement => grupo().closest('div[style*="height: 44px"]') as HTMLElement;
const chips = (): HTMLElement[] => within(grupo()).getAllByRole('button');
const chip = (nombre: string | RegExp): HTMLElement => within(grupo()).getByRole('button', { name: nombre });

/* Las CINCO estrategias del componente, con el rótulo que las nombra. */
const ESTRATEGIAS = [
  'Conservar original',
  'APA 7 Estándar',
  'Institucional UNI',
  'Profesional APA',
  '+ Subir plantilla',
];

/* ── Lectura del archivo ──────────────────────────────────────────────────── */

let SRC = '';
let TIRA = '';
let TARJETAS = '';
let CHROME = '';
/* Los dos bloques de antes de este commit que la guarda estricta no mira, por
   pares [inicio, fin]. Ver el comentario del `beforeAll`. */
const CONGELADOS: [string, string][] = [
  ['{COVER_CARDS.map((c) => {', '{/* Previsualizador'],
  ['{/* Previsualizador', '{/* COLUMNA DERECHA'],
];
const CONGELADO: string[] = [];
let declarados = new Set<string>();
/** Lo que se busca es un color en un ESTILO, no en un comentario. */
const codigo = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

beforeAll(async () => {
  // Las flechas del carrusel llaman a scrollBy, que jsdom no trae.
  if (!Element.prototype.scrollBy) {
    Element.prototype.scrollBy = function () {};
  }
  /* El nombre va en una variable: con el literal, `nodePolyfills()` de vite lo
     resuelve a su propio shim y `readFileSync` no existe. */
  const NODE_FS = 'node:fs';
  const NODE_PATH = 'node:path';
  const NODE_URL = 'node:url';
  const { readFileSync } = await import(/* @vite-ignore */ NODE_FS);
  const { resolve } = await import(/* @vite-ignore */ NODE_PATH);
  const { fileURLToPath } = await import(/* @vite-ignore */ NODE_URL);
  const testDir = fileURLToPath(import.meta.url).replace(/[^/\\]+$/, '');
  SRC = readFileSync(resolve(testDir, '../components/wizard/CoverCarouselStudio.tsx'), 'utf8');
  const css = readFileSync(resolve(testDir, '../styles/design-system.css'), 'utf8');
  declarados = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));

  /* El chrome nuevo va de `COVER_CARDS` al FINAL del archivo: la raíz, la fila
     del cuerpo, las flechas y el `aside` están en el cuerpo del componente, y
     una guarda que termina en `export const` no los mira. */
  const desde = SRC.indexOf('const COVER_CARDS');
  expect(desde).toBeGreaterThan(-1);
  TIRA = desde > -1 ? SRC.slice(desde) : '';

  /* Se CONGELAN dos bloques: el de las tarjetas del carrusel y el de los
     envoltorios de la vista previa. Los dos son de antes de este commit -este
     solo los reindento-, y sus literales (`rgba` de sombras y de la hoja, el
     fallback de `--paper-white`, el `borderRadius: '4px'`) estaban en el reporte
     de T18 para triaje. T20 los saldó, y la cuenta de abajo quedó en cero; los
     marcadores de cada bloque se comprueban igual: sin eso, un archivo reordenado
     dejaria la guarda sin region congelada y "pasaria" sin mirar nada. */
  let resto = TIRA;
  for (const [ini, fin] of CONGELADOS) {
    const a = resto.indexOf(ini);
    const b = resto.indexOf(fin);
    expect(a, `no se encuentra el inicio del bloque congelado ${ini}`).toBeGreaterThan(-1);
    expect(b, `no se encuentra el fin del bloque congelado ${fin}`).toBeGreaterThan(a);
    CONGELADO.push(resto.slice(a, b));
    resto = resto.slice(0, a) + resto.slice(b);
  }
  TARJETAS = CONGELADO.join('\n');
  CHROME = resto;
});

/* ── La tira de estrategias ───────────────────────────────────────────────── */

describe('T18 — la tira lista las estrategias que la app tiene', () => {
  it('la tira es la primera zona y mide 44px', () => {
    portada();
    const { container } = render(<CoverCarouselStudio />);
    const raiz = container.firstElementChild as HTMLElement;
    expect(raiz.children[0]).toBe(tira());
    expect(tira().style.height).toBe('44px');
    // `flexShrink` es un número sin unidad: jsdom lo serializa '0'.
    expect(tira().style.flexShrink).toBe('0');
  });

  it('un chip por estrategia real, y ninguno de más', () => {
    portada();
    render(<CoverCarouselStudio />);
    // La cuenta sale de los chips: si `COVER_CARDS` crece y la tira no, el modo
    // nuevo queda solo en el carrusel, y si la tira inventa uno, el chip no hace
    // nada.
    expect(chips().map((c) => (c.textContent || '').trim())).toEqual(ESTRATEGIAS);
  });

  it('el chip encendido es el modo derivado del documento, no un estado propio', () => {
    portada({ use_original_cover: false, cover_mode: 'generate_uni_cover' });
    render(<CoverCarouselStudio />);
    expect(chip('Institucional UNI').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Conservar original').getAttribute('aria-pressed')).toBe('false');
  });

  it('una plantilla ya cargada no enciende el chip de acción, y la nombra', () => {
    /* Un documento con `cover_template_id` SÍ tiene un modo —el 'custom'—, pero
       su chip es una acción, así que no puede quedar "presionado". Lo que dice
       qué plantilla está puesta es el rótulo de al lado. */
    portada({ use_original_cover: false, cover_mode: '', cover_template_id: 'custom-7' });
    render(<CoverCarouselStudio />);
    expect(chip('+ Subir plantilla').hasAttribute('aria-pressed')).toBe(false);
    expect(chips().map((c) => (c.textContent || '').trim())).toEqual(ESTRATEGIAS);
  });

  it('elegir un chip cambia la portada del documento', () => {
    portada();
    render(<CoverCarouselStudio />);
    fireEvent.click(chip('Institucional UNI'));
    expect(estado().cover_mode).toBe('generate_uni_cover');
    expect(estado().use_original_cover).toBe(false);
    // Y el chip se enciende solo: la tira no guarda el modo, lo deriva.
    expect(chip('Institucional UNI').getAttribute('aria-pressed')).toBe('true');
  });

  it('el chip de plantilla abre el selector de archivos en vez de elegir un modo', () => {
    // "Subir plantilla" no es un modo más: es una acción. Si el chip lo
    // tratara como los demás pondría `cover_template_id` sin que haya una
    // plantilla detrás, y el documento declararía una portada que no existe.
    portada();
    const abierto = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    render(<CoverCarouselStudio />);
    fireEvent.click(chip('+ Subir plantilla'));
    expect(abierto).toHaveBeenCalled();
    expect(estado().cover_template_id).toBeUndefined();
    abierto.mockRestore();
  });

  it('el chip de plantilla NO se anuncia como un interruptor', () => {
    /* Un `aria-pressed` sobre una acción: el lector de pantalla anuncia
       "botón, no presionado" y lo que hace es abrir un diálogo de archivos. Y
       con una plantilla ya cargada el chip queda "presionado" sin decir cuál. */
    portada();
    render(<CoverCarouselStudio />);
    const subir = chip('+ Subir plantilla');
    expect(subir.hasAttribute('aria-pressed')).toBe(false);
    // Los otros cuatro sí son interruptores: eligen un modo.
    for (const modo of ['Conservar original', 'APA 7 Estándar', 'Institucional UNI', 'Profesional APA']) {
      expect(chip(modo).hasAttribute('aria-pressed')).toBe(true);
    }
  });

  it('la plantilla cargada se nombra en la tira', () => {
    /* Sin esto, la persona ve la misma barra que antes de subir nada y no
       tiene cómo saber que su .docx está puesto. */
    portada({ use_original_cover: false, cover_mode: '', cover_template_id: 'custom-7' });
    render(<CoverCarouselStudio />);
    expect(within(tira()).getByText(/custom-7/)).toBeTruthy();
  });

  it('un modo que la app no reconoce no enciende ningún chip, y lo dice', () => {
    /* El backend tiene su propio vocabulario de `cover_mode`
       (`keep_original`, `keep_design_update_data`, `generate_apa7_template`), así
       que un valor desconocido es real, no hipotético. Encender "APA 7" para un
       documento que no es APA 7 es una afirmación falsa en la barra; lo honesto
       es no encender nada y decirlo. */
    portada({ use_original_cover: false, cover_mode: 'cover_del_año_que_viene' });
    render(<CoverCarouselStudio />);
    for (const modo of ['Conservar original', 'APA 7 Estándar', 'Institucional UNI', 'Profesional APA']) {
      expect(chip(modo).getAttribute('aria-pressed')).toBe('false');
    }
    expect(within(tira()).getByText(/no reconoce/i)).toBeTruthy();
    expect(within(tira()).getByText(/cover_del_año_que_viene/)).toBeTruthy();
  });

  it('un cover_mode del backend que SÍ es APA 7 enciende el chip de APA 7', () => {
    // `generate_apa7_template` es la palabra del backend por el mismo estado que
    // la app escribe como `cover_mode: ''`. Tratarlo como desconocido haría que
    // un documento APA 7 real no encendiera nada.
    portada({ use_original_cover: false, cover_mode: 'generate_apa7_template' });
    render(<CoverCarouselStudio />);
    expect(chip('APA 7 Estándar').getAttribute('aria-pressed')).toBe('true');
  });
});

/* ── La tira y el carrusel son el mismo control ───────────────────────────── */

describe('T18 — tira y carrusel no cuentan historias distintas', () => {
  it('elegir en la tarjeta enciende el chip de la tira', () => {
    portada();
    render(<CoverCarouselStudio />);
    const pista = screen.getByTestId('cover-model-track');
    fireEvent.click(within(pista).getByText('Profesional APA'));
    expect(chip('Profesional APA').getAttribute('aria-pressed')).toBe('true');
    expect(estado().cover_mode).toBe('apa_pro');
  });

  it('la pista y la tira ofrecen las mismas cinco estrategias', () => {
    portada();
    render(<CoverCarouselStudio />);
    const pista = screen.getByTestId('cover-model-track');
    /* Una tarjeta por estrategia, con el rótulo que la nombra. Si la pista
       tuviera una tarjeta que la tira no lista, ese modo no se podría elegir
       desde la barra; y al revés, un chip sin tarjeta no tendría miniatura. */
    expect(pista.querySelectorAll(':scope > div')).toHaveLength(ESTRATEGIAS.length);
    for (const titulo of ESTRATEGIAS) {
      expect(within(pista).getByText(titulo, { selector: 'span' })).toBeTruthy();
    }
  });

  it('la tarjeta del carrusel se alcanza y se elige con el teclado', () => {
    /* Una tarjeta que solo responde al clic es un modo que no se puede elegir
       sin ratón. El control tiene que estar en el orden de tabulación, con
       `role="button"`, y Enter y Espacio tienen que elegir. */
    portada();
    render(<CoverCarouselStudio />);
    const pista = screen.getByTestId('cover-model-track');
    const tarjetas = within(pista).getAllByRole('button');
    expect(tarjetas).toHaveLength(ESTRATEGIAS.length);
    for (const t of tarjetas) expect(t.getAttribute('tabindex')).toBe('0');

    const uni = within(pista).getByRole('button', { name: /Institucional UNI/ });
    uni.focus();
    expect(document.activeElement).toBe(uni);
    fireEvent.keyDown(uni, { key: 'Enter' });
    expect(chip('Institucional UNI').getAttribute('aria-pressed')).toBe('true');
    expect(estado().cover_mode).toBe('generate_uni_cover');

    // Y Espacio, que además no debe dejar desplazar la página: `fireEvent`
    // devuelve `false` cuando el evento fue cancelado.
    const pro = within(pista).getByRole('button', { name: /Profesional APA/ });
    expect(fireEvent.keyDown(pro, { key: ' ' })).toBe(false);
    expect(estado().cover_mode).toBe('apa_pro');
  });

  it('la tarjeta de plantilla es una acción y no se anuncia como interruptor', () => {
    /* Igual que su chip: abrir un selector de archivos no es un estado, y con
       `aria-pressed` el lector de pantalla dice "no presionado". Con teclado,
       además, tiene que abrir el selector. */
    portada();
    const abierto = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    render(<CoverCarouselStudio />);
    const tarjeta = within(screen.getByTestId('cover-model-track')).getByRole('button', {
      name: /Subir plantilla/,
    });
    expect(tarjeta.hasAttribute('aria-pressed')).toBe(false);
    fireEvent.keyDown(tarjeta, { key: 'Enter' });
    expect(abierto).toHaveBeenCalled();
    abierto.mockRestore();
  });});

/* ── Las tres zonas ───────────────────────────────────────────────────────── */

describe('T18 — el editor vive a la derecha, en 320px', () => {
  it('el panel de 320px es el editor de verdad y no una caja con el ancho bien', () => {
    portada();
    const { container } = render(<CoverCarouselStudio />);
    const panel = container.querySelector('[data-testid="cover-editor"]') as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.style.width).toBe('320px');
    // Un `flex: 1` encima del ancho lo borraría en cuanto la ventana creciera.
    expect(panel.style.flexShrink).toBe('0');
    expect(within(panel).getByText('Editor de portada')).toBeTruthy();
  });

  it('el editor es la última zona y el carrusel la primera de la fila', () => {
    portada();
    const { container } = render(<CoverCarouselStudio />);
    const raiz = container.firstElementChild as HTMLElement;
    const fila = raiz.children[1] as HTMLElement;
    expect(fila.children[0]).toBe(screen.getByTestId('cover-carousel'));
    expect(fila.children[fila.children.length - 1]).toBe(
      container.querySelector('[data-testid="cover-editor"]')
    );
  });

  it('el carrusel y su vista previa comparten la columna del centro', () => {
    portada();
    render(<CoverCarouselStudio />);
    const centro = screen.getByTestId('cover-carousel');
    expect(centro.contains(screen.getByTestId('cover-model-track'))).toBe(true);
    expect(centro.contains(screen.getByTestId('canvas'))).toBe(true);
  });
});

/* ── La altura llega hasta el panel ───────────────────────────────────────── */

describe('T18 — la cadena de alto llega hasta el panel de 320px', () => {
  it('la raíz y la fila del cuerpo tienen alto DEFINIDO', () => {
    /* Esto son DECLARACIONES, no layout: jsdom no calcula cajas. Pero el
       defecto que cubren es literal —una declaración que faltaba—, y sin ella
       el `flex: 1` de la raíz no hace nada, porque `Step1PortadaWizard` es una
       caja de BLOQUE (`position: relative; height: 100%`) y un hijo de bloque no
       es ítem flexible. El tamaño real se verificó en un navegador. */
    portada();
    const { container } = render(<CoverCarouselStudio />);
    const raiz = container.firstElementChild as HTMLElement;
    const fila = raiz.children[1] as HTMLElement;
    expect(raiz.style.height).toBe('100%');
    expect(fila.style.height).toBe('100%');
    // Y las dos cajas se pueden encoger: sin `minHeight: 0` el `flex: 1` de
    // abajo no llega a mandar y el contenido manda en el alto.
    expect(raiz.style.minHeight).toBe('0px');
    expect(fila.style.minHeight).toBe('0px');
  });

  it('la columna del centro reparte el alto entre la pista y la vista previa', () => {
    portada();
    render(<CoverCarouselStudio />);
    const centro = screen.getByTestId('cover-carousel');
    const vista = screen.getByTestId('canvas').parentElement as HTMLElement;
    expect(centro.style.display).toBe('flex');
    expect(centro.style.flexDirection).toBe('column');
    expect(centro.style.minHeight).toBe('0px');
    // El preview crece hasta llenar lo que queda, con `minHeight: 0` para que
    // pueda encogerse: sin esto el `flex: 1` de abajo no manda.
    expect(vista.style.flex).not.toBe('');
    expect(vista.style.minHeight).toBe('0px');
  });
});

/* ── La portada no se mide dos veces ──────────────────────────────────────── */

describe('T18 — la portada sigue siendo un bloque que no se parte', () => {
  it('este componente no pagina el documento: eso es de `PaperCanvas`', () => {
    /* La invariante real. La paginación sale de `computeRenderedPages`, de la
       geometría del documento (`geom.pageH`) y del alto de cada elemento
       (`offsetHeight`), y un `overflow` de un ancestro no entra en esa cuenta:
       `offsetHeight` es alto de contenido y `PaperCanvas` no lee `clientHeight`
       en ningún lado. Lo que sí partiría la portada en dos es un SEGUNDO
       paginador aquí, o algo que vuelva a medir la hoja. Se comprueba sobre el
       archivo, que es donde podría aparecer. */
    expect(SRC).toMatch(/import \{ PaperCanvas \}/);
    for (const modulo of ['computePages', 'computeRenderedPages', 'applyPageFlow', 'applyLayout', 'usePageIndex', 'computeRenderedPages']) {
      expect(SRC, `este archivo importa ${modulo}`).not.toMatch(new RegExp(`import[^;]*\\b${modulo}\\b`));
    }
  });

  it('este componente no vuelve a medir la hoja', () => {
    // Una re-medición es la otra forma de partir la portada: si este archivo
    // buscara los nodos de la hoja para medirlos, tendría su propia cuenta de
    // páginas, y dos cuentas no pueden coincidir. Se mira el CÓDIGO, no los
    // comentarios: este archivo explica la regla y nombra `offsetHeight` al
    // hablar de ella.
    for (const llamada of ['querySelectorAll', 'getBoundingClientRect', 'offsetHeight', 'clientHeight', 'scrollHeight', 'paper-elem']) {
      expect(codigo(SRC), `este archivo usa ${llamada}`).not.toMatch(new RegExp(`[^\\w.]${llamada}\\b`));
    }
  });
});

/* ── Tokens y copy del chrome que escribió esta task ──────────────────────── */

describe('T18 — el chrome nuevo usa tokens declarados', () => {
  it('el chrome nuevo no lleva colores literales ni radios fuera de token', () => {
    /* Cubre `COVER_CARDS`..fin de archivo: la lista, el chip, la tira Y el
       cuerpo del componente (raíz, flechas, `aside`), que es donde están la
       mayoría de las declaraciones nuevas. */
    expect(CHROME).toContain('Estrategias de portada');
    expect(codigo(CHROME)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(codigo(CHROME)).not.toMatch(/rgba?\(/);
    const radios = [...codigo(CHROME).matchAll(/borderRadius:\s*'([^']+)'/g)].map((m) => m[1]);
    // Sin radios la comprobación de abajo no miraría nada.
    expect(radios.length).toBeGreaterThan(0);
    for (const radio of radios) expect(radio).toMatch(/^var\(--radius-/);
  });

  it('la deuda literal de los bloques re-indentados está saldada', () => {
    /* Los dos bloques que T18 congeló —las tarjetas del carrusel y los
       envoltorios de la vista previa— eran de antes de ese commit, que solo los
       reindentó, y su cuenta exacta quedó FIJADA para que la deuda no creciera
       en silencio. T20 la saldó: los `rgba` de las sombras son tokens
       (`--shadow-sm`, `--shadow-accent`, `--shadow-card`, `--shadow-inset`), el
       fallback de `--paper-white` desapareció, el `borderRadius: '4px'` es
       `--radius-sm` y los seis `<svg>` a mano son iconos de lucide-react.
       Los cuatro contadores quedan en CERO, y `noHardcodedColors.test.ts` los
       vigila sobre el archivo entero ahora, así que esta cuenta ya no es la
       única red: si vuelve un literal, salta allá con el nombre de la línea. */
    const cuenta = (re: RegExp) => (codigo(TARJETAS).match(re) || []).length;
    expect(cuenta(/rgba?\(/g)).toBe(0);
    expect(cuenta(/#[0-9a-fA-F]{3,8}\b/g)).toBe(0);
    expect(cuenta(/var\(\s*--[a-z0-9-]+\s*,/gi)).toBe(0);
    expect(cuenta(/borderRadius:\s*'(?!\s*var\()/g)).toBe(0);
  });

  it('cada token que usa el chrome nuevo está declarado en design-system.css', () => {
    const usados = new Set<string>();
    for (const m of codigo(TIRA).matchAll(/var\(\s*(--[a-z0-9-]+)/g)) usados.add(m[1]);
    expect(usados.size).toBeGreaterThan(0);
    for (const token of usados) {
      expect(declarados.has(token), `${token} no esta declarado`).toBe(true);
    }
  });

  it('ninguna cadena de la vista lleva emojis', () => {
    portada();
    const { container } = render(<CoverCarouselStudio />);
    expect(container.textContent || '').not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('el texto de la pantalla sigue siendo el que el paso necesita', () => {
    // La salida del paso no es chrome decorativo: si desaparece al rearmar la
    // barra, el paso 1 deja de avanzar. Se busca DENTRO de la tira porque el
    // editor de la derecha tiene su propio "Continuar a Estructura".
    portada();
    render(<CoverCarouselStudio />);
    expect(within(tira()).getByRole('button', { name: /Continuar/ })).toBeTruthy();
  });
});


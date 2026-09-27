/**
 * WordAPA7 — T20: EL LINT DE TOKENS DEL REDISEÑO.
 *
 * Este archivo no es "una prueba más": es la red que convierte en regla lo que
 * hasta aquí era una aspiración escrita en AGENTS.md. Nueve pruebas de este
 * proyecto pasaron veinte tasks sin poder fallar, y dos defectos reales —un
 * fallback muerto que resolvía a 4px donde la spec decía 8px, y un token que no
 * existía y dejaba una marca del minimapa sin color— solo aparecieron leyendo
 * con calma. Ninguno de los dos rompe la compilación. Por eso las reglas viven
 * AQUÍ, y cada detector se prueba contra una violación inyectada.
 *
 * LAS REGLAS (una prueba cada una, para que un rojo diga cuál se rompió):
 *
 *  R1 sin colores literales. Ni hex, ni rgb/rgba/hsl/hsla/oklch/color-mix en el
 *     código del rediseño. Los comentarios NO se miran: un comentario puede y
 *     debe citar el valor que explica por qué dos tokens son el mismo azul. Y se
 *     mira la LÍNEA COMPLETA, no el fragmento: un `var(--x)` en la misma línea
 *     que un `#4f7cff` no absuelve al hex. La versión del brief saltaba la
 *     línea entera, que es justo el agujero que hace que el fuente PAREZCA
 *     correcto.
 *  R2 un specifier en variable nunca lleva fallback. `var(--space-1, 8px)` es
 *     siempre un error: o el token existe (y el fallback es ruido que dice 8px
 *     donde la hoja dice 4px) o no existe (y la referencia está mal escrita). No
 *     hay tercer caso. Este lint encontró UNO vivo en `RailFlyout` después de
 *     diecinueve tasks.
 *  R2-bis la misma regla, pero HONRA la diferencia entre declarar y usar. Dentro
 *     de un bloque `:root` la ley es la de un token. Fuera (`.wa-bubble`, `.btn`)
 *     un `var(--x, valor)` es un literal con un token por delante y su fallback
 *     es su valor: por eso ahí el fallback se permite y lo que no se perdona es
 *     un `var(--x)` SECO de un token que nadie declara. Esta regla encontró tres
 *     tokens que NO EXISTÍBAN en la hoja y que el navegador descartaba en
 *     silencio: `--accent-soft` y `--accent-subtle` (hover y activo de tarjetas,
 *     sin fondo) y `--text-tertiary` (los puntos de "cargando", sin color).
 *  R3 cada token que se usa está DECLARADO en design-system.css. Declarado es
 *     una línea `--token:` dentro de un bloque `:root` (claro u oscuro): buscar
 *     el nombre "en algún lado" daba por definido lo que solo aparecía dentro
 *     del valor de otro token. Un token inexistente no rompe la compilación:
 *     rompe el color en pantalla, que es peor y más difícil de ver.
 *  R4 el radio de borde solo sale de `--radius-*`. Ningún literal.
 *  R5 `strokeWidth` es el valor de `--icon-stroke` (hoy 1.75), leído de la
 *     hoja: si el token cambia, esta regla cambia con él en vez de quedar
 *     mirando un 1.75 escrito a mano en un test.
 *  R6 los iconos son de `lucide-react`. Un `<svg>` escrito a mano puede tener el
 *     grosor que quiera y no lo declara; por eso se prohíbe el elemento, no solo
 *     el `strokeWidth` equivocado.
 *  R7 la hoja de papel es la misma en los dos temas: `--paper-white` es
 *     `#ffffff` y `--paper-ink` es `#111827` en claro Y en oscuro, sin excepción.
 *
 * EL ALCANCE, y por qué es una lista y no un `src/**`. Este lint gobierna lo que
 * el rediseño ESCRIBIÓ, que es lo que se puede hacer cumplir sin reescribir de
 * paso el resto del producto. `git diff --diff-filter=A aa03c53^..HEAD` da los
 * archivos que la rama creó; los directorios van enteros para que un archivo
 * NUEVO quede dentro sin que nadie tenga que acordarse. Los archivos reescritos
 * fuera de esos directorios entran por nombre. Lo que la rama solo TOCÓ
 * (PaperCanvas, App.tsx, ProjectTabs, WhatsAppComment, Step0QuickStart,
 * uiSlice) queda FUERA a propósito: arrastrar su deuda literal aquí convertiría
 * esta tarea en un proyecto de reescritura y, peor, haría que alguien metiera
 * una exención silenciosa para que el lint pasara. Esa deuda está nombrada en el
 * reporte de T20, no perdonada en el código.
 */
import { describe, it, expect, beforeAll } from 'vitest';

/* Specifier en variable + import dinámico: con el literal, `nodePolyfills()` de
   vite lo resuelve a su propio shim de browser y `readFileSync` no existe
   (mismo truco que designTokens.test.ts, readingText.test.tsx y compañía). */
const NODE_FS = 'node:fs';
const NODE_PATH = 'node:path';
const NODE_URL = 'node:url';

/* ── El alcance ──────────────────────────────────────────────────────────── */

const DIRECTORIOS = ['components/shell', 'components/review', 'hooks'];
const ARCHIVOS = [
  'components/export/ExportView.tsx',
  'components/toolbar/UnifiedToolbar.tsx',
  'components/toolbar/ToolbarOverflowMenu.tsx',
  'components/wizard/CoverCarouselStudio.tsx',
  'components/wizard/Step5AuditIAWizard.tsx',
  'lib/commentContext.ts',
];
/** La hoja canónica. Los tokens se declaran AQUÍ y en ningún otro sitio. */
const HOJA = 'styles/design-system.css';

/* ── La hoja: qué está DECLARADO y qué vive dentro de un bloque :root ───────
   El detalle que hace que R2 y R3 no sean reglas de adivinanza. Una hoja de
   estilos tiene dos sitios: los bloques `:root`, donde se DECLARA un token, y
   las reglas de selector (`.wa-bubble`, `.btn`), donde se USA. En un bloque
   `:root` la ley es la de un token: sin fallback, y todo lo que se declara ahí
   es un token. Fuera, un `var(--x, valor)` es un LITERAL con un token por
   delante, y un `--x:` suelto es un custom property de esa regla: no es un token
   de la app, y por eso su `var(--x)` tiene que traer su valor. Esa distinción es
   la que separa "fallback muerto" de "defecto de tema oscuro". */

interface Hoja {
  /** Todo lo declarado en un bloque `:root` (claro u oscuro). */
  declarados: Set<string>;
  /** Las líneas que caen dentro de un bloque `:root`. */
  raiz: (linea: number) => boolean;
}

const SELECTOR_RAIZ = /^\s*:root\b[^{]*\{/gm;

function analizarHoja(css: string): Hoja {
  const declarados = new Set<string>();
  const rangos: [number, number][] = [];
  for (const m of css.matchAll(SELECTOR_RAIZ)) {
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
    const lineaDe = (offset: number) => css.slice(0, offset).split('\n').length;
    rangos.push([lineaDe(m.index), lineaDe(cierre)]);
    for (const d of css.slice(abierto + 1, cierre).matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)) {
      declarados.add(d[1]);
    }
  }
  return {
    declarados,
    raiz: (linea) => rangos.some(([a, b]) => linea >= a && linea <= b),
  };
}

/* ── Detectores: funciones puras sobre un trozo de código ───────────────────
   Puras a propósito. Un detector que solo existe metido dentro del `expect` no
   se puede probar con una violación inyectada, que es la mitad del trabajo de
   este archivo. Cada una devuelve la lista de ofensas con su línea, o `[]`. */

interface Ofensa {
  linea: number;
  detalle: string;
}

/** El código sin comentarios. Un comentario puede citar un color; el código no. */
const sinComentarios = (src: string): string =>
  src
    /* El `[^:]` delante de `//` es lo que salva a las URLs: sin él, un
       `https://` dentro de una cadena se comería el resto de la línea. */
    .replace(/\/\*[\s\S]*?\*\//g, (bloque) => bloque.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** R1: un color escrito a mano. Se mira la LÍNEA COMPLETA. */
function coloresLiterales(codigo: string): Ofensa[] {
  const COLOR =
    /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\brgba?\(|\bhsla?\(|\boklch\(|\bcolor-mix\(/g;
  return codigo.split('\n').flatMap((linea, i) =>
    [...linea.matchAll(COLOR)].map((m) => ({ linea: i + 1, detalle: `color literal ${m[0]}` })),
  );
}

/** R2: `var(--token, algo)`. El fallback de un specifier en variable. */
function fallbackDeToken(codigo: string, enRaiz?: (linea: number) => boolean): Ofensa[] {
  const re = /var\(\s*--[a-z0-9-]+\s*,/gi;
  return codigo.split('\n').flatMap((linea, i) =>
    [...linea.matchAll(re)]
      .filter(() => !enRaiz || enRaiz(i + 1))
      .map((m) => ({ linea: i + 1, detalle: `fallback en ${m[0].trim()}` })),
  );
}

/** Los tokens que el código usa. */
function tokensUsados(codigo: string): Set<string> {
  const usados = new Set<string>();
  for (const m of codigo.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) usados.add(m[1]);
  return usados;
}

/** R3: los tokens que el código usa y la hoja NO declara. */
function tokensSinDeclarar(codigo: string, declarados: Set<string>): string[] {
  return [...tokensUsados(codigo)].filter((t) => !declarados.has(t));
}

/**
 * R2-bis: un `var(--token)` SECO, fuera de todo bloque `:root`, de un token que
 * ningún `:root` declara. Fuera de `:root` el fallback sí es el valor de la
 * regla; lo que no tiene arreglo es un token seco que no existe: no tiene valor
 * en claro ni en oscuro, y en oscuro es una caja sin borde.
 */
function tokensSecosFueraDeRaiz(
  codigo: string,
  declarados: Set<string>,
  enRaiz: (linea: number) => boolean,
): Ofensa[] {
  const salida: Ofensa[] = [];
  codigo.split('\n').forEach((linea, i) => {
    if (enRaiz(i + 1)) return;
    /* SECO = el specifier cierra sin fallback. `var(--a, var(--b))` tiene el
       `--b` seco y el `--a` con valor: los dos se miran por separado. */
    for (const m of linea.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/g)) {
      if (!declarados.has(m[1])) {
        salida.push({ linea: i + 1, detalle: `${m[1]} sin declarar y sin fallback` });
      }
    }
  });
  return salida;
}

/** R4: un radio de borde que no viene de `--radius-*`. */
function radiosLiterales(codigo: string): Ofensa[] {
  const formas = [
    /borderRadius:\s*'([^']*)'/g,
    /borderRadius:\s*"([^"]*)"/g,
    /border-radius:\s*([^;}\n]+)/g,
  ];
  const salida: Ofensa[] = [];
  codigo.split('\n').forEach((linea, i) => {
    for (const re of formas) {
      for (const m of linea.matchAll(re)) {
        if (!/^\s*var\(\s*--radius-/.test(m[1])) {
          salida.push({ linea: i + 1, detalle: `radio literal ${m[1].trim()}` });
        }
      }
    }
  });
  return salida;
}

/** R5: un grosor de icono distinto del token `--icon-stroke`. */
function grosoresDistintos(codigo: string, valorDelToken: number): Ofensa[] {
  const salida: Ofensa[] = [];
  codigo.split('\n').forEach((linea, i) => {
    for (const m of linea.matchAll(/strokeWidth\s*=\s*\{?\s*["']?([\d.]+)/g)) {
      if (Number(m[1]) !== valorDelToken) {
        salida.push({
          linea: i + 1,
          detalle: `strokeWidth ${m[1]} ≠ --icon-stroke ${valorDelToken}`,
        });
      }
    }
  });
  return salida;
}

/** R6: un `<svg>` escrito a mano en vez de un icono de lucide-react. */
function svgsAMano(codigo: string): Ofensa[] {
  return codigo.split('\n').flatMap((linea, i) =>
    /<svg[\s>]/.test(linea) ? [{ linea: i + 1, detalle: 'svg a mano (los iconos son de lucide-react)' }] : [],
  );
}

/* ── Lectura del disco ─────────────────────────────────────────────────────── */

let rutas: string[] = [];
let declarados = new Set<string>();
let enRaizDeHoja = (_linea: number): boolean => true;
let grosorDeIcono = 0;
let hoja = '';
let bloquesDeTema: Record<string, string> = {};
let fuenteDe = (_ruta: string): string => '';

beforeAll(async () => {
  const { readdirSync, readFileSync, statSync } = await import(/* @vite-ignore */ NODE_FS);
  const { join, resolve } = await import(/* @vite-ignore */ NODE_PATH);
  const { fileURLToPath } = await import(/* @vite-ignore */ NODE_URL);
  const raiz = resolve(fileURLToPath(import.meta.url).replace(/[^/\\]+$/, ''), '..');

  const recorrer = (dir: string): string[] => {
    const salida: string[] = [];
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) salida.push(...recorrer(ruta));
      else if (/\.tsx?$/.test(nombre)) salida.push(ruta);
    }
    return salida;
  };

  /* Un archivo renombrado hace que `readFileSync` lance y la prueba falle con
     su nombre: el alcance no puede encogerse en silencio. */
  rutas = [
    ...DIRECTORIOS.flatMap((d) => recorrer(join(raiz, d))),
    ...ARCHIVOS.map((a) => join(raiz, a)),
  ].sort();
  fuenteDe = (ruta) => readFileSync(ruta, 'utf8');

  hoja = readFileSync(join(raiz, HOJA), 'utf8');
  /* Declarado = una línea que DECLARA un token dentro de un bloque `:root`.
     `--text-tertiary` sale dentro del valor de `--text-secondary` y eso no es
     una declaración; un `--x:` dentro de `.wa-bubble` es un custom property de
     esa regla, tampoco. */
  ({ declarados, raiz: enRaizDeHoja } = analizarHoja(hoja));
  grosorDeIcono = Number(hoja.match(/--icon-stroke\s*:\s*([^;]+);/)?.[1].trim());

  /* R7 necesita los dos temas POR SEPARADO: un token puede estar bien en claro
     y haber cambiado en oscuro, que es lo que no puede pasar con la hoja. Los
     bloques se toman por su selector, no por posición. */
  const bloque = (selector: RegExp): string => {
    const desde = hoja.search(selector);
    if (desde < 0) return '';
    const abierto = hoja.indexOf('{', desde);
    let nivel = 0;
    for (let i = abierto; i < hoja.length; i++) {
      if (hoja[i] === '{') nivel++;
      else if (hoja[i] === '}' && --nivel === 0) return hoja.slice(abierto + 1, i);
    }
    return '';
  };
  bloquesDeTema = {
    claro: bloque(/^:root,\s*$/m) || bloque(/^:root\s*\{/m),
    oscuro: bloque(/^:root\[data-theme="dark"\]/m),
  };
});

/* ── Las siete reglas, sobre el archivo real ─────────────────────────────── */

const nombreDe = (ruta: string): string => ruta.split(/[\\/]/).pop() || ruta;

/** Corre un detector sobre TODO el alcance y devuelve una lista legible. */
const comoTexto = (regla: (codigo: string) => Ofensa[]): string[] =>
  rutas.flatMap((ruta) =>
    regla(sinComentarios(fuenteDe(ruta))).map(
      (o) => `${nombreDe(ruta)}:${o.linea} ${o.detalle}`,
    ),
  );

describe('T20 — el lint de tokens del rediseño', () => {
  it('el alcance existe: sin archivos, estas reglas no mirarían nada', () => {
    /* La guarda que este proyecto necesitó nueve veces. Un alcance que se vacía
       —un directorio renombrado, una lista mal escrita— haría que las siete
       reglas siguientes PASARAN sin haber leído una línea. */
    expect(rutas.length).toBeGreaterThanOrEqual(20);
    const nombres = rutas.map(nombreDe);
    /* Los que el rediseño creó, para que un archivo nuevo caiga dentro sin que
       nadie tenga que acordarse de añadirlo a una lista. */
    for (const esperado of [
      'EngineGroupCard.tsx',
      'FocusReadingCard.tsx',
      'ReadingText.tsx',
      'ReviewStrip.tsx',
      'ReviewWorkbench.tsx',
      'IconRail.tsx',
      'RailFlyout.tsx',
      'AppShell.tsx',
      'useReviewWorkbench.ts',
      'usePageIndex.ts',
      'ExportView.tsx',
      'CoverCarouselStudio.tsx',
    ]) {
      expect(nombres, `${esperado} no está en el alcance del lint`).toContain(esperado);
    }
  });

  it('R1 — ningún color literal en el código del rediseño', () => {
    expect(comoTexto(coloresLiterales)).toEqual([]);
  });

  it('R2 — ningún specifier en variable con fallback', () => {
    expect(comoTexto(fallbackDeToken)).toEqual([]);
    /* Y en la hoja, DENTRO de un bloque `:root`: un token que se define a sí
       mismo no declara nada, y ahí un fallback no puede ser "el valor de esta
       regla", porque la regla es la del token. (Fuera de `:root` el fallback sí
       se permite: ver R2-bis.) */
    expect(fallbackDeToken(hoja, enRaizDeHoja)).toEqual([]);
  });

  it('R2-bis — fuera de :root, un token sin declarar tiene que traer su valor', () => {
    /* La mitad de la hoja son reglas de selector, y ahí un `var(--x, valor)` es
       un literal con un token por delante. Lo que no puede pasar es un
       `var(--x)` SECO que la hoja no declara en ningún `:root`: eso no tiene
       valor en ningún tema. Es el defecto de la clase "el token no existe", del
       lado de la hoja. */
    const offenses = tokensSecosFueraDeRaiz(hoja, declarados, enRaizDeHoja);
    /* Que no se vacíe: si la hoja no tuviera usos fuera de `:root`, la regla no
       estaría mirando nada. */
    const usosFueraDeRaiz = hoja
      .split('\n')
      .flatMap((linea, i) => (enRaizDeHoja(i + 1) ? [] : [...linea.matchAll(/var\(\s*--[a-z0-9-]+/g)]))
      .length;
    expect(usosFueraDeRaiz).toBeGreaterThan(50);
    expect(offenses).toEqual([]);
  });

  it('R3 — cada token que se usa está declarado en design-system.css', () => {
    const sinDeclarar: string[] = [];
    let total = 0;
    for (const ruta of rutas) {
      const usados = tokensUsados(sinComentarios(fuenteDe(ruta)));
      total += usados.size;
      for (const token of tokensSinDeclarar(fuenteDe(ruta), declarados)) {
        sinDeclarar.push(`${nombreDe(ruta)}: ${token}`);
      }
    }
    /* Que no se vacíe: si nadie usara tokens, la regla pasaría por nada. */
    expect(total).toBeGreaterThan(20);
    expect(sinDeclarar).toEqual([]);
  });

  it('R4 — el radio de borde solo sale de --radius-*', () => {
    /* Y que el alcance use radios por token, para que el `for` de abajo tenga
       algo que mirar y no sea una regla que nunca encuentra nada. */
    expect(rutas.some((r) => /var\(\s*--radius-/.test(fuenteDe(r)))).toBe(true);
    expect(comoTexto(radiosLiterales)).toEqual([]);
  });

  it('R5 — strokeWidth es el valor de --icon-stroke', () => {
    /* El token se resuelve contra la hoja real, no contra un 1.75 copiado. */
    expect(grosorDeIcono).toBe(1.75);
    expect(comoTexto((c) => grosoresDistintos(c, grosorDeIcono))).toEqual([]);
  });

  it('R6 — los iconos vienen de lucide-react, no de un <svg> a mano', () => {
    expect(comoTexto(svgsAMano)).toEqual([]);
  });

  it('R7 — la hoja de papel es la misma en claro y en oscuro', () => {
    /* `--paper-white: #ffffff` y `--paper-ink: #111827` en los DOS temas. El
       papel no se oscurece: es la fidelidad de la norma, no una preferencia. */
    expect(Object.keys(bloquesDeTema)).toEqual(['claro', 'oscuro']);
    for (const [tema, bloque] of Object.entries(bloquesDeTema)) {
      expect(bloque, `no se encontró el bloque :root del tema ${tema}`).not.toBe('');
      expect(bloque, `--paper-white del tema ${tema}`).toMatch(/--paper-white:\s*#ffffff\s*;/);
      expect(bloque, `--paper-ink del tema ${tema}`).toMatch(/--paper-ink:\s*#111827\s*;/);
    }
  });
});

/* ── El detector contra violaciones inyectadas ────────────────────────────────
   Cada detector se pasa un trozo que lo viola y uno que no. Un detector que solo
   se puede probar con el archivo real no demuestra que dispare: puede estar
   mirando otra cosa y dar verde por casualidad. */

const LIMPIO = [
  "const s = { color: 'var(--color-accent)', borderRadius: 'var(--radius-md)' };",
  'const w = { gap: "var(--space-1)" };',
].join('\n');

describe('T20 — el detector se enciende con una violación y se calla sin ella', () => {
  it('R1: un hex en una línea que YA trae un token también es delito', () => {
    /* El agujero del brief: se saltaba la línea entera si tenía un `var(--`.
       Aquí la misma línea, con el token y el hex, tiene que reportar el hex. */
    expect(coloresLiterales(LIMPIO)).toEqual([]);
    expect(coloresLiterales("const s = { color: 'var(--color-accent)', borderColor: '#4f7cff' };").map((o) => o.detalle))
      .toEqual(['color literal #4f7cff']);
    expect(coloresLiterales("const s = { boxShadow: '0 1px 2px rgba(0,0,0,0.1)' };")).toHaveLength(1);
    expect(coloresLiterales("const s = { backgroundColor: 'var(--paper-white)' };")).toEqual([]);
  });

  it('R1: un comentario puede citar el color; el código no', () => {
    const comentado = '/* el token y el acento son el mismo azul (#4f7cff) */\n' + LIMPIO;
    expect(coloresLiterales(sinComentarios(comentado))).toEqual([]);
  });

  it('R2: el fallback se ve aunque el token exista', () => {
    /* El caso de `RailFlyout`: `--space-1` existe y vale 4px, y el fallback
       decía 8px. El detector no necesita preguntar si el token existe. */
    expect(declarados.has('--space-1')).toBe(true);
    expect(fallbackDeToken(LIMPIO)).toEqual([]);
    expect(fallbackDeToken("gap: 'var(--space-1, 8px)'")).toHaveLength(1);
    expect(fallbackDeToken("border: '1px solid var(--border-strong, var(--color-border-subtle))'")).toHaveLength(1);
    expect(fallbackDeToken("fuente: 'var(--font-sans, system-ui, sans-serif)'")).toHaveLength(1);
  });

  it('R2-bis: dentro de :root el fallback está prohibido; fuera es el valor', () => {
    /* La hoja sintética que separa los dos casos. `--marca: var(--x, 8px)` dentro
       de `:root` es un token; el mismo `var(--x, valor)` dentro de `.wa` es un
       literal con un token por delante, y por eso ahí el fallback se NECESITA. */
    const css = [
      ':root {', // 1
      '  --color-accent: #4f7cff;', // 2
      '  --marca: var(--space-1, 8px);', // 3
      '}', // 4
      '.wa {', // 5
      '  background: var(--surface-elevated, #ffffff);', // 6
      '  color: var(--text-main);', // 7
      '  border-radius: var(--radius-md, 8px);', // 8
      '}', // 9
    ].join('\n');
    const falsa = analizarHoja(css);
    expect(falsa.raiz(2)).toBe(true);
    expect(falsa.raiz(6)).toBe(false);
    /* Dentro de `:root`: un solo fallback, el de la línea 3. */
    expect(fallbackDeToken(css, falsa.raiz).map((o) => o.linea)).toEqual([3]);
    /* Fuera de `:root`: los de las líneas 6 y 8 son el valor de la regla. */
    expect(fallbackDeToken(css, (l) => !falsa.raiz(l)).map((o) => o.linea)).toEqual([6, 8]);
    /* Y lo que no se perdona en ningún sitio: el `var(--text-main)` SECO de la
       línea 7, con `--text-main` sin declarar en ningún `:root`. */
    expect(tokensSecosFueraDeRaiz(css, falsa.declarados, falsa.raiz).map((o) => o.linea)).toEqual([7]);
    /* Con el token declarado, la misma línea deja de ser delito. */
    const conToken = css.replace('  --color-accent: #4f7cff;', '  --color-accent: #4f7cff;\n  --text-main: #1a1a2e;');
    expect(tokensSecosFueraDeRaiz(conToken, analizarHoja(conToken).declarados, analizarHoja(conToken).raiz))
      .toEqual([]);
  });

  it('R3: un token que no existe se reporta, uno que existe no', () => {
    /* El caso del minimapa: `--color-text-tertiary` está declarado;
       `--text-tertiary` sale dentro del valor de otro token y no existe. Un
       patrón que lo diera por definido aprobaría un `var(--x-typo)`. */
    expect(declarados.has('--color-text-tertiary')).toBe(true);
    expect(declarados.has('--text-tertiary')).toBe(false);
    expect(tokensSinDeclarar("color: 'var(--color-text-tertiary)'", declarados)).toEqual([]);
    expect(tokensSinDeclarar("color: 'var(--color-minimapa-que-no-existe)'", declarados)).toEqual([
      '--color-minimapa-que-no-existe',
    ]);
  });

  it('R4: un radio literal se ve; un token de radio, no', () => {
    expect(radiosLiterales(LIMPIO)).toEqual([]);
    expect(radiosLiterales("borderRadius: '4px'")[0].detalle).toBe('radio literal 4px');
    expect(radiosLiterales('border-radius: 12px;')).toHaveLength(1);
    expect(radiosLiterales("borderRadius: 'var(--radius-full)'")).toEqual([]);
  });

  it('R5: cualquier grosor distinto del token se ve', () => {
    expect(grosoresDistintos(LIMPIO, 1.75)).toEqual([]);
    expect(grosoresDistintos('<Check strokeWidth={2} />', 1.75)).toHaveLength(1);
    expect(grosoresDistintos('<Check strokeWidth="3" />', 1.75)).toHaveLength(1);
    expect(grosoresDistintos('<Check strokeWidth={1.75} />', 1.75)).toEqual([]);
  });

  it('R6: un <svg> a mano se ve aunque su grosor sea el correcto', () => {
    /* El grosor correcto no salva el icono: lo que se vigila es de dónde sale,
       y un svg a mano puede cambiarlo sin que nadie lo note. */
    expect(svgsAMano('<Check size={14} strokeWidth={1.75} />')).toEqual([]);
    expect(svgsAMano('<svg width="14" height="14" strokeWidth="2">')).toHaveLength(1);
  });
});

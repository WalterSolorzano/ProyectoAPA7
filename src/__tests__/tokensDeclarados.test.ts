/**
 * F1 · Task 1 — los tokens que se usan y no existen.
 *
 * El lint de `noHardcodedColors.test.ts` ya tiene R3 ("cada token que se usa
 * está declarado"), pero su alcance es una lista de directorios y de archivos:
 * seis carpetas de `src/components` estaban fuera, y en una de ellas un token
 * inexistente vivía sin que nadie lo notara. `--surface-bg` era el peor caso,
 * porque además venía con un fallback `var(--surface-bg, #ffffff)`, que es
 * exactamente el patrón que hace parecer sano lo que está roto: se ve bien en
 * claro y mal donde el token no existe.
 *
 * Esta prueba es la regla GENERAL: recorre TODOS los fuentes de `src/**` y pide
 * que cada `var(--x)` seco esté declarado en la hoja canónica. Caza los tokens
 * fantasma hoy y impide que aparezca el próximo. No es una copia de R3 con más
 * directorios: R3 mira el alcance, esta mira el repo.
 *
 * Los `var(--x, fallback)` se IGNORAN a propósito, y no es una omisión:
 * un fallback se resuelve solo, así que no rompe nada; lo que rompe es el token
 * seco de uno que nadie declaró, que no tiene valor en ningún tema.
 *
 * NOTA DE IMPLEMENTACIÓN (por qué el mixto): `import.meta.glob` con `?raw`
 * devuelve el texto de los `.ts`/`.tsx`, pero de los `.css` devuelve cadena
 * vacía en este runner. La hoja se lee con el rodeo por variable de specifier
 * que ya usan `designTokens.test.ts` y `noHardcodedColors.test.ts`, porque con
 * el specifier literal `nodePolyfills()` intercepta el módulo y su shim de
 * browser no trae `readFileSync`.
 */
import { describe, it, expect, beforeAll } from 'vitest';

const fuentes = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const NODE_FS = 'node:fs';
const NODE_PATH = 'node:path';
const NODE_URL = 'node:url';

/** El código sin comentarios: un comentario puede citar un token que no existe. */
const sinComentarios = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (bloque) => bloque.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

let declarados = new Set<string>();

beforeAll(async () => {
  const { readFileSync } = await import(/* @vite-ignore */ NODE_FS);
  const { resolve } = await import(/* @vite-ignore */ NODE_PATH);
  const { fileURLToPath } = await import(/* @vite-ignore */ NODE_URL);
  const testDir = fileURLToPath(import.meta.url).replace(/[^/\\]+$/, '');
  const css = sinComentarios(readFileSync(resolve(testDir, '../styles/design-system.css'), 'utf8'));

  /* Declarado = una línea `--token:` dentro de un bloque `:root`. Un `--x:`
     suelto dentro de `.wa-bubble` es un custom property de esa regla, y un
     `--x` que aparece dentro del VALOR de otro token no está declarado: son dos
     engaños distintos, y el segundo es el que dejó a `--text-tertiary` pasar
     en R3 como si estuviera definido. */
  for (const m of css.matchAll(/:root\b[^{]*\{/gm)) {
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
    for (const d of css.slice(abierto + 1, cierre).matchAll(/^\s*(--[\w-]+)\s*:/gm)) {
      declarados.add(d[1]);
    }
  }
});

/** `src/__tests__` queda afuera a propósito, y no es una excepción de las que
 *  matan un lint: los archivos de prueba guardan CSS SINTÉTICO como cadena para
 *  probar los detectores, y ese texto viola la regla por diseño —un
 *  `--color-minimapa-que-no-existe` dentro de un `expect` es la violación
 *  inyectada, no un uso. La regla gobierna el producto, no el banco de pruebas. */
const rutas = Object.keys(fuentes).filter((r) => !r.includes('/__tests__/'));

describe('F1 — todo var(--x) seco de src/** está declarado en design-system.css', () => {
  it('ningún token seco se usa sin existir', () => {
    const sinDeclarar: string[] = [];
    for (const ruta of rutas) {
      for (const m of sinComentarios(fuentes[ruta]).matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
        if (!declarados.has(m[1])) sinDeclarar.push(`${ruta.slice(5)} usa ${m[1]}`);
      }
    }
    expect(sinDeclarar).toEqual([]);
  });

  it('la regla no está mirando nada: hay tokens declarados y hay usos secos', () => {
    /* La guarda que este proyecto necesitó nueve veces. Un alcance vacío hace que
       la regla de arriba PASE sin haber leído una línea, y eso es verde falso. */
    expect(declarados.size).toBeGreaterThan(80);
    const usos = Object.values(fuentes).reduce(
      (n, f) => n + [...sinComentarios(f).matchAll(/var\(\s*--[\w-]+\s*\)/g)].length,
      0,
    );
    expect(usos).toBeGreaterThan(200);
  });

  it('un token con fallback NO se reporta, porque se resuelve solo', () => {
    /* El patrón que tapaba el defecto: `var(--surface-bg, #ffffff)` se veía bien en
       claro y mal en oscuro, y la guarda de existencia no lo marca porque no es
       un token seco. Por eso separarlo es parte de la regla y no un detalle. */
    expect([...sinComentarios("background: 'var(--no-existe-nada, #ffffff)'").matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].length)
      .toBe(0);
  });
});

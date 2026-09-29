/**
 * El layout de la lista, afirmado sobre el FUENTE y no sobre el DOM.
 *
 * jsdom no calcula cajas: `getBoundingClientRect` devuelve ceros siempre. Un test
 * que "mide" en jsdom no mide, pasa por la forma del assert y no vigila nada. Lo
 * que sí se puede afirmar sin mentir son las TRES reglas que, si no se cumplen,
 * producen el defecto de §8.4 — y se afirman sobre el código que las tiene que
 * cumplir, no sobre una suposición.
 *
 * LECTOR: `?raw` sobre `.tsx`, que es lo que funciona. NO sirve para `.css` —el
 * runner tiene `css: false`—; para una hoja va el rodeo del specifier en variable
 * que ya usan `designTokens.test.ts:13-16`.
 */
import { describe, it, expect } from 'vitest';

const FUENTES = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const lista = FUENTES['/src/components/figures/ListaContextual.tsx'];
const paso = FUENTES['/src/components/wizard/Step3FiguresTablesWizard.tsx'];

/** Quita comentarios de bloque y de linea, para que un `flexShrink: 0` citado en
 *  una nota no cuente como el `flexShrink: 0` de un header real. */
const sinComentarios = (fuente: string): string =>
  fuente
    .replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Los bloques `{ ... }` de un objeto de estilo, uno por elemento. Es lo que hace
 *  la regla del header posarse sobre UNA caja y no sobre una ventana de 300
 *  caracteres, que es como una guarda termina accusando al archivo equivocado. */
function bloquesDeEstilo(fuente: string): string[] {
  const bloques: string[] = [];
  const re = /style=\{\{([\s\S]*?)\}\}/g;
  for (let m = re.exec(fuente); m !== null; m = re.exec(fuente)) bloques.push(m[1]);
  return bloques;
}

/**
 * El bloque de estilo DEL ELEMENTO que lleva ese `data-testid`, y no una ventana
 * de caracteres alrededor.
 *
 * POR QUE NO UNA VENTANA. La primera version de esta guarda buscaba 400 caracteres
 * despues del `data-testid` y asi leia `minWidth: 0` de un `<div>` que estaba
 * cuatro lineas mas abajo: la prueba daba verde con el scroller SIN `minWidth: 0`.
 * Una guarda que lee de mas es peor que ninguna, porque seReporta vigilando. Esta
 * devuelve el `style={{ ... }}` que le sigue al `data-testid`, que es el del
 * elemento y solo el suyo.
 */
function estiloDe(fuente: string, testid: string): string {
  const desde = fuente.indexOf(`data-testid="${testid}"`);
  if (desde === -1) return '';
  const resto = fuente.slice(desde);
  const m = resto.match(/style=\{\{([\s\S]*?)\}\}/);
  return m ? m[1] : '';
}

describe('§8.4: nada se tapa y ninguna lista queda en 0 px', () => {
  it('el glob esta leyendo de verdad', () => {
    expect(Object.keys(FUENTES).length).toBeGreaterThan(100);
    expect(lista, 'no se leyo ListaContextual.tsx').toBeTruthy();
    expect(lista.length).toBeGreaterThan(500);
    /* Y el poder leer CSS con `?raw` NO: con `css: false` devuelve cadena vacia,
       y una cadena vacia matchea cero reglas. Por eso esta suite es de `.tsx`. */
    const css = Object.keys(FUENTES).filter((r) => r.endsWith('.css'));
    expect(css, 'este glob es de ts y tsx, no deberia traer css').toEqual([]);
  });

  it('el scroller de la lista lleva minHeight: 0 y minWidth: 0', () => {
    const scroller = estiloDe(lista, 'lista-figuras-scroller');
    expect(scroller).not.toBe('');
    expect(scroller).toMatch(/minHeight:\s*0/);
    expect(scroller).toMatch(/minWidth:\s*0/);
    expect(scroller).toMatch(/overflowY:\s*'auto'/);
  });

  it('NINGUN header lleva flexShrink: 0 sin maxHeight al lado', () => {
    /* El header del rail de hoy (`Step3FiguresTablesWizard.tsx:180-321`) es
       exactamente eso, y con una ventana de 700 px de alto se come la lista.

       LA REGLA SE APUNTA A LOS HEADERS, NO A TODO `flexShrink: 0`. Un chip de 56 px
       con `flexShrink: 0` no se come nada: no crece. Un bloque apilado con borde
       inferior, que es la FIRMA de un header dentro de una columna, sí. Por eso la
       guarda busca esa firma —`flexShrink: 0` junto a `borderBottom` de token— y
       no un `flexShrink: 0` suelto: una regla que salta con los iconos se
       desactiva sola la primera vez que alguien mete un boton. */
    for (const [ruta, fuente] of [
      ['/src/components/figures/ListaContextual.tsx', lista],
      ['/src/components/wizard/Step3FiguresTablesWizard.tsx', paso],
    ] as const) {
      const limpio = sinComentarios(fuente ?? '');
      for (const bloque of bloquesDeEstilo(limpio)) {
        if (!/flexShrink:\s*0/.test(bloque)) continue;
        const esHeader = /borderBottom:\s*'1px solid var\(--border-subtle\)'/.test(bloque)
          || /data-testid="[^"]*-header"/.test(bloque);
        if (!esHeader) continue;
        expect(bloque, `${ruta}: un header con flexShrink: 0 y sin maxHeight`).toMatch(/maxHeight/);
      }
    }
  });

  it('el header de la lista declara su maxHeight, y el tope es un valor', () => {
    const header = estiloDe(lista, 'lista-figuras-header');
    expect(header).not.toBe('');
    /* Admite el literal o la constante que lo nombra: lo que se prohibe es que no
       haya tope, no que el tope este escrito de una forma o de otra. */
    expect(header).toMatch(/maxHeight:\s*('[^']*'|[A-Z_]+)/);
    /* Y el `flexShrink: 0` del header tiene que estar EN ese bloque, no en el
       del rail de al lado: son dos cajas distintas. */
    expect(header).toMatch(/flexShrink:\s*0/);
  });

  it('el contenedor del escenario lleva minWidth: 0, que es lo que faltaba en :445', () => {
    const escenario = FUENTES['/src/components/figures/EscenarioFigura.tsx'];
    /* SIN RAMA DE RESGUARDO, A PROPOSITO. Cuando se escribio esta prueba el
       `EscenarioFigura.tsx` todavia no existia y la guarda admitia "si no esta,
       mira el paso". Hoy el archivo esta: una rama de esas es una guarda que
       puede quedarse mirando la mitad equivocada sin que nadie lo note, y esta
       regla fue media guarda durante tres commits. Si el archivo se borra, esto
       tiene que CAER. */
    expect(escenario, 'EscenarioFigura.tsx tiene que estar: si no esta, esta guarda no vigila').toBeTruthy();
    const scroller = estiloDe(escenario!, 'escenario-scroller');
    expect(scroller, 'no se encontro el estilo del scroller del escenario').not.toBe('');
    expect(scroller).toMatch(/minHeight:\s*0/);
    expect(scroller).toMatch(/minWidth:\s*0/);
  });

  it('NO se importa ReviewMinimap en la fase de figuras', () => {
    /* Spec §14 y AGENTS.md §1. Vive en `src/components/review/` desde F1 y no
       vuelve a un layout de tres columnas. */
    expect(lista).not.toMatch(/ReviewMinimap/);
    expect(paso).not.toMatch(/ReviewMinimap/);
  });
});

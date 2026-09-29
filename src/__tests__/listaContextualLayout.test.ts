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
    const scroller = lista.match(/data-testid="lista-figuras-scroller"[\s\S]{0,400}/)?.[0] ?? '';
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
    const header = lista.match(/data-testid="lista-figuras-header"[\s\S]{0,400}/)?.[0] ?? '';
    expect(header).not.toBe('');
    /* Admite el literal o la constante que lo nombra: lo que se prohibe es que no
       haya tope, no que el tope este escrito de una forma o de otra. */
    expect(header).toMatch(/maxHeight:\s*('[^']*'|[A-Z_]+)/);
  });

  it('el contenedor del escenario lleva minWidth: 0, que es lo que faltaba en :445', () => {
    const escenario = FUENTES['/src/components/figures/EscenarioFigura.tsx'];
    if (escenario === undefined) {
      /* La regla se escribe ahora aunque el escenario llegue en la Task 3: una
         guarda que espera al archivo para poder leerse pasa verde sin haber leido
         nada, que es la forma de una guarda que no vigila. Mientras tanto vigila
         el contenedor del lienzo del paso, que es el `:445` al que §8.4 le falta
         el `minWidth: 0`. */
      expect(paso, 'el contenedor del lienzo tiene que llevar minHeight: 0 y minWidth: 0')
        .toMatch(/flex:\s*1,\s*minHeight:\s*0,\s*minWidth:\s*0/);
      return;
    }
    const scroller = escenario.match(/data-testid="escenario-scroller"[\s\S]{0,400}/)?.[0] ?? '';
    expect(escenario).toBeTruthy();
    expect(scroller).not.toBe('');
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

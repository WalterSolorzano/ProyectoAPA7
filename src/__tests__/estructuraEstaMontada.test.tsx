/**
 * EL GUARDIÁN DE LA MONTAJE. Este archivo existe por un hecho, no por una idea:
 * `src/components/structure/` tenía SIETE componentes terminados, con sus
 * pruebas en verde, y CERO importadores fuera de la propia carpeta. Un trabajo
 * terminado que no llega a la pantalla no está terminado: está guardado.
 *
 * Por eso hay dos pruebas y las dos son negativas:
 *
 *   1. la fase de Estructura MONTA el índice, no el documento entero. El
 *      defecto reportado fue que el centro era el archivo vomitado, y un centro
 *      que se puede volver a ensuciar no se arregla con un commit.
 *
 *   2. cada componente de la carpeta tiene un importador, y los nombres se LEEN
 *      DEL DISCO. Nada de lista escrita a mano: la lista escrita a mano es la
 *      misma tautología que hay que evitar —agrega un componente, no lo
 *      montás, la guarda sigue verde porque no lo conocía—. Si mañana aparece un
 *      noveno archivo en la carpeta, esta prueba lo mira sin que nadie la toque.
 *
 * LOS `__tests__` NO CUENTAN COMO MONTADA UNA COSA. Una prueba que importa un
 * componente para probarlo no lo pone en pantalla; si contara, la guarda de
 * arriba habría pasado con los siete archivos huérfanos y sus cuatro archivos
 * de prueba.
 *
 * Y el LECTOR DE FUENTES: `?raw` sobre `.ts`/`.tsx`, que es lo que funciona
 * acá. NO sirve para `.css` —el runner tiene `css: false` y devuelve cadena
 * vacía—, y para una hoja se usa el rodeo del specifier en variable que ya
 * hacen `designTokens.test.ts` y `noHardcodedColors.test.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { EscritorioEstructura, fasesConocidasDe } from '../components/structure/EscritorioEstructura';
import { construirJerarquia } from '../lib/jerarquia';
import type { ElementModel } from '../types';

vi.mock('../api/backend', () => ({
  getApiBase: vi.fn().mockReturnValue('http://localhost:8742'),
  getApiBaseAsync: vi.fn().mockResolvedValue('http://localhost:8742'),
  fetchWithTrace: vi.fn(),
  resolveAssetUrl: vi.fn(),
  sendLiveChat: vi.fn().mockResolvedValue({ reply: '' }),
  syncAllProviderKeys: vi.fn().mockResolvedValue({ ok: true, applied: [] }),
}));

/* ── Los fuentes de `src/`, leídos del disco ─────────────────────────────── */

const FUENTES = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const CARPETA = '/src/components/structure/';

/** Los nombres de la carpeta, LEÍDOS. Nunca escritos. */
const NOMBRES_DE_LA_CARPETA: string[] = Object.keys(FUENTES)
  .filter((ruta) => ruta.startsWith(CARPETA) && ruta.endsWith('.tsx'))
  .map((ruta) => ruta.slice(CARPETA.length).replace(/\.tsx$/, ''));

/**
 * Cuántos archivos, fuera de las pruebas, importan cada componente.
 *
 * Se cuenta el IMPORT, no el archivo: la cadena de montaje va
 * `App.tsx → EscritorioEstructura → los otros seis`, así que a un componente lo
 * importa `./IndiceEstructura` y a otro `./components/structure/…` desde el
 * ensamblado. Lo que se busca es el specifier cuyo último segmento es el
 * nombre, con barra antes, y no el nombre suelto: el nombre suelto aparece en
 * los comentarios, en las pruebas y en los `import type`.
 *
 * Los `__tests__` quedan afuera: una prueba que importa un componente para
 * probarlo no lo pone en pantalla. Y la raíz de la cadena no se da por buena
 * sola —que `App.tsx` monte el compositor y no un recorte lo afirma la prueba
 * de alcance—, porque un árbol de importaciones que arranca en un módulo que
 * nadie monta tiene la misma existencia que un componente sin importador.
 */
function contarImportadores(carpeta: string): Record<string, number> {
  const cuenta: Record<string, number> = {};
  for (const nombre of NOMBRES_DE_LA_CARPETA) cuenta[nombre] = 0;

  for (const [ruta, fuente] of Object.entries(FUENTES)) {
    if (ruta.includes('/__tests__/')) continue;
    for (const nombre of NOMBRES_DE_LA_CARPETA) {
      const patron = new RegExp(`from\\s+['"][^'"]*/${nombre}['"]`);
      if (patron.test(fuente)) cuenta[nombre] += 1;
    }
  }
  return cuenta;
}

/* ── El documento de la prueba ────────────────────────────────────────────── */

let secuencia = 0;
const el = (o: Partial<ElementModel> & { type: ElementModel['type']; text: string }): ElementModel =>
  ({
    id: `e${++secuencia}`,
    style_name: '',
    alignment: 'left',
    font_name: 'Times New Roman',
    font_size: 12,
    is_bold: false,
    is_italic: false,
    is_bullet: false,
    left_indent_cm: 0,
    confidence: 1,
    is_user_modified: false,
    cita_ids: [],
    needs_review: false,
    auto_applied: false,
    ...o,
  }) as ElementModel;

const h1 = (t: string): ElementModel => el({ type: 'heading', heading_level: 1, text: t });
const h2 = (t: string): ElementModel => el({ type: 'heading', heading_level: 2, text: t });
const parrafo = (n: number): ElementModel =>
  el({ type: 'paragraph', text: Array.from({ length: n }, (_, i) => `w${i}`).join(' ') });

/* Un caso desbalanceado a propósito: es el problema que el índice existe para
   volver visible, y un documento de capítulos iguales no lo demuestra. */
const ELEMENTOS: ElementModel[] = [
  h1('1. Introducción'),
  parrafo(12000),
  h1('2. Metodología'),
  h2('2.1 Resultados'),
  parrafo(80),
];

/**
 * Monta la fase de Estructura con un documento cargado.
 *
 * Se monta el componente al que el rail lleva cuando se pulsa "Estructura" —
  `EscritorioEstructura`—, no un esqueleto: montar un recortes que se parece a
 * la pantalla es la forma de que la guarda passe por haber mirado la coisa
 * equivocada. Que `App.tsx` lo monte de verdad lo vigila la tercera prueba, y
 * no se puede sustituir por goodwill.
 */
function montarFase(_fase: 'estructura') {
  act(() => {
    useDocStore.setState({
      doc: {
        session_id: 's-f3',
        file_name: 'Tesis.docx',
        elements: ELEMENTOS,
        referencias: [],
        meta: { page_count: 12 },
      } as never,
      reviewResult: null,
      proofreadFindings: [],
      citationAuditResult: null,
    });
  });
  return render(<EscritorioEstructura documento={<div data-testid="documento-real" />} />);
}

beforeEach(() => {
  secuencia = 0;
});

describe('la fase de Estructura está montada', () => {
  it('la fase de Estructura monta el indice, no el documento entero', () => {
    montarFase('estructura');
    expect(screen.getByTestId('indice-estructura')).toBeTruthy();
    /* Y el documento NO aparece: es un toggle apagado. Un centro que se puede
       volver a ensuciar no lo arregla un commit, lo arregla una prueba. */
    expect(screen.queryByTestId('documento-completo')).toBeNull();
    expect(screen.queryByTestId('documento-real')).toBeNull();
  });

  it('sin nodo elegido el inspector dice qué hacer, en vez de dejar un hueco', () => {
    montarFase('estructura');
    expect(screen.getByRole('status').textContent).toMatch(/elegí un capítulo/i);
  });

  it('el pulso de cinco números YA NO ESTÁ: no se mide lo que no se acciona', () => {
    /* La tira de palabras / balance / fases que faltan / figuras sin leyenda /
       referencias sin citar se borró. Palabras y balance son métricas sin acción;
       las otras tres duplicaban algo que ya vive donde se acciona (figuras en su
       fase, referencias en el rail, fases que faltan en `FaltasApa7`, que está en
       esta misma pantalla). Esta guarda existe para que nadie la reintroduzca
       como una tira muda arriba del trabajo: si vuelve, vuelve como superficie
       propia y con su prueba. */
    montarFase('estructura');
    expect(screen.queryByLabelText('Pulso del documento')).toBeNull();
    expect(screen.queryByText('Palabras')).toBeNull();
  });

  it('elegir un nodo abre su rama, con las cuatro acciones y su alcance a la vista', () => {
    const { container } = montarFase('estructura');
    fireEvent.click(screen.getByText('2. Metodología'));
    const rama = screen.getByLabelText(/^Rama 2\. Metodología$/);
    expect(rama).toBeTruthy();
    /* El alcance se PINTA al lado de cada botón: "mover" sin alcance es una
       amenaza, y con alcance es una operación. */
    expect(container.textContent).toMatch(/\(esta rama\)/);
    /* Y la sección de APA 7 está, diciendo que no hay lista de fases obligatorias
       en vez de inventarla. */
    expect(screen.getByLabelText('Faltas de APA 7')).toBeTruthy();
    expect(container.textContent).toMatch(/no expone qué secciones exige APA 7/i);
  });

  it('el mapa es un toggle dentro del indice y el documento otro, y no se ven juntos', () => {
    const { container } = montarFase('estructura');
    fireEvent.click(screen.getByRole('button', { name: /ver el mapa/i }));
    expect(container.querySelector('[data-testid="mapa-estructura"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="documento-completo"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /ver el documento/i }));
    expect(container.querySelector('[data-testid="documento-completo"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mapa-estructura"]')).toBeNull();
  });

  it('la fase es alcanzable desde el rail: App.tsx la monta, no un recorte', () => {
    /* El grep de importadores de abajo ya exige que alguien la importe; esto
       exige que sea el ENSAMBLADO, que es lo que el rail promises. Un
       componente importado por un módulo que nadie monta tiene la misma
       existencia que uno sin importador. */
    const app = FUENTES['/src/App.tsx'];
    expect(app, 'App.tsx no está entre los fuentes leídos').toBeTruthy();
    expect(app).toMatch(/from '\.\/components\/structure\/EscritorioEstructura'/);
    /* Y la fase 2 lo muestra sin que haya que tocar un flag raro. */
    expect(app).toMatch(/structureTab === 'indice'\s*\?\s*<EscritorioEstructura/);
  });
});

describe('todos los componentes de structure/ están montados en algún lado', () => {
  it('el guard ve la carpeta entera, y la lista no está escrita a mano', () => {
    /* Si el glob dejara de mirar, las dos pruebas de abajo pasarían sin haber
       leído un archivo: es el modo de fallo más barato de una guarda de código. */
    expect(NOMBRES_DE_LA_CARPETA.length).toBeGreaterThanOrEqual(7);
    expect(NOMBRES_DE_LA_CARPETA).toContain('IndiceEstructura');
    expect(NOMBRES_DE_LA_CARPETA).toContain('EscritorioEstructura');
  });

  it('cada componente de la carpeta tiene un importador', () => {
    const usos = contarImportadores(CARPETA);
    const huerfanos = NOMBRES_DE_LA_CARPETA.filter((n) => (usos[n] ?? 0) === 0);
    expect(huerfanos, `componentes de structure/ que nadie usa: ${huerfanos.join(', ')}`).toEqual([]);
  });

  it('el documento entero no es el centro por omisión, ni en el código ni pintado', () => {
    /* Las dos mitades. La primera es la regla; la segunda es que la regla siga
       sirviendo de algo cuando alguien la cambie sin querer. */
    const escritorio = FUENTES[CARPETA + 'EscritorioEstructura.tsx'];
    expect(escritorio).not.toMatch(/useState<VistaEstructura>\(\s*'documento'/);
    montarFase('estructura');
    expect(screen.queryByTestId('documento-completo')).toBeNull();
  });
});

describe('la fase de un elemento la dice el backend, y no se re-deriva', () => {
  it('un hallazgo con fase le da la fase al elemento, y uno general no', () => {
    /* `RULE_SCOPES` mapea regla → ámbito; un error de ortografía no abre
       ámbito. Si esta función devolviera 'global' para un hallazgo general, el
       índice metería un párrafo en la fase equivocada. */
    const elementos = [{ id: 'h1' }, { id: 'p1' }];
    const fases = fasesConocidasDe(elementos, [
      { element_id: 'h1', phase: 'metodo' },
      { element_id: 'p1', phase: null },
    ]);
    expect(fases).toEqual({ h1: 'metodo' });
  });

  it('sin hallazgos, el árbol se arma solo con los títulos, y eso es un dato', () => {
    const arbol = construirJerarquia([h1('1. Introducción'), parrafo(10)], {});
    expect(arbol[0].fase).toBe('introduccion');
  });
});

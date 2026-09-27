/**
 * El mosaico de IA: cuatro escalones, área proporcional con piso, y una sola
 * fuente de verdad para los hallazgos.
 *
 * Estas reglas no son de apariencia. Cada una corrige un modo de fallo concreto
 * que un mapa de calor puede tener y que no se ven mirando la pantalla: un
 * degradado que nadie ordena, un área que miente, una lista de fases que se
 * desincroniza del backend, o dos recuentos de IA distintos en la misma app.
 */

import { describe, it, expect } from 'vitest';
import {
  construirMosaico,
  cortesPorCuartiles,
  nivelDe,
  repartirNiveles,
  columnasDeBloque,
  filasDeBloques,
  tokenDeNivel,
  type BloqueMosaico,
  type NivelIa,
} from '../lib/aiMosaic';
import type { ElementModel } from '../types';
import type { AuditItem } from '../lib/auditItems';

const el = (over: Partial<ElementModel> & { id: string; text: string }): ElementModel => ({
  type: 'paragraph',
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
  ...over,
} as ElementModel);

const item = (over: Partial<AuditItem> & { element_id: string }): AuditItem => ({
  id: 'i1',
  category: 'ai',
  subtype: 'ai_phrase',
  severity: 'warn',
  summary: '',
  detail: '',
  originalText: '',
  pageNumber: 1,
  phase: 'metodo',
  readOnly: false,
  ...over,
} as AuditItem);

const H1 = (text: string, id: string) => el({ id, text, type: 'heading', heading_level: 1 });
const P = (id: string, phase?: string) =>
  item({ element_id: id, id: `f-${id}`, phase: phase ?? 'metodo' });

/* ── Los cuatro escalones ───────────────────────────────────────────────────── */

describe('la rampa de intensidad', () => {
  it('son cuatro escalones y solo cuatro', () => {
    /* Doce matices no se ordenan de un vistazo. Y el número de escalones es lo
       que hace que la rampa quepa en una palabra: "nivel 3 de 4" o "casi
       seguro". */
    const tokens = ([1, 2, 3, 4] as NivelIa[]).map((n) => tokenDeNivel(n));
    expect(tokens).toEqual([
      'var(--ia-nivel-1)',
      'var(--ia-nivel-2)',
      'var(--ia-nivel-3)',
      'var(--ia-nivel-4)',
    ]);
  });

  it('ningún nivel se salta: de 0 a 1 hay cuatro escalones, no cinco', () => {
    const cortes = cortesPorCuartiles([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
    const vistos = new Set<number>();
    for (let p = 0; p <= 1.0001; p += 0.01) vistos.add(nivelDe(p, cortes));
    expect([...vistos].sort()).toEqual([1, 2, 3, 4]);
  });

  it('cero es el escalón más bajo, no una alarma', () => {
    /* Una sección donde el detector no vio nada no es una advertencia. Si su
       cuadrado se viera levemente rojo, el mapa estaría mintiendo sobre la
       mitad del documento. */
    const cortes: [number, number, number] = [0.34, 0.67, 0.9];
    expect(nivelDe(0, cortes)).toBe(1);
  });

  it('los cortes son del documento, no absolutos', () => {
    /* Con cortes absolutos, el nivel 4 sería "pasó 70" y una tesis uniforme
       entera sería una alarma, que es un color que deja de significar nada.
       Por eso los cortes son cuartiles del documento. */
    const uniforme = cortesPorCuartiles([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(uniforme).toEqual([0.5, 0.5, 0.5]);
  });

  it('un documento UNIFORME se lee neutro, no entero en alarma', () => {
    /* Esta es la razón de la segunda pasada de `repartirNiveles`. Con los
       cuartiles solos, todas las secciones de una tesis uniforme superan el
       corte superior y salen TODAS en nivel 4: veinte cuadros de alarma
       seguidos. El usuario lee "peligro" veinte veces y no lee nada, que es
       justo lo que se pidió evitar al decir "mucho color pero que no se vea
       cargado". */
    expect(repartirNiveles([0.5, 0.5, 0.5, 0.5, 0.5, 0.5])).toEqual([2, 2, 2, 2, 2, 2]);
    expect(repartirNiveles([0, 0, 0, 0, 0, 0])).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('el escalón 4 queda reservado a lo que se sale del resto', () => {
    /* Y sigue reservándose: si hay una sección que sí destaca, tiene que poder
       decir "aquí". El tope no es un freno a la información. */
    const conOutlier = repartirNiveles([0.05, 0.1, 0.08, 0.12, 0.1, 0.9]);
    expect(conOutlier[conOutlier.length - 1]).toBe(4);
  });

  it('un solo capítulo NO se reprime: un punto no tiene amplitud', () => {
    /* La amplitud de un solo capítulo es cero por no tener con qué compararse,
       no porque sea "igual a los demás". Caparlo escondería el único dato que
       hay, que es justo cuando el mapa importa. Con un solo bloque, "el peor
       del documento" es literalmente cierto, así que sale en el escalón 4 y el
       número impreso es el que dice cuánto —ahí está la lectura fina, y para
       eso el detalle existe. */
    expect(repartirNiveles([1])).toEqual([4]);
    expect(repartirNiveles([0.42])).toEqual([4]);
  });

  it('dos capítulos iguales SÍ se reprimen: ahí sí no hay diferencia', () => {
    expect(repartirNiveles([0.5, 0.5])).toEqual([2, 2]);
    /* Y si se diferencian, la rampa vuelve a trabajar: el apartado arriba, el
       otro más abajo. Con dos muestras los percentiles se degeneran, así que
       lo que se afirma es la ORDEN, no el escalón exacto del bajo. */
    const dos = repartirNiveles([0.2, 0.9]);
    expect(dos[1]).toBe(4);
    expect(dos[0]).toBeLessThan(dos[1]);
  });

  it('un documento sin nada marcado no inventa intensidad', () => {
    expect(nivelDe(0, cortesPorCuartiles([]))).toBe(1);
  });
});

/* ── El área ───────────────────────────────────────────────────────────────── */

describe('el área del bloque', () => {
  it('el área es proporcional a los párrafos', () => {
    /* Cuatro veces los párrafos = cuatro veces el área, y por eso el ancho es
       la raíz: si fuera lineal, el bloque grande tendría el cuádruple de
       superficie y el mapa exageraría justo donde hay más que trabajar. */
    const uno = columnasDeBloque(1, 100);
    const cuatro = columnasDeBloque(4, 100);
    expect(cuatro).toBeGreaterThan(uno);
    expect(cuatro).toBeLessThan(uno * 2.1);
  });

  it('un bloque chico tiene un piso: se ve chico pero se puede apuntar', () => {
    /* Sin el piso, una sección de un párrafo queda en cinco píxeles, que no es
       un cuadrado sino una mancha. El piso es lo que hace clicable lo chico. */
    expect(columnasDeBloque(1, 1000)).toBeGreaterThanOrEqual(1);
    expect(columnasDeBloque(1, 1000)).toBe(1);
    expect(columnasDeBloque(2, 1000)).toBe(1);
  });

  it('una sección sin párrafos no colapsa a nada', () => {
    expect(columnasDeBloque(0, 100)).toBeGreaterThanOrEqual(1);
  });

  it('nunca se pasa del máximo', () => {
    expect(columnasDeBloque(100000, 100)).toBeLessThanOrEqual(4);
  });
});

/* ── El reparto en filas ───────────────────────────────────────────────────── */

describe('el mosaico no parte bloques', () => {
  const b = (i: number, parrafos: number): BloqueMosaico => ({
    key: `k${i}`, label: `L${i}`, parrafos, marcados: 0, proporcion: 0, nivel: 1, elementId: null,
  });

  it('respeta el orden del documento', () => {
    /* Ordenar por intensidad perdería la memoria espacial de la tesis: el
       usuario tiene que reconocer "el bloque largo del medio". */
    const bloques = [b(0, 30), b(1, 1), b(2, 10), b(3, 1)];
    const filas = filasDeBloques(bloques, 12);
    expect(filas.flat()).toEqual([0, 1, 2, 3]);
  });

  it('un bloque no cae partido entre dos filas', () => {
    const bloques = [b(0, 30), b(1, 30), b(2, 30), b(3, 30), b(4, 30), b(5, 30)];
    const filas = filasDeBloques(bloques, 12);
    const todos = filas.flat();
    expect(todos.sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(new Set(todos).size).toBe(6);
  });

  it('sin bloques no hay filas', () => {
    expect(filasDeBloques([], 12)).toEqual([]);
  });
});

/* ── La construcción ───────────────────────────────────────────────────────── */

describe('las secciones del mosaico', () => {
  const documento = [
    H1('Portada', 'h-portada'),
    el({ id: 'p1', text: 'Título de la tesis' }),
    H1('Metodo', 'h-metodo'),
    el({ id: 'p2', text: 'Uno' }),
    el({ id: 'p3', text: 'Dos' }),
    H1('Resultados', 'h-res'),
    el({ id: 'p4', text: 'Tres' }),
    el({ id: 'p5', text: 'Cuatro' }),
  ];

  it('corta por H1 y en el orden del documento', () => {
    const m = construirMosaico(documento, []);
    expect(m.map((b) => b.label)).toEqual(['Portada', 'Metodo', 'Resultados']);
    expect(m.map((b) => b.parrafos)).toEqual([1, 2, 2]);
  });

  it('un H2 NO abre sección: hereda la de su H1', () => {
    /* La misma regla que usa todo el producto. Si el mosaico abriera por H2,
       "3.1 Instrumentos" sería un bloque propio y el mapa tendría más bloques
       que capítulos, que es donde estos mapas dejan de leerse. */
    const conH2 = [
      H1('Metodo', 'h1'),
      el({ id: 'h2', text: '3.1 Instrumentos', type: 'heading', heading_level: 2 }),
      el({ id: 'p1', text: 'Uno' }),
    ];
    expect(construirMosaico(conH2, []).map((b) => b.label)).toEqual(['Metodo']);
  });

  it('la proporción es sobre el tamaño de la sección, no sobre los hallazgos', () => {
    /* Si el denominador fuera la cantidad de hallazgos, una sección con un solo
       hallazgo en tres párrafos saldría al 100% y una con dos en treinta al
       7%: el mapa premiaría a las secciones chicas por tener menos ocasión de
       equivocarse, que es al revés de lo que sirve para corregir. */
    const m = construirMosaico(documento, [P('p2'), P('p3')]);
    const metodo = m.find((b) => b.label === 'Metodo')!;
    expect(metodo.proporcion).toBe(1);
    expect(metodo.marcados).toBe(2);
  });

  it('cuenta los párrafos con texto, no los renglones vacíos', () => {
    const conVacio = [
      H1('Metodo', 'h1'),
      el({ id: 'p1', text: 'Uno' }),
      el({ id: 'p2', text: '   ' }),
      el({ id: 'p3', text: 'Dos' }),
    ];
    expect(construirMosaico(conVacio, [])[0].parrafos).toBe(2);
  });

  it('SOLO cuenta el motor IA: la ortografía no opinará sobre la IA', () => {
    /* Si el color dijera "cuánta IA hay" y el denominador contara también
       faltas de ortografía, un bloque con muchos errores y poca IA se vería
       rojo sin que el detector de IA haya dicho nada. */
    const m = construirMosaico(documento, [
      P('p2'),
      item({ element_id: 'p3', id: 'ort', category: 'spelling', phase: 'metodo' }),
    ]);
    expect(m.find((b) => b.label === 'Metodo')!.marcados).toBe(1);
  });

  it('una sección sin marcas sale neutra, no roja', () => {
    const m = construirMosaico(documento, [P('p2')]);
    expect(m.find((b) => b.label === 'Resultados')!.proporcion).toBe(0);
    expect(m.find((b) => b.label === 'Resultados')!.nivel).toBe(1);
  });

  it('una sección sin párrafos no revienta: cero de cero es nivel 1', () => {
    const soloTitulos = [H1('Metodo', 'h1'), H1('Resultados', 'h2')];
    const m = construirMosaico(soloTitulos, []);
    for (const b of m) {
      expect(b.proporcion).toBe(0);
      expect(b.nivel).toBe(1);
    }
  });

  it('un H1 que no está en el vocabulario NO desaparece', () => {
    /* Una sección con un nombre propio del autor tiene que verse con su
       nombre genérico. Un bloque que no se ve es peor que uno con el nombre
       feo, y el mapa entero deja de cubrir el documento. */
    const raro = [H1('Marco de la encuesta en el norte', 'h1'), el({ id: 'p1', text: 'Uno' })];
    expect(construirMosaico(raro, []).map((b) => b.label)).toEqual(['Seccion sin nombre']);
  });

  it('cada bloque sabe en qué elemento empezar', () => {
    /* El clic tiene que poder llevar al lugar, no solo filtrar. */
    const m = construirMosaico(documento, []);
    expect(m.find((b) => b.label === 'Resultados')!.elementId).toBe('h-res');
  });
});

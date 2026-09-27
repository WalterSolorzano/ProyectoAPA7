/* WordAPA7 — el mosaico de IA: el documento entero como cuadritos en orden.
 *
 * QUÉ ES. Una fila de bloques, uno por sección (H1), en el orden del documento.
 * Cada bloque tiene DOS variables y ninguna más:
 *
 *   - el ÁREA es su tamaño: cuántos párrafos tiene la sección.
 *   - el COLOR es su intensidad: qué proporción de esos párrafos el detector
 *     marcó como IA.
 *   - el NÚMERO impreso es el porcentaje, y es la misma cifra que el detalle
 *     lateral muestra al abrir la sección. Un número, dos sitios, no dos
 *     métricas para lo mismo.
 *
 * POR QUÉ EL ÁREA ES PROPORCIONAL Y NO UNIFORME. Porque el problema del usuario
 * no es "dónde hay texto sospechoso" sino "corregir páginas inmensas": una
 * sección de tres párrafos al 90% y una de treinta al 40% no pesan lo mismo, y
 * con cuadrados iguales el mapa mentiría sobre dónde está el trabajo. Son dos
 * canales visuales y cada uno carga una variable DISTINTA, que es lo que
 * permite que no compitan entre sí ni con el texto.
 *
 * POR QUÉ CUATRO ESCALONES Y NO UN DEGRADADO. Doce matices no se ordenan de un
 * vistazo. Y los cortes son POR CUARTILES del documento, no absolutos: si toda
 * tu tesis es medio IA tiene que poder leerse neutra, porque el nivel 4 tiene
 * que significar "el peor de TU documento", no "pasó 70".
 *
 * Y DE DÓNDE SALE LA LISTA DE HALLAZGOS. De `auditItems`, la MISMA lista que
 * abre el workbench y que cuenta el rail. No se re-deriva nada acá: un mosaico
 * que contara la IA por su cuenta y un rail que la contara por la suya
 * acabarían mostrando dos números distintos para la misma realidad, que es
 * exactamente lo que `railPending.ts` existe para impedir.
 */

import type { ElementModel } from '../types';
import type { AuditItem } from './auditItems';
import { PHASE_LABELS, phaseLabel } from './auditItems';

/** Un escalón de la rampa. 1 es lo más bajo; 4 lo más alto. */
export type NivelIa = 1 | 2 | 3 | 4;

export interface BloqueMosaico {
  /** Clave estable: la fase del backend, o `sin_fase` para lo que no está en
   *  ninguna. Es la que aplica el filtro de fase que ya existe. */
  key: string;
  label: string;
  /** Párrafos de la sección, contados en el documento. */
  parrafos: number;
  /** Párrafos que el detector de IA marcó. */
  marcados: number;
  /** `marcados / parrafos`, de 0 a 1. Es lo que decide el color. */
  proporcion: number;
  nivel: NivelIa;
  /** El elemento donde arranca la sección, para saltar ahí. */
  elementId: string | null;
}

/**
 * Los tres cortes de la rampa, como percentiles del PROPIO documento.
 *
 * No son absolutos a propósito. Con cortes fijos, una tesis corta o muy escrita
 * a mano tendría casi todo en nivel 1 y el mapa no diría nada; y una tesis muy
 * uniforme tendría todo en nivel 4, que es un color de alarma sobre el
 * documento entero y termina no significando nada. Relativos, el nivel 4
 * siempre señala el peor de ESE documento.
 *
 * P90 y no P75 para el tope. Un solo apartado —una sección que sí se sale— es
 * uno de cada diez, no uno de cada cuatro: con el cuartil superior el corte
 * caería por debajo de donde está ese apartado, ningún valor lo alcanzaría y el
 * mapa nunca podría decir "aquí", que es lo único que el escalón 4 tiene que
 * decir.
 */
export function cortesPorCuartiles(valores: readonly number[]): [number, number, number] {
  const v = valores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return [0.3, 0.6, 0.9];
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return [q(0.3), q(0.6), q(0.9)];
}

/**
 * Amplitud mínima para que la rampa diga algo.
 *
 * Cinco puntos porcentuales entre la sección más limpia y la más sospechosa es
 * medio párrafo en una sección de veinte: se ve en el detalle, no en el mapa. Y
 * por debajo de eso el nivel 4 deja de ser "el peor de tu documento" y pasa a
 * ser "tu documento", que es una alarma sobre todo lo que no dice nada.
 */
const AMPLITUD_MINIMA = 0.05;

/**
 * Reparte los niveles, con la regla de que el escalón 4 es una EXCEPCIÓN.
 *
 * Sin esta segunda pasada, un documento donde todas las secciones se parecen
 * sale entero en nivel 4: los percentiles coinciden, todos los valores alcanzan
 * el corte superior, y el mapa entero queda en rojo de alarma. El usuario lee
 * "peligro" veinte veces y no lee nada, que es peor que no tener mapa — la razón
 * por la que se pidió que "mucho color" no se viera "cargado".
 *
 * La guarda mira la amplitud de TODO el documento, no la del percentil alto.
 * Medir la separación entre P75 y la mediana parece más directo, pero con un
 * apartado la mediana se queda abajo, P75 no lo alcanza y el tope mataba
 * justamente el valor que el escalón 4 existe para señalar.
 *
 * Un documento uniforme se lee neutro, que es la lectura honesta: "por aquí no
 * hay diferencia". Y con un SOLO capítulo la guarda no se aplica, porque un punto
 * no tiene amplitud —la tiene en cero por no haber nada que comparar, no porque
 * las secciones sean iguales— y caparlo escondería el único dato que hay.
 */
export function repartirNiveles(proporciones: readonly number[]): NivelIa[] {
  const cortes = cortesPorCuartiles(proporciones);
  const niveles = proporciones.map((p) => nivelDe(p, cortes));
  if (proporciones.length < 2) return niveles;
  const amplitud = Math.max(...proporciones) - Math.min(...proporciones);
  if (amplitud < AMPLITUD_MINIMA) return niveles.map((n) => Math.min(n, 2) as NivelIa);
  return niveles;
}

export function nivelDe(proporcion: number, cortes: [number, number, number]): NivelIa {
  if (proporcion <= 0) return 1;
  if (proporcion >= cortes[2]) return 4;
  if (proporcion >= cortes[1]) return 3;
  if (proporcion >= cortes[0]) return 2;
  return 1;
}

/** El token del escalón. El color carga UNA variable y el resto va en texto. */
export const tokenDeNivel = (n: NivelIa): string => `var(--ia-nivel-${n})`;

/**
 * Tamaño del bloque en la retícula, en columnas.
 *
 * El mínimo es el piso que pidió el usuario: sin él, una sección de un párrafo
 * queda en un cuadrado de cinco píxeles, que no es un cuadrado sino una mancha.
 * Con el piso, un bloque chico se ve chico —que es la verdad— pero se puede
 * apuntar y hacer clic.
 *
 * `Math.sqrt` y no una proporción lineal porque el ÁREA tiene que ser
 * proporcional a los párrafos: al cuadrado de la raíz, un bloque con cuatro
 * veces los párrafos ocupa el doble de ancho y no el cuádruple de superficie.
 */
export function columnasDeBloque(parrafos: number, maxParrafos: number, minCols = 1, maxCols = 4): number {
  if (parrafos <= 0) return minCols;
  const proporcion = Math.sqrt(parrafos / Math.max(1, maxParrafos));
  const cols = Math.round(minCols + proporcion * (maxCols - minCols));
  return Math.max(minCols, Math.min(maxCols, cols));
}

/**
 * Reparte los bloques en filas, en el orden del documento, sin partir ninguno.
 *
 * El ancho del mosaico no se conoce al construir los datos —depende de la
 * ventana—, así que el corte es por filas de ancho fijo, que es lo que hace
 * cualquier retícula y no deja bloques a la mitad. La última fila se queda con
 * lo que sobre: no se rellena, porque un hueco al final es un hecho del
 * documento y un hueco inventado sería ruido.
 */
export function filasDeBloques(bloques: readonly BloqueMosaico[], colsPorFila = 12): number[][] {
  if (!bloques.length) return [];
  const maxP = bloques.reduce((m, b) => Math.max(m, b.parrafos), 0);
  const filas: number[][] = [];
  let actual: number[] = [];
  let ancho = 0;
  bloques.forEach((b, i) => {
    const anchoB = columnasDeBloque(b.parrafos, maxP);
    if (ancho + anchoB > colsPorFila && actual.length) {
      filas.push(actual);
      actual = [];
      ancho = 0;
    }
    actual.push(i);
    ancho += anchoB;
  });
  if (actual.length) filas.push(actual);
  return filas;
}

/**
 * Las secciones del documento, en orden.
 *
 * El corte lo hacen los H1, y sólo los H1: un H2 hereda el ámbito de su H1, así
 * que abrir un bloque por H2 rompería la misma regla que usa el resto del
 * producto. Antes del primer H1 hay un bloque, y es la portada.
 *
 * Se cuenta un bloque por SECCIÓN, no por hallazgo: el denominador de la
 * proporción tiene que ser el tamaño de la sección, o el mapa premiaría a las
 * secciones chicas por tener menos ocasión de equivocarse.
 */
export function construirMosaico(
  elements: readonly ElementModel[],
  items: readonly AuditItem[],
): BloqueMosaico[] {
  /* 1. Los párrafos marcados, por sección. Sólo el motor IA: este mosaico es
   *    de la IA, y dejar que la ortografía opinara sobre la intensidad de la IA
   *    haría que el color dijera una cosa y el detector otra. */
  const marcadosPor = new Map<string, Set<string>>();
  for (const it of items) {
    if (it.category !== 'ai') continue;
    const fase = it.phase ?? 'sin_fase';
    let set = marcadosPor.get(fase);
    if (!set) marcadosPor.set(fase, (set = new Set()));
    if (it.element_id) set.add(it.element_id);
  }

  /* 2. Los elementos por sección, con el H1 como única frontera. */
  const porFase = new Map<string, { elementos: ElementModel[]; primero: ElementModel | null }>();
  const orden: string[] = [];
  let faseActual = 'portada';
  for (const el of elements) {
    if (el.type === 'heading' && el.heading_level === 1) {
      faseActual = faseDeTitulo(el.text || '');
    }
    let bucket = porFase.get(faseActual);
    if (!bucket) {
      orden.push(faseActual);
      porFase.set(faseActual, (bucket = { elementos: [], primero: null }));
    }
    bucket.elementos.push(el);
    if (!bucket.primero) bucket.primero = el;
  }

  /* 3. El mosaico. Una sección sin párrafos no tiene intensidad: cero de cero
   *    no es "poca IA", es "no hay nada que medir", y se ve como nivel 1. */
  const bloques: BloqueMosaico[] = [];
  for (const key of orden) {
    const bucket = porFase.get(key);
    if (!bucket) continue;
    const parrafos = bucket.elementos.filter(cuentaComoParrafo).length;
    const marcadosSet = marcadosPor.get(key);
    const marcados = marcadosSet
      ? bucket.elementos.filter((e) => marcadosSet.has(e.id)).length
      : 0;
    bloques.push({
      key,
      /* `phaseLabel`, sin el `null` de la versión del filtro: `null` significa
         "sin filtro, todo el documento", que es la etiqueta de un chip, no el
         nombre de un bloque. Para el bloque de portada, el nombre es Portada. */
      label: phaseLabel(key),
      parrafos,
      marcados,
      proporcion: parrafos > 0 ? marcados / parrafos : 0,
      nivel: 1,
      elementId: bucket.primero?.id ?? null,
    });
  }

  const niveles = repartirNiveles(bloques.map((b) => b.proporcion));
  bloques.forEach((b, i) => { b.nivel = niveles[i]; });
  return bloques;
}

const cuentaComoParrafo = (e: ElementModel): boolean =>
  e.type === 'paragraph' && (e.text || '').trim().length > 0;

/* ── La clave de fase de un H1 ───────────────────────────────────────────────
 *
 * NO se reescribe el vocabulario. `PHASE_LABELS` es el espejo del backend
 * (`python/modules/phase_scope.py`) y ya lo usan la tira de filtros y el rack;
 * una lista de once fases escrita acá sería la quinta copia, y el día que el
 * backend sume una fase el mosaico mostraría "sin sección" donde la tira muestra
 * el nombre. Se compara contra ESA tabla, y lo que no está se muestra con su
 * nombre genérico en vez de desaparecer.
 *
 * Y es `match_phase` del backend el que hizo la cuenta: `AuditItem.phase` viene
 * ya calculado. Este archivo no vuelve a decidir qué título abre qué fase.
 */

const SIN_FASE = 'sin_fase';

function normalizar(s: string): string {
  return (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

const CLAVE_POR_ETIQUETA: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const clave of Object.keys(PHASE_LABELS)) {
    if (clave === SIN_FASE) continue;
    m.set(normalizar(PHASE_LABELS[clave]), clave);
  }
  return m;
})();

export function faseDeTitulo(titulo: string): string {
  return CLAVE_POR_ETIQUETA.get(normalizar(titulo)) ?? SIN_FASE;
}

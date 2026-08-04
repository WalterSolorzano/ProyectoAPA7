import { describe, it, expect } from 'vitest';
import { reviewContent } from '../lib/contentReview';

function el(id: string, text: string, type = 'paragraph'): any {
  return { id, text, type, heading_level: type === 'heading' ? 2 : 1 };
}

describe('reviewContent — objetivos (Bloom)', () => {
  const doc = [
    el('h1', 'Objetivos', 'heading'),
    el('g', 'Desarrollar un sistema de gestión para la microempresa.'),
    el('e1', 'Identificar los tiempos muertos en el proceso de producción.'),
    el('e2', 'Analizar las causas de los tiempos improductivos.'),
    el('e3', 'Proponer mejoras con base en el método S.C.E.M.'),
  ];

  it('flags an objective that does not start with an infinitive verb', () => {
    const withBad = [
      ...doc.slice(0, 2),
      el('bad', 'La mejora del proceso de producción.'),
      ...doc.slice(2),
    ];
    const f = reviewContent(withBad as any);
    expect(f.some((x) => x.rule === 'objetivo_sin_infinitivo')).toBe(true);
  });

  it('flags forbidden Bloom verbs like "conocer"', () => {
    const f = reviewContent([
      el('h1', 'Objetivos', 'heading'),
      el('g', 'Desarrollar un sistema.'),
      el('e1', 'Conocer los tiempos muertos.'),
      el('e2', 'Analizar las causas.'),
    ] as any);
    const hit = f.find((x) => x.rule === 'objetivo_verbo_no_medible');
    expect(hit?.message).toContain('"conocer"');
  });

  it('flags repeated verbs across specific objectives', () => {
    const f = reviewContent([
      el('h1', 'Objetivos', 'heading'),
      el('g', 'Desarrollar un sistema.'),
      el('e1', 'Analizar los tiempos.'),
      el('e2', 'Analizar las causas.'),
      el('e3', 'Analizar las mejoras.'),
    ] as any);
    expect(f.some((x) => x.rule === 'objetivo_verbo_repetido')).toBe(true);
  });
});

describe('reviewContent — introducción', () => {
  it('flags missing research question', () => {
    const f = reviewContent([
      el('h1', 'Introducción', 'heading'),
      el('p1', 'La microempresa enfrenta tiempos de producción elevados.'),
      el('p2', 'Este estudio busca documentar el proceso actual.'),
    ] as any);
    expect(f.some((x) => x.rule === 'intro_sin_pregunta')).toBe(true);
  });

  it('passes when there is a question', () => {
    const f = reviewContent([
      el('h1', 'Introducción', 'heading'),
      el('p1', '¿Cómo se pueden reducir los tiempos muertos en la producción?'),
      el('p2', 'Este trabajo se divide en cuatro capítulos.'),
    ] as any);
    expect(f.some((x) => x.rule === 'intro_sin_pregunta')).toBe(false);
  });

  it('flags a dictionary-definition opening', () => {
    const f = reviewContent([
      el('h1', 'Introducción', 'heading'),
      el('p1', 'Según la RAE, el tiempo es la duración de las cosas sujetas a cambio.'),
    ] as any);
    expect(f.some((x) => x.rule === 'intro_definicion_diccionario')).toBe(true);
  });
});

describe('reviewContent — hipótesis y metodología', () => {
  it('flags a hypothesis written as a question', () => {
    const f = reviewContent([
      el('h1', 'Hipótesis', 'heading'),
      el('h', '¿La implementación de las 5S reducirá los tiempos muertos?'),
    ] as any);
    expect(f.some((x) => x.rule === 'hipotesis_como_pregunta')).toBe(true);
  });

  it('flags methodology missing type and instruments', () => {
    const f = reviewContent([
      el('h1', 'Metodología', 'heading'),
      el('m', 'Se realizaron mediciones directas en el área de producción.'),
    ] as any);
    expect(f.some((x) => x.rule === 'metodologia_sin_tipo')).toBe(true);
    expect(f.some((x) => x.rule === 'metodologia_sin_instrumentos')).toBe(true);
  });
});

describe('reviewContent — resumen y conclusiones', () => {
  it('flags a summary outside 150-250 words', () => {
    const short = el('r', 'Resumen corto de la investigación.');
    const f = reviewContent([
      el('h1', 'Resumen', 'heading'),
      short,
    ] as any);
    const hit = f.find((x) => x.rule === 'resumen_longitud');
    expect(hit?.message).toContain('palabras');
  });

  it('flags a vague recommendation', () => {
    const f = reviewContent([
      el('h1', 'Conclusiones', 'heading'),
      el('c', 'Se recomienda seguir investigando para ampliar los resultados.'),
    ] as any);
    expect(f.some((x) => x.rule === 'conclusiones_recomendacion_vaga')).toBe(true);
  });
});

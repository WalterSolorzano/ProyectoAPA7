import { describe, it, expect } from 'vitest';
import { repeticionCuerpo, leyesPorFase } from '../lib/informeRevision';
import type { ElementModel } from '../types';
import type { AuditItem } from '../lib/auditItems';

const p = (id: string, text: string): ElementModel => ({ id, type: 'paragraph', heading_level: null, text } as ElementModel);

const item = (id: string, phase: string | null): AuditItem =>
  ({ id, element_id: 'e', category: 'style', subtype: 'x', severity: 'medium', summary: '', detail: '', originalText: '', pageNumber: null, phase, readOnly: false }) as AuditItem;

describe('repeticionCuerpo', () => {
  it('cuenta palabras de contenido repetidas y las ordena por frecuencia', () => {
    const r = repeticionCuerpo([
      p('a', 'investigacion proceso investigacion gestion'),
      p('b', 'investigacion proceso proceso proceso'),
    ]);
    expect(r[0]).toEqual({ termino: 'proceso', conteo: 4 });
    expect(r[1]).toEqual({ termino: 'investigacion', conteo: 3 });
  });

  it('ignora palabras vacias y palabras cortas', () => {
    const r = repeticionCuerpo([p('a', 'de la y el para con que los las')]);
    expect(r).toEqual([]);
  });

  it('no incluye palabras que aparecen menos de 3 veces', () => {
    const r = repeticionCuerpo([p('a', 'metodologia metodologia encuesta')]);
    expect(r.find((x) => x.termino === 'metodologia')).toBeUndefined();
  });

  it('respeta topN', () => {
    const r = repeticionCuerpo(
      [p('a', 'alfa alfa alfa beta beta beta gamma gamma gamma delta delta delta')],
      2,
    );
    expect(r).toHaveLength(2);
  });
});

describe('leyesPorFase', () => {
  it('agrupa por fase y deja fuera global/null', () => {
    const grupos = leyesPorFase([
      item('1', 'metodo'),
      item('2', 'objetivos'),
      item('3', 'global'),
      item('4', null),
    ]);
    expect(grupos.map((g) => g.phase)).toEqual(['objetivos', 'metodo']);
    expect(grupos[0].items.map((x) => x.id)).toEqual(['2']);
    expect(grupos[1].label.length).toBeGreaterThan(0);
  });
});

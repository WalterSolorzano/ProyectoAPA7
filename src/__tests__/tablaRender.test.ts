import { describe, it, expect } from 'vitest';
import { normalizarSpans, matrizDeTabla, estiloDePreset } from '../lib/tablaRender';
import type { TableModel } from '../types';

const tabla = (extra: Partial<TableModel> = {}): TableModel => ({
  element_id: 't1',
  headers: ['A', 'B'],
  rows: [
    ['1', '2'],
    ['3', '4'],
  ],
  caption: '',
  table_number: 1,
  ...extra,
});

describe('normalizarSpans', () => {
  it('sin spans paralelos devuelve 1x1 para cada celda', () => {
    const { header, rows } = normalizarSpans(tabla());
    expect(header).toEqual([
      { col: 1, row: 1 },
      { col: 1, row: 1 },
    ]);
    expect(rows).toEqual([
      [
        { col: 1, row: 1 },
        { col: 1, row: 1 },
      ],
      [
        { col: 1, row: 1 },
        { col: 1, row: 1 },
      ],
    ]);
  });

  it('aplica header_spans y row_spans y coacciona valores inválidos a 1', () => {
    const { header, rows } = normalizarSpans(
      tabla({
        header_spans: [
          { col: 2, row: 1 },
          { col: 0, row: 3 },
        ],
        row_spans: [
          [
            { col: 1, row: 2 },
            { col: 1, row: 1 },
          ],
          [
            { col: 1, row: 1 },
            { col: 1, row: 1 },
          ],
        ],
      }),
    );
    expect(header).toEqual([
      { col: 2, row: 1 },
      { col: 1, row: 3 },
    ]);
    expect(rows[0][0]).toEqual({ col: 1, row: 2 });
  });
});

describe('matrizDeTabla', () => {
  it('arma una fila de encabezado y una por fila de cuerpo con sus spans', () => {
    const filas = matrizDeTabla(tabla());
    expect(filas).toHaveLength(3);
    expect(filas[0].esHeader).toBe(true);
    expect(filas[0].celdas[0]).toMatchObject({ texto: 'A', colSpan: 1, rowSpan: 1, esHeader: true });
    expect(filas[1].esHeader).toBe(false);
    expect(filas[2].celdas[1]).toMatchObject({ texto: '4', filaIndice: 2, celdaIndice: 1 });
  });

  it('no inventa fila de encabezado si no hay headers', () => {
    const filas = matrizDeTabla(tabla({ headers: [] }));
    expect(filas).toHaveLength(2);
    expect(filas.every((f) => !f.esHeader)).toBe(true);
  });
});

describe('estiloDePreset', () => {
  it('marca APA-safe vs no-APA y activa zebra solo en zebra', () => {
    expect(estiloDePreset('apa')).toMatchObject({ esAPA: true, zebra: false, sombreadoEncabezado: false });
    expect(estiloDePreset('grid')).toMatchObject({ esAPA: false });
    expect(estiloDePreset('zebra')).toMatchObject({ esAPA: false, zebra: true, sombreadoEncabezado: true });
  });
});

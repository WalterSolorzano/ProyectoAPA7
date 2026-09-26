/**
 * WordAPA7 — T3: los destinos del rail son datos, no JSX. El estado de cada
 * fase se calcula aquí para que el rail y su flyout muestren lo mismo.
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { EDITOR_RAIL_ITEMS } from '../components/shell/railItems';
import { useRailDestinations } from '../hooks/useRailDestinations';

const elem = (over: Record<string, unknown> = {}) =>
  ({ id: 'e1', type: 'paragraph', text: 'x', ...over }) as never;

const docWith = (over: Record<string, unknown> = {}) =>
  ({ id: 'd1', name: 'doc', elements: [], referencias: [], ...over }) as never;

/** Lee el hook con un render mínimo: el estado vive en el store, no en React. */
function readDestinations(): ReturnType<typeof useRailDestinations> {
  let items: ReturnType<typeof useRailDestinations> = [];
  function Probe() {
    items = useRailDestinations();
    return null;
  }
  render(React.createElement(Probe));
  return items;
}

const byStep = (items: ReturnType<typeof useRailDestinations>, step: number) => {
  const found = items.find((i) => i.step === step);
  if (!found) throw new Error(`sin destino para la fase ${step}`);
  return found;
};

describe('T3 — destinos del rail', () => {
  beforeEach(() => {
    useDocStore.setState({
      doc: null,
      wizardStep: 1,
      coverSetupDone: false,
      proofreadFindings: [],
      citationAuditResult: null,
    });
  });

  it('son las seis fases, en orden, con etiqueta sin emojis', () => {
    expect(EDITOR_RAIL_ITEMS.map((i) => i.label)).toEqual([
      'Portada', 'Estructura', 'Figuras', 'Referencias', 'Revisión & IA', 'Exportar',
    ]);
    for (const item of EDITOR_RAIL_ITEMS) {
      expect(item.label).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('el mapa del documento solo se ofrece en las fases de sección', () => {
    const conMapa = EDITOR_RAIL_ITEMS.filter((i) => i.showOutline).map((i) => i.step);
    expect(conMapa).toEqual([2, 3, 4]);
  });

  it('cada destino lleva id estable, icono y la misma gramática del catálogo', () => {
    const items = readDestinations();
    expect(items.map((i) => i.id)).toEqual([
      'step-1', 'step-2', 'step-3', 'step-4', 'step-5', 'step-6',
    ]);
    items.forEach((item, idx) => {
      const src = EDITOR_RAIL_ITEMS[idx];
      expect(item.step).toBe(src.step);
      expect(item.label).toBe(src.label);
      expect(item.Icon).toBe(src.Icon);
      expect(item.showOutline).toBe(src.showOutline);
    });
  });
});

describe('T3b — estado por destino', () => {
  beforeEach(() => {
    useDocStore.setState({
      doc: null,
      wizardStep: 1,
      coverSetupDone: false,
      proofreadFindings: [],
      citationAuditResult: null,
    });
  });

  it('sin documento, todas las fases quedan idle', () => {
    const items = readDestinations();
    expect(items).toHaveLength(6);
    expect(items.every((i) => i.status === 'idle')).toBe(true);
    expect(items.every((i) => i.pending === 0)).toBe(true);
  });

  it('con documento, una fase con pendientes queda pending y sin pendientes done', () => {
    useDocStore.setState({
      doc: docWith({
        elements: [
          elem({ id: 'h1', type: 'heading', needs_review: true }),
          elem({ id: 'h2', type: 'heading', needs_review: false }),
        ],
      }),
    });
    const items = readDestinations();
    expect(byStep(items, 2).status).toBe('pending');
    expect(byStep(items, 2).pending).toBe(1);
    expect(byStep(items, 3).status).toBe('done');
  });

  it('cuenta como pendientes solo las imágenes y tablas marcadas para revisar', () => {
    useDocStore.setState({
      doc: docWith({
        elements: [
          elem({ id: 'i1', type: 'image', needs_review: true }),
          elem({ id: 't1', type: 'table', needs_review: true }),
          elem({ id: 'i2', type: 'image', needs_review: false }),
          elem({ id: 'p1', type: 'paragraph', needs_review: true }),
        ],
      }),
    });
    const items = readDestinations();
    expect(byStep(items, 3).pending).toBe(2);
    expect(byStep(items, 3).status).toBe('pending');
    // Un párrafo marcado no infla la fase de figuras.
    expect(byStep(items, 2).pending).toBe(0);
  });

  it('la fase de auditoría suma hallazgos de ortografía y citas fantasma', () => {
    useDocStore.setState({
      doc: docWith(),
      proofreadFindings: [
        { id: 'f1', kind: 'typo', message: 'x', excerpt: 'x' },
        { id: 'f2', kind: 'typo', message: 'y', excerpt: 'y' },
      ] as never,
      citationAuditResult: { ghost_citations: [{ cite: 'a' }], orphan_references: [] } as never,
    });
    const step5 = byStep(readDestinations(), 5);
    expect(step5.pending).toBe(3);
    expect(step5.status).toBe('pending');
  });

  it('la portada queda done solo cuando el usuario confirmó su configuración', () => {
    useDocStore.setState({ doc: docWith(), coverSetupDone: true });
    const items = readDestinations();
    expect(byStep(items, 1).status).toBe('done');
    // Referencias sin confirmar no se marcan listas por el solo hecho de tener documento.
    expect(byStep(items, 4).status).toBe('idle');
  });

  it('referencias queda done cuando el documento trae al menos una referencia', () => {
    useDocStore.setState({ doc: docWith({ referencias: [{ id: 'r1' }] }) });
    expect(byStep(readDestinations(), 4).status).toBe('done');
  });
});

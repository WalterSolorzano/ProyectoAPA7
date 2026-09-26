// src/__tests__/applyLayoutPagination.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDocStore } from '../store/useDocStore';
import type { LayoutPaginateResult } from '../api/layout';

vi.mock('../api/backend', () => ({
  uploadDocxFile: vi.fn(), updateElement: vi.fn(), getApiBase: vi.fn(),
  getApiBaseAsync: vi.fn().mockResolvedValue('http://x'), fetchWithTrace: vi.fn(),
  resolveAssetUrl: vi.fn(), explainElement: vi.fn(), suggestCaption: vi.fn(),
}));

import * as api from '../api/backend';

const makeDoc = () =>
  ({
    session_id: 's1',
    file_name: 't.docx',
    elements: [
      { id: 'e0', type: 'paragraph', text: 'uno', page_number: 1 },
      { id: 'e1', type: 'paragraph', text: 'dos', page_number: 1 },
    ],
    meta: { page_count: 1 },
    referencias: [],
  }) as any;

const resp = (over: Partial<LayoutPaginateResult> = {}): LayoutPaginateResult => ({
  session_id: 's1',
  available: true,
  provider: 'com',
  total_pages: 4,
  elements: [
    { element_id: 'e0', page_start: 1 },
    { element_id: 'e1', page_start: 3 },
  ],
  line_cuts: [{ element_id: 'e1', cuts: [{ offset: 2, page: 3 }] }],
  ...over,
});

describe('applyLayoutPagination', () => {
  beforeEach(() => {
    useDocStore.setState({ doc: makeDoc(), layoutCuts: null, layoutEcho: 0, wordLayoutUnavailable: false });
  });

  it('aplica page_number, page_count, cortes y eco', () => {
    useDocStore.getState().applyLayoutPagination(resp());
    const s = useDocStore.getState();
    expect(s.doc!.elements[1].page_number).toBe(3);
    expect(s.doc!.meta.page_count).toBe(4);
    expect(s.layoutCuts!['e1']).toEqual([{ offset: 2, page: 3 }]);
    expect(s.layoutEcho).toBe(1);
    expect(s.wordLayoutUnavailable).toBe(false);
  });

  it('idempotente: respuesta idéntica NO incrementa el eco (corta el bucle)', () => {
    const st = useDocStore.getState();
    st.applyLayoutPagination(resp());
    const echo1 = useDocStore.getState().layoutEcho;
    useDocStore.getState().applyLayoutPagination(resp());   // 2ª igual
    expect(useDocStore.getState().layoutEcho).toBe(echo1);
  });

  it('respuesta de OTRA sesión se ignora', () => {
    useDocStore.getState().applyLayoutPagination(resp({ session_id: 'otra' }));
    const s = useDocStore.getState();
    expect(s.doc!.elements[1].page_number).toBe(1);
    expect(s.layoutEcho).toBe(0);
  });

  it('available:false solo prende el aviso D-a (no muta doc)', () => {
    useDocStore.getState().applyLayoutPagination({
      session_id: 's1', available: false, reason: 'Se requiere Microsoft Word',
    });
    const s = useDocStore.getState();
    expect(s.wordLayoutUnavailable).toBe(true);
    expect(s.doc!.elements[1].page_number).toBe(1);
    expect(s.layoutEcho).toBe(0);
  });

  it('reset de upload: al cambiar de documento los 3 campos vuelven al valor inicial', async () => {
    // Estado "sucio" de la sesión anterior: cortes + eco + aviso D-a.
    useDocStore.setState({
      layoutCuts: { e1: [{ offset: 2, page: 3 }] },
      layoutEcho: 5,
      wordLayoutUnavailable: true,
    });

    (api.uploadDocxFile as any).mockResolvedValue({
      session_id: 's2',
      file_name: 'otro.docx',
      elements: [{ id: 'e0', type: 'paragraph', text: 'x', page_number: 1 }],
      meta: { page_count: 1 },
      referencias: [],
    });
    await useDocStore.getState().uploadFile(new File(['x'], 'otro.docx'));

    const s = useDocStore.getState();
    expect(s.doc!.session_id).toBe('s2');
    expect(s.layoutCuts).toBeNull();
    expect(s.layoutEcho).toBe(0);
    expect(s.wordLayoutUnavailable).toBe(false);
  });

  it('available:false con cortes previos limpia layoutCuts (D-a: layout desconocido)', () => {
    useDocStore.getState().applyLayoutPagination(resp());
    expect(useDocStore.getState().layoutCuts).not.toBeNull();

    useDocStore.getState().applyLayoutPagination({
      session_id: 's1', available: false, reason: 'Se requiere Microsoft Word',
    });
    const s = useDocStore.getState();
    expect(s.wordLayoutUnavailable).toBe(true);
    expect(s.layoutCuts).toBeNull();
    expect(s.layoutEcho).toBe(1);        // el eco no es layout: no se toca
    expect(s.doc!.elements[1].page_number).toBe(3); // doc ya aplicado, intacto
  });

  it('reset de tab: cambiar y cerrar pestaña limpia los 3 campos', () => {
    const docA = makeDoc();                       // sesión s1
    const docB = { ...makeDoc(), session_id: 's2' };
    useDocStore.setState({
      doc: docA,
      tabs: [
        { session_id: 's1', file_name: 'a.docx' },
        { session_id: 's2', file_name: 'b.docx' },
      ],
      activeTabIndex: 0,
      tabDocs: { s1: docA, s2: docB },
      layoutCuts: { e1: [{ offset: 2, page: 3 }] },
      layoutEcho: 5,
      wordLayoutUnavailable: true,
    });

    useDocStore.getState().switchToTab(1);
    let s = useDocStore.getState();
    expect(s.doc!.session_id).toBe('s2');
    expect(s.layoutCuts).toBeNull();
    expect(s.layoutEcho).toBe(0);
    expect(s.wordLayoutUnavailable).toBe(false);

    // De nuevo "sucio" y se cierra la pestaña activa (s2 → vuelve a s1).
    useDocStore.setState({
      layoutCuts: { e1: [{ offset: 2, page: 3 }] },
      layoutEcho: 5,
      wordLayoutUnavailable: true,
    });
    useDocStore.getState().removeTab(1);
    s = useDocStore.getState();
    expect(s.doc!.session_id).toBe('s1');
    expect(s.layoutCuts).toBeNull();
    expect(s.layoutEcho).toBe(0);
    expect(s.wordLayoutUnavailable).toBe(false);
  });

  it('firma canónica: mismo contenido en distinto orden NO incrementa el eco', () => {
    const a = resp({
      line_cuts: [
        { element_id: 'e1', cuts: [{ offset: 2, page: 3 }, { offset: 9, page: 4 }] },
        { element_id: 'e0', cuts: [{ offset: 5, page: 2 }] },
      ],
    });
    const b = resp({
      elements: [
        { element_id: 'e1', page_start: 3 },
        { element_id: 'e0', page_start: 1 },
      ],
      line_cuts: [
        { element_id: 'e0', cuts: [{ offset: 5, page: 2 }] },
        { element_id: 'e1', cuts: [{ offset: 9, page: 4 }, { offset: 2, page: 3 }] }, // lista reordenada
      ],
    });

    useDocStore.getState().applyLayoutPagination(a);
    const echo1 = useDocStore.getState().layoutEcho;
    const cuts1 = useDocStore.getState().layoutCuts;
    expect(echo1).toBe(1);

    useDocStore.getState().applyLayoutPagination(b);   // mismo contenido, otro orden
    expect(useDocStore.getState().layoutEcho).toBe(echo1);            // sin eco nuevo
    expect(useDocStore.getState().layoutCuts).toBe(cuts1);            // sin set de cortes (misma referencia)
  });
});

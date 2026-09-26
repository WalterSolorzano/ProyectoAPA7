// src/__tests__/applyLayoutPagination.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDocStore } from '../store/useDocStore';
import type { LayoutPaginateResult } from '../api/layout';

vi.mock('../api/backend', () => ({
  uploadDocxFile: vi.fn(), updateElement: vi.fn(), getApiBase: vi.fn(),
  getApiBaseAsync: vi.fn().mockResolvedValue('http://x'), fetchWithTrace: vi.fn(),
  resolveAssetUrl: vi.fn(), explainElement: vi.fn(), suggestCaption: vi.fn(),
}));

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
    useDocStore.setState({ doc: makeDoc(), layoutCuts: {}, layoutEcho: 0, wordLayoutUnavailable: false });
  });

  it('aplica page_number, page_count, cortes y eco', () => {
    useDocStore.getState().applyLayoutPagination(resp());
    const s = useDocStore.getState();
    expect(s.doc!.elements[1].page_number).toBe(3);
    expect(s.doc!.meta.page_count).toBe(4);
    expect(s.layoutCuts['e1']).toEqual([{ offset: 2, page: 3 }]);
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
});

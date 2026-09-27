/**
 * WordAPA7 — T12: la vista de Revisión saca su cerebro del componente.
   Aquí se prueban el filtrado, el agrupado, la página real y la honestidad
   de las métricas, todo sin montar un solo nodo del DOM.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { ENGINE_META, useReviewWorkbench } from '../hooks/useReviewWorkbench';
import type { AIReviewParagraph } from '../api/backend';
import type { ProofreadFinding } from '../types';

/** `doc` completo es un modelo de 30 campos; a la capa de datos solo le sirven
 *  los elementos. */
const DOC_SIN_MOTORES = {
  doc: {
    elements: [
      { id: 'e1', type: 'paragraph', text: 'tambien' },
      { id: 'e2', type: 'paragraph', text: 'otro parrafo' },
    ],
  } as never,
};

/** Hallazgo del proofreador local. `kind` es el vocabulario REAL del backend
 *  (auditSlice KIND_LABELS): 'bloom_vague', no 'bloom_verb'. */
const hallazgo = (over: Partial<ProofreadFinding> = {}): ProofreadFinding => ({
  element_id: 'e1',
  start: 0,
  end: 6,
  excerpt: 'tambien',
  kind: 'ortografia',
  severity: 'error',
  message: 'Falta tilde',
  suggestion: 'también',
  source: 'local',
  ...over,
});

/** Párrafo del detector de IA con la forma de `AIReviewParagraph`. */
const parrafoIA = (
  element_id: string,
  ai_score: number,
  ai_category: AIReviewParagraph['ai_category'],
): AIReviewParagraph => ({
  element_id,
  index: 0,
  type: 'paragraph',
  text: `texto del bloque ${element_id}`,
  ai_score,
  ai_category,
  findings: [],
  spelling: [],
});

const tresMotores = {
  reviewResult: { paragraphs: [parrafoIA('e1', 10, 'LOW')] },
  proofreadFindings: [hallazgo()],
  citationAuditResult: { ghost_citations: [], orphan_references: [] },
} as never;

describe('T12 — useReviewWorkbench', () => {
  // El store es global: sin restaurar, este archivo deja un documento cargado
  // atrás y cualquier corrida sin aislamiento por archivo depende del orden.
  const estadoInicial = {
    doc: useDocStore.getState().doc,
    reviewResult: useDocStore.getState().reviewResult,
    proofreadFindings: useDocStore.getState().proofreadFindings,
    citationAuditResult: useDocStore.getState().citationAuditResult,
    aiIndices: useDocStore.getState().aiIndices,
    updateElementText: useDocStore.getState().updateElementText,
  };

  beforeEach(() => {
    useDocStore.setState({
      ...DOC_SIN_MOTORES,
      reviewResult: null,
      proofreadFindings: [],
      citationAuditResult: null,
      aiIndices: null,
    });
  });

  afterEach(() => {
    // El `cleanup` global de RTL corre DESPUÉS de este afterEach, así que el
    // hook del test anterior sigue montado: restaurar el store fuera de act()
    // disparaba un update sin envolver en cada test.
    act(() => useDocStore.setState(estadoInicial));
  });

  it('sin motores ejecutados, la vista está vacía y la métrica es honesta', () => {
    const { result } = renderHook(() => useReviewWorkbench());
    expect(result.current.items).toHaveLength(0);
    expect(result.current.metrics.compliance).toBeNull();
  });

  it('la página sale del índice real, y un elemento ajeno no recibe número', () => {
    useDocStore.setState({
      proofreadFindings: [hallazgo(), hallazgo({ element_id: 'fantasma' })],
    });
    const { result } = renderHook(() => useReviewWorkbench());
    const [real, huerfano] = result.current.items;
    // e1 sí está en la página 1 del computePages: ahí hay página.
    expect(real.pageNumber).toBe(1);
    // 'fantasma' no está en el documento: null, no la página de otro.
    expect(huerfano.pageNumber).toBeNull();
  });

  it('el filtro por motor oculta los grupos de los otros', () => {
    useDocStore.setState({
      proofreadFindings: [
        hallazgo(),
        hallazgo({ element_id: 'e2', excerpt: 'objetivo', kind: 'bloom_vague', message: 'Verbo impreciso' }),
      ],
    });
    const { result } = renderHook(() => useReviewWorkbench());
    expect(result.current.groups.map((g) => g.engine).sort()).toEqual(['spelling', 'style']);

    act(() => result.current.setFilter('spelling'));
    expect(result.current.groups.map((g) => g.engine)).toEqual(['spelling']);
  });

  it('el filtro también recorta las marcas del minimapa', () => {
    useDocStore.setState({
      proofreadFindings: [
        hallazgo(),
        hallazgo({ element_id: 'e2', excerpt: 'redundancia', kind: 'muletilla', suggestion: '' }),
      ],
    });
    const { result } = renderHook(() => useReviewWorkbench());
    // Las dos caen en la página 1: sin filtro, la marca cuenta 2 hallazgos.
    expect(result.current.marks.get(1)?.count).toBe(2);

    act(() => result.current.setFilter('spelling'));
    const marcas = [...result.current.marks.values()];
    expect(marcas).toHaveLength(1);
    expect(marcas[0].count).toBe(1);
    expect(marcas[0].label).toBe(ENGINE_META.spelling.title);
  });

  it('el grupo que abre por defecto es el de mayor severidad, no el primero', () => {
    useDocStore.setState({
      proofreadFindings: [hallazgo()],
      reviewResult: {
        paragraphs: [
          parrafoIA('e3', 82, 'HIGH'),
          parrafoIA('e4', 78, 'HIGH'),
          parrafoIA('e5', 55, 'MEDIUM'),
        ],
      } as never,
    });
    const { result } = renderHook(() => useReviewWorkbench());
    // 'ai' es el ÚLTIMO motor de ENGINE_ORDER y aun así es el que abre: gana
    // por tener 2 hallazgos altos contra 1 del motor que va primero.
    expect(result.current.openEngines).toEqual(['ai']);
  });

  it('el detector de IA nunca ofrece Aceptar', () => {
    useDocStore.setState({
      proofreadFindings: [hallazgo({ kind: 'muletilla', message: 'Muletilla repetitiva', suggestion: '' })],
      reviewResult: { paragraphs: [parrafoIA('e3', 82, 'HIGH')] } as never,
    });
    const { result } = renderHook(() => useReviewWorkbench());
    const ia = result.current.groups.find((g) => g.engine === 'ai');
    expect(ia).toBeDefined();
    expect(ia?.massAction).toBe('mark');
    expect(ia?.massLabel).toBe('Marcar todos');
    // Ni un solo subtipo del motor probabilístico puede aceptar: los dos
    // subtipos que hay (muletilla y parrafo_ia) solo proponen.
    expect(ia?.groups.length).toBe(2);
    expect(ia?.groups.every((g) => g.action === 'mark')).toBe(true);
  });

  it('un hallazgo de IA no dispara la corrección; uno de ortografía sí', async () => {
    // La costura se prueba en las DOS direcciones: si el doble no llegara a
    // llamarse nunca, la primera mitad pasaría sinreason (y sin red).
    const updateElementText = vi.fn(async () => {});
    useDocStore.setState({
      updateElementText,
      proofreadFindings: [
        hallazgo({ kind: 'muletilla', message: 'Muletilla repetitiva', suggestion: 'texto inventado' }),
        hallazgo({ element_id: 'e2', excerpt: 'tambien', suggestion: 'también' }),
      ],
    });
    const { result } = renderHook(() => useReviewWorkbench());
    const [ia, ortografia] = result.current.items;
    expect(ia.category).toBe('ai');
    expect(ortografia.category).toBe('spelling');

    await act(async () => {
      await result.current.acceptOne(ia);
    });
    // El detector de IA propone: la persona decide.
    expect(updateElementText).not.toHaveBeenCalled();
    expect(result.current.items.map((i) => i.id)).toEqual([ia.id, ortografia.id]);

    await act(async () => {
      await result.current.acceptOne(ortografia);
    });
    expect(updateElementText).toHaveBeenCalledWith('e2', 'también');
    expect(result.current.items.map((i) => i.id)).toEqual([ia.id]);
  });

  it('el cumplimiento solo se publica con los tres motores ejecutados', () => {
    useDocStore.setState({ proofreadFindings: [hallazgo()] });
    const { result } = renderHook(() => useReviewWorkbench());
    expect(result.current.metrics.compliance).toBeNull();
  });

  it('con los tres motores ejecutados el cumplimiento sí es un número', () => {
    useDocStore.setState(tresMotores);
    const { result } = renderHook(() => useReviewWorkbench());
    // 1 hallazgo (la ortografía) y la revisión IA de 10% no entra al panel:
    // solo el motor con señales. Cumplimiento = 100 - 1x3.
    expect(result.current.items).toHaveLength(1);
    expect(result.current.metrics.compliance).toBe(97);
    expect(result.current.metrics.critical).toBe(0);
  });

  it('“Siguiente hallazgo” avanza, selecciona y abre el grupo del que elige', () => {
    useDocStore.setState({
      proofreadFindings: [hallazgo(), hallazgo({ element_id: 'e2', excerpt: 'objetivo' })],
    });
    const { result } = renderHook(() => useReviewWorkbench());
    const [primero] = result.current.items;

    act(() => result.current.nextFinding());
    expect(result.current.selected?.id).toBe(primero.id);
    expect(result.current.openEngines).toContain('spelling');
    expect(result.current.openSubtypes).toContain('spelling:ortografia');

    act(() => result.current.nextFinding());
    expect(result.current.selected?.id).not.toBe(primero.id);
  });

  it('marcar para revisar no borra el hallazgo; descartar sí', () => {
    useDocStore.setState({ proofreadFindings: [hallazgo()] });
    const { result } = renderHook(() => useReviewWorkbench());
    const [unico] = result.current.items;

    act(() => result.current.markForReview(unico));
    expect(result.current.markedIds).toEqual([unico.id]);
    expect(result.current.items).toHaveLength(1);

    act(() => result.current.dismiss(unico));
    expect(result.current.items).toHaveLength(0);
    expect(result.current.markedIds).toEqual([unico.id]);
  });

  it('una referencia huérfana no recibe la página del último elemento', () => {
    useDocStore.setState({
      citationAuditResult: {
        ghost_citations: [{ citation_text: 'García, 2020', element_id: 'e2' }],
        orphan_references: [{ authors: ['Pérez'], year: 2019, raw_text: 'Pérez, A. (2019). Título.' }],
      } as never,
    });
    const { result } = renderHook(() => useReviewWorkbench());
    const fantasma = result.current.items.find((i) => i.subtype === 'cita_fantasma');
    const huerfana = result.current.items.find((i) => i.subtype === 'referencia_huerfana');

    expect(fantasma?.pageNumber).toBe(1);
    expect(fantasma?.severity).toBe('critical');
    // La huérfana no está anclada a ningún elemento: sin página, no un 1 falso.
    expect(huerfana?.pageNumber).toBeNull();
    expect(huerfana?.originalText).toBe('Pérez, A. (2019). Título.');
  });

  it('la vista arranca en Foco, no en la hoja completa', () => {
    const { result } = renderHook(() => useReviewWorkbench());
    expect(result.current.viewMode).toBe('focus');
  });
});

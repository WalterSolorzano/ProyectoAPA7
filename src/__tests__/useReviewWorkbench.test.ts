/**
 * WordAPA7 — T12: la vista de Revisión saca su cerebro del componente.
   Aquí se prueban el filtrado, el agrupado, la página real y la honestidad
   de las métricas, todo sin montar un solo nodo del DOM.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { ENGINE_META, ENGINE_ORDER, useReviewWorkbench } from '../hooks/useReviewWorkbench';
import type { AIReviewParagraph } from '../api/backend';
import type { ProofreadFinding } from '../types';

/** `doc` completo es un modelo de 30 campos; a la capa de datos solo le sirven
 *  los elementos. */
const DOC_SIN_MOTORES = {
  doc: {
    session_id: 'sesion-1',
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

/** Documento con figuras y tablas sin rotular (motor Estructura). */
const DOC_CON_ESTRUCTURA = {
  doc: {
    session_id: 'sesion-1',
    elements: [
      { id: 'e1', type: 'paragraph', text: 'tambien' },
      { id: 'fig1', type: 'image', text: '', image_info: { url: 'data:' } },
    ],
  } as never,
};

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
    autoResolveGhosts: useDocStore.getState().autoResolveGhosts,
    autoCaptionAll: useDocStore.getState().autoCaptionAll,
    runAIReview: useDocStore.getState().runAIReview,
    runProofreadBatch: useDocStore.getState().runProofreadBatch,
    runCitationAudit: useDocStore.getState().runCitationAudit,
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

  it('`allGroups` NO se estrecha: los chips del view siguen siendo la lista completa', () => {
    // La clase de defecto que Found 1 reportaba: `groups` se construye desde
    // `visibles` (o sea, YA filtrado), así que un chip por motor alimentado con
    // `groups` pierde a los demás motores en cuanto hay un filtro activo, y el
    // "Todo" pasa a decir el total filtrado. Los chips necesitan el resumen sin
    // filtro; el rack y la siembra de `openEngines` necesitan el estrecho.
    useDocStore.setState({
      proofreadFindings: [
        hallazgo(),
        hallazgo({ element_id: 'e2', excerpt: 'objetivo', kind: 'bloom_vague', message: 'Verbo impreciso' }),
        hallazgo({ element_id: 'e2', kind: 'muletilla', message: 'Muletilla repetitiva' }),
      ],
    });
    const { result } = renderHook(() => useReviewWorkbench());
    expect(result.current.allGroups.map((g) => [g.engine, g.count])).toEqual([
      ['spelling', 1],
      ['style', 1],
      ['ai', 1],
    ]);
    expect(result.current.metrics.total).toBe(3);

    act(() => result.current.setFilter('spelling'));
    // Estrecho: el rack y la semilla de grupos abiertos solo miran ortografía.
    expect(result.current.groups.map((g) => g.engine)).toEqual(['spelling']);
    // Completo: el chip de IA y el de redacción siguen disponibles para elegir,
    // y el "Todo" sigue siendo el total del documento, no el del filtro.
    expect(result.current.allGroups.map((g) => g.engine)).toEqual(['spelling', 'style', 'ai']);
    expect(result.current.allGroups.reduce((n, g) => n + g.count, 0)).toBe(3);
  });

  it('`hasFindings` cuenta los hallazgos del documento, no los que deja el filtro', () => {
    const { result } = renderHook(() => useReviewWorkbench());
    expect(result.current.hasFindings).toBe(false);

    act(() => {
      useDocStore.setState({
        proofreadFindings: [hallazgo(), hallazgo({ element_id: 'e2', kind: 'muletilla', message: 'Muletilla' })],
      });
    });
    expect(result.current.hasFindings).toBe(true);

    // El filtro no borra hallazgos: si `hasFindings` se derivara de `groups`,
    // con un filtro activo sobre un documento que SÍ tiene hallazgos de otro
    // motor, la barra ofrecería "Escanear" sobre un documento ya escaneado.
    act(() => result.current.setFilter('spelling'));
    expect(result.current.hasFindings).toBe(true);

    // Descartarlos sí lo vacía: `items` es la única fuente de la verdad.
    const [spelling, ai] = result.current.items;
    act(() => result.current.dismiss(spelling));
    expect(result.current.hasFindings).toBe(true);
    act(() => result.current.dismiss(ai));
    expect(result.current.hasFindings).toBe(false);
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
    // llamarse nunca, la primera mitad pasaría sin razón (y sin red).
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

  it('cargar otro documento vuelve a elegir su grupo más crítico', () => {
    useDocStore.setState({ proofreadFindings: [hallazgo()] });
    const { result } = renderHook(() => useReviewWorkbench());
    expect(result.current.openEngines).toEqual(['spelling']);

    // Mismo hook, otra sesión = otro documento: si la siembra no se reinicia, el
    // grupo del documento anterior seguiría abierto y el nuevo no abriría ninguno.
    act(() => {
      useDocStore.setState({
        doc: { session_id: 'sesion-2', elements: [{ id: 'z1', type: 'paragraph', text: 'otro' }] } as never,
        proofreadFindings: [hallazgo({ element_id: 'z1', kind: 'muletilla', message: 'Muletilla' })],
      });
    });
    expect(result.current.openEngines).toEqual(['ai']);
  });

  it('una edición en el documento NO vuelve a elegir el grupo', () => {
    // Ortografía y Bloom empatan en gravedad, así que la siembra elige el
    // primero de ENGINE_ORDER: 'spelling'. La persona abre el otro.
    useDocStore.setState({
      proofreadFindings: [
        hallazgo(),
        hallazgo({ element_id: 'e2', kind: 'bloom_vague', message: 'Verbo impreciso', suggestion: 'x' }),
      ],
    });
    const { result } = renderHook(() => useReviewWorkbench());
    expect(result.current.openEngines).toEqual(['spelling']);
    act(() => result.current.setOpenEngines(['style']));

    // Esto es lo que hace `updateElementText` -> `updateElementType`: el
    // backend devuelve el documento entero y el store reemplaza el objeto
    // (documentSlice.ts:695). Si la siembra se reiniciara por identidad de
    // objeto, aceptar una sola tilde tiraría abajo lo que la persona abrió.
    act(() => {
      useDocStore.setState({
        doc: { session_id: 'sesion-1', elements: [{ id: 'e1', type: 'paragraph', text: 'también' }] } as never,
      });
    });
    expect(result.current.openEngines).toEqual(['style']);
  });

  it('“Página X de N” nunca muestra una página que no existe', () => {
    // 40 párrafos de 100 caracteres = 2 páginas en el índice real.
    const elementos = Array.from({ length: 40 }, (_, i) => ({
      id: `x${i}`,
      type: 'paragraph',
      text: 'a'.repeat(100),
    }));
    useDocStore.setState({ doc: { elements: elementos } as never });
    const { result } = renderHook(() => useReviewWorkbench());
    expect(result.current.totalPages).toBe(2);

    act(() => result.current.goToPage(99));
    expect(result.current.currentPage).toBe(2);
    act(() => result.current.goToPage(0));
    expect(result.current.currentPage).toBe(1);
  });

  it('si el documento encoge bajo la vista, la página actual se recorta', () => {
    // `currentPage` es un useState crudo: si el documento pierde páginas (una
    // edición que fusiona elementos, otro documento en la misma vista) la vista
    // queda announcing "Página 2 de 1" y la flecha anterior camina hacia atrás
    // por páginas que ya no existen. El recorte es del hook, no del paginador.
    const muchos = Array.from({ length: 40 }, (_, i) => ({
      id: `x${i}`,
      type: 'paragraph',
      text: 'a'.repeat(100),
    }));
    useDocStore.setState({ doc: { session_id: 'sesion-1', elements: muchos } as never });
    const { result } = renderHook(() => useReviewWorkbench());
    expect(result.current.totalPages).toBe(2);
    act(() => result.current.goToPage(2));
    expect(result.current.currentPage).toBe(2);

    act(() => {
      useDocStore.setState({
        doc: { session_id: 'sesion-1', elements: [{ id: 'y0', type: 'paragraph', text: 'corto' }] } as never,
      });
    });
    expect(result.current.totalPages).toBe(1);
    expect(result.current.currentPage).toBe(1);
  });

  it('la marca de la página la tiñe el motor más grave, no el primero que aparece', () => {
    useDocStore.setState({
      proofreadFindings: [
        // El primero en insertarse es de IA (medium); el segundo es de
        // ortografía (high). La marca tiene que ser del segundo.
        hallazgo({ kind: 'muletilla', message: 'Muletilla repetitiva', suggestion: '' }),
        hallazgo({ element_id: 'e2', excerpt: 'tambien' }),
      ],
    });
    const { result } = renderHook(() => useReviewWorkbench());
    const marca = result.current.marks.get(1);
    expect(marca?.label).toBe('Ortografía');
    expect(marca?.color).toBe('var(--color-accent)');
    expect(marca?.count).toBe(2);
  });

  it('un párrafo IA sin puntuación no muestra un porcentaje inventado', () => {
    // Entra por `ai_category` con `ai_score` sin calcular: el panel no puede
    // inventionar un 60% para una medición que no existe.
    useDocStore.setState({ reviewResult: { paragraphs: [parrafoIA('e1', 0, 'HIGH')] } as never });
    const { result } = renderHook(() => useReviewWorkbench());
    const [item] = result.current.items;
    expect(item.category).toBe('ai');
    expect(item.summary).not.toMatch('%');
    expect(item.aiScore).toBeUndefined();
  });

  it('ningún kind del auditor se pierde en el panel', () => {
    const kinds = ['repeticion', 'ambigua', 'passive_voice', 'long_sentence', 'incompleta', 'persona'];
    useDocStore.setState({
      proofreadFindings: kinds.map((kind, i) =>
        hallazgo({ element_id: `k${i}`, kind, message: `Aviso de ${kind}` }),
      ),
    });
    const { result } = renderHook(() => useReviewWorkbench());
    // Los seis llegan. Los cinco que no tienen corrección automática se
    // MARCAN; la mezcla de personas es una corrección de estilo.
    expect(result.current.items).toHaveLength(6);
    const filas = new Map(
      result.current.groups.flatMap((g) => g.groups).map((s) => [s.label, s.action]),
    );
    expect(filas.get('Palabra repetida')).toBe('mark');
    expect(filas.get('Pronombre ambiguo')).toBe('mark');
    expect(filas.get('Voz pasiva')).toBe('mark');
    expect(filas.get('Oración extensa')).toBe('mark');
    expect(filas.get('Idea incompleta')).toBe('mark');
    expect(filas.get('Mezcla de personas gramaticales')).toBe('accept');
  });

  it('un kind que este archivo no conoce se marca, no se descarta', () => {
    useDocStore.setState({
      proofreadFindings: [hallazgo({ kind: 'detector_del_2026', message: 'Algo nuevo' })],
    });
    const { result } = renderHook(() => useReviewWorkbench());
    expect(result.current.items).toHaveLength(1);
    const fila = result.current.groups.flatMap((g) => g.groups)[0];
    expect(fila.label).toBe('Otro hallazgo del corrector');
    expect(fila.action).toBe('mark');
    expect(fila.items[0].summary).toBe('Algo nuevo');
  });

  it('el lote tampoco toca los hallazgos de IA', async () => {
    const updateElementText = vi.fn(async () => {});
    useDocStore.setState({
      updateElementText,
      proofreadFindings: [
        hallazgo({ kind: 'muletilla', message: 'Muletilla repetitiva', suggestion: 'texto inventado' }),
        hallazgo({ element_id: 'e2', excerpt: 'tambien', suggestion: 'también' }),
        hallazgo({ element_id: 'e2', kind: 'ai_phrase', message: 'Frase típica', suggestion: 'otra' }),
      ],
    });
    const { result } = renderHook(() => useReviewWorkbench());
    await act(async () => {
      await result.current.acceptMany(result.current.items);
    });
    // De los tres, solo la ortografía tiene corrección aplicable.
    expect(updateElementText).toHaveBeenCalledTimes(1);
    expect(updateElementText).toHaveBeenCalledWith('e2', 'también');
    expect(result.current.items).toHaveLength(2);
  });

  describe('runGroupAction — la vista pregunta, el hook ejecuta', () => {
    it('un motor objetivo se rotula "Aceptar todas"; el de IA, "Marcar todos"', () => {
      useDocStore.setState({
        ...DOC_CON_ESTRUCTURA,
        proofreadFindings: [
          hallazgo(),
          hallazgo({ element_id: 'e1', kind: 'bloom_vague', message: 'Verbo impreciso' }),
          hallazgo({ element_id: 'e1', kind: 'muletilla', message: 'Muletilla' }),
        ],
        citationAuditResult: {
          ghost_citations: [{ citation_text: 'García, 2020', element_id: 'e1' }],
          orphan_references: [],
        } as never,
      });
      const { result } = renderHook(() => useReviewWorkbench());
      // AGENTS.md §1: los cuatro motores objetivos aceptan; el probabilístico
      // solo marca. El rótulo no depende del mecanismo que haya detrás.
      expect(result.current.groups.map((g) => [g.engine, g.massLabel])).toEqual([
        ['spelling', 'Aceptar todas'],
        ['style', 'Aceptar todas'],
        ['structure', 'Aceptar todas'],
        ['citations', 'Aceptar todas'],
        ['ai', 'Marcar todos'],
      ]);
    });

    it('el grupo de citas ejecuta autoResolveGhosts', async () => {
      const autoResolveGhosts = vi.fn(async () => {});
      useDocStore.setState({
        autoResolveGhosts,
        citationAuditResult: {
          ghost_citations: [{ citation_text: 'García, 2020', element_id: 'e1' }],
          orphan_references: [],
        } as never,
      });
      const { result } = renderHook(() => useReviewWorkbench());
      const citas = result.current.groups.find((g) => g.engine === 'citations')!;
      expect(citas.massAction).toBe('resolveGhosts');
      await act(async () => {
        await result.current.runGroupAction(citas);
      });
      expect(autoResolveGhosts).toHaveBeenCalledTimes(1);
    });

    it('el grupo de estructura ejecuta autoCaptionAll', async () => {
      const autoCaptionAll = vi.fn(async () => {});
      useDocStore.setState({ ...DOC_CON_ESTRUCTURA, autoCaptionAll });
      const { result } = renderHook(() => useReviewWorkbench());
      const estructura = result.current.groups.find((g) => g.engine === 'structure')!;
      expect(estructura.massAction).toBe('autoCaption');
      await act(async () => {
        await result.current.runGroupAction(estructura);
      });
      expect(autoCaptionAll).toHaveBeenCalledTimes(1);
    });

    it('el grupo de estilo aplica todas sus correcciones', async () => {
      const updateElementText = vi.fn(async () => {});
      useDocStore.setState({
        updateElementText,
        proofreadFindings: [
          hallazgo({ kind: 'bloom_vague', message: 'Verbo impreciso' }),
          hallazgo({ element_id: 'e2', kind: 'bloom_low', message: 'Nivel bajo' }),
        ],
      });
      const { result } = renderHook(() => useReviewWorkbench());
      const estilo = result.current.groups.find((g) => g.engine === 'style')!;
      expect(estilo.massAction).toBe('accept');
      await act(async () => {
        await result.current.runGroupAction(estilo);
      });
      // El motor da la sugerencia por defecto para Bloom, y se aplica a los dos.
      expect(updateElementText).toHaveBeenCalledTimes(2);
      expect(result.current.items).toHaveLength(0);
    });

    it('"Aceptar todas" de un motor NO se lleva los subtipos que solo se marcan', async () => {
      // El caso MIXTO que la ronda 1 no probó: un motor 'accept' que contiene
      // subtipos 'mark'. Los 'mark' son los que el motor detecta con certeza
      // pero no sabe corregir (palabra repetida, oración colgada, voz pasiva):
      // si la cabecera se los llevara, `aplicar` los mandaría a
      // api.rewriteText y escribiría prosa generada en el documento.
      const updateElementText = vi.fn(async () => {});
      useDocStore.setState({
        updateElementText,
        proofreadFindings: [
          hallazgo({ element_id: 'e1', kind: 'bloom_vague', message: 'Verbo impreciso', suggestion: 'verbo preciso' }),
          // Los dos de abajo llevan `suggestion` a propósito: sin ella, un apply
          // indebido caería en la red y el doble no se vería llamado.
          hallazgo({ element_id: 'e2', kind: 'incompleta', message: 'Oración colgante', suggestion: 'prosa inventada' }),
          hallazgo({ element_id: 'e2', kind: 'repeticion', message: 'Palabra repetida', suggestion: 'prosa inventada' }),
        ],
      });
      const { result } = renderHook(() => useReviewWorkbench());
      const estilo = result.current.groups.find((g) => g.engine === 'style')!;
      expect(estilo.massAction).toBe('accept');
      // El motor mixto: un subtipo 'accept' y dos 'mark'.
      expect(estilo.groups.map((g) => [g.label, g.action])).toEqual([
        ['Verbo impreciso en objetivo (Bloom)', 'accept'],
        ['Idea incompleta', 'mark'],
        ['Palabra repetida', 'mark'],
      ]);

      await act(async () => {
        await result.current.runGroupAction(estilo);
      });
      // Solo el Bloom se escribe. Los otros dos siguen ahí, sin marcar y sin
      // tocar: el rótulo era "aceptar", no "marcar por detrás".
      expect(updateElementText).toHaveBeenCalledTimes(1);
      expect(updateElementText).toHaveBeenCalledWith('e1', 'verbo preciso');
      expect(result.current.items.map((i) => i.subtype)).toEqual(['idea_incompleta', 'palabra_repetida']);
      expect(result.current.markedIds).toEqual([]);
    });

    it('un motor cuyos subtipos no comparten su acción no ejecuta nada', async () => {
      // Citas cuyo único subtipo es 'referencia_huerfana' ('none'): el botón
      // dice "Aceptar todas" pero no hay nada que el motor de citas sepa
      // resolver, así que no dispara el resolvedor de todo el documento.
      const autoResolveGhosts = vi.fn(async () => {});
      const autoCaptionAll = vi.fn(async () => {});
      useDocStore.setState({
        autoResolveGhosts,
        autoCaptionAll,
        proofreadFindings: [hallazgo({ element_id: 'e2', kind: 'incompleta', message: 'Oración colgante' })],
        citationAuditResult: {
          ghost_citations: [],
          orphan_references: [{ authors: ['Pérez'], year: 2019, raw_text: 'Pérez (2019).' }],
        } as never,
      });
      const { result } = renderHook(() => useReviewWorkbench());
      // Motor de estilo: solo hay 'mark', y su acción de cabecera es 'accept'.
      const estilo = result.current.groups.find((g) => g.engine === 'style')!;
      expect(estilo.massAction).toBe('accept');
      expect(estilo.groups.every((g) => g.action === 'mark')).toBe(true);
      await act(async () => {
        await result.current.runGroupAction(estilo);
      });
      // Motor de citas: su único subtipo es 'none' y su acción es
      // 'resolveGhosts'. Tampoco hay nada que resolver.
      const citas = result.current.groups.find((g) => g.engine === 'citations')!;
      await act(async () => {
        await result.current.runGroupAction(citas);
      });

      expect(autoResolveGhosts).not.toHaveBeenCalled();
      expect(autoCaptionAll).not.toHaveBeenCalled();
      expect(result.current.items).toHaveLength(2);
      expect(result.current.markedIds).toEqual([]);
      expect(useDocStore.getState().toastMessage).toMatch(/nada que aplicar en bloque/);
    });

    it('el grupo de estructura no rota figuras si su único subtipo es un encabezado', async () => {
      const autoCaptionAll = vi.fn(async () => {});
      useDocStore.setState({
        autoCaptionAll,
        // Solo un encabezado por revisar: subtipo 'none', no 'autoCaption'.
        doc: {
          session_id: 'sesion-1',
          elements: [{ id: 'h1', type: 'heading', text: 'Método', needs_review: true }],
        } as never,
      });
      const { result } = renderHook(() => useReviewWorkbench());
      const estructura = result.current.groups.find((g) => g.engine === 'structure')!;
      expect(estructura.massAction).toBe('autoCaption');
      expect(estructura.groups.map((g) => g.action)).toEqual(['none']);
      await act(async () => {
        await result.current.runGroupAction(estructura);
      });
      expect(autoCaptionAll).not.toHaveBeenCalled();
      expect(result.current.items).toHaveLength(1);
    });

    it('el grupo de IA marca todo y no borra nada', async () => {
      const updateElementText = vi.fn(async () => {});
      useDocStore.setState({
        updateElementText,
        proofreadFindings: [
          hallazgo({ kind: 'muletilla', message: 'Muletilla A', suggestion: 'a' }),
          hallazgo({ element_id: 'e2', kind: 'muletilla', message: 'Muletilla B', suggestion: 'b' }),
        ],
      });
      const { result } = renderHook(() => useReviewWorkbench());
      const ia = result.current.groups.find((g) => g.engine === 'ai')!;
      expect(ia.massAction).toBe('mark');
      await act(async () => {
        await result.current.runGroupAction(ia);
      });
      expect(result.current.markedIds).toHaveLength(2);
      expect(result.current.items).toHaveLength(2);
      expect(updateElementText).not.toHaveBeenCalled();
    });

    it('un subtipo sin corrección automática no ejecuta nada, y lo dice', async () => {
      const autoResolveGhosts = vi.fn(async () => {});
      useDocStore.setState({
        autoResolveGhosts,
        citationAuditResult: {
          ghost_citations: [],
          orphan_references: [{ authors: ['Pérez'], year: 2019, raw_text: 'Pérez (2019).' }],
        } as never,
      });
      const { result } = renderHook(() => useReviewWorkbench());
      const subtipo = result.current.groups.flatMap((g) => g.groups)[0];
      expect(subtipo.action).toBe('none');
      await act(async () => {
        await result.current.runGroupAction(subtipo);
      });
      expect(autoResolveGhosts).not.toHaveBeenCalled();
      expect(result.current.items).toHaveLength(1);
      expect(useDocStore.getState().toastMessage).toMatch(/no tiene corrección automática/);
    });
  });

  describe('un motor que falló no publica cumplimiento', () => {
    it('falla el motor de IA: los otros dos dejaron resultados y aun así no hay número', async () => {
      useDocStore.setState({
        reviewResult: { paragraphs: [parrafoIA('e1', 10, 'LOW')] } as never,
        // El motor de IA no deja resultados nuevos: el escaneo se registra
        // como fallido aunque el store ya tuviera un review viejo.
        runAIReview: vi.fn(async () => {}),
        runProofreadBatch: vi.fn(async () => {
          useDocStore.setState({ proofreadFindings: [hallazgo()] });
        }),
        runCitationAudit: vi.fn(async () => {
          useDocStore.setState({ citationAuditResult: { ghost_citations: [], orphan_references: [] } as never });
        }),
      });
      const { result } = renderHook(() => useReviewWorkbench());
      await act(async () => {
        await result.current.scanAll();
      });
      // Los tres motores tienen resultados en el store: sin el registro de
      // fallo esto publicaría 97% sobre un escaneo que no ocurrió.
      expect(result.current.items.length).toBeGreaterThan(0);
      expect(result.current.metrics.compliance).toBeNull();
    });

    it('falla el proofread: tampoco publica cumplimiento', async () => {
      useDocStore.setState({
        reviewResult: { paragraphs: [parrafoIA('e1', 10, 'LOW')] } as never,
        proofreadFindings: [hallazgo()],
        citationAuditResult: { ghost_citations: [], orphan_references: [] } as never,
        runAIReview: vi.fn(async () => {
          useDocStore.setState({ reviewResult: { paragraphs: [parrafoIA('e1', 80, 'HIGH')] } as never });
        }),
        runProofreadBatch: vi.fn(async () => {}),
        runCitationAudit: vi.fn(async () => {
          useDocStore.setState({ citationAuditResult: { ghost_citations: [], orphan_references: [] } as never });
        }),
      });
      const { result } = renderHook(() => useReviewWorkbench());
      await act(async () => {
        await result.current.scanAll();
      });
      expect(result.current.metrics.compliance).toBeNull();
    });

    it('falla el motor de citas: tampoco publica cumplimiento', async () => {
      useDocStore.setState({
        reviewResult: { paragraphs: [parrafoIA('e1', 10, 'LOW')] } as never,
        proofreadFindings: [hallazgo()],
        citationAuditResult: { ghost_citations: [], orphan_references: [] } as never,
        runAIReview: vi.fn(async () => {
          useDocStore.setState({ reviewResult: { paragraphs: [parrafoIA('e1', 80, 'HIGH')] } as never });
        }),
        runProofreadBatch: vi.fn(async () => {
          useDocStore.setState({ proofreadFindings: [hallazgo()] });
        }),
        runCitationAudit: vi.fn(async () => {}),
      });
      const { result } = renderHook(() => useReviewWorkbench());
      await act(async () => {
        await result.current.scanAll();
      });
      expect(result.current.metrics.compliance).toBeNull();
    });
  });
});

/* El minimapa se lee "en reposo": sin tooltip, el color ES la información.
   Dos motores con el mismo token son dos motores indistinguibles, y
   AGENTS.md §1 pide una marca por página "coloreada por motor". */
describe('T12 — el color de cada motor', () => {
  // Specifier en variable, como en designTokens.test.ts: Vite no debe analizarlo.
  const NODE_FS = 'node:fs';
  const NODE_PATH = 'node:path';
  const NODE_URL = 'node:url';

  let claro = '';
  let oscuro = '';

  beforeAll(async () => {
    const { readFileSync } = await import(/* @vite-ignore */ NODE_FS);
    const { resolve } = await import(/* @vite-ignore */ NODE_PATH);
    const { fileURLToPath } = await import(/* @vite-ignore */ NODE_URL);
    const dir = fileURLToPath(import.meta.url).replace(/[^/\\]+$/, '');
    const css = readFileSync(resolve(dir, '../styles/design-system.css'), 'utf8');
    claro = css.slice(css.indexOf(':root,'), css.indexOf(':root[data-theme="dark"]'));
    oscuro = css.slice(css.indexOf(':root[data-theme="dark"]'));
  });

  const valorEn = (bloque: string, token: string): string =>
    bloque.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1].trim() ?? '';

  it('ningún motor se queda sin token CSS', () => {
    for (const engine of ENGINE_ORDER) {
      expect(ENGINE_META[engine].color).toMatch(/^var\(--[a-z-]+\)$/);
    }
  });

  it('los cinco motores se distinguen en el tema claro', () => {
    const vistos = ENGINE_ORDER.map((e) => valorEn(claro, ENGINE_META[e].color.slice(4, -1)));
    for (const v of vistos) expect(v).toBeTruthy();
    expect(new Set(vistos).size).toBe(ENGINE_ORDER.length);
  });

  it('los cinco motores se distinguen en el tema oscuro', () => {
    const vistos = ENGINE_ORDER.map((e) => valorEn(oscuro, ENGINE_META[e].color.slice(4, -1)));
    for (const v of vistos) expect(v).toBeTruthy();
    expect(new Set(vistos).size).toBe(ENGINE_ORDER.length);
  });
});

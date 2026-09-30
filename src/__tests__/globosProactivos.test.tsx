/**
 * LA PANTALLA DE REVISIÓN NO AFIRMA NADA QUE EL CÓDIGO NO HAGA.
 *
 * El defecto que estas pruebas cubren era una contradicción, no un texto feo.
 * Al abrir un documento, `documentSlice.uploadFile` dispara tres globos en
 * background: `runProactiveAudits`, `runProactiveAutoCaptioning` y
 * `runProofreadBatch`. Los tres corren solos. Y la pantalla de Revisión decía,
 * mientras corrían, "Todavía no corrió ningún motor / Ningún motor reportó
 * hallazgos todavía", con un `isScanning` que era un `useState` de la vista y
 * que solo `scanAll` levantaba.
 *
 * La clase de bug es la que este proyecto vino a matar: una UI que afirma algo
 * que el código no hace. Por eso el arreglo NO es cambiar el texto: es que la
 * pantalla sepa lo que el código sabe. El estado de corrida vive en el store,
 * que es donde los globos viven.
 *
 * LO QUE SE USA ES EL STORE DE VERDAD
 *
 * Reimplementar la cadena dentro del test probaría el test. Lo único que se
 * finge es la red —`api/backend`—, que es lo único que no existe en una
 * prueba. Todo lo demás es el código que corre en la app.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

/* EL ORDEN DE ESTOS IMPORTES NO ES COSA ESTETICA. `api/backend` importa al store
   y el store importa a `api/backend`: son un ciclo. Si el test importara primero
   a `api/backend`, el store se evaluaría por el otro lado y los slices se
   quedarían con la versión REAL de `api.proofreadBatch` —el mock no se aplica,
   la llamada sale a la red y el `catch { }` se la come en silencio—. Importando
   el store primero, el mock entra antes de que los slices lean el módulo. */
import { useDocStore } from '../store/useDocStore';
import * as api from '../api/backend';
import { ReviewWorkbench } from '../components/review/ReviewWorkbench';

vi.mock('../api/backend', async (importOriginal) => {
  const real = await importOriginal<typeof import('../api/backend')>();
  return {
    ...real,
    proofreadBatch: vi.fn(),
    validateCitations: vi.fn(),
    runAIReview: vi.fn(),
    fetchProactiveCaptions: vi.fn(),
  };
});

/* El lienzo va simulado con `importOriginal` y no con una caja vacía: el índice
   de páginas importa `computeRenderedPages` de ESE módulo, y un mock sin esa
   exportación revienta el hook que publica los números de página. */
vi.mock('../components/layout/PaperCanvas', async (importOriginal) => {
  const real = await importOriginal<typeof import('../components/layout/PaperCanvas')>();
  return { ...real, PaperCanvas: () => <div data-testid="canvas" /> };
});

const corregir = api.proofreadBatch as unknown as ReturnType<typeof vi.fn>;
const citas = api.validateCitations as unknown as ReturnType<typeof vi.fn>;
const estilo = api.runAIReview as unknown as ReturnType<typeof vi.fn>;
const leyendas = api.fetchProactiveCaptions as unknown as ReturnType<typeof vi.fn>;

const DOC = {
  session_id: 's-globo',
  file_name: 'tesis.docx',
  elementos: [{ id: 'e1', type: 'paragraph', text: 'el parrafo uno' }],
  elements: [
    {
      id: 'e1', type: 'paragraph', text: 'el parrafo uno', page_number: 1,
      style_name: 'Normal', alignment: 'left', font_name: 'Times New Roman',
      font_size: 12, is_bold: false, is_italic: false, is_bullet: false,
      left_indent_cm: 0, confidence: 1, is_user_modified: false,
      needs_review: false, auto_applied: false, cita_ids: [],
    },
  ],
  referencias: [],
  meta: { page_count: 1 },
} as never;

/** Un hallazgo de ortografía, con la forma que espera el store. */
const HALLAZGO = {
  element_id: 'e1', start: 3, end: 10, excerpt: 'parrafo', kind: 'ortografia',
  severity: 'error', message: 'Falta tilde', suggestion: 'párrafo',
  source: 'local', phase: 'portada', read_only: true,
};

/** Una promesa que todavía no se resolvió: es lo que hace "un motor corriendo". */
const pendiente = () => new Promise<never>(() => {});

beforeEach(() => {
  vi.clearAllMocks();
  /* jsdom no trae `ResizeObserver` y el auto-ajuste de texto lo necesita. Es
     andamiaje del entorno, no del comportamiento que se prueba. */
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  useDocStore.setState({
    doc: DOC,
    reviewResult: null,
    proofreadFindings: [],
    citationAuditResult: null,
    aiIndices: null,
    sugerenciasProactivas: true,
    isAuditing: false,
    motoresAuditando: [],
    dismissedCommentIds: [],
  } as never);
  /* Por defecto, todo el mundo termina: los tests que necesitan un globo en
     vuelo sobrescriben UNO de estos. Escribir el valor por defecto explícito y
     no en el cuerpo de cada test evita que un caso nuevo olvide el andamiaje. */
  corregir.mockResolvedValue({ findings: [HALLAZGO], ai_indices: null });
  citas.mockResolvedValue({ ghost_citations: [], orphan_references: [] });
  estilo.mockResolvedValue({ paragraphs: [], total_paragraphs: 0, findings: [] });
  leyendas.mockResolvedValue({ suggestions: [] });
});

afterEach(() => {
  act(() => useDocStore.setState({ isAuditing: false, motoresAuditando: [] } as never));
});

describe('el estado de corrida de los globos vive en el store', () => {
  it('con un motor en vuelo, el store lo dice; cuando termina, deja de decirlo', async () => {
    /* El caso central. Un flag de la vista no podría afirmar esto: el globo lo
       dispara `uploadFile`, no la vista, y sobrevive a que la vista se desmonte. */
    let resolver!: () => void;
    corregir.mockImplementation(() => new Promise((res) => { resolver = () => res({ findings: [], ai_indices: null }); }));

    act(() => { void useDocStore.getState().runProofreadBatch(); });
    expect(useDocStore.getState().isAuditing).toBe(true);
    expect(useDocStore.getState().motoresAuditando.length).toBe(1);

    await act(async () => { resolver(); await Promise.resolve(); });
    expect(useDocStore.getState().isAuditing).toBe(false);
    expect(useDocStore.getState().motoresAuditando).toEqual([]);
  });

  it('UN motor que termina NO apaga a los otros dos', async () => {
    /* Si `isAuditing` fuera un booleano, esto no se podría expresar: tres
       motores quedan en vuelo, uno termina, y los otros dos siguen trabajando.
       Con un booleano la pantalla parpadearía "no está corriendo" en medio de
       una auditoría. La lista es la que hace posible el estado honesto. */
    estilo.mockImplementation(() => pendiente());
    leyendas.mockImplementation(() => pendiente());

    /* `runProactiveAudits` anota DOS motores: el de citas y el de estilo se
       lanzan juntos y se apagan juntos, y contarlos como uno mentiría sobre
       cuál de los dos sigue vivo. Con leyendas, son tres en vuelo. */
    act(() => { void useDocStore.getState().runProactiveAudits(); });
    act(() => { void useDocStore.getState().runProactiveAutoCaptioning(); });
    expect(useDocStore.getState().isAuditing).toBe(true);
    expect(useDocStore.getState().motoresAuditando).toHaveLength(3);

    /* El revisor entra, corre y sale: la lista crece a cuatro y vuelve a tres.
       Lo que se afirma es que NO baja de tres: los otros siguen en vuelo. */
    await act(async () => { await useDocStore.getState().runProofreadBatch(); });
    expect(useDocStore.getState().isAuditing).toBe(true);
    expect(useDocStore.getState().motoresAuditando).toHaveLength(3);
    expect(useDocStore.getState().motoresAuditando).not.toContain('ortografía, texto pegado e IA');
  });

  it('UN motor que FALLA también se apaga: el glob se traga el error, el estado no', async () => {
    /* El `catch` silencioso de los globos es lo correcto para un trabajo en
       segundo plano, pero si el `finally` no escribiera el estado, un fallo de
       red dejaría la pantalla diciendo "corriendo" para siempre. Un estado de
       corrida que no se apaga es peor que uno que no existe. */
    corregir.mockRejectedValue(new Error('ECONNREFUSED'));
    await act(async () => { await useDocStore.getState().runProofreadBatch(); });
    expect(useDocStore.getState().isAuditing).toBe(false);
    expect(useDocStore.getState().motoresAuditando).toEqual([]);
  });

  it('sin documento no se anota nada: no hay motor corriendo sobre nada', async () => {
    useDocStore.setState({ doc: null } as never);
    await act(async () => { await useDocStore.getState().runProofreadBatch(); });
    expect(corregir).not.toHaveBeenCalled();
    expect(useDocStore.getState().isAuditing).toBe(false);
  });
});

describe('la pantalla de Revisión no afirma que no corrió nada mientras corre', () => {
  it('con un globo en vuelo, el motivo es "corriendo" y NO "todavía no corrió ningún motor"', () => {
    /* La pantalla decía la cosa contraria mientras tres motores trabajaban.
       El texto viejo no se cambia: se deja de usar cuando es falso. */
    useDocStore.setState({
      isAuditing: true,
      motoresAuditando: ['citas y estilo', 'leyendas de figuras y tablas'],
    } as never);
    render(<ReviewWorkbench />);
    const texto = screen.getByTestId('estado-vacio').textContent ?? '';
    expect(texto).not.toMatch(/Todavia no corrio ningun motor/i);
    expect(texto).toMatch(/Los motores estan corriendo/i);
  });

  it('el motivo "corriendo" NOMBRA los motores, no dice un "cargando" mudo', () => {
    /* Un "cargando" sin decir qué carga no le dice a nadie cuándo va a
       terminar. Los nombres vienen del store, que es quien sabe qué corría. */
    useDocStore.setState({
      isAuditing: true,
      motoresAuditando: ['citas y estilo', 'revisión de estilo con IA'],
    } as never);
    render(<ReviewWorkbench />);
    const texto = screen.getByTestId('estado-vacio').textContent ?? '';
    expect(texto).toMatch(/citas y estilo/);
    expect(texto).toMatch(/revisión de estilo con IA/);
    /* Y se leen como una frase, no como un campo de texto: la conjunción es la
       diferencia entre "esto corre" y "esto es una lista". */
    expect(texto).toMatch(/citas y estilo, y revisión de estilo con IA| y revisión de estilo con IA/);
  });

  it('el estado vacío ofrece el Escanear DE VERDAD, no un texto que manda a otro lado', async () => {
    /* El botón real vive en la tira de arriba. El estado vacío decía "pulsa
       Escanear" sin ofrecerlo, y mandar al usuario a buscarlo a 44px de la
       grilla es trabajo de más. Que el botón esté y que EJECUTE es lo que se
       prueba: se aprieta y se llama a los motores. */
    useDocStore.setState({ isAuditing: true, motoresAuditando: ['citas y estilo'] } as never);
    render(<ReviewWorkbench />);

    /* El de la grilla: el que NO vive en la tira. Se distinguen por su padre. */
    const enLaGrilla = screen.getByTestId('estado-vacio').querySelectorAll('button');
    expect(enLaGrilla.length).toBe(1);
    const boton = enLaGrilla[0] as HTMLButtonElement;

    /* Mientras corre, el botón no se puede volver a pulsar: los motores ya
       están trabajando y un segundo escaneo es trabajo tirado. Y su ETIQUETA
       sigue diciendo "Escanear": el estado ya lo dice el título, y un botón que
       lo repite haría que el texto de la pantalla no sirviera para afirmar
       cuál de los dos motivos está. */
    expect(boton.disabled).toBe(true);
    expect(boton.textContent).toBe('Escanear');
  });

  it('sin nada corriendo y con el interruptor encendido, el motivo vuelve a ser el de siempre', () => {
    /* El arreglo no dejó de hablar cuando no hay nada que decir: el caso "nunca
       corrió nada" sigue teniendo su propio texto, porque sigue siendo cierto
       en un documento recién creado sin abrir. */
    render(<ReviewWorkbench />);
    expect(screen.getByTestId('estado-vacio').textContent).toMatch(/Todavia no corrio ningun motor/i);
  });
});

describe('CON CERO CLAVES LA PANTALLA TIENE RESULTADOS, NO ESTÁ VACÍA', () => {
  it('sin ninguna clave, el motor local deja hallazgos y la pantalla los muestra', async () => {
    /* La afirmación que hay que PROBAR, no la que hay que suponer: los motores
       locales no piden red ni clave (`python/routers/proofread.py`, la auditoría
       local es "siempre disponible"), así que con cero claves la pantalla tiene
       que mostrar resultados. Si un día el refinamiento se vuelve obligatorio y
       el local desaparece, este test cae —que es lo que tiene que pasar—. */
    useDocStore.setState({ apiKey: '', aiProviderConfig: { providerId: '', nimUrl: '', useLocal: false } } as never);
    await act(async () => { await useDocStore.getState().runProofreadBatch(); });

    expect(useDocStore.getState().proofreadFindings.length).toBeGreaterThan(0);

    render(<ReviewWorkbench />);
    expect(screen.queryByTestId('estado-vacio')).toBeNull();
    expect(screen.getByLabelText('Párrafo en revisión')).toBeTruthy();
  });

  it('y la clave vacía no se cuela como si fuera una clave puesta', async () => {
    /* El motor viaja con la clave en la petición. Con cero claves tiene que
       viajar VACÍA, no con un placeholder: una clave de mentira haría que el
       refinamiento se intente contra un proveedor inexistente en cada apertura
       de documento. */
    useDocStore.setState({ apiKey: '' } as never);
    await act(async () => { await useDocStore.getState().runProofreadBatch(); });
    const [, opts] = corregir.mock.calls[0] as [string, { apiKey?: string }];
    expect(opts.apiKey).toBe('');
  });
});

describe('con el interruptor apagado, la pantalla vacía lo DICE', () => {
  it('el motivo Nombra el interruptor y dice qué hacer para encenderlo', () => {
    /* Apagado, los motores corren, sus resultados se descartan, y la pantalla
       queda vacía SIN CAUSA. Un estado vacío sin causa no informa: entretiene. Y
       esta es la misma clase que el `if (tipo === 'clave' && limpio)` que la F8
       sacó de la pestaña de Conexión: un interruptor que descarta el resultado
       sin decir nada. */
    useDocStore.setState({ sugerenciasProactivas: false } as never);
    render(<ReviewWorkbench />);
    const texto = screen.getByTestId('estado-vacio').textContent ?? '';
    expect(texto).toMatch(/Sugerencias proactivas/);
    expect(texto).toMatch(/Ajustes/);
    /* Y no dice que no corrió ningún motor: los globos SÍ corrieron, lo que se
       apagó fue la salida de lo que encontraron. Esa era la mentira. */
    expect(texto).not.toMatch(/Todavia no corrio ningun motor/i);
  });

  it('apagado Y con motores corriendo, el motivo es "corriendo", y al terminar pasa al del interruptor', () => {
    /* El orden de los motivos no es una preferencia de redacción, y esta
       combinación es la que lo fija. Hay dos lecturas posibles y son
       defendibles: con el interruptor apagado, "corriendo" promete una entrega
       que no va a llegar, porque los motores que corren igual dejarán la
       pantalla vacía; y "sugerencias apagadas" es el motivo que hay que
       arreglar a mano.

       Gana "corriendo" por una razón concreta: es un estado que SE RESUELVE
       SOLO, mientras que el del interruptor no se resuelve sin que la persona
       lo toque. Y la secuencia completa no miente en ningún momento: primero
       dice que algo corre (que es cierto), y cuando termina dice qué hay que
       hacer. Al revés, el mensaje del interruptor aparecería sobre un documento
       que todavía se está revisando. */
    useDocStore.setState({
      sugerenciasProactivas: false,
      isAuditing: true,
      motoresAuditando: ['leyendas de figuras y tablas'],
    } as never);
    const { rerender } = render(<ReviewWorkbench />);
    expect(screen.getByTestId('estado-vacio').textContent).toMatch(/Los motores estan corriendo/i);

    /* Y cuando el último motor termina, el motivo cambia solo al que hay que
       arreglar a mano. La transición es lo que hace que la secuencia no mienta:
       si el mensaje se quedara en "corriendo", sería el bug original. */
    act(() => useDocStore.setState({ isAuditing: false, motoresAuditando: [] } as never));
    rerender(<ReviewWorkbench />);
    const texto = screen.getByTestId('estado-vacio').textContent ?? '';
    expect(texto).toMatch(/Sugerencias proactivas/);
    expect(texto).not.toMatch(/Los motores estan corriendo/i);
  });

  it('con el interruptor apagado, lo que SÍ hay en pantalla no se borra', () => {
    /* El interruptor decide si se GUARDAN los hallazgos futuros. No es un
       interruptor de "borrar lo que ya se encontró": si lo fuera, prenderlo y
       apagarlo dos veces perdería el trabajo. Este test afirma que apagar no
       toca lo ya recogido. */
    useDocStore.setState({ sugerenciasProactivas: false, proofreadFindings: [HALLAZGO] } as never);
    render(<ReviewWorkbench />);
    expect(screen.queryByTestId('estado-vacio')).toBeNull();
    expect(screen.getByLabelText('Párrafo en revisión')).toBeTruthy();
  });
});

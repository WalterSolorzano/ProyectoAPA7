/**
 * La accion de refresco del store: que recarga el documento cuando Word guardo
 * algo de verdad, y que no toca NADA cuando no lo hay.
 *
 * LA PREGUNTA QUE ESTE ARCHIVO RESPONDE
 *
 * El watcher de Word dispara por cada evento del sistema de archivos, y la
 * mayoria de las veces no hay nada que contar: un Ctrl+S que solo toca estilos, una
 * imagen, un metacampo. Si cada guardado vagara por el store, la app estaria
 * reconstruyendo el documento entero para terminar en el mismo lugar. Peor: si
 * cada guardado tirara los hallazgos, un Ctrl+S perderia el trabajo de la
 * revision por un gesto que no cambio una palabra. Por eso el contrato tiene la
 * palabra "cambiado" y por eso este archivo prueba las dos ramas.
 *
 * EL CASO DEL ARCHIVO A MEDIAS ES EL QUE MAS DUELE SI SE IGNORA
 *
 * Un `.docx` se esta reescribiendo entero en cada guardado, asi que leerlo a
 * medias es lo normal y el backend responde `listo: false` en vez de tirar un
 * 500. En ese caso el backend NO guardo nada: recargar el documento seria tirar
 * el estado guardado para atras, y el texto que Word acaba de escribir
 * desapareceria de la pantalla. Un `listo: false` no es "un documento con menos
 * parrafos": es "no se pudo mirar", y no se puede mirar no es motivo para
 * cambiar nada.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDocStore } from '../store/useDocStore';
import type { DiffWord } from '../lib/wordRefresh';

vi.mock('../api/backend', async (importOriginal) => {
  const real = await importOriginal<typeof import('../api/backend')>();
  return { ...real, recoverSession: vi.fn() };
});

vi.mock('../lib/wordRefresh', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/wordRefresh')>();
  return { ...real, refrescarDesdeWord: vi.fn() };
});

import * as api from '../api/backend';
import { refrescarDesdeWord as refrescarDesdeWordLib } from '../lib/wordRefresh';

const pedir = refrescarDesdeWordLib as unknown as ReturnType<typeof vi.fn>;
const recuperar = api.recoverSession as unknown as ReturnType<typeof vi.fn>;

const docViejo = () =>
  ({
    session_id: 's1',
    file_name: 'tesis.docx',
    elements: [{ id: 'elem_0', type: 'paragraph', text: 'el texto viejo', page_number: 1 }],
    meta: { page_count: 1 },
    referencias: [],
  }) as any;

const docNuevo = () =>
  ({
    session_id: 's1',
    file_name: 'tesis.docx',
    elements: [
      { id: 'elem_0', type: 'paragraph', text: 'el texto viejo', page_number: 1 },
      { id: 'elem_1', type: 'paragraph', text: 'el parrafo que Word agrego', page_number: 1 },
    ],
    meta: { page_count: 1 },
    referencias: [],
  }) as any;

const diff = (over: Partial<DiffWord> = {}): DiffWord => ({
  session_id: 's1',
  listo: true,
  cambiado: false,
  hash_estructura: 'h1',
  elementos: [],
  ids_nuevos: [],
  ids_eliminados: [],
  ...over,
});

const montar = () => {
  useDocStore.setState({
    doc: docViejo(),
    tabDocs: { s1: docViejo() },
    proofreadFindings: [],
  });
  return useDocStore.getState().refrescarDesdeWord;
};

beforeEach(() => {
  vi.clearAllMocks();
  useDocStore.setState({ tabDocs: {}, proofreadFindings: [] });
});

describe('refrescarDesdeWord del store', () => {
  it('UN GUARDADO QUE NO CAMBIO NADA NO TOCA NADA', async () => {
    // La razon por la que existe la palabra "cambiado" en el contrato. Un Ctrl+S
    // que solo toca estilos no puede costar una reauditoria entera, y sobre todo
    // no puede vaciar los hallazgos: se perderian por un Ctrl+S.
    const refrescar = montar();
    pedir.mockResolvedValue(diff());

    const r = await refrescar('C:/tesis.docx');

    expect(r.cambiado).toBe(false);
    expect(recuperar).not.toHaveBeenCalled();
    const s = useDocStore.getState();
    expect(s.doc!.elements).toHaveLength(1);
    expect(s.proofreadFindings).toEqual([]);
  });

  it('SIN DOCUMENTO NO SE PIDE NADA, NI AL ARCHIVO NI AL BACKEND', async () => {
    // El watcher dispara eventos del sistema de archivos, no acciones del usuario:
    // puede saltar con la app en Home, sin ninguna sesion abierta. Preguntar por
    // un documento que no existe produce una peticion sin destino.
    useDocStore.setState({ doc: null });
    const refrescar = useDocStore.getState().refrescarDesdeWord;

    const r = await refrescar('C:/tesis.docx');

    expect(r).toEqual({ listo: false, cambiado: false, nuevos: 0, eliminados: 0, hallazgos: null });
    expect(pedir).not.toHaveBeenCalled();
    expect(recuperar).not.toHaveBeenCalled();
  });

  it('UN ARCHIVO A MEDIAS NO RECARGA NI UN ELEMENTO', async () => {
    // El backend no guardo nada en este caso. Recargar seria tirar el estado
    // guardado para atras y perder de la pantalla el texto recien escrito.
    const refrescar = montar();
    pedir.mockResolvedValue(diff({ listo: false, motivo: 'a_medias' }));

    const r = await refrescar('C:/tesis.docx');

    expect(r.listo).toBe(false);
    expect(r.cambiado).toBe(false);
    expect(r.hallazgos).toBeNull();
    expect(recuperar).not.toHaveBeenCalled();
    expect(useDocStore.getState().doc!.elements).toHaveLength(1);
  });

  it('LO QUE WORD AGREGO SE VE EN PANTALLA, EN EL DOC Y EN LA PESTA', async () => {
    const refrescar = montar();
    pedir.mockResolvedValue(
      diff({ cambiado: true, hash_estructura: 'h2', ids_nuevos: ['elem_1'], ids_eliminados: ['elem_9'] })
    );
    recuperar.mockResolvedValue(docNuevo());

    const r = await refrescar('C:/tesis.docx');

    expect(r).toEqual({ listo: true, cambiado: true, nuevos: 1, eliminados: 1, hallazgos: null });
    const s = useDocStore.getState();
    expect(s.doc!.elements).toHaveLength(2);
    expect(s.tabDocs.s1.elements).toHaveLength(2);
  });

  it('LA RECARGA PASA POR migrateDocument', async () => {
    // Sin esto, un documento guardado con campos viejos rompe los componentes que
    // leen el esquema actual. Es la misma linea que usa openSession.
    const refrescar = montar();
    pedir.mockResolvedValue(diff({ cambiado: true }));
    recuperar.mockResolvedValue({ ...docNuevo(), schema_version: 1 });

    await refrescar('C:/tesis.docx');

    expect(useDocStore.getState().doc!.schema_version).toBe(2);
  });

  it('EL CONTEO DE HALLAZGOS ES null, NO CERO: ESTA TAREA NO REAUDITA', async () => {
    // La reauditoria es de otra tarea. Devolver 0 aca seria una afirmacion sobre
    // algo que no se miro, y el aviso la repetiria: "0 hallazgos" cuando en
    // realidad no se conto ninguno. `null` es "no se conto", que es otra cosa.
    const refrescar = montar();
    pedir.mockResolvedValue(diff({ cambiado: true, ids_nuevos: ['elem_1'] }));
    recuperar.mockResolvedValue(docNuevo());

    const r = await refrescar('C:/tesis.docx');

    expect(r.hallazgos).toBeNull();
    expect(r.nuevos).toBe(1);
  });
});

/**
 * F7 Task 3 — el proyecto sobrevive al reinicio, y deja de inventar su nombre.
 *
 * DOS defectos, y son distintos:
 *
 * 1. El nombre del proyecto no sobrevivía. Vivía derivado del nombre del archivo
 *    de la pestaña activa, así que renombrar el archivo renombraba el proyecto y
 *    cerrar la app lo dejaba en nada. Eso no es una entidad: es un prefijo.
 *
 * 2. Sin pestaña, `ProjectFolderModal` imprimía literalmente `'Proyecto APA 7'`.
 *    Un nombre inventado en pantalla es peor que no tener chrome: la persona lee
 *    un nombre y razona sobre un trabajo que no existe.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDocStore, persistPartialize } from '../store/useDocStore';
import { ProjectFolderModal } from '../components/project/ProjectFolderModal';
import { crearProyecto } from '../lib/proyecto';

// La subida pega al backend. Lo que se mide en esta tarea es la RUTA, y la ruta
// se lee del archivo antes de hablar con el backend: espiar la API deja que el
// resto de `uploadFile` corra sin red y sin romper el store.
vi.mock('../api/backend', async () => {
  const real = await vi.importActual<typeof import('../api/backend')>('../api/backend');
  return { ...real, uploadDocxFile: vi.fn().mockResolvedValue({ session_id: 's1', file_name: 'x.docx', elements: [] }) };
});

/**
 * Simula cerrar y reabrir la app con la MISMA lógica que la app usa: el
 * `partialize` real del store. Un `partialize` reescrito acá mediría la copia y
 * no la cosa.
 */
function rehidratar() {
  const opt = useDocStore.persist.getOptions();
  const delStore = opt.partialize!(useDocStore.getState());
  const exportado = persistPartialize(useDocStore.getState());
  // Si el `partialize` de las opciones y el exportado divergieran, el test
  // mediría una cosa y la app otra: el modo de fallo que este archivo mata.
  expect(JSON.stringify(exportado)).toBe(JSON.stringify(delStore));
  return JSON.parse(JSON.stringify({ state: delStore, version: opt.version })).state as {
    proyecto: { nombre: string; raiz: string | null; documentos: string[] } | null;
  };
}

const proyectoDePrueba = () =>
  crearProyecto({ nombre: 'Mi tesis', raiz: 'C:\\tesis' });

beforeEach(() => {
  useDocStore.setState({
    proyecto: null,
    projectImages: [],
    tabs: [],
    activeTabIndex: 0,
    activeFilePath: null,
  });
});

describe('el proyecto sobrevive al reinicio', () => {
  it('el nombre y la carpeta vuelven', () => {
    // El defecto: el nombre salía del nombre del archivo, y el archivo se
    // renombra. Cerrar la app volvía a la nada.
    useDocStore.getState().setProyecto(proyectoDePrueba());

    const antes = rehidratar();
    expect(antes.proyecto?.nombre).toBe('Mi tesis');
    expect(antes.proyecto?.raiz).toBe('C:\\tesis');
  });

  it('sin proyecto, la persistencia no inventa uno', () => {
    // El otro lado del mismo defecto: si `proyecto` está `null` y el store
    // rellena un nombre por las dudas, volvió el nombre inventado, ahora por la
    // puerta de la persistencia en vez de por la del render.
    expect(rehidratar().proyecto).toBeNull();
  });

  it('cerrar el proyecto lo borra de verdad, no lo deja a medias', () => {
    useDocStore.getState().setProyecto(proyectoDePrueba());
    useDocStore.getState().cerrarProyecto();
    expect(useDocStore.getState().proyecto).toBeNull();
    expect(rehidratar().proyecto).toBeNull();
  });

  it('el proyecto recuerda los documentos que se le agregaron', () => {
    // Un proyecto sin documentos es una etiqueta. Si al cargar una sesion no
    // queda anotada en su proyecto, el proyecto no es un conjunto de sesiones.
    const p = proyectoDePrueba();
    useDocStore.getState().setProyecto(p);
    useDocStore.getState().setProyecto({
      ...useDocStore.getState().proyecto!,
      documentos: [...useDocStore.getState().proyecto!.documentos, 'abc123'],
    });
    expect(rehidratar().proyecto?.documentos).toEqual(['abc123']);
  });
});

describe('un proyecto sin nombre no se puede crear', () => {
  it('un nombre vacío se rechaza en vez de convertirse en un nombre inventado', () => {
    // ESTA ES LA GUARDA DE `crearProyecto`, y es la que impide que el nombre
    // inventado vuelva por la puerta de atrás: si `crearProyecto` aceptara un
    // nombre vacío, el llamador que "se Forget" de ponerlo volvería a imprimir
    // una cadena vacía en el título, que es el mismo defecto con menos letras.
    expect(() => crearProyecto({ nombre: '' })).toThrow();
    expect(() => crearProyecto({ nombre: '   ' })).toThrow();
  });

  it('el error es al construir, no un nombre raro que se muestra', () => {
    // El fallo tiene que ser ruidoso en el desarrollo y NUNCA llegar a la
    // pantalla: por eso lanza en vez de devolver un objeto con nombre vacío.
    try {
      crearProyecto({ nombre: '' });
      throw new Error('no debería llegar acá');
    } catch (e) {
      expect((e as Error).message).toMatch(/nombre/i);
    }
  });

  it('crearProyecto completa TODOS los campos', () => {
    // Un `Proyecto` armado a mano puede no tener `creado`, y sin `creado` no se
    // puede ordenar nunca. La función existe para que eso sea imposible.
    const p = crearProyecto({ nombre: 'Tesis' });
    expect(p).toEqual({
      id: expect.any(String),
      nombre: 'Tesis',
      raiz: null,
      documentos: [],
      figuras: [],
      creado: expect.any(String),
    });
    expect(p.id.length).toBeGreaterThan(0);
  });

  it('dos proyectos seguidos no comparten id', () => {
    // Si el id saliera de `Date.now()`, dos proyectos abiertos en el mismo
    // milisegundo serían el mismo, y el segundo pisaría al primero.
    const a = crearProyecto({ nombre: 'A' });
    const b = crearProyecto({ nombre: 'B' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('sin proyecto, el chrome de proyecto no se monta', () => {
  const montar = () =>
    render(<ProjectFolderModal isOpen onClose={() => {}} onOpenMerge={() => {}} />);

  it('el nombre inventado no aparece en pantalla', () => {
    // El defecto: sin pestaña activa el título decía 'Proyecto APA 7'.
    montar();
    expect(document.body.textContent).not.toContain('Proyecto APA 7');
  });

  it('no hay ningún nombre de proyecto en pantalla sin proyecto', () => {
    // Más fuerte que el anterior, y por eso el que manda: no basta con que el
    // relleno haya cambiado de texto, tiene que NO haber un título.
    montar();
    expect(screen.queryByTestId('proyecto-titulo')).toBeNull();
  });

  it('con proyecto, el chrome se monta y dice SU nombre', () => {
    // Y no solo "deja de mentir": cuando hay proyecto, el nombre real está.
    useDocStore.getState().setProyecto(proyectoDePrueba());
    montar();
    expect(screen.getByTestId('proyecto-titulo').textContent).toContain('Mi tesis');
  });

  it('con proyecto pero sin pestaña, el nombre tampoco sale del archivo', () => {
    // El nombre del proyecto y el del archivo son dos cosas. Si el título
    // prefiere el archivo, renombrar el archivo renombra el proyecto, que es
    // exactamente lo que esta tarea vino a cerrar.
    useDocStore.getState().setProyecto(proyectoDePrueba());
    useDocStore.setState({
      tabs: [{ session_id: 's1', file_name: 'Otra cosa_v9.docx' }],
      activeTabIndex: 0,
    } as never);
    montar();
    expect(screen.getByTestId('proyecto-titulo').textContent).toContain('Mi tesis');
    expect(screen.getByTestId('proyecto-titulo').textContent).not.toContain('Otra cosa');
  });
});

describe('el botón de abrir carpeta tiene destino', () => {
  it('subir un archivo con ruta deja esa ruta', () => {
    // El defecto: `activeFilePath` es `null` por defecto y NUNCA se establecía en
    // el camino de subir un archivo desde la app, así que el botón "Abrir
    // carpeta" no aparecía nunca en el modo de uso normal. Solo aparecía si el
    // documento se abría desde el menú contextual de Windows.
    const ruta = 'C:\\tesis\\cap1.docx';
    const archivo = Object.assign(new File([new Uint8Array([1])], 'cap1.docx'), { path: ruta });

    void useDocStore.getState().uploadFile(archivo);

    // La ruta del archivo se conoce ANTES de hablar con el backend, y se
    // escribe antes: un fallo de red no puede borrar el lugar de donde vino el
    // documento.
    expect(useDocStore.getState().activeFilePath).toBe(ruta);
  });

  it('sin ruta en el archivo, la ruta anterior no se borra', () => {
    // Un `File` de navegador no tiene `.path`. Poner `null` sería defendible,
    // pero BORRAR la ruta del documento que se está reemplazando dejaría al
    // usuario sin "Abrir carpeta" sobre el archivo que todavía tiene abierto.
    useDocStore.getState().setActiveFilePath('C:\\tesis\\anterior.docx');
    const archivo = new File([new Uint8Array([1])], 'nuevo.docx');

    void useDocStore.getState().uploadFile(archivo);

    expect(useDocStore.getState().activeFilePath).toBe('C:\\tesis\\anterior.docx');
  });
});

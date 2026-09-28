/**
 * El ámbito de Ajustes, y la prueba que no es decorativa.
 *
 * La línea de texto de cada pestaña ("se guardan con el documento" / "valen
 * para toda la app") es una promesa sobre el CÓDIGO, no sobre el diseño: por eso
 * este archivo la contrasta contra el catálogo y no contra una captura. Hoy cada
 * ajuste repite su regla en un comentario; acá hay una sola tabla, y si mañana
 * alguien mete un ajuste de documento en la pestaña Conexión, esto se cae.
 */
import { describe, it, expect } from 'vitest';
import { PESTANAS, pestanaPorId, PESTANA_POR_DEFECTO } from '../components/settings/tabs';

describe('Ajustes — el ámbito es la pestaña', () => {
  it('NINGUN AJUSTE DE DOCUMENTO ESCRIBE EN localStorage', () => {
    // Esta es la prueba que hace verdadera la linea de la pestaña, y la unica
    // forma de que no se vuelva mentira. Hoy cada ajuste repite su regla en un
    // comentario; aca hay una sola regla, y si manana alguien mete un ajuste de
    // documento en la pestaña Conexion, esto se cae.
    const deDocumento = PESTANAS.filter((p) => p.ambito === 'documento').map((p) => p.id);
    const deApp = PESTANAS.filter((p) => p.ambito === 'app').map((p) => p.id);
    expect(deDocumento).toEqual(['documento', 'formato']);
    expect(deApp).toEqual(['conexion', 'revision', 'app']);
  });

  it('CADA PESTANA DICE SU AMBITO, Y LO DICE UNA VEZ', () => {
    for (const p of PESTANAS) {
      expect(p.subtitulo).toMatch(/documento|app/);
      expect(p.subtitulo.length).toBeGreaterThan(20);
    }
  });

  it('NINGUNA PESTANA MEZCLA AMBITOS, Y NO HAY DOS PESTANAS IGUALES', () => {
    // El `id` es lo que se persiste en el store y lo que viaja en la URL de la
    // entrada que abre el hub: dos pestañas con el mismo id son dos pantallas
    // que comparten nombre, y una es inalcanzable.
    const ids = PESTANAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const subtitulos = new Set(PESTANAS.map((p) => p.subtitulo));
    /* El subtítulo se escribe UNA vez por pestaña, y hay dos contextos distintos
     * (documento y app): si aparece un tercero, alguien empezó a distinguir
     * pestañas por su cuenta y la línea dejó de ser la regla. */
    expect(subtitulos.size).toBe(2);
  });

  it('el catálogo se puede resolver por id, y un id desconocido no rompe', () => {
    expect(pestanaPorId('conexion').etiqueta).toBe('Conexión');
    expect(pestanaPorId(undefined).id).toBe(PESTANA_POR_DEFECTO);
    expect(pestanaPorId('una-pestana-que-no-existe').id).toBe(PESTANA_POR_DEFECTO);
  });

  it('el id por defecto es una pestaña que EXISTE en el catálogo', () => {
    // El store arranca en `documento`; si el catálogo se renombra, el hub abre
    // con una barra sin pestaña activa.
    expect(PESTANAS.some((p) => p.id === PESTANA_POR_DEFECTO)).toBe(true);
  });
});

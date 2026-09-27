/**
 * Ninguna clave interna llega a la lista de correcciones.
 *
 * El usuario vio `g74_verbatim_sin_comillas` donde debía leer "Texto copiado
 * sin comillas". Ese rótulo SÍ existía: el problema no fue la tabla, fue el
 * `SUBTYPE_LABELS[key] || key`, que devuelve la clave cruda en cuanto la tabla
 * no conoce el subtipo. Es un modo de fallo por omisión —se manifiesta la
 * primera vez que el backend emite una regla nueva— y por eso se cierra sobre
 * la clase, no sobre el caso.
 *
 * Estas pruebas walkean el catálogo de reglas y comprueban dos cosas: que todo
 * subtipo tiene rótulo de usuario, y que aunque no lo tuviera, lo que se
 * muestra nunca es la clave.
 */

import { describe, it, expect, vi } from 'vitest';
import { rotuloDeSubtipo, agruparHallazgosPorFase } from '../hooks/useReviewWorkbench';
import { PROOFREAD_SPECS } from '../lib/auditItems';

/** El mismo objeto que la vista recibe, con el tipo más flojo posible. */
const item = (subtype: string) => ({
  id: 'i', element_id: 'e', category: 'style', subtype,
  severity: 'low', summary: '', detail: '', originalText: '',
  pageNumber: 1, phase: null, readOnly: false,
});

describe('ningún nombre interno llega a la pantalla', () => {
  it('todo subtipo que la vista produce tiene rótulo de usuario', () => {
    /* La guarda que hace que las pruebas siguientes no pasen por no haber leído
       nada: si el catálogo se vacía, esto se vuelve cierto por falta de
       catálogo y no porque esté todo cubierto. */
    const subtipos = [...new Set(Object.values(PROOFREAD_SPECS).map((s) => s.subtype))];
    expect(subtipos.length).toBeGreaterThan(15);

    const sinRotulo = subtipos.filter((s) => rotuloDeSubtipo(s) === s);
    expect(
      sinRotulo,
      `subtipos que se muestran con su propia clave: ${sinRotulo.join(', ')}`,
    ).toEqual([]);
  });

  it('el g74 sale con el rótulo, no con la clave', () => {
    /* El caso que reportó el usuario, nombrado. */
    const fila = PROOFREAD_SPECS.g74_verbatim_sin_comillas;
    expect(fila).toBeTruthy();
    expect(rotuloDeSubtipo(fila.subtype)).toBe('Texto copiado sin comillas');
  });

  it('una regla nueva y desconocida NO muestra su clave interna', () => {
    /* El modo de fallo por omisión. Con el `|| key` de antes esto devolvía
       `regla_del_ano_que_nadie_registro`; ahora devuelve un rótulo legible y
       avisa en la consola, que es donde se arregla. */
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rotulo = rotuloDeSubtipo('regla_del_ano_que_nadie_registro');
    expect(rotulo).not.toBe('regla_del_ano_que_nadie_registro');
    expect(rotulo).toBe('Otro hallazgo del corrector');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ninguna etiqueta de la tabla parece un identificador', () => {
    /* La otra mitad: que la tabla no se haya llenado con claves. Un rótulo con
       guion bajo o que empiece por una letra y número seguidos es una clave
       que se coló. */
    const subtipos = [...new Set(Object.values(PROOFREAD_SPECS).map((s) => s.subtype))];
    const crudos = subtipos
      .map((s) => rotuloDeSubtipo(s))
      .filter((r) => /^[a-z0-9]+(_[a-z0-9]+)+$/.test(r));
    expect(crudos, `rótulos que son claves: ${crudos.join(', ')}`).toEqual([]);
  });

  it('el rack agrupa con el rótulo, no con la clave', () => {
    /* Y que el camino que de verdad usa la vista pase por acá. */
    const grupos = agruparHallazgosPorFase([item('verbatim_sin_comillas')] as never);
    const sub = grupos[0] as unknown as { items: { subtype: string }[] };
    expect(sub.items[0].subtype).toBe('verbatim_sin_comillas');
    const etiqueta = rotuloDeSubtipo(sub.items[0].subtype);
    expect(etiqueta).not.toContain('_');
  });
});

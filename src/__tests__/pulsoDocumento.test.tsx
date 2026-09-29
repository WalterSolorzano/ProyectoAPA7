/**
 * El pulso del documento y el inspector de rama.
 *
 * DOS COSAS DISTINTAS Y QUE A VECES SE CONFUNDEN.
 *
 * El pulso son CINCO NÚMEROS y nada más: palabras, balance, fases que faltan,
 * figuras sin leyenda y referencias que no se citan. Es lo que un redactor mira
 * primero y no existía en ninguna parte de la app. Que sean cinco y no seis es
 * la regla: si aparece otro, es porque alguien empezó a agregar cosas, y cada
 * número tiene que decir SU valor, no un ícono.
 *
 * El inspector es lo que hay adentro de UNA rama y qué se puede hacer SOLO ahí.
 * Y la parte que se prueba más fuerte es la del alcance: "Reordenar" en un
 * índice jerárquico sin decir a qué aplica es una amenaza, y una acción que dice
 * "esta rama" y toca las hermanas es peor que una que no existiera.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  PulsoDocumento,
  pulsoDe,
  celdasDelPulso,
} from '../components/structure/PulsoDocumento';
import {
  InspectorRama,
  ACCIONES,
  alcanceDe,
  moverRama,
  preguntasDeIa,
  preguntaDeIa,
} from '../components/structure/InspectorRama';
import { construirJerarquia } from '../lib/jerarquia';
import { useDocStore } from '../store/useDocStore';
import type { ElementModel } from '../types';
import type { AuditItem } from '../lib/auditItems';

let secuencia = 0;
const el = (o: Partial<ElementModel> & { type: ElementModel['type']; text: string }): ElementModel =>
  ({
    id: `e${++secuencia}`,
    style_name: '',
    alignment: 'left',
    font_name: 'Times New Roman',
    font_size: 12,
    is_bold: false,
    is_italic: false,
    is_bullet: false,
    left_indent_cm: 0,
    confidence: 1,
    is_user_modified: false,
    cita_ids: [],
    needs_review: false,
    auto_applied: false,
    ...o,
  }) as ElementModel;

const h1 = (titulo: string): ElementModel => el({ type: 'heading', heading_level: 1, text: titulo });
const h2 = (titulo: string): ElementModel => el({ type: 'heading', heading_level: 2, text: titulo });
const parrafo = (texto: string): ElementModel => el({ type: 'paragraph', text: texto });
const palabras = (n: number): string => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

const titulos = (ts: string[]): ElementModel[] => ts.map(h1);

const hallazgo = (over: Partial<AuditItem> & { id: string }): AuditItem =>
  ({
    element_id: 'e0',
    category: 'citations',
    subtype: 'referencia_huerfana',
    severity: 'warn',
    summary: '',
    detail: '',
    originalText: '',
    pageNumber: null,
    phase: null,
    readOnly: false,
    ...over,
  }) as AuditItem;

describe('el pulso del documento', () => {
  it('son cinco números y nada más', () => {
    /* Si aparecen más, es porque alguien empezó a agregar cosas. Y cada número
     * tiene que decir SU valor: un número sin nombre es un número que nadie
     * sabe qué medir. */
    expect(celdasDelPulso(pulsoDe(titulos(['1. Introducción', '2. Metodología'])))).toHaveLength(5);
  });

  it('cada celda dice su nombre Y su valor', () => {
    const celdas = celdasDelPulso(pulsoDe([h1('1. Introducción'), parrafo(palabras(12000))]));
    expect(celdas.map((c) => c.nombre)).toEqual([
      'Palabras',
      'Balance',
      'Fases que faltan',
      'Figuras sin leyenda',
      'Referencias sin citar',
    ]);
    expect(celdas[0].valor).toContain('12.000');
  });

  it('el balance de un documento de un solo capítulo es null, no 100%', () => {
    /* Una rampa comparativa sin hermanas no significa nada, y un 100 % parece una
     * nota. `null` es un estado de primera clase, no cero. */
    expect(pulsoDe(titulos(['1. Introducción'])).balance).toBeNull();
    expect(pulsoDe(titulos(['1. Introducción', '2. Metodología'])).balance).not.toBeNull();
  });

  it('el balance es la rama más corta contra la más larga', () => {
    /* 80 contra 12.000 es un problema de redacción que solo aparece cuando las
     * dos están en la misma escala. El pulso lo dice con un número. */
    const p = pulsoDe([
      h1('1. Introducción'),
      parrafo(palabras(12000)),
      h1('2. Metodología'),
      parrafo(palabras(80)),
    ]);
    expect(p.balance).toBeLessThan(2);
  });

  it('las figuras sin leyenda se CUENTAN, no se estiman', () => {
    const conFigura = el({
      type: 'image',
      text: 'Figura 1',
      image_info: { element_id: 'x', file_path: 'a.png', filename: 'a.png', caption: '' } as never,
    });
    const conLeyenda = el({
      type: 'image',
      text: 'Figura 2',
      image_info: { element_id: 'y', file_path: 'b.png', filename: 'b.png', caption: 'Figura 2. El proceso' } as never,
    });
    expect(pulsoDe([h1('1. Metodología'), conFigura, conLeyenda]).figurasSinLeyenda).toBe(1);
  });

  it('las referencias sin citar salen de la MISMA lista de hallazgos', () => {
    /* La lista es la que abre el workbench y la que cuenta el rail. Un segundo
     * conteo de referencias es la forma de que el pulso diga 2 y la revisión
     * diga 3, que es exactamente lo que `railPending.ts` existe para impedir. */
    const hallazgos = [hallazgo({ id: 'r1' }), hallazgo({ id: 'r2' })];
    expect(pulsoDe([h1('1. Metodología')], [], hallazgos).referenciasNoCitadas).toBe(2);
  });

  it('las fases que faltan vienen de la lista que trae quien la tiene', () => {
    /* Sin la lista, cero fases que faltan: la ausencia del dato no es evidencia
     * de que falten veinte capítulos. Y con la lista, solo las que de verdad no
     * están, por su NOMBRE y no por su clave. Se usa "Discusión" y no
     * "Metodología" porque el espejo local de rótulos no trae el alias, y eso
     * está declarado en `jerarquia.test.ts`: el hueco es del vocabulario, no de
     * esta cuenta. */
    const p = pulsoDe([h1('1. Introducción'), h1('2. Discusión')], ['introduccion', 'discusion', 'resultados']);
    expect(p.fasesQueFaltan).toHaveLength(1);
    expect(p.fasesQueFaltan[0]).toMatch(/Resultado/i);
  });

  it('sin lista de requeridas, el pulso no inventa fases que faltan', () => {
    expect(pulsoDe([h1('1. Introducción')]).fasesQueFaltan).toEqual([]);
  });

  it('dibujado, el pulso muestra las cinco celdas y el balance ausente se dice', () => {
    render(<PulsoDocumento elementos={[h1('1. Introducción'), parrafo(palabras(400))]} />);
    expect(screen.getByText('Palabras')).toBeTruthy();
    expect(screen.getByText(/no hay con qué comparar/i)).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });
});

describe('el inspector de rama', () => {
  const DOC: ElementModel[] = [
    h1('1. Introducción'),
    parrafo('uno'),
    h1('2. Metodología'),
    h2('2.1 Instrumentos'),
    parrafo('dos'),
    parrafo('tres'),
    h1('3. Resultados'),
    parrafo('cuatro'),
  ];
  const ARBOL = construirJerarquia(DOC);
  const METODO = ARBOL[1];

  it('cada acción dice a qué alcance aplica', () => {
    expect(alcanceDe('reordenar')).toBe('esta-rama');
    expect(alcanceDe('promover')).toBe('esta-rama');
    expect(alcanceDe('renombrar')).toBe('esta-rama');
    expect(alcanceDe('consultar-ia')).toBe('esta-rama');
    /* Y el alcance está DECLARADO, no supuesto: si mañana aparece una acción
     * de documento, esta tabla es la que la vuelve visible. */
    expect(ACCIONES.every((a) => a.alcance === 'esta-rama')).toBe(true);
  });

  it('el alcance se ve en la pantalla, no solo en el código', () => {
    /* Un alcance que solo existe en el código no evita la amenaza: la amenaza es
     * de la persona que no lee el código. */
    render(<InspectorRama nodo={METODO} elementos={DOC} />);
    for (const accion of ACCIONES) {
      expect(screen.getAllByText(new RegExp(accion.etiquetaAlcance, 'i')).length).toBeGreaterThan(0);
    }
  });

  it('una acción de rama mueve la rama ENTERA y no toca el contenido de las hermanas', () => {
    /* "Reordenar" sin alcance declarado es una amenaza. Y si dice "esta rama" y
     * cambia el texto o el contenido de las hermanas, es peor que si no
     * existiera: por eso la prueba mira que las hermanas conservan su contenido
     * Y su orden relativo, y que la rama movida se lleva sus tres elementos. */
    const antes = moverRama(METODO, DOC, 'abajo');
    expect(antes).not.toBeNull();
    const nuevo = antes!;
    const tituloEn = (orden: string[]): string[] =>
      orden
        .map((id) => DOC.find((e) => e.id === id)!)
        .filter((e) => e.type === 'heading' && (e.heading_level ?? 1) === 1)
        .map((e) => e.text);
    expect(tituloEn(nuevo)).toEqual(['1. Introducción', '3. Resultados', '2. Metodología']);
    /* La rama movida conserva su contenido, íntegro y en orden. */
    const textos = (orden: string[]): string[] =>
      orden.map((id) => DOC.find((e) => e.id === id)!.text);
    expect(textos(nuevo)).toHaveLength(DOC.length);
    expect(textos(nuevo).filter((t) => t === 'dos' || t === 'tres')).toEqual(['dos', 'tres']);
    expect(textos(nuevo).filter((t) => t === 'uno')).toEqual(['uno']);
    expect(textos(nuevo).filter((t) => t === 'cuatro')).toEqual(['cuatro']);
  });

  it('una rama que ya está al borde no se mueve, y lo dice con null', () => {
    /* Un botón de "subir" en la primera rama es un botón que no hace nada. */
    expect(moverRama(ARBOL[0], DOC, 'arriba')).toBeNull();
    expect(moverRama(ARBOL[2], DOC, 'abajo')).toBeNull();
    expect(moverRama(ARBOL[0], DOC, 'abajo')).not.toBeNull();
  });

  it('preguntarle a la IA dice sobre qué rama pregunta', () => {
    expect(preguntaDeIa(METODO)).toContain('Metodología');
    /* Y la pregunta dice qué hay adentro: una pregunta sin el contenido de la
     * rama es una pregunta sobre el título. */
    expect(preguntasDeIa(METODO, DOC)).toContain('dos');
  });

  it('preguntar a la IA llama al backend de verdad, con la rama como contexto', () => {
    const consultar = vi.fn();
    render(<InspectorRama nodo={METODO} elementos={DOC} onConsultarIa={consultar} />);
    fireEvent.click(screen.getByRole('button', { name: /preguntarle a la IA/i }));
    expect(consultar).toHaveBeenCalledTimes(1);
    expect(consultar.mock.calls[0][1]).toContain('Metodología');
  });

  it('promover llama al store con el nivel nuevo, y renombrar con el texto nuevo', () => {
    const promover = vi.fn();
    const renombrar = vi.fn();
    render(
      <InspectorRama
        nodo={METODO.hijos[0]}
        elementos={DOC}
        onPromover={promover}
        onRenombrar={renombrar}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /promover/i }));
    expect(promover).toHaveBeenCalledWith(METODO.hijos[0]);
    expect(promover.mock.calls[0][0].titulo).toBe('2.1 Instrumentos');
  });

  it('sin la acción que no existe, NO hay botón: la lista es la que se puede hacer', () => {
    /* Nada de esta lista es un botón mudo: promover va a `updateElementType`,
     * renombrar a `updateElementText`, reordenar a `reorder-elements` y la
     * consulta al copiloto. Lo que no tiene endpoint no entra en la lista. */
    const spias = ACCIONES.map(() => vi.fn());
    render(
      <InspectorRama
        nodo={METODO}
        elementos={DOC}
        onPromover={spias[0]}
        onRenombrar={spias[1]}
        onReordenar={spias[2]}
        onConsultarIa={spias[3]}
      />,
    );
    expect(ACCIONES.map((a) => a.clave)).toEqual(['promover', 'reordenar', 'renombrar', 'consultar-ia']);
    expect(screen.getByRole('button', { name: /^Subir/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Bajar/i })).toBeTruthy();
  });

  it('la rama se PINTA: sus párrafos, sus figuras y sus citas', () => {
    render(<InspectorRama nodo={METODO} elementos={DOC} />);
    expect(screen.getByText('dos')).toBeTruthy();
    expect(screen.getByText('tres')).toBeTruthy();
    expect(screen.getByText(/2 palabras/i)).toBeTruthy();
  });

  it('una rama sin contenido lo dice, y no muestra una lista vacía', () => {
    const vacia = construirJerarquia([h1('1. Introducción'), h1('2. Metodología')]);
    render(<InspectorRama nodo={vacia[1]} elementos={[h1('1. Introducción'), h1('2. Metodología')]} />);
    expect(screen.getByText(/sin contenido/i)).toBeTruthy();
  });
});

/**
 * El índice de estructura: un documento de trabajo, no un árbol de navegación.
 *
 * Lo que se verifica acá no es la forma del componente sino lo que el índice
 * AFIRMA, porque las tres afirmaciones son las que un índice sin diagnóstico
 * no puede hacer:
 *
 *   1. cuántas palabras tiene cada rama, y eso incluye lo que tiene debajo;
 *   2. cómo se mide esa rama CONTRA SUS HERMANAS, y qué pasa cuando no hay
 *      con qué compararla —que es un estado, no un 100 %;
 *   3. por qué un nodo está en el estado en que está, dicho en palabras.
 *
 * Y una cuarta, que es la que reportó el usuario: el documento entero NO es el
 * centro. Es un toggle, apagado por omisión.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  IndiceEstructura,
  captionDe,
  saludDe,
  diagnosticoDe,
  balanceDe,
  motivoDe,
  porDefectoSeVeElDocumento,
  VISIBLE_POR_DEFECTO,
  filasDelIndice,
} from '../components/structure/IndiceEstructura';
import { construirJerarquia, type NodoJerarquia } from '../lib/jerarquia';
import type { ElementModel } from '../types';

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

const h1 = (titulo: string): ElementModel =>
  el({ type: 'heading', heading_level: 1, text: titulo });
const h2 = (titulo: string): ElementModel =>
  el({ type: 'heading', heading_level: 2, text: titulo });
const parrafo = (palabras: number): ElementModel =>
  el({ type: 'paragraph', text: Array.from({ length: palabras }, (_, i) => `w${i}`).join(' ') });
const figura = (): ElementModel => el({ type: 'image', text: 'Figura 1' });
const cita = (): ElementModel => el({ type: 'paragraph', text: 'texto', cita_ids: ['c1'] });

/* Un árbol de dos capítulos, uno enorme y otro mínimo: el caso del Review
 * Focus #3, que es el problema que el índice tiene que volver visible. */
const DESBALANCEADO = construirJerarquia([
  h1('1. Introducción'),
  parrafo(12000),
  h1('2. Metodología'),
  parrafo(80),
]);

const SIN_HERMANAS = construirJerarquia([h1('1. Introducción'), parrafo(500)]);
const VACIO = construirJerarquia([h1('1. Introducción'), h1('2. Metodología')]);
const CON_H2_SOSPECHOSO = construirJerarquia([
  h1('1. Metodología'),
  h2('1.1 Resultados'),
  parrafo(300),
]);
const CON_H2_ESPECIFICO = construirJerarquia([
  h1('1. Metodología'),
  h2('1.1 Resultados de la encuesta'),
  parrafo(300),
]);
const CON_FIGURAS = construirJerarquia([
  h1('1. Metodología'),
  parrafo(300),
  figura(),
  cita(),
]);

describe('cada nodo dice cuántas palabras tiene', () => {
  it('la fila imprime el número de la rama, no el del párrafo', () => {
    /* Un resumen de la rama que no incluye lo que tiene debajo es el resumen de
     * otra rama. La palabra "ramas" del índice ES la fila del capítulo, y tiene
     * que ser la misma cuenta que la del árbol. */
    const n = DESBALANCEADO[0];
    expect(n.palabras).toBe(12000);
    expect(captionDe(n)).toContain('12.000');
  });

  it('las palabras suben desde los nietos', () => {
    const arbol = construirJerarquia([
      h1('1. Metodología'),
      h2('1.1 Instrumentos'),
      parrafo(10),
      h2('1.2 Muestra'),
      parrafo(20),
    ]);
    expect(arbol[0].palabras).toBe(30);
    expect(captionDe(arbol[0])).toContain('30');
  });

  it('un número grande se separa, porque 12000 se lee como una cifra sin fin', () => {
    expect(captionDe(DESBALANCEADO[0])).toContain('12.000');
    expect(captionDe(DESBALANCEADO[1])).toContain('80');
  });

  it('el título se conserva entero, con su numeración y sus acentos', () => {
    const arbol = construirJerarquia([h1('1. Marco de la encuesta en el norte'), parrafo(50)]);
    expect(arbol[0].titulo).toBe('1. Marco de la encuesta en el norte');
  });
});

describe('el balance se mide contra las hermanas, no en absoluto', () => {
  it('con imbalance real, la barra pone a las dos en la misma escala', () => {
    /* 12.000 contra 80 tiene que ser visible con un NÚMERO, no con una
     * intuición: hoy no se ve en ninguna parte de la app. Y la escala es la de
     * la hermana más larga, para que la barra de la corta sea, de verdad,
     * corta. */
    const b = balanceDe(DESBALANCEADO);
    expect(b).not.toBeNull();
    expect(b!.mayor).toBe(12000);
    expect(b!.porcentajes[0]).toBe(100);
    expect(b!.porcentajes[1]).toBeLessThan(2);
    expect(motivoDe(DESBALANCEADO[1], b)).toContain('12.000');
  });

  it('con una sola hermana NO hay balance, y la fila lo dice', () => {
    /* Una rampa comparativa sin hermanas no significa nada: no hay ni un 100 %
     * que pueda ser una nota ni un 0 % que pueda ser un problema. Por eso es
     * `null`, un estado de primera clase, y no cero. */
    const b = balanceDe(SIN_HERMANAS);
    expect(b).toBeNull();
    expect(motivoDe(SIN_HERMANAS[0], b)).toMatch(/no hay con qu/i);
  });

  it('el índice NO renderiza la barra de balance sin al menos dos hermanas', () => {
    /* Un 100 % solo es un bug esperando: parece una nota, y no lo es. La regla
     * se mira en las filas, que es donde la barra se decide. */
    const conHermanas = filasDelIndice(DESBALANCEADO);
    expect(conHermanas.every((f) => f.diagnostico.balance !== null)).toBe(true);
    const sola = filasDelIndice(SIN_HERMANAS);
    expect(sola.every((f) => f.diagnostico.balance === null)).toBe(true);
  });

  it('las hermanas se comparan ENTRE SÍ, no contra el capítulo padre', () => {
    /* Un H2 y un H3 que cuelgan del mismo H1 son las dos ramas que se
     * comparan. Comparar cada hijo contra su padre marcaría como desbalanceado
     * un resumen de un párrafo, que es lo normal en un documento bien escrito. */
    const arbol = construirJerarquia([
      h1('1. Metodología'),
      parrafo(1000),
      h2('1.1 Instrumentos'),
      parrafo(400),
      h2('1.2 Muestra'),
      parrafo(500),
    ]);
    const filas = filasDelIndice(arbol);
    const cap = filas.find((f) => f.nodo.nivel === 1)!;
    const hijos = filas.filter((f) => f.nodo.nivel === 2);
    expect(cap.diagnostico.balance).toBeNull();
    for (const h of hijos) expect(h.diagnostico.salud).toBe('completa');
  });
});

describe('el estado de salud sale de reglas, no de heurísticas', () => {
  it('un capítulo sin contenido se DICE, no se muestra como vacío', () => {
    /* Un nodo con 0 palabras es un capítulo que existe y no está escrito. La
     * fila vacía no lo dice: se lee como un error de la vista. */
    expect(saludDe(VACIO[1])).toBe('sin-contenido');
    expect(captionDe(VACIO[1])).toMatch(/sin contenido/i);
  });

  it('un H2 que dice "Resultados" a secas está en duda, y el motivo lo nombra', () => {
    /* La regla es `match_phase_exact`: un encabezado de nivel 2 o más cuyo
     * título ES el nombre de una fase es una fase mal puesta. El motivo lleva
     * el título real, para que la persona vea cuál. */
    expect(saludDe(CON_H2_SOSPECHOSO[0])).toBe('en-duda');
    expect(diagnosticoDe(CON_H2_SOSPECHOSO[0]).motivo).toContain('Resultados');
    expect(diagnosticoDe(CON_H2_SOSPECHOSO[0]).tituloEnDuda).toBe('1.1 Resultados');
  });

  it('un H2 con calificador NO está en duda', () => {
    /* "Resultados de la encuesta" lleva un calificador que avisa de que el
     * autor quiso decir algo concreto. Un motor que marcara los dos sería
     * peor que uno que no marcara ninguno. */
    expect(saludDe(CON_H2_ESPECIFICO[0])).not.toBe('en-duda');
    expect(diagnosticoDe(CON_H2_ESPECIFICO[0]).tituloEnDuda).toBeNull();
  });

  it('una hermana muy corta marca desbalanceada, con el número en el motivo', () => {
    /* El motivo es un número, no un punto de color: "1 % de la rama hermana más
     * larga" se puede discutir; un punto rojo, no. */
    const b = balanceDe(DESBALANCEADO);
    expect(saludDe(DESBALANCEADO[1], b)).toBe('desbalanceada');
    expect(diagnosticoDe(DESBALANCEADO[1], b).motivo).toMatch(/\d/);
  });

  it('el ámbito NO se decide mirando el cuerpo de un párrafo', () => {
    /* `AGENTS.md` §1 prohíbe buscar palabras en el texto del cuerpo: es lo que
     * hizo que "meta" disparara la regla de objetivos dentro de "metodología".
     * Acá la salud sale de `faseDeTitulo` sobre el TÍTULO, en modo estricto. */
    const arbol = construirJerarquia([
      h1('1. Introducción'),
      el({ type: 'paragraph', text: 'La metodología se aplicó a 40 personas del universo' }),
    ]);
    expect(arbol[0].fase).toBe('introduccion');
    expect(saludDe(arbol[0])).toBe('completa');
  });

  it('el nodo sano se dice completo, y no es una ausencia de estado', () => {
    expect(saludDe(CON_FIGURAS[0])).toBe('completa');
    expect(diagnosticoDe(CON_FIGURAS[0]).motivo).toBe('Completa');
  });

  it('las figuras y las citas cuelgan de su rama, en la fila', () => {
    const d = diagnosticoDe(CON_FIGURAS[0]);
    expect(CON_FIGURAS[0].figuras).toBe(1);
    expect(CON_FIGURAS[0].citas).toBe(1);
    expect(d.balance).toBeNull();
  });
});

describe('el documento entero no es el centro', () => {
  it('por defecto NO se ve el documento vomitado', () => {
    /* El defecto reportado: el centro era el archivo entero. Eso es un toggle,
     * y un toggle apagado por omisión es una decisión que alguien tomó; uno
     * encendido por omisión es un forgot que nadie revisó. */
    expect(porDefectoSeVeElDocumento()).toBe(false);
    expect(VISIBLE_POR_DEFECTO).toBe(false);
  });

  it('montado, el documento NO está en el árbol hasta que se lo prende', () => {
    const documento = (
      <>
        <h1>1. Introducción</h1>
        <p>{parrafo(12000).text}</p>
      </>
    );
    const { container } = render(
      <IndiceEstructura
        elementos={[h1('1. Introducción'), parrafo(12000), h1('2. Metodología'), parrafo(80)]}
        documento={documento}
      />,
    );
    expect(container.querySelector('[data-testid="documento-completo"]')).toBeNull();
    /* Y el índice sí está: el centro es la estructura, no el archivo. */
    expect(screen.getByText('1. Introducción')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /ver el documento/i }));
    expect(container.querySelector('[data-testid="documento-completo"]')).not.toBeNull();
    /* Y al volver, el documento se esconde: el toggle es un toggle. */
    fireEvent.click(screen.getByRole('button', { name: /ver la estructura/i }));
    expect(container.querySelector('[data-testid="documento-completo"]')).toBeNull();
  });
});

describe('el índice dibujado', () => {
  it('una fila por encabezado, con el nivel y el nombre a la vista', () => {
    render(
      <IndiceEstructura
        elementos={[
          h1('1. Introducción'),
          parrafo(12000),
          h1('2. Metodología'),
          h2('2.1 Instrumentos'),
          parrafo(80),
        ]}
      />,
    );
    const filas = screen.getAllByRole('listitem');
    /* Los tres encabezados del documento son tres filas, y el H2 cuelga del H2
     * sin volverse un capítulo: es lo mismo que usa todo el producto. */
    expect(filas.length).toBe(3);
    expect(screen.getAllByText('H1').length).toBe(2);
    expect(screen.getByText('H2')).toBeTruthy();
    expect(screen.getByText('1. Introducción')).toBeTruthy();
  });

  it('el número de la rama está en pantalla, con los miles separados', () => {
    render(<IndiceEstructura elementos={[h1('1. Introducción'), parrafo(12000)]} />);
    expect(screen.getByText(/12\.000/)).toBeTruthy();
  });

  it('el motivo del estado se DICE en la fila, no es un punto de color', () => {
    /* Aparece en las DOS filas y no es una repetición: la del capítulo dice qué
     * le pasa a su rama, y la del H2 dice qué le pasa a ÉL, que es la fila que
     * hay que corregir. Un solo aviso obligaría a adivinar cuál de las dos. */
    render(<IndiceEstructura elementos={[h1('1. Metodología'), h2('1.1 Resultados'), parrafo(300)]} />);
    const motivos = screen.getAllByText(/En duda: el encabezado dice/i);
    expect(motivos.length).toBe(2);
    expect(motivos[0].textContent).toContain('1.1 Resultados');
  });

  it('con una sola rama, la fila dice que no hay con qué comparar', () => {
    render(<IndiceEstructura elementos={[h1('1. Introducción'), parrafo(500)]} />);
    expect(screen.getByText('sin comparar')).toBeTruthy();
  });

  it('sin documento, el hueco se dice', () => {
    render(<IndiceEstructura elementos={null} />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('un documento sin encabezados lo dice, y no muestra una lista vacía', () => {
    render(<IndiceEstructura elementos={[parrafo(300), parrafo(200)]} />);
    expect(screen.getByText(/no tiene encabezados/i)).toBeTruthy();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});

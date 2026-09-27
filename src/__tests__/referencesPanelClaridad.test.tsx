/**
 * El panel de referencias tiene que servir para UNA cosa: sacar la bibliografía.
 *
 * El diagnóstico del usuario fue que el panel "pide demasiadas cosas" y que lo
 * primero que ve es la operación más cara. Mirando el componente, tenía razón en
 * las dos cosas y por razones concretas:
 *
 *  - "Auto-resolver citas con IA" era el botón más grande, arriba de todo y con
 *    el color de acento. Es la operación más lenta, la que más chances tiene de
 *    fallar, y la que casi nadie necesita. Lo primero que se ve era lo peor.
 *  - Tres acciones para un solo trabajo: auto-resolver, resolver DOI, y añadir
 *    a mano. El 90% de los casos es pegar un bloque y listo.
 *  - La tarjeta de Validación, con dos números grandes, estaba ENTRE el campo y
 *    la lista: el entregable quedaba debajo de un diagnóstico que nadie pidió.
 *  - Y la fila de cada referencia se COMPONÍA en el render
 *    (`authors.join(', ')} ({year}). {title}. {source}`) en vez de mostrar el
 *    `formatted_apa` que es lo que realmente va al documento. Eso es lo peor de
 *    todo: lo que el usuario lee no es lo que el documento recibe.
 *
 * Estos tests fijan la jerarquía, no los colores.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ReferencesPanel } from '../components/referencias/ReferencesPanel';
import { useDocStore } from '../store/useDocStore';

const addReference = vi.fn();
const showToast = vi.fn();
const resolveDoisBlock = vi.fn().mockResolvedValue(undefined);
const resolveDoiReference = vi.fn().mockResolvedValue(undefined);
const resolveGhostCitation = vi.fn().mockResolvedValue(undefined);
const autoResolveAllGhostCitations = vi.fn().mockResolvedValue(undefined);
const runCitationAudit = vi.fn().mockResolvedValue(undefined);
const removeReference = vi.fn();

const REF = {
  id: 'r1',
  authors: ['Pérez, A.'],
  year: '2020',
  title: 'Un título',
  source: 'Una revista',
  doi_or_url: '10.1000/a',
  raw_text: 'Pérez, A. (2020). Un título. Una revista. https://doi.org/10.1000/a',
  formatted_apa: 'Pérez, A. (2020). Un título. Una revista. https://doi.org/10.1000/a',
};

function montar(references: any[] = []) {
  useDocStore.setState({
    references,
    isLoading: false,
    addReference,
    showToast,
    resolveDoisBlock,
    resolveDoiReference,
    resolveGhostCitation,
    autoResolveAllGhostCitations,
    runCitationAudit,
    removeReference,
  } as never);
  return render(<ReferencesPanel />);
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveDoisBlock.mockResolvedValue(undefined);
});

/* ── Una acción, no tres ──────────────────────────────────────────────────── */

describe('el panel pide una cosa', () => {
  it('la acción de acento —la que el usuario ve primero— es la de pegar y resolver', () => {
    /* La jerarquía se mide por el único canal que el usuario no tiene que
       interpretar: el botón relleno con el color de acento. Antes había dos, y
       el que ganaba era el auto-resolve con IA. */
    const { container } = montar();
    const rellenos = container.querySelectorAll('[data-accion="principal"]');
    expect(rellenos).toHaveLength(1);
    expect(within(rellenos[0] as HTMLElement).getByRole('button').textContent || '')
      .toMatch(/resolver/i);
  });

  it('el auto-resolve con IA no está relleno: es una acción secundaria', () => {
    const { container } = montar();
    const auto = screen.getByRole('button', { name: /auto|ia/i });
    expect(auto.getAttribute('data-accion')).not.toBe('principal');
    expect(container.querySelectorAll('[data-accion="principal"]').length).toBe(1);
  });

  it('la acción secundaria sigue ahí: ocultarla sería quitar una capacidad', () => {
    montar();
    expect(screen.getByRole('button', { name: /auto|ia/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /manual|a mano/i })).toBeTruthy();
  });
});

/* ── La fila muestra lo que va al documento ────────────────────────────────── */

describe('la fila de una referencia', () => {
  it('muestra el texto APA que va al documento, no uno compuesto en el render', () => {
    /* El bug más caro de los tres: el render componía
       `authors (year). title. source` y lo mostraba como si fuera la referencia.
       Si el backend ya trae `formatted_apa` —y lo trae, es lo que escribe en el
       .docx— el panel tiene que mostrar ESO. Un usuario que lee una cosa y
       recibe otra es un usuario que va a descubrirlo en la entrega. */
    montar([{ ...REF, formatted_apa: 'Perez, A. (2020). Uno. Revista. https://doi.org/10.1000/x' }]);
    const fila = screen.getByText(/Perez, A\. \(2020\)\. Uno\./);
    expect(fila).toBeTruthy();
  });

  it('no inventa el texto cuando el backend no trae ninguno', () => {
    /* Sin `formatted_apa` se cae a `raw_text`; si tampoco hay, se muestra lo que
       hay —nada de "Autor (s.f.)"— porque inventar la autoria de una obra es
       peor que no mostrarla. */
    montar([{ id: 'r9', authors: [], year: '', title: '', source: '', raw_text: 'Texto tal cual.', formatted_apa: '' }]);
    expect(screen.getByText(/Texto tal cual\./)).toBeTruthy();
    expect(screen.queryByText(/\(s\.f\.\)/)).toBeNull();
  });

  it('los campos exactos no están hasta que se piden', () => {
    /* Autores, año y DOI están para quien verifica, no para quien lee. Viven
       detrás de un click. Ojo: el DOI aparece en la línea APA, que es
       correcto —va al documento— así que lo que se mira es la ETIQUETA del
       campo, que solo existe en el detalle. */
    montar([REF]);
    expect(screen.queryByText(/^Autores:/)).toBeNull();
    expect(screen.queryByText(/^Año:/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /ver campos/i }));
    expect(screen.getByText(/^Autores:/)).toBeTruthy();
    expect(screen.getByText(/^Año:/)).toBeTruthy();
  });

  it('una referencia sin autor se ve, no desaparece detrás de un contador', () => {
    /* La primera versión de este arreglo las separaba con una línea que decía
       "3 sin autor" y no las pintaba. Eso es el error que se estaba corrigiendo
       —esconder al lado de donde hay que mirarlo— mudado de lugar: el usuario
       ve que hay tres referencias y no encuentra ninguna. */
    montar([REF, { id: 'r9', authors: [], year: '', title: '', source: '', raw_text: 'Entrada sin autor.', formatted_apa: 'Entrada sin autor.' }]);
    expect(screen.getByText(/Entrada sin autor\./)).toBeTruthy();
  });
});

/* ── La etiqueta de estado ─────────────────────────────────────────────────── */

describe('cada referencia dice de dónde salió', () => {
  it('una referencia resuelta contra una fuente dice "Verificada"', () => {
    montar([{ ...REF, verificada: true }]);
    expect(screen.getByText(/verificada/i)).toBeTruthy();
  });

  it('una referencia que nadie contrastó dice "Sin verificar"', () => {
    /* El caso real: una tesis que ya venía con su bibliografía escrita. Nadie
       la contrastó contra ninguna fuente, y el panel no puede fingir lo
       contrario. El valor por defecto de `verificada` es `false` justamente por
       esto. */
    montar([REF]);
    expect(screen.getByText(/sin verificar/i)).toBeTruthy();
    expect(screen.queryByText(/^verificada$/i)).toBeNull();
  });

  it('la etiqueta es una palabra, no un panel de campos', () => {
    montar([{ ...REF, verificada: true }]);
    const etiqueta = screen.getByText(/verificada/i);
    expect(etiqueta.textContent?.trim().split(/\s+/).length).toBeLessThanOrEqual(2);
  });
});

/* ── La validación no ocupa el centro ──────────────────────────────────────── */

describe('la validación no está en el centro del panel', () => {
  const auditoria = {
    ghost_citations: ['Fantasma, X. (2018)'],
    orphan_references: [],
  };

  it('sin problema, no hay dos números grandes en pantalla', () => {
    /* "Citas sin referencia: 0 / Refs sin cita: 0" es un tablero para cuando hay
       un problema. Con todo en cero solo ocupa lugar y empuja el entregable
       hacia abajo. */
    montar([REF]);
    expect(screen.queryByText(/refs sin cita/i)).toBeNull();
    expect(screen.queryByText(/citas sin referencia/i)).toBeNull();
  });

  it('con problema, aparece una línea y no un tablero', () => {
    montar([REF]);
    useDocStore.setState({ citationAuditResult: auditoria } as never);
    const { container } = render(<ReferencesPanel />);
    /* `getAllByText` y no `getByText`: `QuickReferenceSearch` también nombra las
       citas sin referencia, y lo que se comprueba es que el PANEL tenga una
       línea con el número, no que sea el único sitio que la nombre. */
    expect(screen.getAllByText(/1 cita sin referencia/).length).toBeGreaterThan(0);
    /* Una línea: los dos contadores grandes no están, hay una sola frase. */
    expect(screen.queryByText(/refs sin cita/i)).toBeNull();
    expect(container.querySelectorAll('[data-panel="tablero"]').length).toBe(0);
  });

  it('la lista de referencias sigue estando aunque haya un problema', () => {
    /* El entregable no se esconde detrás del diagnóstico. Antes la tarjeta de
       Validación estaba entre el campo y la lista. */
    montar([REF]);
    useDocStore.setState({ citationAuditResult: auditoria } as never);
    render(<ReferencesPanel />);
    expect(screen.getAllByText(/Pérez, A\. \(2020\)\. Un título\./).length).toBeGreaterThan(0);
  });
});

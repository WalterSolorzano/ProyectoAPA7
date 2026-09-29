/**
 * EL PASO 4 DICE LA VERDAD, O NO DICE NADA.
 *
 * Estas pruebas fijan tres cosas que la pantalla hoy hace al revés, y las tres
 * son del mismo tipo de defecto: la pantalla afirma algo que no sabe.
 *
 *  1. EL ESTADO DE LA REFERENCIA. El chip decía "Válidas · DOI verificado OK"
 *     para un grupo que solo miraba que la referencia tuviera autor y un título
 *     de más de cinco caracteres. Nadie contrastaba esas referencias contra
 *     nada. Con la corrección, el chip sale de `diagnosticoDeReferencia` y
 *     `verificada` —el dato que un resolutor real pone—, y cuando el estado es
 *     "sin verificar" la pantalla dice POR QUÉ en vez de fingir que está bien.
 *
 *  2. `null` NO ES `false`. La versión vieja pintaba "Sin citar en texto" a todo
 *     lo que no encontraba, y `isOrphan` comparaba
 *     `s.includes(authors?.[0] || '---')`: con autores vacíos el operando
 *     derecho era la cadena `'---'`, y con autores presentes comparaba el
 *     NOMBRE COMPLETO del autor contra el texto, donde lo que está es el
 *     apellido. Antes de que corra la auditoría no se sabe si una referencia
 *     está citada, y decir "no está citada" cuando nadie miró es una
 *     afirmación sin dato.
 *
 *  3. LA VISTA PREVIA COMPOSA MENTIRAS. Pintaba
 *     `authors (year). title. source` armándolo en el render, mientras lo que
 *     va al documento es `formatted_apa`: con la elipsis de APA 7 de 21+ autores
 *     y el DOI normalizado, que sólo arma el backend. Lo que la persona lee no
 *     era lo que el documento recibía.
 *
 * Lo que NO se prueba acá, a propósito: los colores. Los tonos salen de tokens
 * y `TONO_DE_ESTADO`, y hay una prueba de R3 que lo cobra.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { Step5ReferencesWizard } from '../components/wizard/Step5ReferencesWizard';
import { useDocStore } from '../store/useDocStore';

const runCitationAudit = vi.fn();
const addReference = vi.fn();
const removeReference = vi.fn();
const updateReferences = vi.fn();
const resolveDoiReference = vi.fn().mockResolvedValue(undefined);
const resolveGhostCitation = vi.fn().mockResolvedValue(undefined);
const showToast = vi.fn();

const REF = {
  id: 'r1',
  authors: ['García, A.'],
  year: '2021',
  title: 'Análisis de metodologías',
  source: 'Revista X',
  formatted_apa: 'García, A. (2021). Análisis de metodologías. Revista X.',
  raw_text: '',
  verificada: true,
};

/** Un documento con un párrafo que cita a García. Sin documento, la pantalla no
 *  tiene nada que mostrar y los vacíos cambian de motivo. */
const DOC = {
  id: 'd1',
  name: 'tesis.docx',
  elements: [
    { id: 'p1', type: 'paragraph', text: 'Garcia (2021) lo demonstró en su trabajo' },
  ],
} as never;

function montar(
  references: unknown[],
  selectedId: string | null = 'r1',
  auditoria: unknown = null,
  doc: unknown = DOC,
) {
  useDocStore.setState({
    references,
    selectedReferenceId: selectedId,
    citationAuditResult: auditoria,
    doc,
    isLoading: false,
    addReference,
    removeReference,
    updateReferences,
    resolveDoiReference,
    runCitationAudit,
    resolveGhostCitation,
    showToast,
    setSelectedElementId: vi.fn(),
    setScrollTargetId: vi.fn(),
    setSelectedReferenceId: vi.fn(),
    setWizardStep: vi.fn(),
  } as never);
  return render(<Step5ReferencesWizard />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ── El chip sale del dato, no de una cuenta de autores ────────────────────── */

describe('el estado de la referencia seleccionada', () => {
  it('una referencia verificada se rotula Verificada', () => {
    montar([REF]);
    expect(within(screen.getByTestId('estado-referencia')).getByText('Verificada')).toBeTruthy();
  });

  /* El defecto medido: el grupo decía "Válidas · DOI verificado OK" y solo
     miraba que hubiera autor y título. Nadie contrastó esas referencias. */
  it('una referencia con datos pero sin verificar NO dice "Válida", dice por qué', () => {
    montar([{ ...REF, verificada: false }]);
    const detalle = screen.getByTestId('estado-referencia');
    expect(detalle.textContent).not.toMatch(/Válida/);
    expect(detalle.textContent).toMatch(/contrast/i);
  });

  it('sin autores, el motivo nombra el campo que falta', () => {
    montar([{ ...REF, authors: [], verificada: false }]);
    expect(screen.getByTestId('estado-referencia').textContent).toMatch(/autor/i);
  });

  it('sin título ni texto crudo, el motivo también lo nombra', () => {
    montar([{ ...REF, title: '', raw_text: '', verificada: false }]);
    const texto = screen.getByTestId('estado-referencia').textContent;
    expect(texto).toMatch(/autor|título/i);
    expect(texto).toMatch(/título/i);
  });

  it('cuando está verificada, la razón es la real y no un campo que falta', () => {
    montar([{ ...REF, verificada: true, fuente_verificacion: 'doi' }]);
    const detalle = screen.getByTestId('estado-referencia');
    expect(detalle.textContent).toMatch(/doi/i);
    /* Y no se inventa un defecto: una referencia verificada no le falta nada. */
    expect(detalle.textContent).not.toMatch(/falta/i);
  });
});

/* ── `null` no es `false` ──────────────────────────────────────────────────── */

describe('la referencia sin citar en el texto', () => {
  it('sin auditoría corriendo NO dice que la referencia esté sin citar', () => {
    montar([REF], 'r1', null);
    expect(screen.getByTestId('estado-referencia').textContent).not.toMatch(/sin citar/i);
  });

  it('con la auditoría corrida y la referencia huérfana, lo dice', () => {
    montar([REF], 'r1', { ghost_citations: [], orphan_references: [{ id: 'r1' }] });
    expect(screen.getByTestId('estado-referencia').textContent).toMatch(/sin citar/i);
  });

  it('con la auditoría corrida y la referencia citada, NO lo dice', () => {
    montar([REF], 'r1', { ghost_citations: [], orphan_references: [{ id: 'r9' }] });
    expect(screen.getByTestId('estado-referencia').textContent).not.toMatch(/sin citar/i);
  });

  /* El caso que `isOrphan` no distinguía: con autores vacíos el operando
     derecho era `'---'`. Ahora no hay búsqueda en el cliente: el conjunto sale
     del `id` que devolvió el backend. */
  it('una referencia sin autor no se marca sola como huérfana', () => {
    montar([{ ...REF, authors: [] }], 'r1', { ghost_citations: [], orphan_references: [] });
    expect(screen.getByTestId('estado-referencia').textContent).not.toMatch(/sin citar/i);
  });
});

/* ── La vista previa muestra lo que va al documento ────────────────────────── */

describe('la vista previa de la referencia', () => {
  it('muestra formatted_apa, no un texto compuesto en el render', () => {
    montar([{ ...REF, formatted_apa: 'Texto que arma el backend.' }]);
    expect(screen.getByTestId('vista-previa-apa').textContent).toContain('Texto que arma el backend.');
  });

  it('sin formatted_apa cae al texto crudo, que también va al documento', () => {
    montar([{ ...REF, formatted_apa: '', raw_text: 'Texto crudo que sí se escribe.' }]);
    expect(screen.getByTestId('vista-previa-apa').textContent).toContain('Texto crudo que sí se escribe.');
  });

  it('sin ninguno de los dos lo dice, en vez de inventar una referencia', () => {
    montar([{ ...REF, formatted_apa: '', raw_text: '' }]);
    expect(screen.getByTestId('vista-previa-apa').textContent).toMatch(/no tiene texto/i);
  });
});

/* ── El formulario sigue editable: es el que arma formatted_apa ────────────── */

describe('el formulario no se rompió', () => {
  it('los cinco campos siguen ahí', () => {
    montar([REF]);
    const cajas = screen.getAllByRole('textbox');
    const nombres = cajas.map((c) => c.getAttribute('placeholder') || c.getAttribute('value') || '');
    expect(cajas.length).toBeGreaterThanOrEqual(5);
    expect(nombres.join(' ')).not.toBe('');
  });

  it('"Guardar Cambios" sigue llamando a la actualización de referencias', () => {
    montar([REF]);
    const guardar = screen.getByRole('button', { name: /guardar cambios/i });
    guardar.click();
    expect(updateReferences).toHaveBeenCalled();
  });
});

/* ── La lista se agrupa por el dato, no por la heurística ──────────────────── */

describe('los grupos de la lista', () => {
  it('una referencia con datos pero sin verificar NO va al grupo de verificadas', () => {
    /* El defecto: `titleText.length < 5` mandaba a "Sin verificar" un artículo
       titulado "AI", y una referencia jamás contrastada entraba como válida. */
    const { container } = montar([{ ...REF, id: 'larga', verificada: false }], null);
    expect(container.textContent).toMatch(/Sin verificar/);
  });
});

/* ── La mascota: la cara sale del estado de la fase ────────────────────────── */

describe('la mascota de la fase', () => {
  it('se pinta, y con el kind que EditorialMascot dibuja', () => {
    /* Un `kind` declarado y no dibujado deja la mascota en blanco, que es un
       fallo que no se ve: la pantalla parece tener icono y no tiene nada. */
    const { container } = montar([REF]);
    expect(container.querySelector('.editorial-mascot-kind-reference')).toBeTruthy();
  });

  it('con referencias incompletas está preocupada, y con la fase en orden está feliz', () => {
    /* La expresión se deriva del estado, no del decorado. Si fuera fija, estas
       dos pruebas daría lo mismo. */
    const incompleta = montar([{ ...REF, authors: [], verificada: false }]);
    expect(incompleta.container.querySelector('.editorial-mascot-expression-worried')).toBeTruthy();

    const enOrden = montar([REF]);
    expect(enOrden.container.querySelector('.editorial-mascot-expression-happy')).toBeTruthy();
  });

  it('sin documento está preocupada, aunque las referencias estén completas', () => {
    /* El orden de las reglas de `expresionDeReferencias` importa: sin documento
       no hay nada que verificar, por muchas fuentes que diga el store. */
    const { container } = montar([REF], 'r1', null, null);
    expect(container.querySelector('.editorial-mascot-expression-worried')).toBeTruthy();
  });

  it('con citas sin fuente está preocupada aunque no haya incompletas', () => {
    const { container } = montar([REF], 'r1', {
      ghost_citations: [{ raw_text: 'Alguien (2019) dijo algo' }], orphan_references: [],
    });
    expect(container.querySelector('.editorial-mascot-expression-worried')).toBeTruthy();
  });
});

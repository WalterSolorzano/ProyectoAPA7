/**
 * El bloque de contexto de una figura, que es la respuesta a la pregunta que esta
 * pantalla tiene que responder: "esta figura tiene contexto o esta perdida".
 *
 * Lo que se afirma aca son cinco datos POR ELEMENTO, y ninguno de ellos es un
 * adorno:
 *
 *   1. El tamano REAL, de la geometria de la hoja, y no el `|| 12` / `|| 8` que
 *      hacia que un numero inventado se mostrara con la apariencia de un dato.
 *   2. La leyenda, o la AUSENCIA DE LEYENDA DICHA. "Sin leyenda - APA 7 la exige"
 *      es el estado; un hueco mudo no es el estado.
 *   3. El H1/H2 al que pertenece.
 *   4. El parrafo anterior, y `null` se dice en palabras.
 *   5. Para una tabla, sus filas: un `<Table size={18}/>` no es un dato.
 *
 * Y la miniatura que no carga: hoy `Step3FiguresTablesWizard.tsx:399` hace
 * `visibility = hidden` y deja un cuadro de 48 x 48 sin marco y sin texto, que
 * parece un elemento que se esta cargando y no lo esta.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListaContextual } from '../components/figures/ListaContextual';
import { contextosDeFiguras } from '../lib/figuras';
import type { ElementModel } from '../types';

vi.mock('../api/backend', () => ({
  getApiBase: vi.fn().mockReturnValue('http://localhost:8742'),
  getApiBaseAsync: vi.fn().mockResolvedValue('http://localhost:8742'),
  fetchWithTrace: vi.fn(),
  resolveAssetUrl: vi.fn((p?: string | null) => (p ? `https://x/${p}` : null)),
  syncAllProviderKeys: vi.fn().mockResolvedValue({ ok: true, applied: [] }),
}));

let n = 0;
const el = (o: Partial<ElementModel> & { type: ElementModel['type']; text: string }): ElementModel =>
  ({ id: `elem_${++n}`, style_name: '', alignment: 'left', font_name: 'Times New Roman',
     font_size: 12, is_bold: false, is_italic: false, is_bullet: false, left_indent_cm: 0,
     confidence: 1, is_user_modified: false, cita_ids: [], needs_review: false,
     auto_applied: false, ...o }) as ElementModel;

const DOC: ElementModel[] = [
  el({ type: 'heading', heading_level: 1, text: '2. Metodología' }),
  el({ type: 'heading', heading_level: 2, text: '2.1 Instrumentos' }),
  el({ type: 'paragraph', text: 'Se aplico un cuestionario a doscientos estudiantes' }),
  el({ type: 'image', text: 'Figura 1', image_info: { figure_number: 1, caption: 'Diagrama del balance', relative_url: 'a.png', width_cm: 14, height_cm: 9 } as never }),
  el({ type: 'image', text: 'Figura 2', image_info: { figure_number: 2, caption: '', relative_url: 'b.png' } as never }),
];

const props = (extra: Partial<React.ComponentProps<typeof ListaContextual>> = {}) => ({
  contextos: contextosDeFiguras(DOC),
  tipo: 'image' as const,
  onTipoChange: vi.fn(),
  query: '',
  onQueryChange: vi.fn(),
  soloPendientes: false,
  onSoloPendientesChange: vi.fn(),
  indiceActivo: 3,
  onSelectIndice: vi.fn(),
  onAutoCaption: vi.fn(),
  autoCaptionCargando: false,
  hayDocumento: true,
  conteoFiguras: 2,
  conteoTablas: 0,
  filtroActivo: null,
  ...extra,
});

describe('el bloque de contexto de una figura', () => {
  it('dice la seccion, la leyenda, el tamano y el parrafo anterior', () => {
    render(<ListaContextual {...props()} />);
    const bloque = screen.getByTestId('contexto-elem_4');
    expect(bloque.textContent).toMatch(/2\.1 Instrumentos/);
    expect(bloque.textContent).toMatch(/Diagrama del balance/);
    expect(bloque.textContent).toMatch(/14\s*[x×]\s*9\s*cm/);
    expect(bloque.textContent).toMatch(/Se aplico un cuestionario/);
  });

  it('UNA FIGURA SIN LEYENDA DICE QUE NO TIENE LEYENDA, y no deja la linea vacia', () => {
    render(<ListaContextual {...props()} />);
    const bloque = screen.getByTestId('contexto-elem_5');
    expect(bloque.textContent).toMatch(/sin leyenda/i);
    /* Y nombra por que importa, que es el estado y no el adorno. */
    expect(bloque.textContent).toMatch(/apa 7/i);
  });

  it('una figura SIN tamano declarado lo dice, y no muestra 12 x 8', () => {
    render(<ListaContextual {...props()} />);
    const bloque = screen.getByTestId('contexto-elem_5');
    expect(bloque.textContent).toMatch(/sin tamaño declarado/i);
    expect(bloque.textContent).not.toMatch(/12\s*[x×]\s*8/);
  });

  it('la miniatura que TIENE tamano declarado se pinta a la escala de la hoja', () => {
    render(<ListaContextual {...props()} />);
    const img = screen.getByRole('img', { name: /Figura 1/ }) as HTMLImageElement;
    /* 14 cm de los 21.59 cm de una carta, sobre 680 px de hoja. */
    expect(img.style.width).not.toBe('');
    expect(img.style.width).not.toBe('48px');
  });

  it('el id del elemento va en el data-testid y NO en el texto que ve la persona', () => {
    /* Seccion 3.4: ningun identificador interno visible. `elem_4` es direccion
       para la prueba, no informacion para quien redacta. */
    render(<ListaContextual {...props()} />);
    const bloque = screen.getByTestId('contexto-elem_4');
    expect(bloque.textContent).not.toMatch(/elem_/);
  });
});

describe('la miniatura que no carga', () => {
  it('el onError cae a un placeholder CON marco y CON texto, no a un hueco invisible', () => {
    /* El defecto de `Step3FiguresTablesWizard.tsx:399`: `visibility: hidden` deja
       un cuadro de 48 x 48 sin marco y sin texto, que parece una carga. */
    render(<ListaContextual {...props()} />);
    const img = screen.getByRole('img', { name: /Figura 1/ });
    fireEvent.error(img);
    const reserva = screen.getByTestId('miniatura-de-reserva');
    expect(reserva.textContent).toMatch(/no se pudo cargar/i);
    /* Y el hueco sigue siendo un hueco con marco, no una ausencia. */
    expect(screen.queryByRole('img', { name: /Figura 1/ })).toBeNull();
  });
});

describe('la tabla muestra sus datos, no un icono', () => {
  it('enseña las primeras filas y dice cuantas faltan', () => {
    const conTabla = [...DOC,
      el({ type: 'table', text: 'Tabla 1', table_info: {
        table_number: 1, caption: 'Resultados', note: '',
        headers: ['Grupo', 'n', 'Media'],
        rows: [['A', '30', '4.2'], ['B', '30', '3.9'], ['C', '30', '4.0'], ['D', '30', '2.1']],
      } as never })];
    render(<ListaContextual {...props({ contextos: contextosDeFiguras(conTabla), tipo: 'table', conteoTablas: 1 })} />);
    expect(screen.getByText(/Grupo/)).toBeTruthy();
    expect(screen.getByText('4.2')).toBeTruthy();
    expect(screen.getByText(/2 de 4 filas/)).toBeTruthy();
  });
});

describe('el buscador y los estados vacios', () => {
  it('sin documento, el motivo es sin-documento', () => {
    render(<ListaContextual {...props({ hayDocumento: false, contextos: [] })} />);
    expect(screen.getByTestId('estado-vacio').textContent).toMatch(/documento/i);
  });

  it('con filtro que no deja nada, el motivo NOMBRA el filtro', () => {
    render(<ListaContextual {...props({ contextos: [], query: 'zzz', filtroActivo: '"zzz"' })} />);
    const texto = screen.getByTestId('estado-vacio').textContent ?? '';
    expect(texto).toMatch(/filtro/i);
    expect(texto).toMatch(/zzz/);
  });

  it('el buscador dice que busca por seccion, porque ahora busca por seccion', () => {
    render(<ListaContextual {...props()} />);
    expect(screen.getByRole('textbox', { name: /buscar/i }).getAttribute('placeholder'))
      .toMatch(/sección/i);
  });
});

describe('el header y la lista tienen las cajas que §8.4 exige', () => {
  it('el header lleva flexShrink: 0 CON maxHeight al lado', () => {
    /* El header de `Step3FiguresTablesWizard.tsx:180-321` era `flexShrink: 0` sin
       `maxHeight`, y por eso con una ventana de 700 px la lista quedaba en 0 px. */
    render(<ListaContextual {...props()} />);
    const header = document.querySelector('[data-testid="lista-figuras-header"]');
    expect(header).toBeTruthy();
    expect((header as HTMLElement).style.flexShrink).toBe('0');
    expect((header as HTMLElement).style.maxHeight).not.toBe('');
  });

  it('el scroller lleva minHeight: 0 y minWidth: 0', () => {
    render(<ListaContextual {...props()} />);
    const scroller = document.querySelector('[data-testid="lista-figuras-scroller"]') as HTMLElement;
    expect(scroller).toBeTruthy();
    expect(scroller.style.minHeight).toBe('0px');
    expect(scroller.style.minWidth).toBe('0px');
  });
});

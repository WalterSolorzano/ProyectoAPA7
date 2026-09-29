/**
 * El escenario: UNA figura a la vez, a la escala de la hoja, y el documento por
 * un toggle apagado por omision (§8.1 y §8.2).
 *
 * LO QUE SE PRUEBA, Y POR QUE CADA COSA MUERDE.
 *
 *   1. LA FIGURA A ESCALA, NO A "QUE ENTRE". El defecto del `max-width: 100%` es
 *      que una figura de 4 cm se ve gigante y sale de 4 cm: entra, no mide. La
 *      caja sale de `medidaDeFigura`, que es la geometria de la hoja de F2. Y
 *      sin tamano declarado NO inventa 12 x 8: lo dice y usa la proporcion
 *      natural del archivo.
 *   2. LA LEYENDA SE GUARDA AL SALIR DEL CAMPO. `updateElementImage` es una
 *      llamada HTTP con `pushHistory`, y con `caption` corre
 *      `cleanRedundantTitleParagraphs`, que reescribe parrafos del documento.
 *      Escribirla por pulsacion es un PATCH por pulsacion que reescribe el
 *      documento letra por letra.
 *   3. LAS TABLAS MUESTRAN SUS CELDAS. `TableModel` tiene `headers` y `rows`; un
 *      icono de tabla no es un dato.
 *   4. EL DOCUMENTO ES UN TOGGLE, APAGADO POR OMISION. El documento entero como
 *      centro es exactamente el defecto que §8.1 viene a matar: twenty filas de
 *      una lista, no twenty paginas de papel.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EscenarioFigura, VISTA_POR_DEFECTO, porDefectoSeVeElDocumento } from '../components/figures/EscenarioFigura';
import { contextosDeFiguras, ANCHO_DE_LA_HOJA_PX } from '../lib/figuras';
import { HOJA_CARTA_MM } from '../lib/portada/geometria';
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
  el({ type: 'paragraph', text: 'Se aplico un cuestionario a doscientos estudiantes' }),
  el({ type: 'image', text: 'Figura 1', image_info: { figure_number: 1, caption: 'Diagrama del balance', relative_url: 'a.png', width_cm: 14, height_cm: 9 } as never }),
  el({ type: 'image', text: 'Figura 2', image_info: { figure_number: 2, caption: '', relative_url: 'b.png' } as never }),
];

const props = (extra: Partial<React.ComponentProps<typeof EscenarioFigura>> = {}) => ({
  contexto: contextosDeFiguras(DOC)[0],
  totalEnDocumento: contextosDeFiguras(DOC).length,
  onNavigate: vi.fn(),
  onLegendChange: vi.fn(),
  documento: <div data-testid="documento-real" />,
  ...extra,
});

describe('la figura a escala, no a "que entre"', () => {
  it('con tamano declarado, la caja mide lo que mide en la hoja', () => {
    render(<EscenarioFigura {...props()} />);
    const escala = ANCHO_DE_LA_HOJA_PX / HOJA_CARTA_MM.ancho;
    const img = screen.getByRole('img', { name: /Figura 1/ }) as HTMLImageElement;
    expect(img.style.width).toBe(`${140 * escala}px`);
    expect(img.style.height).toBe(`${90 * escala}px`);
  });

  it('una figura de 4 cm NO se ve como una que llena la columna', () => {
    /* El defecto de `max-width: 100%`: "que entre" no es "que mida". Una figura
       de 4 cm tiene que medir 4 cm, y la hoja tiene 21.59 cm. */
    const chica = [el({ type: 'heading', heading_level: 1, text: '1. Uno' }),
      el({ type: 'image', text: 'Figura 1', image_info: { figure_number: 1, caption: 'x', relative_url: 'a.png', width_cm: 4, height_cm: 3 } as never })];
    render(<EscenarioFigura {...props({ contexto: contextosDeFiguras(chica)[0] })} />);
    const escala = ANCHO_DE_LA_HOJA_PX / HOJA_CARTA_MM.ancho;
    const img = screen.getByRole('img', { name: /Figura 1/ }) as HTMLImageElement;
    expect(img.style.width).toBe(`${40 * escala}px`);
    expect(img.style.width).not.toContain('100%');
  });

  it('sin tamano declarado, NO inventa 12 x 8 y lo dice', () => {
    render(<EscenarioFigura {...props({ contexto: contextosDeFiguras(DOC)[1] })} />);
    const img = screen.getByRole('img', { name: /Figura 2/ }) as HTMLImageElement;
    /* `auto` y no un alto fijo: la altura la pone la proporcion natural del
       archivo. Un 12 x 8 puesto ahi seria una figura que miente. */
    expect(img.style.height).toBe('auto');
    expect(screen.getByTestId('escenario-figura').textContent).toMatch(/sin tamaño declarado/i);
  });
});

describe('la leyenda se guarda al salir del campo, no en cada tecla', () => {
  it('escribe en el campo y todavia no despacha; al salir, si', () => {
    const spy = vi.fn();
    render(<EscenarioFigura {...props({ onLegendChange: spy })} />);
    const campo = screen.getByRole('textbox', { name: /leyenda/i });
    fireEvent.change(campo, { target: { value: 'Nueva leyenda' } });
    expect(spy).not.toHaveBeenCalled();
    fireEvent.blur(campo);
    expect(spy).toHaveBeenCalledWith('Nueva leyenda');
  });

  it('sin leyenda, el campo lo avisa con el borde de aviso y el texto lo dice', () => {
    render(<EscenarioFigura {...props({ contexto: contextosDeFiguras(DOC)[1] })} />);
    expect(screen.getByRole('textbox', { name: /leyenda/i })).toBeTruthy();
    expect(screen.getByTestId('escenario-figura').textContent).toMatch(/sin leyenda/i);
  });
});

describe('el contexto, dicho', () => {
  it('dice la seccion, la posicion y el parrafo anterior', () => {
    render(<EscenarioFigura {...props()} />);
    const t = screen.getByTestId('escenario-figura').textContent ?? '';
    expect(t).toMatch(/Metodología/);
    /* Las dos figuras del documento de prueba cuelgan del mismo H1, asi que la
       primera es "1 de 2 en esta seccion". */
    expect(t).toMatch(/1 de 2 en esta sección/);
    expect(t).toMatch(/Se aplico un cuestionario/);
  });

  it('sin parrafo anterior, lo DICE y no pinta una linea vacia', () => {
    const suelta = [el({ type: 'heading', heading_level: 1, text: '1. Uno' }),
      el({ type: 'image', text: 'Figura 1', image_info: { figure_number: 1, caption: 'x', relative_url: 'a.png', width_cm: 4, height_cm: 3 } as never })];
    render(<EscenarioFigura {...props({ contexto: contextosDeFiguras(suelta)[0] })} />);
    expect(screen.getByTestId('escenario-figura').textContent)
      .toMatch(/no hay párrafo que la presente/i);
  });

  it('sin figura elegida, el bloque central dice que elija una, y no se borra', () => {
    /* No es `EstadoVacio` de pantalla completa: la lista y el inspector siguen
       vivos. Es el bloque central, y tiene que decir que hacer. */
    render(<EscenarioFigura {...props({ contexto: null })} />);
    expect(screen.getByTestId('escenario-figura').textContent).toMatch(/elegí una figura/i);
    expect(screen.queryByTestId('escenario-figura-imagen')).toBeNull();
  });
});

describe('las tablas muestran sus datos', () => {
  it('pinta las celdas de table_info, no un icono', () => {
    const conTabla = [el({ type: 'heading', heading_level: 1, text: '3. Resultados' }),
      el({ type: 'table', text: 'Tabla 1', table_info: { table_number: 1, caption: 'Resultados', note: '',
        headers: ['Grupo', 'n', 'Media'], rows: [['A', '30', '4.2'], ['B', '30', '3.9']] } as never })];
    const ctx = contextosDeFiguras(conTabla)[0];
    render(<EscenarioFigura {...props({ contexto: ctx, totalEnDocumento: 1 })} />);
    expect(screen.getByText('Grupo')).toBeTruthy();
    expect(screen.getByText('4.2')).toBeTruthy();
  });

  it('una tabla sin filas lo dice, y no muestra una pantalla vacia', () => {
    const vacia = [el({ type: 'heading', heading_level: 1, text: '3. Resultados' }),
      el({ type: 'table', text: 'Tabla 1', table_info: { table_number: 1, caption: 'Resultados', note: '', headers: [], rows: [] } as never })];
    render(<EscenarioFigura {...props({ contexto: contextosDeFiguras(vacia)[0], totalEnDocumento: 1 })} />);
    expect(screen.getByTestId('escenario-figura').textContent).toMatch(/no trae datos/i);
  });
});

describe('el documento es un toggle, y por omision apagado', () => {
  it('por omision se ve la figura', () => {
    expect(VISTA_POR_DEFECTO).toBe('figura');
    expect(porDefectoSeVeElDocumento()).toBe(false);
  });

  it('el documento NO esta montado hasta que se pide', () => {
    render(<EscenarioFigura {...props()} />);
    expect(screen.queryByTestId('documento-real')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /ver el documento/i }));
    expect(screen.getByTestId('documento-real')).toBeTruthy();
    /* Y son excluyentes: ver el documento apaga la figura. */
    expect(screen.queryByTestId('escenario-figura-imagen')).toBeNull();
  });

  it('volver a la figura apaga el documento otra vez', () => {
    render(<EscenarioFigura {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /ver el documento/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver la figura/i }));
    expect(screen.queryByTestId('documento-real')).toBeNull();
    expect(screen.getByTestId('escenario-figura-imagen')).toBeTruthy();
  });
});

describe('la navegacion entre figuras del mismo tipo', () => {
  it('las flechas piden el paso, y en el ultimo borde no hay siguiente', () => {
    const ctx = contextosDeFiguras(DOC);
    const onNavigate = vi.fn();
    const { rerender } = render(<EscenarioFigura {...props({ contexto: ctx[0], onNavigate })} />);
    expect(screen.getByRole('button', { name: /figura anterior/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /figura anterior/i }));
    expect(onNavigate).toHaveBeenCalledWith(-1);

    /* En la ultima, "siguiente" no existe: un boton que no hace nada es un
       control que hay que adivinar. */
    rerender(<EscenarioFigura {...props({ contexto: ctx[1], onNavigate })} />);
    expect(screen.queryByRole('button', { name: /figura siguiente/i })).toBeNull();
  });
});

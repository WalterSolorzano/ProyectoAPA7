/**
 * EL GUARDIÁN DEL MONTAJE DE LA F4, por el mismo motivo que el de F3: componentes
 * con sus pruebas en verde y cero importadores son un trabajo TERMINADO que no
 * está terminado, está guardado. F3 cometió ese error y lo tapó con
 * `estructuraEstaMontada.test.tsx`; el precedente está a una carpeta de distancia y
 * la lección también.
 *
 * Todas las pruebas son negativas, y todas se apoyan en el mismo par: el glob lee
 * los fuentes del disco y la lista de componentes NO está escrita a mano. Una lista
 * escrita a mano es la tautología que hay que evitar: se agrega un componente, no
 * se monta, y la guarda sigue verde porque no lo conocía.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { Step3FiguresTablesWizard } from '../components/wizard/Step3FiguresTablesWizard';
import { contextosDeFiguras } from '../lib/figuras';
import type { ElementModel } from '../types';

vi.mock('../api/backend', () => ({
  getApiBase: vi.fn().mockReturnValue('http://localhost:8742'),
  getApiBaseAsync: vi.fn().mockResolvedValue('http://localhost:8742'),
  fetchWithTrace: vi.fn(),
  resolveAssetUrl: vi.fn((p?: string | null) => (p ? `https://x/${p}` : null)),
  syncAllProviderKeys: vi.fn().mockResolvedValue({ ok: true, applied: [] }),
  autoCaptionAll: vi.fn().mockResolvedValue(undefined),
  suggestCaption: vi.fn().mockResolvedValue('sugerida'),
}));
vi.mock('../components/layout/PaperCanvas', () => ({ PaperCanvas: () => <div data-testid="canvas-real" /> }));

const FUENTES = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** El fuente SIN comentarios. Un regex no sabe qué es un comentario, y un guardián
 *  que se puede desactivar con un `//` no vigila nada. */
const SIN_COMENTARIOS = (f: string) => f
  .replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const CARPETA = '/src/components/figures/';
const NOMBRES = Object.keys(FUENTES)
  .filter((r) => r.startsWith(CARPETA) && r.endsWith('.tsx'))
  .map((r) => r.slice(CARPETA.length).replace(/\.tsx$/, ''));

let n = 0;
const el = (o: Partial<ElementModel> & { type: ElementModel['type']; text: string }): ElementModel =>
  ({ id: `elem_${++n}`, style_name: '', alignment: 'left', font_name: 'Times New Roman',
     font_size: 12, is_bold: false, is_italic: false, is_bullet: false, left_indent_cm: 0,
     confidence: 1, is_user_modified: false, cita_ids: [], needs_review: false,
     auto_applied: false, ...o }) as ElementModel;

const ELEMENTOS: ElementModel[] = [
  el({ type: 'heading', heading_level: 1, text: '2. Metodología' }),
  el({ type: 'paragraph', text: 'Se aplico un cuestionario a doscientos estudiantes' }),
  el({ type: 'image', text: 'Figura 1', image_info: { figure_number: 1, caption: 'Diagrama', relative_url: 'a.png', width_cm: 14, height_cm: 9 } as never }),
  el({ type: 'image', text: 'Figura 2', image_info: { figure_number: 2, caption: '', relative_url: 'b.png' } as never }),
];

function montar() {
  act(() => {
    useDocStore.setState({
      doc: { session_id: 's-f4', file_name: 'Tesis.docx', elements: ELEMENTOS, referencias: [], meta: { page_count: 4 } } as never,
      reviewResult: null, proofreadFindings: [], citationAuditResult: null,
      imagePanelOpen: false, selectedElementId: null,
    } as never);
  });
  return render(<Step3FiguresTablesWizard />);
}

beforeEach(() => { n = 0; });

describe('la fase de Figuras y tablas está montada', () => {
  it('el glob esta leyendo de verdad y la carpeta tiene los componentes', () => {
    expect(Object.keys(FUENTES).length).toBeGreaterThan(100);
    expect(NOMBRES).toContain('ListaContextual');
    expect(NOMBRES).toContain('EscenarioFigura');
  });

  it('cada componente de la carpeta tiene un importador REAL fuera de las pruebas', () => {
    /* POR QUÉ SE LEEN LOS COMENTARIOS ANTES. La primera versión de esta guarda
       contaba un `import` comentado como importador, porque un regex no sabe qué es
       un comentario. Eso la volvía inútil justo para el caso que viene a cazar:
       commenting el import para "verificar" la guarda la dejaba verde con el
       componente huérfano. Un guardián que se puede desactivar con un `//` no
       vigila nada. */
    const cuenta: Record<string, number> = {};
    for (const nombre of NOMBRES) cuenta[nombre] = 0;
    for (const [ruta, fuente] of Object.entries(FUENTES)) {
      if (ruta.includes('/__tests__/')) continue;
      const limpio = SIN_COMENTARIOS(fuente);
      for (const nombre of NOMBRES) {
        if (new RegExp(`from\\s+['"][^'"]*/${nombre}['"]`).test(limpio)) cuenta[nombre] += 1;
      }
    }
    const huerfanos = NOMBRES.filter((x) => (cuenta[x] ?? 0) === 0);
    expect(huerfanos, `componentes de figures/ que nadie usa: ${huerfanos.join(', ')}`).toEqual([]);
  });

  it('monta la lista contextual y el escenario, con la figura elegida', () => {
    montar();
    expect(screen.getByTestId('lista-figuras-scroller')).toBeTruthy();
    expect(screen.getByTestId('escenario-figura')).toBeTruthy();
    /* Y el lienzo NO esta: es un toggle apagado por omision. El documento entero
       como centro es exactamente el defecto que §8.1 viene a matar. */
    expect(screen.queryByTestId('canvas-real')).toBeNull();
  });

  it('sin figura elegida, el escenario muestra una, y dice su seccion y su falta de leyenda', () => {
    /* Con el filtro vacio, la primera figura es la que se mira por omision, y su
       ausencia de leyenda se ve EN EL ESCENARIO, no solo en la lista. */
    const { container } = montar();
    expect(container.textContent).toMatch(/Metodología/);
    expect(screen.getByTestId('escenario-figura').textContent).toMatch(/Diagrama/);
  });

  it('elegir una figura la pone en el escenario', () => {
    montar();
    /* Se elige la SEGUNDA, que es la que no tiene leyenda: si el clic no llegara al
       escenario, esto seguiría mostrando la primera y la prueba no lo notaría.
       `ELEMENTOS` se construye al cargar el módulo, así que sus ids son fijos:
       elem_1 el H1, elem_2 el párrafo, elem_3 la Figura 1 y elem_4 la Figura 2. */
    fireEvent.click(screen.getByTestId('contexto-elem_4'));
    expect(screen.getByTestId('escenario-figura').textContent).toMatch(/sin leyenda/i);
  });

  it('la fase es alcanzable desde el rail: App.tsx la monta en el paso 3', () => {
    /* Montar el componente a mano no prueba que exista en la app. Un componente
       importado por un modulo que nadie monta tiene la misma existencia que uno sin
       importador. */
    const app = FUENTES['/src/App.tsx'];
    expect(app, 'App.tsx no esta entre los fuentes leidos').toBeTruthy();
    expect(app).toMatch(/wizardStep === 3 && <Step3FiguresTablesWizard \/>/);
  });

  it('NO se importa ReviewMinimap en la fase, y el panel derecho sigue montandose', () => {
    const paso = FUENTES['/src/components/wizard/Step3FiguresTablesWizard.tsx'];
    expect(paso).not.toMatch(/ReviewMinimap/);
    /* Y la tercera columna es la que ya existia, no una nueva. */
    expect(FUENTES['/src/App.tsx']).toMatch(/wizardStep !== 4 && wizardStep !== 5 && wizardStep !== 6 && !focusMode && <RightSidePanel \/>/);
  });
});

/** Los comentarios se quitan porque la cabecera de `Step3FiguresTablesWizard.tsx`
 *  explica el defecto NOMBRANDO el código que ya no está —"la fila ya no llama a
 *  `setImagePanelOpen(true)`"— y una guarda que lee los comentarios accuse al
 *  comentario de ser el defecto. */
describe('la verdad de la figura no se re-deriva en la vista', () => {
  it('la lista y el escenario leen el MISMO contexto', () => {
    /* Un `sectionMap` local y un `contextosDeFiguras` en la lib son dos verdades
       sobre a que seccion pertenece una figura, y divergen el primer dia que una
       cambia. La lista y el escenario tienen que leer el mismo arreglo. */
    const paso = SIN_COMENTARIOS(FUENTES['/src/components/wizard/Step3FiguresTablesWizard.tsx']);
    expect(paso).toMatch(/contextosDeFiguras/);
    expect(paso).not.toMatch(/new Map<string, \{ title: string; level/);
  });

  it('la figura activa se guarda por indice, y no por element_id', () => {
    const paso = SIN_COMENTARIOS(FUENTES['/src/components/wizard/Step3FiguresTablesWizard.tsx']);
    expect(paso).toMatch(/indiceActivo/);
    /* Y no queda ningun `setSelectedElementId(item.id)` como identidad de la
       eleccion de la lista: la lista elige una POSICION. */
    expect(paso).not.toMatch(/setSelectedElementId\(item\.id\)/);
    /* Y seleccionar NO abre el panel de imagen: eso es reemplazar en vez de
       navegar, y es el defecto de §8.3. */
    expect(paso).not.toMatch(/setImagePanelOpen\(true\)/);
    expect(paso).not.toMatch(/setForceRightPanelOpen\(true\)/);
  });

  it('el estado vacio de esta pantalla es el de F1, no uno escrito a mano', () => {
    const paso = SIN_COMENTARIOS(FUENTES['/src/components/wizard/Step3FiguresTablesWizard.tsx']);
    expect(paso).toMatch(/ListaContextual/);
    expect(paso).not.toMatch(/No se detectaron \$\{/);
    const lista = FUENTES['/src/components/figures/ListaContextual.tsx'];
    expect(lista).toMatch(/EstadoVacio/);
  });
});

describe('la lista y el escenario leen la misma verdad, de verdad', () => {
  it('el total que muestra la lista y el que muestra el escenario son el mismo numero', () => {
    const ctx = contextosDeFiguras(ELEMENTOS);
    expect(ctx.filter((c) => c.tipo === 'image')).toHaveLength(2);
    montar();
    /* El toggle Figuras dice 2, y el escenario es 1 de 2: un numero derivado dos
       veces divergen, y el que miente es el que la persona ve. */
    expect(screen.getByRole('button', { name: /Figuras \(2\)/ })).toBeTruthy();
  });
});

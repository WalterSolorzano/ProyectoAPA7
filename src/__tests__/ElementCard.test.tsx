/**
 * WordAPA7 — ElementCard Component Tests
 *
 * Verifica el comportamiento del componente ElementCard:
 * - Renderizado con diferentes tipos de elementos
 * - Cambios de tipo via selector
 * - Cambios de nivel de heading
 * - Edicion de texto
 * - Visualizacion de imagenes y tablas
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ElementCard } from '../components/elements/ElementCard';
import { ElementModel, ElementType } from '../types';
import { useDocStore } from '../store/useDocStore';

// Mock del store Zustand
vi.mock('../store/useDocStore', () => ({
  useDocStore: vi.fn(),
}));

// Mock del componente ConfidenceBadge
vi.mock('../components/shared/ConfidenceBadge', () => ({
  ConfidenceBadge: ({
    confidence,
    isUserModified,
  }: {
    confidence: number;
    isUserModified?: boolean;
  }) =>
    React.createElement(
      'span',
      { 'data-testid': 'confidence-badge' },
      `${Math.round(confidence * 100)}%`
    ),
}));

// Mock de lucide-react GripVertical manteniendo el resto
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    GripVertical: ({ size }: { size: number }) =>
      React.createElement('span', { 'data-testid': 'grip-icon' }, 'grip'),
  };
});

/** Factory que crea un ElementModel completo para tests */
function makeElement(overrides: Partial<ElementModel> = {}): ElementModel {
  return {
    id: 'elem_1',
    type: 'paragraph',
    heading_level: 1,
    text: 'Este es un parrafo de prueba.',
    original_text: 'Este es un parrafo de prueba.',
    style_name: 'Normal',
    alignment: 'left',
    font_name: 'Times New Roman',
    font_size: 12,
    is_bold: false,
    is_italic: false,
    is_bullet: false,
    left_indent_cm: 0,
    confidence: 0.85,
    is_user_modified: false,
    needs_review: false,
    auto_applied: false,
    cita_ids: [],
    ...overrides,
  };
}

describe('ElementCard', () => {
  const mockUpdateElementType = vi.fn().mockResolvedValue(undefined);
  const mockShowToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useDocStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      updateElementType: mockUpdateElementType,
      showToast: mockShowToast,
    });
  });

  // ── RENDERIZADO BASICO ──────────────────────────────────────────────────

  it('renderiza el texto del elemento', () => {
    render(React.createElement(ElementCard, { element: makeElement() }));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Este es un parrafo de prueba.');
  });

  it('muestra el selector de tipo', () => {
    render(React.createElement(ElementCard, { element: makeElement() }));
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('paragraph');
  });

  it('muestra el badge de confianza', () => {
    render(React.createElement(ElementCard, { element: makeElement() }));
    const badge = screen.getByTestId('confidence-badge');
    expect(badge.textContent).toBe('85%');
  });

  // ── TIPOS DE ELEMENTO ───────────────────────────────────────────────────

  it('muestra selector de nivel para headings', () => {
    render(
      React.createElement(ElementCard, {
        element: makeElement({ type: 'heading' as ElementType, heading_level: 2, text: 'Titulo de Seccion' }),
      })
    );

    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(2);

    const levelSelect = selects[1] as HTMLSelectElement;
    expect(levelSelect.value).toBe('2');
  });

  it('no muestra textarea para imagenes', () => {
    render(
      React.createElement(ElementCard, {
        element: makeElement({
          type: 'image' as ElementType,
          text: '',
          image_info: {
            element_id: 'elem_img',
            file_path: '/test.png',
            filename: 'grafico.png',
            relative_url: '/api/images/test/grafico.png',
            width_cm: 12,
            height_cm: 8,
            caption: 'Resultados',
            figure_number: 1,
            alignment: 'center',
            wrap_style: 'inline',
            caption_position: 'above',
            constrain_proportions: true,
            design_style: 'standard',
          },
        }),
      })
    );

    const textarea = screen.queryByRole('textbox');
    expect(textarea).toBeNull();
  });

  it('muestra info de tabla para elementos table', () => {
    render(
      React.createElement(ElementCard, {
        element: makeElement({
          type: 'table' as ElementType,
          text: '',
          table_info: {
            element_id: 'elem_tbl',
            headers: ['A', 'B'],
            rows: [['1', '2']],
            caption: 'Datos',
            table_number: 1,
          },
        }),
      })
    );

    expect(screen.getByText('Tabla 1')).toBeTruthy();
    expect(screen.getByText(/2 columnas, 1 filas/)).toBeTruthy();
  });

  it('renderiza correctamente elementos bullet', () => {
    render(
      React.createElement(ElementCard, {
        element: makeElement({
          type: 'bullet' as ElementType,
          text: 'Item de viñeta',
        }),
      })
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Item de viñeta');
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('bullet');
  });

  it('renderiza correctamente elementos numbered_list', () => {
    render(
      React.createElement(ElementCard, {
        element: makeElement({
          type: 'numbered_list' as ElementType,
          text: 'Item enumerado',
        }),
      })
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('numbered_list');
  });

  it('renderiza correctamente elementos block_quote', () => {
    render(
      React.createElement(ElementCard, {
        element: makeElement({
          type: 'block_quote' as ElementType,
          text: 'Texto citado',
        }),
      })
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('block_quote');
  });

  // ── INTERACCIONES ───────────────────────────────────────────────────────

  it('llama a updateElementType al cambiar el tipo', () => {
    render(React.createElement(ElementCard, { element: makeElement() }));
    const select = screen.getByRole('combobox') as HTMLSelectElement;

    fireEvent.change(select, { target: { value: 'heading' } });

    expect(mockUpdateElementType).toHaveBeenCalledWith(
      'elem_1',
      'heading',
      1,
      'Este es un parrafo de prueba.'
    );
  });

  it('llama a updateElementType al cambiar el nivel de heading', () => {
    render(
      React.createElement(ElementCard, {
        element: makeElement({ type: 'heading' as ElementType, heading_level: 1 }),
      })
    );

    const selects = screen.getAllByRole('combobox');
    const levelSelect = selects[1] as HTMLSelectElement;

    fireEvent.change(levelSelect, { target: { value: '3' } });

    expect(mockUpdateElementType).toHaveBeenCalledWith(
      'elem_1',
      'heading',
      3,
      'Este es un parrafo de prueba.'
    );
  });

  it('llama a updateElementType al perder el foco en el textarea con texto modificado', () => {
    render(React.createElement(ElementCard, { element: makeElement() }));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'Texto modificado' } });
    fireEvent.blur(textarea);

    expect(mockUpdateElementType).toHaveBeenCalledWith(
      'elem_1',
      'paragraph',
      1,
      'Texto modificado'
    );
  });

  // ── ESTADOS DE CONFIANZA ────────────────────────────────────────────────

  it('muestra confianza alta correctamente', () => {
    render(React.createElement(ElementCard, { element: makeElement({ confidence: 0.95 }) }));
    const badge = screen.getByTestId('confidence-badge');
    expect(badge.textContent).toBe('95%');
  });

  it('muestra confianza baja correctamente', () => {
    render(React.createElement(ElementCard, { element: makeElement({ confidence: 0.35 }) }));
    const badge = screen.getByTestId('confidence-badge');
    expect(badge.textContent).toBe('35%');
  });
});

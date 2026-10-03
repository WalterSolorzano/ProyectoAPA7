import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiagramaAnatomicoSVG } from '../DiagramaAnatomicoSVG';
import type { NodoJerarquia } from '../../lib/jerarquia';

describe('DiagramaAnatomicoSVG', () => {
  const arbolMock: NodoJerarquia[] = [
    {
      id: 'h1_1',
      titulo: 'Introducción General',
      nivel: 1,
      palabras: 450,
      figuras: 2,
      tablas: 0,
      citas: 3,
      elementoId: 'elem_1',
      hijos: [
        {
          id: 'h2_1',
          titulo: 'Planteamiento del Problema',
          nivel: 2,
          palabras: 250,
          figuras: 1,
          tablas: 0,
          citas: 1,
          elementoId: 'elem_2',
          hijos: [
            {
              id: 'h3_1',
              titulo: 'Justificación Teórica',
              nivel: 3,
              palabras: 120,
              figuras: 0,
              tablas: 0,
              citas: 2,
              elementoId: 'elem_3',
              hijos: [],
            },
          ],
        },
      ],
    },
  ];

  it('renderiza nodos SVG para H1, H2 y H3 con títulos visibles', () => {
    render(<DiagramaAnatomicoSVG arbol={arbolMock} />);

    expect(screen.getByText('Introducción General')).toBeDefined();
    expect(screen.getByText('Planteamiento del Problema')).toBeDefined();
    expect(screen.getByText('Justificación Teórica')).toBeDefined();
  });

  it('permite filtrar la densidad con toggles de ocultar figuras y solo hasta H2', () => {
    render(<DiagramaAnatomicoSVG arbol={arbolMock} />);

    const toggleH2 = screen.getByRole('button', { name: /solo hasta h2/i });
    expect(screen.getByText('Justificación Teórica')).toBeDefined();

    // Activar filtro "Solo hasta H2"
    fireEvent.click(toggleH2);
    // H3 debe desaparecer del diagrama
    expect(screen.queryByText('Justificación Teórica')).toBeNull();
    // H1 y H2 deben permanecer
    expect(screen.getByText('Introducción General')).toBeDefined();
    expect(screen.getByText('Planteamiento del Problema')).toBeDefined();

    // Toggle ocultar figuras
    const toggleFiguras = screen.getByRole('button', { name: /ocultar figuras/i });
    expect(screen.getByText(/2 fig/i)).toBeDefined();
    fireEvent.click(toggleFiguras);
    expect(screen.queryByText(/2 fig/i)).toBeNull();
  });

  it('soporta drag-and-drop proyectando una línea fantasma de inserción', () => {
    const onReorder = vi.fn();
    render(<DiagramaAnatomicoSVG arbol={arbolMock} onReorder={onReorder} />);

    const nodoH2 = screen.getByTestId('nodo-svg-h2_1');
    const nodoH1 = screen.getByTestId('nodo-svg-h1_1');

    // Inicialmente no hay línea fantasma
    expect(screen.queryByTestId('linea-fantasma-drop')).toBeNull();

    // Iniciar arrastre en H2
    fireEvent.dragStart(nodoH2, { dataTransfer: { setData: vi.fn() } });

    // Drag over sobre H1
    fireEvent.dragOver(nodoH1, {
      clientY: 30, // en mitad superior o inferior
      preventDefault: vi.fn(),
    });

    // Debe proyectarse la línea fantasma punteada
    const lineaFantasma = screen.getByTestId('linea-fantasma-drop');
    expect(lineaFantasma).toBeDefined();
    expect(lineaFantasma.getAttribute('stroke-dasharray')).toBe('4 4');

    // Soltar (Drop)
    fireEvent.drop(nodoH1);
    expect(onReorder).toHaveBeenCalledWith('h2_1', 'h1_1', 'before');
  });
});

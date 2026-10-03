import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EstudioEstructuraView } from '../EstudioEstructuraView';
import { useDocStore } from '../../../store/useDocStore';

vi.mock('../../../store/useDocStore');

describe('EstudioEstructuraView', () => {
  const mockUpdateElementType = vi.fn();
  const mockReorderElements = vi.fn();
  const mockSetSelectedElementId = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useDocStore as any).mockReturnValue({
      doc: {
        id: 'doc-1',
        title: 'Documento de Prueba',
        elements: [
          {
            id: 'elem-h1',
            type: 'heading',
            heading_level: 1,
            text: '1. Introducción',
          },
          {
            id: 'elem-p1',
            type: 'paragraph',
            text: 'Texto de prueba de la introducción.',
          },
          {
            id: 'elem-h2',
            type: 'heading',
            heading_level: 2,
            text: '1.1 Contexto',
          },
        ],
      },
      updateElementType: mockUpdateElementType,
      reorderElements: mockReorderElements,
      setSelectedElementId: mockSetSelectedElementId,
    });
  });

  it('renderiza la vista anatómica unificada sin pestañas residuales', () => {
    render(<EstudioEstructuraView />);
    expect(screen.getByRole('heading', { name: /Estructura del Documento/i })).toBeDefined();
    expect(screen.getByText(/Diagrama Anatómico/i)).toBeDefined();
    expect(screen.getByText(/Prosa de Sección/i)).toBeDefined();
  });

  it('permite alternar entre Diagrama Anatómico y Prosa de Sección', () => {
    render(<EstudioEstructuraView />);
    const btnProsa = screen.getByRole('button', { name: /Prosa de Sección/i });
    fireEvent.click(btnProsa);

    // Debe renderizar la prosa de la sección activa
    expect(screen.getByText(/Texto de prueba de la introducción/i)).toBeDefined();

    const btnDiagrama = screen.getByRole('button', { name: /Diagrama Anatómico/i });
    fireEvent.click(btnDiagrama);
    expect(screen.getByText(/Diagrama Anatómico/i)).toBeDefined();
  });

  it('permite cambiar el nivel del nodo activo mediante los chips del inspector', () => {
    render(<EstudioEstructuraView />);
    const chipH2 = screen.getByRole('button', { name: 'H2' });
    fireEvent.click(chipH2);
    expect(mockUpdateElementType).toHaveBeenCalledWith('elem-h1', 'heading', 2);
  });
});

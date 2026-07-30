import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { DocumentOutlinePane } from '../components/layout/DocumentOutlinePane';
import { useDocStore } from '../store/useDocStore';

// Mock de zustand para tener datos
vi.mock('../store/useDocStore', () => ({
  useDocStore: vi.fn(),
}));

describe('DocumentOutlinePane - Virtualization & Drag', () => {
  beforeEach(() => {
    // Creamos 50 elementos para forzar el scroll
    const elements = Array.from({ length: 50 }).map((_, i) => ({
      id: `elem-${i}`,
      type: 'heading',
      heading_level: 1,
      text: `Título ${i}`,
      confidence: 1,
      is_user_modified: false
    }));

    (useDocStore as any).mockReturnValue({
      doc: { elements },
      selectedElementId: null,
      setSelectedElementId: vi.fn(),
      reorderElements: vi.fn(),
      isLoading: false
    });
  });

  it('should render the virtualized container with overflowY: auto for dnd-kit autoScroll', () => {
    render(<DocumentOutlinePane />);
    
    // Cambiar a vista 'Todos' para habilitar drag
    const allTab = screen.getByText(/Todos/i);
    fireEvent.click(allTab);

    // El contenedor virtualizado es el padre directo del div que tiene altura total
    // Buscamos el texto del primer elemento para encontrar el contenedor
    const firstElement = screen.getByText('Título 0');
    
    // Subimos en el DOM hasta encontrar el contenedor de scroll (que tiene overflowY: auto)
    let scrollContainer = firstElement.parentElement;
    while (scrollContainer && scrollContainer.style.overflowY !== 'auto') {
      scrollContainer = scrollContainer.parentElement;
    }

    expect(scrollContainer).toBeTruthy();
    expect(scrollContainer?.style.overflowY).toBe('auto');
    expect(scrollContainer?.style.flex).toBe('1 1 0%'); // tailwind flex-1 en jsdom es 1 1 0% o flex: 1
  });
});

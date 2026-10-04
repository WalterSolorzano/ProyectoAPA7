import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LienzoEditorialActivo } from '../LienzoEditorialActivo';

describe('LienzoEditorialActivo', () => {
  const defaultProps = {
    figureNumber: 1,
    figureTitle: 'Distribución de frecuencias por estrato socioeconómico',
    figureNote: 'Nota. Adaptado de los datos del censo nacional 2024.',
    imageUrl: 'blob:http://localhost:5173/test-image.png',
    prevParagraph: 'El análisis descriptivo inicial mostró variaciones significativas en los estratos evaluados. A continuación se ilustra este comportamiento.',
    nextParagraph: 'Como se observa en la figura anterior, el estrato medio concentra el mayor porcentaje de participantes, confirmando la hipótesis de muestreo.',
    aiSuggestion: {
      suggestedTitle: 'Distribución porcentual por estratos socioeconómicos (2024)',
      suggestedNote: 'Nota. Elaboración propia a partir del censo nacional 2024.',
      confidence: 0.94
    },
    onRotate: vi.fn(),
    onReplaceImage: vi.fn(),
    onApplyCaption: vi.fn(),
  };

  it('renderiza párrafos anterior y posterior con tipografía serif académica y sangría', () => {
    const { container } = render(<LienzoEditorialActivo {...defaultProps} />);

    const prevEl = screen.getByText(/El análisis descriptivo inicial/i);
    const nextEl = screen.getByText(/Como se observa en la figura anterior/i);

    expect(prevEl).toBeInTheDocument();
    expect(nextEl).toBeInTheDocument();

    // Verificación de clases o estilos serif y sangría
    expect(prevEl.className).toContain('font-serif');
    expect(prevEl.className).toContain('indent-8');
    expect(nextEl.className).toContain('font-serif');
    expect(nextEl.className).toContain('indent-8');

    // Comprobamos el contenedor de lectura cálido
    const canvasContainer = container.querySelector('[data-testid="editorial-reading-canvas"]');
    expect(canvasContainer).toBeInTheDocument();
    expect(canvasContainer).toHaveStyle({ backgroundColor: 'var(--paper-white)' });
  });

  it('renderiza el bloque de la figura con rótulo y título en cursiva según APA 7', () => {
    render(<LienzoEditorialActivo {...defaultProps} />);

    // APA 7: "Figura 1" en negrita, título en cursiva en línea separada
    const labelEl = screen.getByText('Figura 1');
    expect(labelEl).toBeInTheDocument();
    expect(labelEl.className).toContain('font-bold');

    const titleEl = screen.getByText(defaultProps.figureTitle);
    expect(titleEl).toBeInTheDocument();
    expect(titleEl.className).toContain('italic');

    const noteEl = screen.getByText(defaultProps.figureNote);
    expect(noteEl).toBeInTheDocument();
  });

  it('incluye botones rápidos sobre la imagen para rotación y reemplazo', () => {
    const onRotate = vi.fn();
    const onReplaceImage = vi.fn();

    render(
      <LienzoEditorialActivo
        {...defaultProps}
        onRotate={onRotate}
        onReplaceImage={onReplaceImage}
      />
    );

    const rotateBtn = screen.getByRole('button', { name: /rotar/i });
    expect(rotateBtn).toBeInTheDocument();
    fireEvent.click(rotateBtn);
    expect(onRotate).toHaveBeenCalledTimes(1);

    const replaceBtn = screen.getByRole('button', { name: /reemplazar/i });
    expect(replaceBtn).toBeInTheDocument();
    fireEvent.click(replaceBtn);
    expect(onReplaceImage).toHaveBeenCalledTimes(1);
  });

  it('muestra bloque de sugerencia IA abajo de la figura con acción de aplicar', () => {
    const onApplyCaption = vi.fn();

    render(
      <LienzoEditorialActivo
        {...defaultProps}
        onApplyCaption={onApplyCaption}
      />
    );

    expect(screen.getByText(/Distribución porcentual por estratos/i)).toBeInTheDocument();
    const applyBtn = screen.getByRole('button', { name: /aplicar sugerencia/i });
    expect(applyBtn).toBeInTheDocument();

    fireEvent.click(applyBtn);
    expect(onApplyCaption).toHaveBeenCalledWith({
      title: defaultProps.aiSuggestion.suggestedTitle,
      note: defaultProps.aiSuggestion.suggestedNote,
    });
  });
});

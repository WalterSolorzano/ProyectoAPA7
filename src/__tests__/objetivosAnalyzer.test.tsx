import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ObjetivosAnalyzer } from '../components/review/ObjetivosAnalyzer';
import type { ElementModel } from '../types';

const elements = [
  { id: 'h1', type: 'heading', heading_level: 1, text: 'Objetivos' },
  { id: 'h2g', type: 'heading', heading_level: 2, text: 'Objetivo general' },
  { id: 'g', type: 'paragraph', heading_level: null, text: 'Analizar el impacto de la transformación digital.' },
  { id: 'h2e', type: 'heading', heading_level: 2, text: 'Objetivos específicos' },
  { id: 'e1', type: 'paragraph', heading_level: null, text: 'Conocer las herramientas usadas en el sector público.' },
] as ElementModel[];

describe('ObjetivosAnalyzer (REV-L2)', () => {
  it('muestra el veredicto con jerarquía y la escala Bloom', () => {
    render(<ObjetivosAnalyzer elements={elements} onApply={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText(/objetivos no cumplen el nivel exigido/)).toBeTruthy();
    expect(screen.getByText('Recordar')).toBeTruthy();
    expect(screen.getAllByText('General').length).toBeGreaterThan(0);
    expect(screen.getByText(/nivel del general/)).toBeTruthy();
  });

  it('aplica una alternativa y no escribe por sí sola', () => {
    const onApply = vi.fn();
    render(<ObjetivosAnalyzer elements={elements} onApply={onApply} onBack={vi.fn()} />);
    // «Conocer» es nivel nulo; el propuesto es 4 y las alternativas son nivel 4.
    // Por rol: la escala Bloom también rotula el nivel «Aplicar» como texto.
    fireEvent.click(screen.getByRole('button', { name: 'analizar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(onApply).toHaveBeenCalledWith('e1', expect.stringContaining('Analizar'));
  });
});

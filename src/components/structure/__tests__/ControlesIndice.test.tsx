/**
 * Los controles de diseño del Índice: estilo, profundidad e insertar/quitar.
 *
 * El índice es el único destino de la fase que escribe en el documento, así
 * que sus controles tienen que decir la verdad de lo que ya hay: si el
 * índice existe, el botón quita; si no, inserta. Y la profundidad visible es
 * una decisión de lectura, no un adorno.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ControlesIndice } from '../ControlesIndice';

const base = {
  profundidad: 3 as const,
  onProfundidad: () => {},
  reglas: { toc_style: 'apa' as const },
  onRegla: () => {},
  hayIndice: false,
  onInsertar: () => {},
  onQuitar: () => {},
};

describe('ControlesIndice', () => {
  it('cambia la profundidad visible', () => {
    const onProf = vi.fn();
    render(<ControlesIndice {...base} profundidad={2} onProfundidad={onProf} />);
    fireEvent.click(screen.getByRole('button', { name: /hasta h1/i }));
    expect(onProf).toHaveBeenCalledWith(1);
  });

  it('ofrece las cuatro profundidades y marca la activa', () => {
    render(<ControlesIndice {...base} profundidad={2} />);
    expect(screen.getByRole('button', { name: /hasta h1/i }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: /hasta h2/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^todo$/i })).toBeTruthy();
  });

  it('inserta el índice cuando no existe', () => {
    const onInsert = vi.fn();
    render(<ControlesIndice {...base} onInsertar={onInsert} />);
    fireEvent.click(screen.getByRole('button', { name: /insertar índice/i }));
    expect(onInsert).toHaveBeenCalled();
  });

  it('quita el índice cuando ya existe', () => {
    const onQuitar = vi.fn();
    const onInsert = vi.fn();
    render(<ControlesIndice {...base} hayIndice onQuitar={onQuitar} onInsertar={onInsert} />);
    fireEvent.click(screen.getByRole('button', { name: /quitar índice/i }));
    expect(onQuitar).toHaveBeenCalled();
    expect(onInsert).not.toHaveBeenCalled();
  });

  it('cambia el estilo del índice y marca el activo', () => {
    const onRegla = vi.fn();
    render(<ControlesIndice {...base} onRegla={onRegla} />);
    expect(screen.getByRole('button', { name: /^apa$/i }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /punteado/i }));
    expect(onRegla).toHaveBeenCalledWith('toc_style', 'dotted');
  });

  it('no usa <select>: los controles son botones', () => {
    const { container } = render(<ControlesIndice {...base} />);
    expect(document.querySelector('select')).toBeNull();
    expect(container.querySelector('[data-testid="controles-indice"]')).toBeTruthy();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewInforme } from '../components/review/ReviewInforme';
import type { ElementModel } from '../types';
import type { AuditItem } from '../lib/auditItems';

const el = (id: string, type: string, heading_level: number | null, text: string): ElementModel => ({ id, type, heading_level, text } as ElementModel);
const item = (id: string, element_id: string): AuditItem =>
  ({ id, element_id, category: 'style', subtype: 'x', severity: 'medium', summary: 'cabe destacar', detail: '', originalText: '', pageNumber: 1, phase: null, readOnly: false }) as AuditItem;

const elements = [el('h', 'heading', 1, 'Objetivos'), el('o', 'paragraph', null, 'Conocer los procesos'), el('h2', 'heading', 1, 'Metodología'), el('p', 'paragraph', null, 'Texto con proceso y proceso.')];

describe('ReviewInforme', () => {
  it('muestra título, bloque de objetivos y bloque de repetición', () => {
    render(<ReviewInforme items={[item('1', 'p')]} elements={elements} title="Tesis" onStart={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('Informe general')).toBeTruthy();
    expect(screen.getByText(/Conocer/)).toBeTruthy();
    expect(screen.getByText('Repetición · cuerpo completo')).toBeTruthy();
  });

  it('«Leer y corregir» entra al modo lectura', () => {
    const onStart = vi.fn();
    render(<ReviewInforme items={[item('1', 'p')]} elements={elements} title="Tesis" onStart={onStart} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText(/Leer y corregir/i));
    expect(onStart).toHaveBeenCalled();
  });

  it('las leyes de metodología por fase van antes que Bloom y repetición', () => {
    const ley = { ...item('7', 'p'), phase: 'objetivos' } as AuditItem;
    render(<ReviewInforme items={[ley]} elements={elements} title="Tesis" onStart={vi.fn()} onBack={vi.fn()} />);
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings.indexOf('Leyes de metodología')).toBeGreaterThanOrEqual(0);
    expect(headings.indexOf('Leyes de metodología')).toBeLessThan(headings.indexOf('Objetivos · validación Bloom'));
    expect(screen.getByText('cabe destacar')).toBeTruthy();
  });

  it('dibuja el eje de Bloom, etiqueta General/Específico y aplica la alternativa elegida', () => {
    const onAplicar = vi.fn();
    const els = [
      el('h1', 'heading', 1, 'Objetivos'),
      el('g', 'paragraph', null, 'Desarrollar un sistema de gestión.'),
      el('e1', 'paragraph', null, 'Identificar los tiempos muertos.'),
    ];
    render(<ReviewInforme items={[]} elements={els} title="Tesis" onStart={vi.fn()} onBack={vi.fn()} onAplicar={onAplicar} />);
    expect(screen.getByText('Recordar')).toBeTruthy();
    expect(screen.getByText('Crear')).toBeTruthy();
    expect(screen.getByText(/^General/)).toBeTruthy();
    expect(screen.getByText(/^Específico 1/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'analizar' }));
    fireEvent.click(screen.getByText(/Aplicar la alternativa elegida/i));
    expect(onAplicar).toHaveBeenCalledWith('e1', expect.stringContaining('Analizar'));
  });

  it('los capítulos se tocan como mosaico y abren su capítulo', () => {
    const onStart = vi.fn();
    render(<ReviewInforme items={[item('1', 'p')]} elements={elements} title="Tesis" onStart={onStart} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Capítulo Metodología/ }));
    expect(onStart).toHaveBeenCalledWith('h2');
  });
});

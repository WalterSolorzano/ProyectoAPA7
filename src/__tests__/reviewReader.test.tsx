import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewReader } from '../components/review/ReviewReader';
import type { ElementModel } from '../types';
import type { AuditItem } from '../lib/auditItems';

vi.mock('../hooks/useMarkSource', () => ({
  useMarkSourceBase: () => ({}),
  buildMarkSource: (_b: unknown, elem: unknown) => ({ reviewResult: null, proofreadFindings: [], commentCtx: {}, showCitations: false, elem }),
}));

const el = (id: string, type: string, heading_level: number | null, text: string): ElementModel => ({ id, type, heading_level, text } as ElementModel);
const item = (id: string, element_id: string): AuditItem =>
  ({ id, element_id, category: 'style', subtype: 'x', severity: 'medium', summary: 'cabe destacar', detail: 'd', originalText: 'text', pageNumber: 3, phase: null, readOnly: false }) as AuditItem;

const elements = [el('h', 'heading', 1, '1. Introducción'), el('p', 'paragraph', null, 'En el presente apartado cabe destacar que todo sigue.'), el('h2', 'heading', 1, '2. Metodología'), el('q', 'paragraph', null, 'Otra frase.')];

describe('ReviewReader', () => {
  it('muestra la cinta de progreso y el dock del hallazgo', () => {
    render(<ReviewReader elements={elements} items={[item('1', 'p')]} onAccept={vi.fn()} onMark={vi.fn()} onDismiss={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText(/1 de 1/)).toBeTruthy();
    expect(screen.getByText('Aceptar')).toBeTruthy();
  });

  it('«Aceptar» llama onAccept con el hallazgo actual', () => {
    const onAccept = vi.fn();
    render(<ReviewReader elements={elements} items={[item('1', 'p')]} onAccept={onAccept} onMark={vi.fn()} onDismiss={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('Aceptar'));
    expect(onAccept).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('el botón Informe abre la hoja del informe encima', () => {
    render(<ReviewReader elements={elements} items={[item('1', 'p')]} onAccept={vi.fn()} onMark={vi.fn()} onDismiss={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Informe'));
    expect(screen.getByText('Informe general')).toBeTruthy();
  });
});

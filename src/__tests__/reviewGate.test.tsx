import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewGate } from '../components/review/ReviewGate';
import type { AuditItem } from '../lib/auditItems';

const item = (id: string, category: AuditItem['category']): AuditItem =>
  ({ id, element_id: 'e', category, subtype: 'x', severity: 'medium', summary: 's', detail: '', originalText: '', pageNumber: 1, phase: null, readOnly: false }) as AuditItem;

describe('ReviewGate', () => {
  it('no cuenta la IA en el total ni la muestra como fila', () => {
    render(
      <ReviewGate
        items={[item('1', 'style'), item('2', 'spelling'), item('3', 'ai')]}
        aiScore={0.8}
        isScanning={false}
        onScan={vi.fn()}
        onStart={vi.fn()}
        onOpenAiRoom={vi.fn()}
      />,
    );
    expect(screen.getByTestId('review-gate-total').textContent).toBe('2');
    expect(screen.queryByText('Voz sintética')).toBeNull();
  });

  it('el botón de Mapa IA aparece cuando hay IA y usa su etiqueta', () => {
    render(
      <ReviewGate items={[item('3', 'ai')]} aiScore={0.8} isScanning={false}
        onScan={vi.fn()} onStart={vi.fn()} onOpenAiRoom={vi.fn()} />,
    );
    expect(screen.getByText('Ver mapa de IA')).toBeTruthy();
  });
});

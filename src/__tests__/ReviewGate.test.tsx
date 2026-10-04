import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewGate, heatMatrix } from '../components/review/ReviewGate';
import type { AuditItem } from '../lib/auditItems';

const item = (over: Partial<AuditItem>): AuditItem => ({
  id: 'x', element_id: 'e1', category: 'ai', severity: 'medium',
  summary: 's', detail: 'd', originalText: 'o', pageNumber: 1, readOnly: false, ...over,
});

describe('heatMatrix', () => {
  it('cuenta hallazgos por categoria', () => {
    const m = heatMatrix([item({}), item({ category: 'spelling' })]);
    expect(m.ai).toBe(1);
    expect(m.spelling).toBe(1);
  });
});

describe('ReviewGate', () => {
  it('muestra estado vacio accionable sin datos', () => {
    render(<ReviewGate items={[]} aiScore={0} onStart={() => {}} onOpenAiRoom={() => {}} isScanning={false} onScan={() => {}} />);
    expect(screen.getByText(/escanear/i)).toBeTruthy();
  });

  it('con hallazgos muestra el total y el CTA de empezar', () => {
    render(<ReviewGate items={[item({}), item({ id: 'y' })]} aiScore={18} onStart={() => {}} onOpenAiRoom={() => {}} isScanning={false} onScan={() => {}} />);
    expect(screen.getByTestId('review-gate-total').textContent).toBe('2');
    expect(screen.getByText(/empezar revisión/i)).toBeTruthy();
  });
});

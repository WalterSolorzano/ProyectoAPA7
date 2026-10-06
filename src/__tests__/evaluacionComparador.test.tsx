import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvaluacionComparador } from '../components/review/EvaluacionComparador';
import type { AuditItem } from '../lib/auditItems';

const item = {
  id: 'ai-1',
  element_id: 'p1',
  category: 'ai',
  subtype: 'parrafo_ia',
  severity: 'high',
  summary: 'Fórmula sintética',
  detail: '',
  originalText: 'Texto sintético de prueba.',
  suggestedText: 'Propuesta con voz de autor.',
  pageNumber: 2,
  aiScore: 0.71,
  phase: 'metodo',
  readOnly: false,
} as AuditItem;

describe('EvaluacionComparador — fragmento marcado', () => {
  it('marca el fragmento original y muestra su confianza', () => {
    render(<EvaluacionComparador item={item} />);
    expect(screen.getByTestId('ia-fragmento').textContent).toBe('Texto sintético de prueba.');
    expect(screen.getByTestId('ia-confianza').textContent).toBe('71%');
  });

  it('no infla la confianza cuando el score ya viene en escala 0-100', () => {
    render(<EvaluacionComparador item={{ ...item, aiScore: 78 } as AuditItem} />);
    expect(screen.getByTestId('ia-confianza').textContent).toBe('78%');
  });
});

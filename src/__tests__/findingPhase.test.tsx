import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FindingDetail } from '../components/review/FindingDetail';
import type { AuditItem } from '../lib/auditItems';

/* La fase se NOMBRA y lo de solo lectura no se puede aceptar. Las dos mitades
   de la misma decisión: la portada se mide, y lo que se mide no se toca. */

const base: AuditItem = {
  id: 'h1', element_id: 'e1', category: 'structure', subtype: 'portada',
  severity: 'low', summary: 'Título de portada', detail: 'Termina en punto',
  originalText: 'Percepción de la identidad.', pageNumber: 1,
  phase: 'portada', readOnly: true,
};

const props = (over: Partial<AuditItem> = {}, action: 'none' | 'accept' = 'none') => ({
  item: { ...base, ...over },
  index: 0,
  total: 1,
  onStep: vi.fn(),
  onAccept: vi.fn(),
  onDismiss: vi.fn(),
  onMark: vi.fn(),
  busy: false,
  action,
  totalSubtype: 1,
  onEngineAction: vi.fn(),
});

/* La fase y la leyenda de solo lectura viven en el MISMO nodo, así que el texto
   llega partido en dos. Las aserciones usan `textContent` por eso. */

describe('la fase se nombra en el hallazgo', () => {
  it('un hallazgo de fase dice en qué fase está', () => {
    render(<FindingDetail {...props({ phase: 'objetivos', readOnly: false })} />);
    expect(screen.getByText('Objetivos')).toBeTruthy();
  });

  it('una regla general no se finge de fase', () => {
    render(<FindingDetail {...props({ phase: null, readOnly: false })} />);
    expect(screen.getByText('Todo el documento')).toBeTruthy();
  });

  it('una clave desconocida no rompe ni inventa nombre de fase', () => {
    render(<FindingDetail {...props({ phase: 'clave_inventada' })} />);
    expect(document.body.textContent).toContain('Seccion sin nombre');
  });

  it('lo de solo lectura se dice, y no se ofrece aceptar', () => {
    render(<FindingDetail {...props({ suggestedText: 'Determinar' }, 'accept')} />);
    expect(document.body.textContent).toContain('solo lectura');
    expect(screen.queryByRole('button', { name: /aplicar/i })).toBeNull();
  });

  it('un hallazgo de fase normal sí ofrece aplicar su corrección', () => {
    render(
      <FindingDetail
        {...props({ phase: 'objetivos', readOnly: false, suggestedText: 'Determinar' }, 'accept')}
      />,
    );
    expect(screen.getByRole('button', { name: /aplicar/i })).toBeTruthy();
    expect(document.body.textContent).not.toContain('solo lectura');
  });
});

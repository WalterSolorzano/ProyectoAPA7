import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FindingAccordion, actionsForItem } from '../components/review/FindingAccordion';
import { vi } from 'vitest';
import type { AuditItem } from '../lib/auditItems';

const item = (over: Partial<AuditItem>): AuditItem => ({
  id: 'x', element_id: 'e1', category: 'ai', severity: 'medium',
  summary: 'Frase sintética', detail: 'detalle', originalText: 'original',
  suggestedText: 'propuesta', pageNumber: 1, readOnly: false, ...over,
});

describe('actionsForItem', () => {
  it('la voz sintetica nunca ofrece Aceptar', () => {
    expect(actionsForItem(item({ category: 'ai' }))).toEqual(['Marcar para revisar', 'Descartar']);
  });

  it('la ortografia si ofrece Aceptar', () => {
    expect(actionsForItem(item({ category: 'spelling' }))).toContain('Aceptar');
  });

  it('un hallazgo de portada es de solo lectura', () => {
    expect(actionsForItem(item({ readOnly: true }))).toEqual([]);
  });
});

describe('FindingAccordion', () => {
  it('cerrado muestra el tema, abierto muestra el caso exacto', () => {
    const { rerender } = render(
      <FindingAccordion item={item({})} open={false} onToggle={() => {}} onAccept={() => {}} onMark={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.getByText('Frase sintética')).toBeTruthy();
    expect(screen.queryByText('propuesta')).toBeNull();
    rerender(
      <FindingAccordion item={item({})} open onToggle={() => {}} onAccept={() => {}} onMark={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.getByText('propuesta')).toBeTruthy();
  });

  it('no muestra boton de aceptar en un hallazgo de solo lectura', () => {
    render(
      <FindingAccordion item={item({ readOnly: true })} open onToggle={() => {}} onAccept={() => {}} onMark={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /aceptar/i })).toBeNull();
  });
});

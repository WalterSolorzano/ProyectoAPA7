import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryDashboard, groupByTheme } from '../components/review/CategoryDashboard';
import type { AuditItem } from '../lib/auditItems';

const item = (over: Partial<AuditItem>): AuditItem => ({
  id: 'x', element_id: 'e1', category: 'style', severity: 'medium',
  summary: 'Objetivo con verbo vago', detail: 'detalle', originalText: 'original',
  suggestedText: 'propuesta', pageNumber: 2, readOnly: false, ...over,
});

describe('groupByTheme', () => {
  it('agrupa por categoria y subtema sin perder items', () => {
    const items = [item({}), item({ id: 'y' })];
    const grupos = groupByTheme(items);
    expect(grupos.flatMap((g) => g.items)).toHaveLength(2);
  });
});

describe('CategoryDashboard', () => {
  it('muestra la cifra grande de la categoria', () => {
    render(
      <CategoryDashboard category="style" items={[item({}), item({ id: 'y' })]} onAccept={() => {}} onMark={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('cada correccion esta cerrada por defecto', () => {
    render(
      <CategoryDashboard category="style" items={[item({})]} onAccept={() => {}} onMark={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.queryByText('propuesta')).toBeNull();
    fireEvent.click(screen.getByText('Objetivo con verbo vago'));
    expect(screen.getByText('propuesta')).toBeTruthy();
  });
});

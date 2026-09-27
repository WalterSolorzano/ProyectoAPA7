/**
 * WordAPA7 — T13: la tira de Revision lleva los filtros por motor a la
 * izquierda y el paginador a la derecha. Es la unica barra de la vista.
 *
 * Tres reglas de producto que estos tests sostienen, no azucar:
 * - El chip activo se REPRESENTA (aria-pressed), no se filtra aqui: quien
 *   filtra el rack y el minimapa es `useReviewWorkbench`.
 * - El cumplimiento solo aparece si fue medido (`number | null`).
 * - El paginador no pasa de sus extremos: en la primera pagina "anterior" no
 *   hace nada, en la ultima "siguiente" tampoco.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewStrip } from '../components/review/ReviewStrip';
import { ENGINE_META, type EngineGroup } from '../hooks/useReviewWorkbench';

const grupo = (engine: EngineGroup['engine'], count: number): EngineGroup => ({
  engine,
  title: ENGINE_META[engine].title,
  chip: ENGINE_META[engine].chip,
  count,
  criticalHigh: 0,
  groups: [],
  massAction: 'accept',
  massLabel: 'Aceptar todas',
});

const setup = (over: Partial<React.ComponentProps<typeof ReviewStrip>> = {}) => {
  const onFilter = vi.fn();
  const onPage = vi.fn();
  const onNextFinding = vi.fn();
  const onViewMode = vi.fn();
  const utils = render(
    <ReviewStrip
      groups={[grupo('spelling', 48), grupo('ai', 14)]}
      filter="all"
      onFilter={onFilter}
      totalPages={132}
      currentPage={14}
      onPage={onPage}
      onNextFinding={onNextFinding}
      compliance={97}
      viewMode="focus"
      onViewMode={onViewMode}
      hasFindings
      onScan={vi.fn()}
      isScanning={false}
      {...over}
    />,
  );
  return { ...utils, onFilter, onPage, onNextFinding, onViewMode };
};

describe('T13 — ReviewStrip', () => {
  it('lista un chip por motor con su contador, más el chip Todo', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Todo 62' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ortografía 48' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Patrones IA 14' })).toBeTruthy();
  });

  it('marca el chip activo con aria-pressed', () => {
    setup({ filter: 'spelling' });
    expect(screen.getByRole('button', { name: 'Ortografía 48' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Todo 62' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('pedir un chip pide ese filtro, y no filtra nada por su cuenta', () => {
    const { onFilter } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Ortografía 48' }));
    expect(onFilter).toHaveBeenCalledWith('spelling');
    fireEvent.click(screen.getByRole('button', { name: 'Todo 62' }));
    expect(onFilter).toHaveBeenLastCalledWith('all');
    // El chip de IA sigue en pantalla tras pedir un filtro: el filtrado es del
    // hook, la tira solo representa lo que le pasaron.
    expect(screen.getByRole('button', { name: 'Patrones IA 14' })).toBeTruthy();
  });

  it('publica la página actual sobre el total', () => {
    setup();
    expect(screen.getByText('Página 14 de 132')).toBeTruthy();
  });

  it('en la primera página, "anterior" no pagina', () => {
    const { onPage } = setup({ currentPage: 1 });
    const prev = screen.getByRole('button', { name: 'Página anterior' });
    expect(prev.hasAttribute('disabled')).toBe(true);
    fireEvent.click(prev);
    expect(onPage).not.toHaveBeenCalled();
  });

  it('en la última página, "siguiente" no pagina', () => {
    const { onPage } = setup({ currentPage: 132 });
    const next = screen.getByRole('button', { name: 'Página siguiente' });
    expect(next.hasAttribute('disabled')).toBe(true);
    fireEvent.click(next);
    expect(onPage).not.toHaveBeenCalled();
  });

  it('en medio del documento, las flechas paginan de a uno', () => {
    const { onPage } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(onPage).toHaveBeenCalledWith(13);
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(onPage).toHaveBeenCalledWith(15);
  });

  it('sin páginas, no inventa un paginador', () => {
    setup({ totalPages: 0, currentPage: 1 });
    expect(screen.queryByText(/Página/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Página anterior' })).toBeNull();
  });

  it('"Siguiente hallazgo" dispara su acción', () => {
    const { onNextFinding } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente hallazgo' }));
    expect(onNextFinding).toHaveBeenCalledTimes(1);
  });

  it('el toggle de vista ofrece Foco y Hoja, y refleja la activa', () => {
    const { onViewMode } = setup();
    expect(screen.getByRole('button', { name: 'Foco' }).getAttribute('aria-pressed')).toBe('true');
    const hoja = screen.getByRole('button', { name: 'Hoja' });
    expect(hoja.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(hoja);
    expect(onViewMode).toHaveBeenCalledWith('canvas');
  });

  it('con cumplimiento medido, lo publica', () => {
    setup({ compliance: 97 });
    expect(screen.getByText('Cumplimiento 97%')).toBeTruthy();
  });

  it('sin cumplimiento medido, no inventa un porcentaje', () => {
    setup({ compliance: null });
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('sin resultados, ofrece Escanear', () => {
    const onScan = vi.fn();
    setup({ hasFindings: false, groups: [], onScan });
    fireEvent.click(screen.getByRole('button', { name: 'Escanear' }));
    expect(onScan).toHaveBeenCalled();
    // Sin hallazgos, "Todo" sigue en 0: la tira no inventa un total.
    expect(screen.getByRole('button', { name: 'Todo 0' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Siguiente hallazgo' })).toBeTruthy();
  });

  it('mientras escanea, el botón lo dice y no se repite', () => {
    const onScan = vi.fn();
    setup({ hasFindings: false, groups: [], onScan, isScanning: true });
    const btn = screen.getByRole('button', { name: 'Escaneando' });
    expect(btn.hasAttribute('disabled')).toBe(true);
    fireEvent.click(btn);
    expect(onScan).not.toHaveBeenCalled();
  });
});

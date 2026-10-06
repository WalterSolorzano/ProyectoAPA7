import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewGate } from '../components/review/ReviewGate';
import type { AuditItem } from '../lib/auditItems';
import { phaseLabel } from '../lib/auditItems';
import type { ElementModel } from '../types';

const item = (id: string, category: AuditItem['category']): AuditItem =>
  ({ id, element_id: 'e', category, subtype: 'x', severity: 'medium', summary: 's', detail: '', originalText: '', pageNumber: 1, phase: null, readOnly: false }) as AuditItem;

const itemConFase = (id: string, category: AuditItem['category'], phase: string): AuditItem =>
  ({ ...item(id, category), phase }) as AuditItem;

const encabezado = (id: string, text: string): ElementModel =>
  ({ id, type: 'heading', heading_level: 1, text } as ElementModel);
const parrafo = (id: string): ElementModel => ({ id, type: 'paragraph', heading_level: null, text: 'x' } as ElementModel);

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

  it('la matriz abre una fila por fase y aprende la fase del backend', () => {
    render(
      <ReviewGate
        items={[itemConFase('1', 'spelling', 'metodo')]}
        elements={[encabezado('h1', 'Sección propia'), parrafo('e')]}
        aiScore={0}
        isScanning={false}
        onScan={vi.fn()}
        onStart={vi.fn()}
        onOpenAiRoom={vi.fn()}
      />,
    );
    expect(screen.getByText(phaseLabel('metodo'))).toBeTruthy();
    expect(screen.getByText('Ortografía')).toBeTruthy();
  });

  it('ofrece el Mapa IA aunque todavía no haya voz sintética', () => {
    render(
      <ReviewGate
        items={[item('1', 'spelling')]}
        aiScore={0}
        isScanning={false}
        onScan={vi.fn()}
        onStart={vi.fn()}
        onOpenAiRoom={vi.fn()}
      />,
    );
    const boton = screen.getByText('Ver mapa de IA').closest('button') as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
  });

  /* Drill-down: la matriz deja de ser un cartel y abre la revisión ya acotada. */
  const gateConFase = (onStart: (foco?: { phase?: string; engine?: string }) => void) =>
    render(
      <ReviewGate
        items={[itemConFase('1', 'spelling', 'metodo')]}
        elements={[encabezado('h1', 'Metodo'), parrafo('e')]}
        aiScore={0}
        isScanning={false}
        onScan={vi.fn()}
        onStart={onStart}
        onOpenAiRoom={vi.fn()}
      />,
    );

  it('una celda con hallazgos abre la revisión filtrada por fase y motor', () => {
    const onStart = vi.fn();
    gateConFase(onStart);
    fireEvent.click(screen.getByRole('button', { name: /Revisar Metodo: 1 hallazgo de Ortografía/i }));
    expect(onStart).toHaveBeenCalledWith({ phase: 'metodo', engine: 'spelling' });
  });

  it('la etiqueta de fase abre la revisión filtrada solo por esa fase', () => {
    const onStart = vi.fn();
    gateConFase(onStart);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar la fase Metodo' }));
    expect(onStart).toHaveBeenCalledWith({ phase: 'metodo' });
  });

  it('una celda sin hallazgos no es un botón accionable', () => {
    gateConFase(vi.fn());
    // Ortografía tiene 1; Estructura tiene 0: su celda no abre nada.
    expect(
      screen.getByRole('button', { name: /Revisar Metodo: 0 hallazgos de Estructura/i }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('el botón global abre sin filtro: la matriz entera', () => {
    const onStart = vi.fn();
    gateConFase(onStart);
    fireEvent.click(screen.getByRole('button', { name: /Empezar revisión/i }));
    expect(onStart).toHaveBeenCalledWith();
  });
});

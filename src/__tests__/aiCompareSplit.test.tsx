/* T17 — el split-comparador de la sala de IA (robado del workbench de feat).
   Dos columnas lado a lado: Texto Original (fórmula LLM) y Propuesta con Voz
   de Autor Humano. El motor de IA es PROBABILÍSTICO (AGENTS.md §1): solo
   propone; la acción de la propuesta es "Marcar para revisar" / "Reemplazar
   en Manuscrito", NUNCA "Aceptar". */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiCompareSplit } from '../components/review/AiCompareSplit';
import type { AuditItem } from '../lib/auditItems';

const item: AuditItem = {
  id: 'ai_rev_p1_0',
  element_id: 'p1',
  category: 'ai',
  subtype: 'ai_phrase',
  severity: 'high',
  summary: 'Índice de IA 71% — rigidez sintáctica detectada',
  detail: 'Estructura reiterativa característica de modelos generativos.',
  originalText: 'pone de manifiesto la importancia capital',
  suggestedText: 'demuestra que el fenómeno es decisivo',
  pageNumber: 3,
  aiScore: 0.71,
  phase: 'resultados',
  readOnly: false,
};

describe('T17 — el split-comparador de la sala de IA', () => {
  it('muestra las dos columnas: original (fórmula LLM) y propuesta humana', () => {
    render(<AiCompareSplit item={item} />);
    expect(screen.getByText(/Texto Original \(Fórmula LLM Detectada\)/i)).toBeTruthy();
    expect(screen.getByText(/Propuesta con Voz de Autor Humano/i)).toBeTruthy();
    expect(screen.getByText('pone de manifiesto la importancia capital')).toBeTruthy();
  });

  it('la propuesta arranca con la sugerencia del hallazgo y es editable', () => {
    render(<AiCompareSplit item={item} />);
    const ta = screen.getByLabelText(/Propuesta con Voz de Autor Humano/i) as HTMLTextAreaElement;
    expect(ta.value).toBe('demuestra que el fenómeno es decisivo');
    fireEvent.change(ta, { target: { value: 'demuestra de forma concluyente' } });
    expect(ta.value).toBe('demuestra de forma concluyente');
  });

  it('sin sugerencia usa el texto original como punto de partida', () => {
    render(<AiCompareSplit item={{ ...item, suggestedText: undefined }} />);
    const ta = screen.getByLabelText(/Propuesta con Voz de Autor Humano/i) as HTMLTextAreaElement;
    expect(ta.value).toBe('pone de manifiesto la importancia capital');
  });

  it('ofrece Marcar para revisar y NUNCA Aceptar (motor probabilístico)', () => {
    render(<AiCompareSplit item={item} onMark={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Marcar para revisar/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Aceptar/i })).toBeNull();
  });

  it('Marcar para revisar invoca onMark con el id del hallazgo', () => {
    const onMark = vi.fn();
    render(<AiCompareSplit item={item} onMark={onMark} />);
    fireEvent.click(screen.getByRole('button', { name: /Marcar para revisar/i }));
    expect(onMark).toHaveBeenCalledWith('ai_rev_p1_0');
  });

  it('Reemplazar en Manuscrito entrega el texto editado', () => {
    const onReplace = vi.fn();
    render(<AiCompareSplit item={item} onReplace={onReplace} />);
    const ta = screen.getByLabelText(/Propuesta con Voz de Autor Humano/i);
    fireEvent.change(ta, { target: { value: 'propuesta reescrita por la persona' } });
    fireEvent.click(screen.getByRole('button', { name: /Reemplazar en Manuscrito/i }));
    expect(onReplace).toHaveBeenCalledWith('ai_rev_p1_0', 'propuesta reescrita por la persona');
  });

  it('Reemplazar en Manuscrito está deshabilitado si la propuesta está vacía', () => {
    render(<AiCompareSplit item={{ ...item, suggestedText: 'x' }} onReplace={vi.fn()} />);
    const ta = screen.getByLabelText(/Propuesta con Voz de Autor Humano/i);
    fireEvent.change(ta, { target: { value: '   ' } });
    const btn = screen.getByRole('button', { name: /Reemplazar en Manuscrito/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('no renderiza el split cuando el hallazgo no es de IA', () => {
    const { container } = render(<AiCompareSplit item={{ ...item, category: 'spelling' }} />);
    expect(container.querySelector('[data-testid="ai-compare-split"]')).toBeNull();
  });
});

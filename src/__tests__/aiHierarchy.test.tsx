import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiHierarchy } from '../components/review/AiHierarchy';
import type { ElementModel } from '../types';
import type { AuditItem } from '../lib/auditItems';

const mockElements = [
  {
    id: 'h1-1',
    type: 'heading',
    heading_level: 1,
    text: 'Capítulo 1: Introducción',
  },
  {
    id: 'h2-1',
    type: 'heading',
    heading_level: 2,
    text: '1.1 Contexto General',
  },
  {
    id: 'p-1',
    type: 'paragraph',
    text: 'Este es un párrafo generado artificialmente con patrones típicos de un modelo de lenguaje.',
  },
] as unknown as ElementModel[];

const mockAiItems: AuditItem[] = [
  {
    id: 'ai-1',
    element_id: 'h2-1',
    category: 'ai',
    subtype: 'parrafo_ia',
    severity: 'high',
    summary: 'Fórmula sintética detectada',
    detail: 'Uso de estructuras redundantes típicas de LLM',
    originalText: 'Este es un párrafo generado artificialmente con patrones típicos de un modelo de lenguaje.',
    suggestedText: 'Este párrafo contextualiza la problemática de estudio de manera directa.',
    pageNumber: 2,
    aiScore: 78,
    phase: 'introduccion',
    readOnly: false,
  },
];

describe('AiHierarchy — Dashboard y Explorador Jerárquico', () => {
  it('renderiza estado vacío sin documento', () => {
    render(<AiHierarchy elements={null} items={[]} />);
    expect(screen.getByText('Sin documento cargado')).toBeTruthy();
  });

  it('renderiza el macro dashboard con termómetro de voz humana', () => {
    render(<AiHierarchy elements={mockElements} items={mockAiItems} />);
    expect(screen.getByText('Voz Autoral Humana')).toBeTruthy();
    expect(screen.getByText('Párrafos en Alerta')).toBeTruthy();
  });

  it('muestra la jerarquía de capítulos H1 y subsecciones', () => {
    render(<AiHierarchy elements={mockElements} items={mockAiItems} />);
    expect(screen.getAllByText(/Capítulo 1/).length).toBeGreaterThan(0);
  });

  it('permite copiar la propuesta humana', () => {
    const originalClipboard = navigator.clipboard;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<AiHierarchy elements={mockElements} items={mockAiItems} />);
    const copyBtn = screen.getByRole('button', { name: /Copiar/i });
    fireEvent.click(copyBtn);
    expect(writeText).toHaveBeenCalled();

    Object.assign(navigator, { clipboard: originalClipboard });
  });

  it('dispara onApplyParaphrase al presionar Reemplazar en Manuscrito', async () => {
    const onApplyParaphrase = vi.fn().mockResolvedValue(undefined);
    render(
      <AiHierarchy
        elements={mockElements}
        items={mockAiItems}
        onApplyParaphrase={onApplyParaphrase}
      />,
    );

    const applyBtn = screen.getByRole('button', { name: /Reemplazar en Manuscrito/i });
    fireEvent.click(applyBtn);
    expect(onApplyParaphrase).toHaveBeenCalledWith(mockAiItems[0], mockAiItems[0].suggestedText);
  });
});

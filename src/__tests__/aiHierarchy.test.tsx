import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiHierarchy } from '../components/review/AiHierarchy';
import type { ElementModel } from '../types';
import type { AuditItem } from '../lib/auditItems';
import type { AIReviewParagraph } from '../api/backend';

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

/* `index` es el índice del elemento en `elements` (así lo emite el backend). */
const mockParagraphs = [
  { element_id: 'h1-1', index: 0, type: 'heading', text: 'Capítulo 1: Introducción', ai_score: 10, ai_category: 'LOW', findings: [], spelling: [] },
  { element_id: 'h2-1', index: 1, type: 'heading', text: '1.1 Contexto General', ai_score: 78, ai_category: 'HIGH', findings: [], spelling: [] },
  { element_id: 'p-1', index: 2, type: 'paragraph', text: 'Este es un párrafo generado artificialmente con patrones típicos de un modelo de lenguaje.', ai_score: 55, ai_category: 'HIGH', findings: [], spelling: [] },
] as unknown as AIReviewParagraph[];

describe('AiHierarchy — Dashboard y Explorador Jerárquico', () => {
  it('renderiza estado vacío sin documento', () => {
    render(<AiHierarchy elements={null} items={[]} paragraphs={[]} />);
    expect(screen.getByText('Sin documento cargado')).toBeTruthy();
  });

  it('renderiza el macro dashboard con termómetro de voz humana', () => {
    render(<AiHierarchy elements={mockElements} items={mockAiItems} paragraphs={mockParagraphs} />);
    expect(screen.getByText('Voz Autoral Humana')).toBeTruthy();
    expect(screen.getByText('Párrafos en Alerta')).toBeTruthy();
  });

  it('muestra la jerarquía de capítulos H1 y subsecciones', () => {
    render(<AiHierarchy elements={mockElements} items={mockAiItems} paragraphs={mockParagraphs} />);
    expect(screen.getAllByText(/Capítulo 1/).length).toBeGreaterThan(0);
  });

  it('permite copiar la propuesta humana', () => {
    const originalClipboard = navigator.clipboard;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<AiHierarchy elements={mockElements} items={mockAiItems} paragraphs={mockParagraphs} />);
    fireEvent.click(screen.getByRole('button', { name: 'Capítulo 1: Introducción' }));
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
        paragraphs={mockParagraphs}
        onApplyParaphrase={onApplyParaphrase}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Capítulo 1: Introducción' }));
    const applyBtn = screen.getByRole('button', { name: /Reemplazar en Manuscrito/i });
    fireEvent.click(applyBtn);
    expect(onApplyParaphrase).toHaveBeenCalledWith(mockAiItems[0], mockAiItems[0].suggestedText);
  });

  it('el perfil dibuja un punto por párrafo medido', () => {
    render(<AiHierarchy elements={mockElements} items={mockAiItems} paragraphs={mockParagraphs} />);
    expect(document.querySelectorAll('.aip-punto')).toHaveLength(mockParagraphs.length);
  });

  it('el perfil abre la fase al pulsar su título', () => {
    render(<AiHierarchy elements={mockElements} items={mockAiItems} paragraphs={mockParagraphs} />);
    fireEvent.click(screen.getByRole('button', { name: 'Capítulo 1: Introducción' }));
    expect(screen.getByText('‹ Mapa IA')).toBeTruthy();
  });

  it('un punto con hallazgo salta al workbench', () => {
    const onOpenInWorkbench = vi.fn();
    render(
      <AiHierarchy
        elements={mockElements}
        items={mockAiItems}
        paragraphs={mockParagraphs}
        onOpenInWorkbench={onOpenInWorkbench}
      />,
    );
    const puntos = document.querySelectorAll('.aip-punto');
    /* puntos[1] es el párrafo index 1 → element_id 'h2-1', que sí tiene hallazgo. */
    fireEvent.click(puntos[1] as HTMLElement);
    expect(onOpenInWorkbench).toHaveBeenCalledWith(mockAiItems[0]);
  });

  it('el mapa ofrece Siguiente con IA', () => {
    render(<AiHierarchy elements={mockElements} items={mockAiItems} paragraphs={mockParagraphs} />);
    expect(screen.getByRole('button', { name: /Siguiente con IA/i })).toBeTruthy();
  });

  it('el botón de volver del capítulo aislado dice «‹ Mapa IA»', () => {
    render(<AiHierarchy elements={mockElements} items={mockAiItems} paragraphs={mockParagraphs} />);
    fireEvent.click(screen.getByRole('button', { name: 'Capítulo 1: Introducción' }));
    expect(screen.getByText('‹ Mapa IA')).toBeTruthy();
  });
});

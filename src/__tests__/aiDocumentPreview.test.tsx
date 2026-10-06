import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiDocumentPreview } from '../components/review/AiDocumentPreview';
import type { AIReviewParagraph } from '../api/backend';

const paragraphs = [
  { element_id: 'p1', index: 0, type: 'paragraph', text: 'uno', ai_score: 82, ai_category: 'HIGH', findings: [], spelling: [] },
] as AIReviewParagraph[];

describe('AiDocumentPreview', () => {
  it('muestra la leyenda de bandas y el toggle', () => {
    render(<AiDocumentPreview paragraphs={paragraphs} onClose={vi.fn()} onOpenParagraph={vi.fn()} />);
    expect(screen.getByText('Mostrar manchas')).toBeTruthy();
    expect(screen.getByText('Baja')).toBeTruthy();
    expect(screen.getByText('Crítica')).toBeTruthy();
  });

  it('cerrar vuelve a IA-L0', () => {
    const onClose = vi.fn();
    render(<AiDocumentPreview paragraphs={paragraphs} onClose={onClose} onOpenParagraph={vi.fn()} />);
    fireEvent.click(screen.getByText(/Cerrar vista previa/));
    expect(onClose).toHaveBeenCalled();
  });
});

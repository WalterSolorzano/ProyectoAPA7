import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiSectionDetail } from '../components/review/AiSectionDetail';
import type { FilaPerfilIA } from '../lib/aiPerfil';
import type { AIReviewParagraph } from '../api/backend';

const fila: FilaPerfilIA = {
  h1Id: 'h1', titulo: 'Desarrollo', fase: null, rigidezMedia: 64, porBanda: [0, 0, 1, 1],
  parrafos: [
    { elementId: 'p1', index: 0, score: 82, categoria: 'HIGH', excerpt: 'La transformación digital', carril: 0, h2Id: 'h2a', h2Titulo: 'Marco' },
    { elementId: 'p2', index: 1, score: 54, categoria: 'MEDIUM', excerpt: 'Asimismo', carril: 0, h2Id: 'h2b', h2Titulo: 'Discusión' },
  ],
};
const paragraphs = [
  { element_id: 'p1', index: 0, type: 'paragraph', text: 'La transformación digital ha redefinido', ai_score: 82, ai_category: 'HIGH', findings: [{ phrase: 'La transformación digital', detail: 'Apertura genérica', severity: 'HIGH' }], spelling: [] },
  { element_id: 'p2', index: 1, type: 'paragraph', text: 'Asimismo', ai_score: 54, ai_category: 'MEDIUM', findings: [{ phrase: 'Asimismo', detail: 'Conector formulario', severity: 'MEDIUM' }], spelling: [] },
] as AIReviewParagraph[];

describe('AiSectionDetail (IA-L1)', () => {
  it('lista los párrafos agrupados por H2 y muestra el porqué real', () => {
    render(<AiSectionDetail fila={fila} paragraphs={paragraphs} onBack={vi.fn()} onMark={vi.fn()} />);
    expect(screen.getByText('Marco')).toBeTruthy();
    expect(screen.getByText('Discusión')).toBeTruthy();
    expect(screen.getByText(/Apertura genérica/)).toBeTruthy();
  });

  it('filtra por banda', () => {
    render(<AiSectionDetail fila={fila} paragraphs={paragraphs} onBack={vi.fn()} onMark={vi.fn()} />);
    fireEvent.click(screen.getByText('Medio · 1'));
    expect(screen.queryByText('Párrafo 1')).toBeNull();
    expect(screen.getByText('Párrafo 2')).toBeTruthy();
  });

  it('resuelve el panel derecho desde la banda activa, no desde la selección excluida', () => {
    render(<AiSectionDetail fila={fila} paragraphs={paragraphs} onBack={vi.fn()} onMark={vi.fn()} />);
    expect(screen.getByText('Apertura genérica')).toBeTruthy();
    fireEvent.click(screen.getByText('Medio · 1'));
    expect(screen.queryByText('Apertura genérica')).toBeNull();
    expect(screen.getByText('Conector formulario')).toBeTruthy();
  });

  it('marca para revisar y nunca ofrece Aceptar', () => {
    const onMark = vi.fn();
    render(<AiSectionDetail fila={fila} paragraphs={paragraphs} onBack={vi.fn()} onMark={onMark} />);
    expect(screen.queryByText('Aceptar')).toBeNull();
    fireEvent.click(screen.getByText('Marcar para revisar'));
    expect(onMark).toHaveBeenCalledWith('p1');
  });
});

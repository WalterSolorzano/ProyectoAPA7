/* WordAPA7 — Task 10: integración del conteo de pendientes en el StepRail.
   El riel debe consumir el conteo compartido (railPending.ts), no un derivado local.
   Fases 4 (referencias) y 5 (revisión & IA) deben reflejar pendientes. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StepRail } from '../components/wizard/StepRail';
import { useDocStore } from '../store/useDocStore';
import type { DocumentModel, ElementModel } from '../types';

function elem(overrides: Partial<ElementModel> = {}): ElementModel {
  return {
    id: `e_${Math.random().toString(36).slice(2, 9)}`,
    type: 'paragraph',
    heading_level: null,
    text: 'texto',
    style_name: 'Normal',
    alignment: 'left',
    font_name: 'Times New Roman',
    font_size: 12,
    is_bold: false,
    is_italic: false,
    is_bullet: false,
    left_indent_cm: 0,
    confidence: 0.95,
    is_user_modified: false,
    needs_review: false,
    auto_applied: false,
    cita_ids: [],
    ...overrides,
  } as ElementModel;
}

function makeDoc(elements: ElementModel[]): DocumentModel {
  return {
    session_id: 's1',
    file_name: 'doc.docx',
    apa_format: 'student',
    elements,
  } as unknown as DocumentModel;
}

const baseState = {
  wizardStep: 5,
  doc: null as DocumentModel | null,
  proofreadFindings: [],
  citationAuditResult: null as { ghost_citations: any[]; orphan_references: any[] } | null,
  reviewResult: null,
  portada: { title: 'T', author: 'A' },
  coverSetupDone: false,
  leftSidebarWidth: 280,
} as any;

describe('StepRail — conteo compartido de pendientes (Task 10)', () => {
  beforeEach(() => {
    useDocStore.setState({ ...baseState });
  });

  afterEach(() => {
    useDocStore.setState({ ...baseState });
  });

  it('muestra badge en Referencias (fase 4) cuando hay citas fantasma', () => {
    useDocStore.setState({
      doc: makeDoc([elem({ id: 'p1', type: 'paragraph', text: 'Cuerpo' })]),
      citationAuditResult: {
        ghost_citations: [{ citation_text: 'Pérez, 2020' }],
        orphan_references: [],
      },
    });
    render(<StepRail />);
    const refBtn = screen.getByTitle('Referencias');
    expect(refBtn.textContent).toContain('1');
  });

  it('muestra badge en Revisión & IA (fase 5) derivado del conteo compartido', () => {
    // Un heading con needs_review=true no estaba en el derivado local de fase 5
    // (que solo sumaba proofread + ghosts). El conteo compartido sí lo cuenta
    // como hallazgo de estructura.
    useDocStore.setState({
      doc: makeDoc([elem({ id: 'h1', type: 'heading', heading_level: 1, text: 'Introducción', needs_review: true })]),
      proofreadFindings: [],
      citationAuditResult: null,
    });
    render(<StepRail />);
    const aiBtn = screen.getByTitle('Revisión & IA');
    expect(aiBtn.textContent).toContain('1');
  });
});

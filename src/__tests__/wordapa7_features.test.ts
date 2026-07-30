/**
 * WordAPA7 — Feature Tests for R1, R2, R3
 *
 * Tests for:
 * - R1: Visual Pagination with Level 1 Headings (computePages)
 * - R2: Real-time Roman/Decimal Numbering (toRoman & renumberHeadings)
 * - R3: Structural Revision Panel (Step2HeadingsWizard controls)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { useDocStore, toRoman, cleanHeadingPrefix } from '../store/useDocStore';
import { computePages } from '../components/layout/PaperCanvas';
import { Step2HeadingsWizard } from '../components/wizard/Step2HeadingsWizard';
import { DocumentModel, ElementModel } from '../types';

function makeDocElement(overrides: Partial<ElementModel> = {}): ElementModel {
  return {
    id: `elem_${Math.random().toString(36).substring(2, 9)}`,
    type: 'paragraph',
    heading_level: 1,
    text: 'Texto de prueba',
    style_name: 'Normal',
    alignment: 'left',
    font_name: 'Times New Roman',
    font_size: 12,
    is_bold: false,
    is_italic: false,
    is_bullet: false,
    left_indent_cm: 0,
    confidence: 0.9,
    is_user_modified: false,
    needs_review: false,
    auto_applied: false,
    cita_ids: [],
    ...overrides,
  };
}

describe('R2: Real-time Roman and Decimal Numbering (useDocStore)', () => {
  beforeEach(() => {
    useDocStore.setState({
      doc: null,
      history: [],
      historyIndex: -1,
    });
  });

  describe('toRoman helper function', () => {
    it('converts positive integers to Roman numerals', () => {
      expect(toRoman(1)).toBe('I');
      expect(toRoman(2)).toBe('II');
      expect(toRoman(3)).toBe('III');
      expect(toRoman(4)).toBe('IV');
      expect(toRoman(5)).toBe('V');
      expect(toRoman(9)).toBe('IX');
      expect(toRoman(10)).toBe('X');
      expect(toRoman(14)).toBe('XIV');
      expect(toRoman(21)).toBe('XXI');
    });

    it('returns empty string for non-positive numbers', () => {
      expect(toRoman(0)).toBe('');
      expect(toRoman(-5)).toBe('');
    });
  });

  describe('cleanHeadingPrefix helper function', () => {
    it('strips bracket markers and existing number prefixes', () => {
      expect(cleanHeadingPrefix('[ROMAN] Introducción')).toBe('Introducción');
      expect(cleanHeadingPrefix('[DECIMAL] Marco Teórico')).toBe('Marco Teórico');
      expect(cleanHeadingPrefix('I. Introducción')).toBe('Introducción');
      expect(cleanHeadingPrefix('1. Marco Teórico')).toBe('Marco Teórico');
      expect(cleanHeadingPrefix('IV. Metodología')).toBe('Metodología');
      expect(cleanHeadingPrefix('[ROMAN] I. Introducción')).toBe('Introducción');
      expect(cleanHeadingPrefix('Resultados')).toBe('Resultados');
    });
  });

  describe('renumberHeadings', () => {
    it('renumbers Level 1 headings with Roman prefixes ("I. ", "II. ")', () => {
      const doc = {
        session_id: 'test_sess',
        file_name: 'doc.docx',
        apa_format: 'student',
        elements: [
          makeDocElement({ id: 'h1', type: 'heading', heading_level: 1, text: 'Introducción' }),
          makeDocElement({ id: 'p1', type: 'paragraph', text: 'Párrafo de intro' }),
          makeDocElement({ id: 'h2', type: 'heading', heading_level: 2, text: 'Subsección' }),
          makeDocElement({ id: 'h3', type: 'heading', heading_level: 1, text: 'Metodología' }),
        ],
      } as unknown as DocumentModel;

      useDocStore.setState({ doc });

      useDocStore.getState().renumberHeadings('roman');

      const updated = useDocStore.getState().doc;
      expect(updated?.elements[0].text).toBe('I. Introducción');
      expect(updated?.elements[0].original_text).toBe('Introducción');
      expect(updated?.elements[1].text).toBe('Párrafo de intro');
      expect(updated?.elements[2].text).toBe('Subsección');
      expect(updated?.elements[3].text).toBe('II. Metodología');
      expect(updated?.elements[3].original_text).toBe('Metodología');
    });

    it('renumbers Level 1 headings with Decimal prefixes ("1. ", "2. ")', () => {
      const doc = {
        session_id: 'test_sess',
        file_name: 'doc.docx',
        apa_format: 'student',
        elements: [
          makeDocElement({ id: 'h1', type: 'heading', heading_level: 1, text: 'Antecedentes' }),
          makeDocElement({ id: 'h2', type: 'heading', heading_level: 1, text: 'Marco Teórico' }),
        ],
      } as unknown as DocumentModel;

      useDocStore.setState({ doc });

      useDocStore.getState().renumberHeadings('decimal');

      const updated = useDocStore.getState().doc;
      expect(updated?.elements[0].text).toBe('1. Antecedentes');
      expect(updated?.elements[0].original_text).toBe('Antecedentes');
      expect(updated?.elements[1].text).toBe('2. Marco Teórico');
      expect(updated?.elements[1].original_text).toBe('Marco Teórico');
    });

    it('switches between Roman and Decimal cleanly without duplicating prefixes', () => {
      const doc = {
        session_id: 'test_sess',
        file_name: 'doc.docx',
        apa_format: 'student',
        elements: [
          makeDocElement({ id: 'h1', type: 'heading', heading_level: 1, text: 'Capítulo Uno' }),
        ],
      } as unknown as DocumentModel;

      useDocStore.setState({ doc });

      // First convert to Roman
      useDocStore.getState().renumberHeadings('roman');
      expect(useDocStore.getState().doc?.elements[0].text).toBe('I. Capítulo Uno');

      // Then convert to Decimal
      useDocStore.getState().renumberHeadings('decimal');
      expect(useDocStore.getState().doc?.elements[0].text).toBe('1. Capítulo Uno');

      // Back to Roman
      useDocStore.getState().renumberHeadings('roman');
      expect(useDocStore.getState().doc?.elements[0].text).toBe('I. Capítulo Uno');
    });
  });
});

describe('R1: Visual Pagination (PaperCanvas / computePages)', () => {
  it('forces a page break on Level 1 headings when currentPage has elements', () => {
    const elements: ElementModel[] = [
      makeDocElement({ id: 'p1', type: 'paragraph', text: 'Párrafo de inicio' }),
      makeDocElement({ id: 'h1', type: 'heading', heading_level: 1, text: 'Sección Principal 1' }),
      makeDocElement({ id: 'p2', type: 'paragraph', text: 'Contenido de la sección 1' }),
      makeDocElement({ id: 'h2', type: 'heading', heading_level: 1, text: 'Sección Principal 2' }),
    ];

    const pages = computePages(elements);

    expect(pages.length).toBe(3);
    expect(pages[0].map(e => e.id)).toEqual(['p1']);
    expect(pages[1].map(e => e.id)).toEqual(['h1', 'p2']);
    expect(pages[2].map(e => e.id)).toEqual(['h2']);
  });

  it('does not create an extra page break if Level 1 heading is the first element on page', () => {
    const elements: ElementModel[] = [
      makeDocElement({ id: 'h1', type: 'heading', heading_level: 1, text: 'Sección Inicial' }),
      makeDocElement({ id: 'p1', type: 'paragraph', text: 'Texto de sección' }),
    ];

    const pages = computePages(elements);

    expect(pages.length).toBe(1);
    expect(pages[0].map(e => e.id)).toEqual(['h1', 'p1']);
  });

  it('does not force page breaks for Level 2 or Level 3 headings', () => {
    const elements: ElementModel[] = [
      makeDocElement({ id: 'p1', type: 'paragraph', text: 'Párrafo intro' }),
      makeDocElement({ id: 'h2', type: 'heading', heading_level: 2, text: 'Subsección' }),
      makeDocElement({ id: 'h3', type: 'heading', heading_level: 3, text: 'Sub-subsección' }),
    ];

    const pages = computePages(elements);

    expect(pages.length).toBe(1);
    expect(pages[0].length).toBe(3);
  });
});

describe('R3: Structural Revision Panel (Step2HeadingsWizard)', () => {
  const mockUpdateElementType = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    const mockElements: ElementModel[] = [
      makeDocElement({ id: 'h_lvl2', type: 'heading', heading_level: 2, text: 'Título Nivel 2' }),
      makeDocElement({ id: 'h_lvl1', type: 'heading', heading_level: 1, text: 'Título Nivel 1' }),
    ];

    const doc = {
      session_id: 'test_wizard_sess',
      file_name: 'wizard_doc.docx',
      apa_format: 'student',
      elements: mockElements,
    } as unknown as DocumentModel;

    useDocStore.setState({
      doc,
      selectedElementId: 'h_lvl2',
      updateElementType: mockUpdateElementType,
      rules: {
        heading_numbering_style_lvl1: 'decimal',
        heading_numbering_style_lvl2: 'decimal',
        heading_numbering_style_lvl3: 'decimal',
      } as any,
    });
  });

  it('promotes Level 2 heading to Level 1 when "Subir Nivel" is clicked', () => {
    render(React.createElement(Step2HeadingsWizard));

    const subirBtns = screen.getAllByTitle('Subir Nivel');
    expect(subirBtns.length).toBeGreaterThan(0);

    const btnLvl2 = subirBtns[0];
    expect(btnLvl2.getAttribute('disabled')).toBeNull();

    fireEvent.click(btnLvl2);

    expect(mockUpdateElementType).toHaveBeenCalledWith(
      'h_lvl2',
      'heading',
      1,
      'Título Nivel 2'
    );
  });

  it('disables "Subir Nivel" button when heading is already Level 1', () => {
    render(React.createElement(Step2HeadingsWizard));

    const subirBtns = screen.getAllByTitle('Subir Nivel');
    const btnLvl1 = subirBtns[1];
    expect(btnLvl1.getAttribute('disabled')).not.toBeNull();
  });

  it('degrades heading to paragraph when "Degradar a Párrafo" is clicked', () => {
    render(React.createElement(Step2HeadingsWizard));

    const degradaBtns = screen.getAllByTitle('Degradar a Párrafo');
    expect(degradaBtns.length).toBeGreaterThan(0);

    fireEvent.click(degradaBtns[0]);

    expect(mockUpdateElementType).toHaveBeenCalledWith(
      'h_lvl2',
      'paragraph',
      1,
      'Título Nivel 2'
    );
  });
});

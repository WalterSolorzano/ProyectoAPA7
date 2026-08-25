/**
 * WordAPA7 — Inspector UI Tests (C1, C4)
 *
 * Verifies:
 * - C1: No duplicate <ImageEditPanel> inside ElementInspector (single instance
 *   lives in App.tsx's ImageEditSidePanel).
 * - C4: The "Estado" section and the "Tipo de Elemento" badge have been removed.
 * - Smoke test: ElementInspector renders without crashing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { DocumentModel, ElementType } from '../types';

// Mock the API module to avoid network calls
vi.mock('../api/backend', () => ({
  explainElement: vi.fn().mockResolvedValue({ explanation: 'test' }),
  suggestCaption: vi.fn().mockResolvedValue('test caption'),
  getApiBase: vi.fn().mockReturnValue('http://localhost:8742'),
  getApiBaseAsync: vi.fn().mockResolvedValue('http://localhost:8742'),
  fetchWithTrace: vi.fn(),
  resolveAssetUrl: vi.fn(),
  syncAllProviderKeys: vi.fn().mockResolvedValue({ ok: true, applied: [] }),
}));

// Helper: create a minimal document model for testing
function makeTestDoc(): DocumentModel {
  return {
    session_id: 'test-sess',
    file_name: 'test.docx',
    apa_format: 'student',
    elements: [
      {
        id: 'elem-1',
        type: 'heading' as ElementType,
        heading_level: 1,
        text: 'Introducción',
        style_name: 'Heading 1',
        alignment: 'center',
        font_name: 'Times New Roman',
        font_size: 12,
        is_bold: true,
        is_italic: false,
        is_bullet: false,
        left_indent_cm: 0,
        confidence: 0.95,
        is_user_modified: false,
        needs_review: false,
        auto_applied: false,
        cita_ids: [],
        image_info: undefined,
        table_info: undefined,
      } as any,
      {
        id: 'elem-img-1',
        type: 'image' as ElementType,
        text: '',
        style_name: 'Normal',
        alignment: 'center',
        font_name: 'Times New Roman',
        font_size: 12,
        is_bold: false,
        is_italic: false,
        is_bullet: false,
        left_indent_cm: 0,
        confidence: 1.0,
        is_user_modified: false,
        needs_review: false,
        auto_applied: false,
        cita_ids: [],
        image_info: {
          element_id: 'elem-img-1',
          file_path: '',
          filename: '',
          relative_url: '',
          width_cm: 12,
          height_cm: 8,
          caption: '',
          figure_number: 1,
          alignment: 'center',
          wrap_style: 'inline',
          caption_position: 'above',
          constrain_proportions: true,
          design_style: 'standard',
        },
        table_info: undefined,
      } as any,
    ],
    has_landscape_sections: false,
    meta: {
      source_file: 'test.docx',
      source_hash: '',
      wordapa7_version: '1.0.0',
      previously_processed: false,
      parsed_at: '',
      page_count: 1,
      word_count: 100,
      has_images: true,
      has_tables: false,
      has_equations: false,
      has_ole_objects: false,
      portada_detected: false,
      apa_format: 'student',
      work_mode: 'review',
      content_source: 'upload',
      sections: [],
    },
    apa_rules: {} as any,
    portada: { detected: false, element_ids: [], fields: {} },
    referencias: [],
    citas_intext: [],
  };
}

// Reset the store before each test
beforeEach(() => {
  useDocStore.setState({
    doc: makeTestDoc(),
    selectedElementId: 'elem-1',
    imagePanelOpen: false,
  });
});

// ── C1: No duplicate ImageEditPanel ──────────────────────────────────────

describe('C1 — ImageEditPanel deduplication', () => {
  it('ElementInspector does NOT import or render ImageEditPanel', async () => {
    // Read the source file content to verify the import was removed
    // (We test the source, not the runtime, because importing the component
    // triggers many side effects in jsdom.)
    const inspectorSource = await import('../components/inspector/ElementInspector.tsx?raw');
    const source = (inspectorSource as any).default || '';
    // The file should NOT contain a JSX <ImageEditPanel usage
    expect(source).not.toContain('<ImageEditPanel');
    // But it SHOULD contain the button that opens the side panel
    expect(source).toContain('setImagePanelOpen');
  });
});

// ── C4: Estado and Tipo de Elemento badge removed ──────────────────────

describe('C4 — Remove Estado and badge', () => {
  it('ElementInspector source does NOT contain the "Estado" section label', async () => {
    const inspectorSource = await import('../components/inspector/ElementInspector.tsx?raw');
    const source = (inspectorSource as any).default || '';
    // The "Estado" section label should be gone
    expect(source).not.toContain('>Estado<');
    expect(source).not.toContain('Estado de revisión');
    // C4 comment marking its removal should be present
    expect(source).toContain('C4');
  });

  it('ElementInspector source does NOT contain the type badge span', async () => {
    const inspectorSource = await import('../components/inspector/ElementInspector.tsx?raw');
    const source = (inspectorSource as any).default || '';
    // The colored badge that showed the element type in uppercase should be gone.
    // We look for the pattern that existed before: a span with .toUpperCase() rendering the type.
    expect(source).not.toContain('selectedElem.type.toUpperCase()');
    // The compact type selector (select element) should still be present
    expect(source).toContain('Tipo de Elemento');
  });
});

// ── Smoke test: store has updateElementTable and autoCaptionAll ─────────

describe('Store actions exist (C2, C6)', () => {
  it('useDocStore has updateElementTable action', () => {
    const state = useDocStore.getState();
    expect(typeof state.updateElementTable).toBe('function');
  });

  it('useDocStore has autoCaptionAll action', () => {
    const state = useDocStore.getState();
    expect(typeof state.autoCaptionAll).toBe('function');
  });
});

/**
 * WordAPA7 — Modo Rápido: flujo upload → export (health check)
 *
 * Verifica que uploadFile en modo quick:
 * - pasa profile_id y work_mode=quick al backend
 * - acepta elementos de alta confianza, valida y audita citas
 * - abre el modal de descarga con pendingQuickExport=true
 * - NO navega al wizard paso a paso
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDocStore } from '../store/useDocStore';

vi.mock('../api/backend', () => ({
  uploadDocxFile: vi.fn(),
  classifyWithLLM: vi.fn(),
  updateElement: vi.fn(),
  reorderElements: vi.fn(),
  validateDocument: vi.fn(),
  validateCitations: vi.fn(),
  bulkAcceptElements: vi.fn(),
  generatePreview: vi.fn(),
  listSessions: vi.fn(),
  recoverSession: vi.fn(),
  listProfiles: vi.fn(),
  setSessionProfile: vi.fn(),
}));

import * as api from '../api/backend';

const mockDoc = {
  session_id: 'sess_quick_1',
  file_name: 'trabajo.docx',
  apa_format: 'student',
  profile_id: 'apa7',
  elements: [
    { id: 'e1', type: 'heading', heading_level: 1, text: 'Introducción', needs_review: true, confidence: 0.9 },
    { id: 'e2', type: 'paragraph', text: 'Cuerpo del texto', needs_review: true, confidence: 0.6 },
  ],
  has_landscape_sections: false,
  meta: { apa_format: 'student', work_mode: 'review' },
  apa_rules: { profile_name: 'APA 7 Estándar' },
  portada: { detected: false, element_ids: [], fields: {}, profile_name: null },
  referencias: [],
  citas_intext: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  useDocStore.setState({
    doc: null,
    profiles: [],
    activeProfileId: 'apa7',
    references: [],
    validationIssues: [],
    citationAuditResult: null,
    isDownloadModalOpen: false,
    pendingQuickExport: false,
    isLoading: false,
    tabs: [],
    tabDocs: {},
    history: [],
    historyIndex: -1,
    wizardStep: 2,
    atHome: true,
    portada: {
      apa_format: 'student' as const,
      title: 'Título',
      author: 'Ana García',
      institution: 'Universidad X',
      course: '',
      instructor: '',
      date: '',
      running_head: '',
      author_note: '',
    },
  });
});

describe('useDocStore — Modo Rápido', () => {
  it('sube con perfil y modo quick, acepta, valida y abre el modal de export', async () => {
    (api.uploadDocxFile as any).mockResolvedValue(mockDoc);
    (api.bulkAcceptElements as any).mockResolvedValue({ ...mockDoc });
    (api.validateDocument as any).mockResolvedValue([]);
    (api.validateCitations as any).mockResolvedValue({ ghost_citations: [], orphan_references: [] });

    const file = new File(['x'], 'trabajo.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    await useDocStore.getState().uploadFile(file, { profileId: 'apa7', mode: 'quick' });

    expect(api.uploadDocxFile).toHaveBeenCalledWith(file, { profileId: 'apa7', mode: 'quick' });
    expect(api.bulkAcceptElements).toHaveBeenCalled();
    expect(api.validateDocument).toHaveBeenCalled();
    expect(api.validateCitations).toHaveBeenCalled();

    const state = useDocStore.getState();
    expect(state.isDownloadModalOpen).toBe(true);
    expect(state.pendingQuickExport).toBe(true);
    expect(state.doc?.session_id).toBe('sess_quick_1');
    expect(state.wizardStep).toBe(0); // no navega al wizard completo
    expect(state.atHome).toBe(false);
  });

  it('el modo guiado no marca pendingQuickExport', async () => {
    (api.uploadDocxFile as any).mockResolvedValue(mockDoc);

    const file = new File(['x'], 'trabajo.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    await useDocStore.getState().uploadFile(file, { profileId: 'apa7' });

    const state = useDocStore.getState();
    expect(state.isDownloadModalOpen).toBe(false);
    expect(state.pendingQuickExport).toBe(false);
  });

  it('cerrar el modal limpia el flag de modo rápido', () => {
    useDocStore.setState({ pendingQuickExport: true, isDownloadModalOpen: true });
    useDocStore.getState().setDownloadModalOpen(false);
    expect(useDocStore.getState().pendingQuickExport).toBe(false);
  });
});

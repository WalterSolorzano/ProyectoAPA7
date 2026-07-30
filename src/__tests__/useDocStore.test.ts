/**
 * WordAPA7 — Zustand Store Tests
 *
 * Verifica el comportamiento del store useDocStore:
 * - Estado inicial
 * - Actualizaciones de estado
 * - Acciones store sin llamadas API (mocked)
 * - Perfiles de reglas y portada
 * - Wizard answers
 * - Logica de filtrado Quick/Review mode
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDocStore } from '../store/useDocStore';
import { APAFormat, BulletStyle, NumberStyle, WizardAnswers, WorkMode } from '../types';

// Mock del modulo API
vi.mock('../api/backend', () => ({
  uploadDocxFile: vi.fn(),
  classifyWithLLM: vi.fn(),
  updateElement: vi.fn(),
  reorderElements: vi.fn(),
  validateDocument: vi.fn(),
  generateDocx: vi.fn(),
  generatePreview: vi.fn(),
  checkIdempotency: vi.fn(),
  listSessions: vi.fn(),
  recoverSession: vi.fn(),
  resolveDoi: vi.fn(),
  deleteSession: vi.fn(),
  uploadDocxWithWizard: vi.fn(),
}));

// Resetear el store antes de cada test
beforeEach(() => {
  const { resetWizard, setRulesFull, setPortadaFull } = useDocStore.getState();
  useDocStore.setState({
    doc: null,
    activeTab: 'classifier',
    wizardComplete: false,
    wizardAnswers: {
      apa_format: 'student',
      cover_page: 'use_existing',
      work_mode: 'review',
    },
    recoverySession: null,
    recoveryDismissed: false,
    workMode: 'review',
    rules: {
      profile_name: 'APA 7 Estandar',
      is_default: true,
      margins_cm: 2.54,
      font_family: 'Times New Roman',
      font_size_pt: 12,
      line_spacing: 2.0,
      paragraph_indent_cm: 1.27,
      alignment: 'left',
      space_before_pt: 0,
      space_after_pt: 0,
      bullet_style_level1: 'disc' as BulletStyle,
      bullet_style_level2: 'circle' as BulletStyle,
      bullet_style_level3: 'square' as BulletStyle,
      number_style_level1: 'decimal' as NumberStyle,
      number_style_level2: 'lowerLetter' as NumberStyle,
      number_style_level3: 'lowerRoman' as NumberStyle,
      reference_hanging_indent_cm: 1.27,
      doi_as_hyperlink: true,
      figure_label_prefix: 'Figura',
      table_label_prefix: 'Tabla',
      heading_numbering_style_lvl1: 'decimal',
      heading_numbering_style_lvl2: 'decimal',
      heading_numbering_style_lvl3: 'decimal',
      heading_levels: {
        1: { bold: true, italic: false, alignment: 'center', indent_cm: 0, inline_text: false },
        2: { bold: true, italic: false, alignment: 'left', indent_cm: 0, inline_text: false },
        3: { bold: true, italic: true, alignment: 'left', indent_cm: 0, inline_text: false },
        4: { bold: true, italic: false, alignment: 'left', indent_cm: 1.27, inline_text: true },
        5: { bold: true, italic: true, alignment: 'left', indent_cm: 1.27, inline_text: true },
      },
    },
    ruleProfiles: [],
    portada: {
      apa_format: 'student' as APAFormat,
      title: '',
      author: '',
      institution: '',
      course: '',
      instructor: '',
      date: '',
      running_head: '',
      author_note: '',
    },
    portadaProfiles: [],
    references: [],
    validationIssues: [],
    previewHtml: '',
    isPreviewLoading: false,
  });
});

// ── ESTADO INICIAL ────────────────────────────────────────────────────────

describe('useDocStore — estado inicial', () => {
  it('inicia con doc en null', () => {
    const { doc } = useDocStore.getState();
    expect(doc).toBeNull();
  });

  it('inicia con wizardComplete en false', () => {
    const { wizardComplete } = useDocStore.getState();
    expect(wizardComplete).toBe(false);
  });

  it('inicia con activeTab en classifier', () => {
    const { activeTab } = useDocStore.getState();
    expect(activeTab).toBe('classifier');
  });

  it('inicia con el ruleset APA por defecto', () => {
    const { rules } = useDocStore.getState();
    expect(rules.profile_name).toBe('APA 7 Estandar');
    expect(rules.font_family).toBe('Times New Roman');
    expect(rules.font_size_pt).toBe(12);
    expect(rules.margins_cm).toBe(2.54);
    expect(rules.line_spacing).toBe(2.0);
    expect(rules.paragraph_indent_cm).toBe(1.27);
  });

  it('inicia con portada por defecto en formato student', () => {
    const { portada } = useDocStore.getState();
    expect(portada.apa_format).toBe('student');
    expect(portada.title).toBe('');
  });

  it('inicia con listas vacias de referencias y validacion', () => {
    const { references, validationIssues } = useDocStore.getState();
    expect(references).toHaveLength(0);
    expect(validationIssues).toHaveLength(0);
  });
});

// ── WIZARD ────────────────────────────────────────────────────────────────

describe('useDocStore — wizard', () => {
  it('setWizardComplete guarda las respuestas y marca complete', () => {
    const answers: WizardAnswers = {
      apa_format: 'professional',
      cover_page: 'none',
      work_mode: 'quick',
    };

    useDocStore.getState().setWizardComplete(answers);

    const state = useDocStore.getState();
    expect(state.wizardComplete).toBe(true);
    expect(state.wizardAnswers.apa_format).toBe('professional');
    expect(state.wizardAnswers.work_mode).toBe('quick');
  });

  it('resetWizard vuelve al estado inicial', () => {
    useDocStore.getState().setWizardComplete({
      apa_format: 'professional',
      cover_page: 'import_saved',
      work_mode: 'review',
    });
    useDocStore.getState().resetWizard();

    const state = useDocStore.getState();
    expect(state.wizardComplete).toBe(false);
    expect(state.wizardAnswers).toBeNull();
  });
});

// ── REGLAS ────────────────────────────────────────────────────────────────

describe('useDocStore — reglas', () => {
  it('setRules actualiza campos parciales', () => {
    useDocStore.getState().setRules({ font_family: 'Arial', font_size_pt: 11 });

    const { rules } = useDocStore.getState();
    expect(rules.font_family).toBe('Arial');
    expect(rules.font_size_pt).toBe(11);
    expect(rules.line_spacing).toBe(2.0); // no cambia
  });

  it('saveRuleProfile guarda un perfil nuevo', () => {
    useDocStore.getState().saveRuleProfile('Prof. Martinez');

    const { ruleProfiles } = useDocStore.getState();
    expect(ruleProfiles).toHaveLength(1);
    expect(ruleProfiles[0].profile_name).toBe('Prof. Martinez');
    expect(ruleProfiles[0].is_default).toBe(false);
  });

  it('loadRuleProfile carga un perfil guardado', () => {
    // Primero modificar reglas y guardar
    useDocStore.getState().setRules({ font_family: 'Calibri', paragraph_indent_cm: 0 });
    useDocStore.getState().saveRuleProfile('Sin Sangria');

    // Luego restaurar defaults y cargar perfil
    useDocStore.getState().resetRulesToDefault();
    useDocStore.getState().loadRuleProfile('Sin Sangria');

    const { rules } = useDocStore.getState();
    expect(rules.font_family).toBe('Calibri');
    expect(rules.paragraph_indent_cm).toBe(0);
  });

  it('loadRuleProfile con "APA 7 Estandar" restaura defaults', () => {
    useDocStore.getState().setRules({ font_family: 'Arial' });
    useDocStore.getState().loadRuleProfile('APA 7 Estándar');

    const { rules } = useDocStore.getState();
    expect(rules.font_family).toBe('Times New Roman');
  });

  it('resetRulesToDefault restaura todos los valores', () => {
    useDocStore.getState().setRules({
      font_family: 'Comic Sans',
      font_size_pt: 16,
      line_spacing: 3.0,
    });
    useDocStore.getState().resetRulesToDefault();

    const { rules } = useDocStore.getState();
    expect(rules.font_family).toBe('Times New Roman');
    expect(rules.font_size_pt).toBe(12);
    expect(rules.line_spacing).toBe(2.0);
  });
});

// ── PORTADA ───────────────────────────────────────────────────────────────

describe('useDocStore — portada', () => {
  it('setPortada actualiza campos parciales', () => {
    useDocStore.getState().setPortada({ title: 'Nuevo Titulo', author: 'Juan Perez' });

    const { portada } = useDocStore.getState();
    expect(portada.title).toBe('Nuevo Titulo');
    expect(portada.author).toBe('Juan Perez');
    expect(portada.institution).toBe(''); // no cambia
  });

  it('savePortadaProfile guarda y loadPortadaProfile recupera', () => {
    useDocStore.getState().setPortada({
      title: 'Tesis de Maestria',
      author: 'Maria Garcia',
      institution: 'UNAM',
      apa_format: 'professional' as APAFormat,
    });
    useDocStore.getState().savePortadaProfile('Tesis UNAM');

    // Limpiar
    useDocStore.getState().setPortada({ title: '', author: '' });
    useDocStore.getState().loadPortadaProfile('Tesis UNAM');

    const { portada } = useDocStore.getState();
    expect(portada.title).toBe('Tesis de Maestria');
    expect(portada.author).toBe('Maria Garcia');
    expect(portada.apa_format).toBe('professional');
  });

  it('portada cambia entre student y professional', () => {
    useDocStore.getState().setPortada({ apa_format: 'professional' as APAFormat });

    const { portada } = useDocStore.getState();
    expect(portada.apa_format).toBe('professional');
  });
});

// ── REFERENCIAS ───────────────────────────────────────────────────────────

describe('useDocStore — referencias', () => {
  it('addReference agrega una nueva referencia', () => {
    const ref = {
      id: 'ref_1',
      authors: ['Garcia, J.'],
      year: '2023',
      title: 'Estudio sobre IA',
      source: 'Revista de Tecnologia',
      raw_text: 'Garcia, J. (2023). Estudio sobre IA.',
    };

    useDocStore.getState().addReference(ref);

    const { references } = useDocStore.getState();
    expect(references).toHaveLength(1);
    expect(references[0].id).toBe('ref_1');
  });

  it('removeReference elimina una referencia existente', () => {
    useDocStore.getState().addReference({
      id: 'ref_1',
      authors: ['A'],
      year: '2023',
      title: 'T',
      source: 'S',
      raw_text: 'raw',
    });
    useDocStore.getState().addReference({
      id: 'ref_2',
      authors: ['B'],
      year: '2024',
      title: 'T2',
      source: 'S2',
      raw_text: 'raw2',
    });

    useDocStore.getState().removeReference('ref_1');

    const { references } = useDocStore.getState();
    expect(references).toHaveLength(1);
    expect(references[0].id).toBe('ref_2');
  });

  it('removeReference con id inexistente no falla', () => {
    expect(() => useDocStore.getState().removeReference('no_existe')).not.toThrow();
    expect(useDocStore.getState().references).toHaveLength(0);
  });
});

// ── WORK MODE / QUICK FILTER LOGIC ────────────────────────────────────────

describe('useDocStore — modo de trabajo', () => {
  it('setWorkMode cambia el modo', () => {
    useDocStore.getState().setWorkMode('quick');
    expect(useDocStore.getState().workMode).toBe('quick');

    useDocStore.getState().setWorkMode('review');
    expect(useDocStore.getState().workMode).toBe('review');
  });
});

// ── RECOVERY ──────────────────────────────────────────────────────────────

describe('useDocStore — recovery', () => {
  it('setRecoverySession y dismissRecovery funcionan', () => {
    const session = {
      session: {
        session_id: 'abc123',
        file_name: 'test.docx',
        element_count: 10,
        pending_count: 3,
        apa_format: 'student' as APAFormat,
        parsed_at: '2026-07-22',
        last_saved: '2026-07-22',
      },
      available: true,
    };

    useDocStore.getState().setRecoverySession(session);
    expect(useDocStore.getState().recoverySession?.session.session_id).toBe('abc123');
    expect(useDocStore.getState().recoveryDismissed).toBe(false);

    useDocStore.getState().dismissRecovery();
    expect(useDocStore.getState().recoveryDismissed).toBe(true);
  });

  it('preview state se maneja correctamente', () => {
    useDocStore.getState().setPreviewHtml('<p>Test preview</p>');
    expect(useDocStore.getState().previewHtml).toBe('<p>Test preview</p>');

    useDocStore.getState().setPreviewLoading(true);
    expect(useDocStore.getState().isPreviewLoading).toBe(true);

    useDocStore.getState().setPreviewLoading(false);
    expect(useDocStore.getState().isPreviewLoading).toBe(false);
  });
});

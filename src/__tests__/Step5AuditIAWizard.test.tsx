import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const state: any = {
  doc: { elements: [], session_id: 's1' },
  reviewResult: null,
  proofreadFindings: [],
  citationAuditResult: null,
  runAIReview: vi.fn(),
  runProofreadBatch: vi.fn(),
  runCitationAudit: vi.fn(),
  showToast: vi.fn(),
  setSelectedElementId: vi.fn(),
  setScrollTargetId: vi.fn(),
  updateElementText: vi.fn(),
};

vi.mock('../store/useDocStore', () => ({
  useDocStore: (sel: any) => (typeof sel === 'function' ? sel(state) : state),
}));

import { Step5AuditIAWizard } from '../components/wizard/Step5AuditIAWizard';

describe('Step5AuditIAWizard', () => {
  beforeEach(() => {
    state.reviewResult = null;
    state.proofreadFindings = [];
    state.citationAuditResult = null;
  });

  it('sin datos muestra la puerta con estado vacio', () => {
    render(<Step5AuditIAWizard />);
    expect(screen.getByText(/escanear/i)).toBeTruthy();
  });

  it('Empezar revisión cambia a la pantalla journey', () => {
    state.proofreadFindings = [{
      element_id: 'e1', start: 0, end: 3, excerpt: 'abc',
      kind: 'ortografia', severity: 'error', message: 'Falta tilde',
      suggestion: 'ábc', source: 'local',
    }];
    render(<Step5AuditIAWizard />);
    fireEvent.click(screen.getByText(/empezar revisión/i));
    expect(screen.getByText(/estado del documento/i)).toBeTruthy();
  });
});

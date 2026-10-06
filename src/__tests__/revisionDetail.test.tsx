import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RevisionDetail } from '../components/review/RevisionDetail';
import { useDocStore } from '../store/useDocStore';

const hallazgo = (over = {}) => ({
  element_id: 'e1', start: 0, end: 3, excerpt: 'a evolucionado', kind: 'ortografia',
  severity: 'warn', message: 'Se esperaba «ha»', source: 'local', phase: null, read_only: false, ...over,
});

describe('RevisionDetail (REV-L1)', () => {
  beforeEach(() => {
    useDocStore.setState({
      doc: { session_id: 's', elements: [{ id: 'e1', type: 'paragraph', text: 'a evolucionado hacia modelos' }] } as never,
      proofreadFindings: [hallazgo()],
      reviewResult: null,
      citationAuditResult: null,
      dismissedFindingIds: [],
      dismissedCommentIds: [],
    });
  });

  it('ofrece Aceptar y Aceptar todas en un motor objetivo', () => {
    render(<RevisionDetail foco={{ motor: 'spelling' }} onBack={() => {}} />);
    expect(screen.getByText('Aceptar')).toBeTruthy();
    expect(screen.getByText(/Aceptar todas/)).toBeTruthy();
  });

  it('nunca ofrece Aceptar sobre un motor de IA', () => {
    useDocStore.setState({
      proofreadFindings: [hallazgo({ kind: 'muletilla', severity: 'info' })],
    });
    render(<RevisionDetail foco={{ motor: 'ai' }} onBack={() => {}} />);
    expect(screen.queryByText('Aceptar')).toBeNull();
    expect(screen.getByText('Marcar para revisar')).toBeTruthy();
  });

  it('la portada no ofrece botón de aceptar', () => {
    useDocStore.setState({ proofreadFindings: [hallazgo({ kind: 'portada_punto_final', read_only: true, phase: 'portada' })] });
    render(<RevisionDetail foco={{ phase: 'portada' }} onBack={() => {}} />);
    expect(screen.queryByText('Aceptar')).toBeNull();
    expect(screen.getByText(/Solo lectura/)).toBeTruthy();
  });

  it('replica el mockup: severidad, propuesta antigua→nueva, Copiar y puntos del motor', () => {
    useDocStore.setState({
      proofreadFindings: [hallazgo({ suggestion: 'ha evolucionado' })],
    });
    render(<RevisionDetail foco={{ motor: 'spelling' }} onBack={() => {}} />);
    expect(screen.getByText('severidad alta')).toBeTruthy();
    expect(screen.getByText('Propuesta')).toBeTruthy();
    expect(screen.getByText('ha evolucionado')).toBeTruthy();
    expect(screen.getByText('Puntos de este motor')).toBeTruthy();
    expect(screen.getByText(/motor objetivo/)).toBeTruthy();
    const copiar = screen.getByText('Copiar');
    expect(copiar).toBeTruthy();
    fireEvent.click(copiar);
  });
});

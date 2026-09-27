import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReferencesPanel } from '../components/referencias/ReferencesPanel';
import { useDocStore } from '../store/useDocStore';

/* El flujo tipo Zotero entra por el control que YA existe: se pega un bloque
   de DOIs en el mismo campo de siempre. Estos tests fijan que el campo acepte
   varias lineas y que el boton llame a la funcion de LOTE.

   Lo que NO se prueba aqui, a proposito: que el panel no grew. Eso se verifica
   leyendo el componente, y el condicion de diseño esta escrito en el test de
   `resolveDoiReference`: la feature entra por ahi o no entra. */

const estado = useDocStore.getState();
const addReference = vi.fn();
const showToast = vi.fn();
const resolveDoisBlock = vi.fn().mockResolvedValue(undefined);
const resolveDoiReference = vi.fn().mockResolvedValue(undefined);
const resolveGhostCitation = vi.fn().mockResolvedValue(undefined);
const autoResolveGhosts = vi.fn().mockResolvedValue(undefined);
const runCitationAudit = vi.fn().mockResolvedValue(undefined);
const removeReference = vi.fn();
const updateReference = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  resolveDoisBlock.mockResolvedValue(undefined);
  useDocStore.setState({
    references: [],
    isLoading: false,
    addReference, showToast, resolveDoisBlock, resolveDoiReference,
    resolveGhostCitation, autoResolveGhosts, runCitationAudit,
    removeReference, updateReference,
  } as never);
});

describe('el panel acepta un bloque de DOIs', () => {
  it('el campo de entrada acepta varias lineas', () => {
    render(<ReferencesPanel />);
    const campo = screen.getByRole('textbox', { name: /doi|referencia/i });
    expect(campo.tagName).toBe('TEXTAREA');
  });

  it('el placeholder dice que se puede pegar mas de uno', () => {
    render(<ReferencesPanel />);
    const campo = screen.getByRole('textbox', { name: /doi|referencia/i });
    expect(campo.getAttribute('placeholder') || '').toMatch(/varios|uno por l|bloque|multil/i);
  });

  it('el boton manda el bloque entero a la funcion de lote', () => {
    render(<ReferencesPanel />);
    const campo = screen.getByRole('textbox', { name: /doi|referencia/i });
    fireEvent.change(campo, { target: { value: '10.1000/a\n10.1000/b\n10.1000/c' } });
    fireEvent.click(screen.getByRole('button', { name: /^resolver$/i }));
    expect(resolveDoisBlock).toHaveBeenCalledWith('10.1000/a\n10.1000/b\n10.1000/c');
    expect(resolveDoiReference).not.toHaveBeenCalled();
  });

  it('Shift+Enter parte linea sin resolver', () => {
    render(<ReferencesPanel />);
    const campo = screen.getByRole('textbox', { name: /doi|referencia/i });
    fireEvent.change(campo, { target: { value: '10.1000/a' } });
    fireEvent.keyDown(campo, { key: 'Enter', shiftKey: true });
    expect(resolveDoisBlock).not.toHaveBeenCalled();
  });

  it('una sola linea sigue funcionando: no se rompe el caso de un DOI', () => {
    render(<ReferencesPanel />);
    const campo = screen.getByRole('textbox', { name: /doi|referencia/i });
    fireEvent.change(campo, { target: { value: '10.1000/solo' } });
    fireEvent.click(screen.getByRole('button', { name: /^resolver$/i }));
    expect(resolveDoisBlock).toHaveBeenCalledWith('10.1000/solo');
  });
});

void estado;

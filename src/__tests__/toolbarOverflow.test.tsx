/**
 * WordAPA7 — T7: la barra queda como el mockup —titulo, guardado, avatar— y
 * todo lo demas cae en un menu de desborde. Ningun emoji, ninguna etiqueta
 * en mayusculas inventada.
 *
 * Los stores que se manipulan son los reales: `useDocStore` y `useUpdateStore`
 * (este ultimo es donde vive el estado del autoUpdater, no en el store del
 * documento). Ningun setState propio replaces una accion por un no-op: cada
 * entrada se verifica por su efecto en el store o en electronAPI.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { useUpdateStore } from '../store/useUpdateStore';
import { ToolbarOverflowMenu } from '../components/toolbar/ToolbarOverflowMenu';
import { UnifiedToolbar } from '../components/toolbar/UnifiedToolbar';

vi.mock('../components/toolbar/APAScoreCard', () => ({ APAScoreCard: () => <div data-testid="score" /> }));
vi.mock('../components/toolbar/APAModuleToggles', () => ({ APAModuleToggles: () => <div data-testid="toggles" /> }));

const ENTRADAS = [
  'Deshacer', 'Rehacer',
  'Puntuación APA', 'Módulos APA', 'Copiar PDF para WhatsApp',
  'Complemento de Word', 'Tema', 'Ajustes',
];

// Entradas que son comandos: siempre habilitadas y siempre accionables.
const COMANDOS = [
  'Copiar PDF para WhatsApp', 'Complemento de Word', 'Tema', 'Ajustes',
];

const DOC_A = { session_id: 's1', file_name: 'A.docx', elements: [] } as never;
const DOC_B = { session_id: 's1', file_name: 'B.docx', elements: [] } as never;

describe('T7 — menú de desbordamiento', () => {
  beforeEach(() => {
    useDocStore.setState({
      doc: null,
      history: [],
      historyIndex: 0,
      theme: 'light',
      settingsStudioOpen: false,
      settingsStudioTab: 'format',
      liveChatOpen: false,
      showFileMenu: false,
    } as never);
    useUpdateStore.setState({ state: 'idle' } as never);
  });

  afterEach(() => {
    delete (window as any).electronAPI;
  });

  it('expone todas las acciones secundarias, sin emojis', () => {
    render(<ToolbarOverflowMenu onClose={vi.fn()} />);
    for (const nombre of ENTRADAS) {
      const el = screen.getByRole('menuitem', { name: nombre });
      expect(el.textContent || '').not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('cada comando ejecuta su acción y cierra el menú', () => {
    for (const nombre of COMANDOS) {
      const onClose = vi.fn();
      const { unmount } = render(<ToolbarOverflowMenu onClose={onClose} />);
      fireEvent.click(screen.getByRole('menuitem', { name: nombre }));
      expect(onClose).toHaveBeenCalled();
      unmount();
    }
  });

  it('Deshacer y Rehacer caminan el historial del documento', () => {
    useDocStore.setState({ doc: DOC_B, history: [DOC_A, DOC_B], historyIndex: 1 } as never);
    render(<ToolbarOverflowMenu onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Deshacer' }));
    expect(useDocStore.getState().historyIndex).toBe(0);
    expect(useDocStore.getState().doc?.file_name).toBe('A.docx');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Rehacer' }));
    expect(useDocStore.getState().historyIndex).toBe(1);
    expect(useDocStore.getState().doc?.file_name).toBe('B.docx');
  });

  it('Deshacer y Rehacer se deshabilitan sin historial', () => {
    render(<ToolbarOverflowMenu onClose={vi.fn()} />);
    expect(screen.getByRole('menuitem', { name: 'Deshacer' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Rehacer' })).toBeDisabled();
  });

  it('“Complemento de Word” y “Ajustes” abren la configuración en su pestaña', () => {
    render(<ToolbarOverflowMenu onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Complemento de Word' }));
    expect(useDocStore.getState().settingsStudioOpen).toBe(true);
    expect(useDocStore.getState().settingsStudioTab).toBe('addin');
  });

  it('“Ajustes” abre la configuración y “Tema” alterna el tema del store', () => {
    render(<ToolbarOverflowMenu onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ajustes' }));
    expect(useDocStore.getState().settingsStudioOpen).toBe(true);
    expect(useDocStore.getState().settingsStudioTab).toBe('format');

    const antes = useDocStore.getState().theme;
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tema' }));
    expect(useDocStore.getState().theme).toBe(antes === 'light' ? 'dark' : 'light');
  });

  it('“Copiar PDF para WhatsApp” llama a la exportación del store', () => {
    const spy = vi.spyOn(useDocStore.getState(), 'copyPdfToClipboard').mockResolvedValue(false);
    render(<ToolbarOverflowMenu onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copiar PDF para WhatsApp' }));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('“Instalar actualización” solo aparece con una descarga pendiente', () => {
    const installUpdate = vi.fn();
    (window as any).electronAPI = { installUpdate };
    const { rerender } = render(<ToolbarOverflowMenu onClose={vi.fn()} />);
    expect(screen.queryByRole('menuitem', { name: 'Instalar actualización' })).toBeNull();

    act(() => { useUpdateStore.setState({ state: 'downloaded' } as never); });
    rerender(<ToolbarOverflowMenu onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Instalar actualización' }));
    expect(installUpdate).toHaveBeenCalled();
  });

  it('los módulos APA se montan dentro del menú, no en la barra', () => {
    render(<ToolbarOverflowMenu onClose={vi.fn()} />);
    expect(screen.getByTestId('score')).toBeTruthy();
    expect(screen.getByTestId('toggles')).toBeTruthy();
  });
});

describe('T7 — la barra mínima', () => {
  beforeEach(() => {
    useDocStore.setState({
      doc: DOC_B,
      liveChatOpen: false,
      settingsStudioOpen: false,
      showFileMenu: false,
    } as never);
  });

  it('muestra título y Guardado, y saca de la vista lo que ahora vive en el menú', () => {
    render(<UnifiedToolbar />);
    expect(screen.getByText('B.docx')).toBeTruthy();
    expect(screen.getByText('Guardado')).toBeTruthy();
    expect(screen.queryByText(/Copiar PDF/)).toBeNull();
    expect(screen.queryByTestId('score')).toBeNull();
    expect(screen.queryByTestId('toggles')).toBeNull();
  });

  it('el botón de más acciones abre y cierra el menú de desborde', () => {
    render(<UnifiedToolbar />);
    const boton = screen.getByRole('button', { name: 'Más acciones' });
    fireEvent.click(boton);
    expect(screen.getByRole('menu', { name: 'Más acciones' })).toBeTruthy();
    fireEvent.click(boton);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('el Copiloto alterna el chat y el avatar abre Ajustes', () => {
    render(<UnifiedToolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiloto Editorial IA' }));
    expect(useDocStore.getState().liveChatOpen).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Cuenta' }));
    expect(useDocStore.getState().settingsStudioOpen).toBe(true);
  });
});

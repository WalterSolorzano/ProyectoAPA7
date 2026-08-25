/**
 * WordAPA7 — D1: El toggle del Asistente IA vive en RightSidePanel.
 *
 * Verifica:
 * - El panel colapsado muestra un botón accesible "Asistente IA" que al
 *   hacer click limpia la selección y abre el panel (setForceRightPanelOpen).
 * - App.tsx ya NO monta ni importa EditorRail (la columna estrella de 52px).
 * - EditorRail.tsx quedó reducido a helpers puros: sin componente React,
 *   sin botón Sparkles y sin default export.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { RightSidePanel } from '../components/activity/RightSidePanel';
// Vite `?raw` trae el contenido del archivo como string (fs está stubbeado en jsdom).
import appSrc from '../App.tsx?raw';
import editorRailSrc from '../components/wizard/EditorRail.tsx?raw';

vi.mock('../api/backend', () => ({
  getApiBase: vi.fn().mockReturnValue('http://localhost:8742'),
  getApiBaseAsync: vi.fn().mockResolvedValue('http://localhost:8742'),
  fetchWithTrace: vi.fn(),
  resolveAssetUrl: vi.fn(),
  explainElement: vi.fn().mockResolvedValue({ explanation: 'test' }),
  suggestCaption: vi.fn().mockResolvedValue('test caption'),
  syncAllProviderKeys: vi.fn().mockResolvedValue({ ok: true, applied: [] }),
}));

describe('D1 — toggle Asistente IA en RightSidePanel', () => {
  beforeEach(() => {
    useDocStore.setState({
      doc: null,
      forceRightPanelOpen: false,
      selectedElementId: null,
      selectedReferenceId: null,
    });
  });

  it('panel colapsado: botón accesible "Asistente IA" abre el panel y limpia selección', () => {
    useDocStore.setState({
      selectedElementId: 'elem-1',
      selectedReferenceId: 'ref-1',
    });
    render(<RightSidePanel />);
    const btn = screen.getByRole('button', { name: 'Asistente IA' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    const s = useDocStore.getState();
    expect(s.forceRightPanelOpen).toBe(true);
    expect(s.selectedElementId).toBeNull();
    expect(s.selectedReferenceId).toBeNull();
  });
});

describe('D1 — la columna estrella desaparece del layout', () => {
  it('App.tsx NO monta <EditorRail />', () => {
    expect(appSrc).not.toMatch(/<EditorRail/);
  });

  it('App.tsx NO importa EditorRail', () => {
    expect(appSrc).not.toMatch(/import\s+\{[^}]*EditorRail[^}]*\}/);
    expect(appSrc).not.toMatch(/from\s+['"].*EditorRail['"]/);
  });

  it('EditorRail.tsx quedó reducido a helpers puros (sin componente, sin Sparkles)', () => {
    expect(editorRailSrc).not.toContain('Sparkles');
    expect(editorRailSrc).not.toMatch(/export default/);
    expect(editorRailSrc).not.toMatch(/export const EditorRail|const EditorRail: React\.FC/);
    // Los helpers siguen vivos para futuros consumidores
    expect(editorRailSrc).toContain('export const EDITOR_SECTIONS');
    expect(editorRailSrc).toContain('export const getStepProgress');
  });
});

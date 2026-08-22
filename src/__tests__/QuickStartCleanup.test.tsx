import React, { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { Step0QuickStart } from '../components/wizard/Step0QuickStart';

vi.mock('../api/backend', () => ({
  listSessions: vi.fn().mockResolvedValue([]),
  listProfiles: vi.fn().mockResolvedValue([]),
  downloadTemplate: vi.fn(),
  downloadTemplateAsync: vi.fn(),
}));

describe('Step0QuickStart cleanup', () => {
  it('no longer shows "Home / Quick Start" or "Estado del flujo"', async () => {
    useDocStore.setState({ isBackendReady: true, error: null });
    await act(async () => {
      render(<Step0QuickStart />);
    });
    expect(screen.queryByText('Home / Quick Start')).toBeNull();
    expect(screen.queryByText(/Estado del flujo/i)).toBeNull();
    expect(screen.queryByText(/sesiones recientes disponibles/i)).toBeNull();
  });

  it('no longer has the redundant "Ajustes y vista previa" button (moved to sidebar Configuraciones)', async () => {
    useDocStore.setState({ isBackendReady: true, error: null });
    await act(async () => {
      render(<Step0QuickStart />);
    });
    // The "Ajustes y vista previa" button was removed from the top bar.
    // Settings are now accessed exclusively via the sidebar's "Configuraciones" button.
    expect(screen.queryByRole('button', { name: /Ajustes y vista previa/i })).toBeNull();
    // The "Configuraciones" button in the sidebar should exist.
    const configBtn = screen.getByRole('button', { name: 'Configuraciones' });
    expect(configBtn).toBeTruthy();
  });
});

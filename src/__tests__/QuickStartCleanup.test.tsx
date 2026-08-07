import React, { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { Step0QuickStart } from '../components/wizard/Step0QuickStart';

vi.mock('../api/backend', () => ({
  listSessions: vi.fn().mockResolvedValue([]),
  listProfiles: vi.fn().mockResolvedValue([]),
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

  it('has a button to open the settings studio', async () => {
    useDocStore.setState({ isBackendReady: true, error: null });
    await act(async () => {
      render(<Step0QuickStart />);
    });
    const btn = screen.getByRole('button', { name: /Ajustes y vista previa/i });
    expect(btn).toBeTruthy();
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(useDocStore.getState().settingsStudioOpen).toBe(true);
  });
});

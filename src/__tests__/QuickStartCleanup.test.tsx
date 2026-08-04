import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { Step0QuickStart } from '../components/wizard/Step0QuickStart';

describe('Step0QuickStart cleanup', () => {
  it('no longer shows "Home / Quick Start" or "Estado del flujo"', () => {
    useDocStore.setState({ isBackendReady: true, error: null });
    render(<Step0QuickStart />);
    expect(screen.queryByText('Home / Quick Start')).toBeNull();
    expect(screen.queryByText(/Estado del flujo/i)).toBeNull();
    expect(screen.queryByText(/sesiones recientes disponibles/i)).toBeNull();
  });

  it('has a button to open the settings studio', () => {
    useDocStore.setState({ isBackendReady: true, error: null });
    render(<Step0QuickStart />);
    const btn = screen.getByRole('button', { name: /Ajustes y vista previa/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(useDocStore.getState().settingsStudioOpen).toBe(true);
  });
});

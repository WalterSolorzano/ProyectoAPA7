import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsPreviewStudio } from '../components/settings/SettingsPreviewStudio';

// Wrap store setup so the studio can access rules
import { useDocStore } from '../store/useDocStore';

describe('SettingsPreviewStudio', () => {
  it('renders controls and preview', () => {
    useDocStore.setState({ rules: {
      ...useDocStore.getState().rules,
      font_family: 'Times New Roman',
      line_spacing: 2.0,
      heading_levels: {
        1: { bold: true, italic: false, alignment: 'center', indent_cm: 0, inline_text: false },
      },
    } });

    render(<SettingsPreviewStudio onClose={() => {}} />);

    expect(screen.getByText('Estudio de ajustes')).toBeTruthy();
    expect(screen.getByText('Tipografía')).toBeTruthy();
    expect(screen.getByText('Títulos (niveles APA)')).toBeTruthy();
    expect(screen.getByText('Imágenes')).toBeTruthy();
    // Preview paper should render the title block
    expect(screen.getByText('Título del Trabajo Académico')).toBeTruthy();
    // Close button
    expect(screen.getByLabelText('Cerrar estudio')).toBeTruthy();
  });
});

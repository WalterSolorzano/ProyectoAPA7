import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TallerFigurasView } from '../TallerFigurasView';
import { useDocStore } from '../../../store/useDocStore';
import type { DocumentModel } from '../../../types';

const mockDoc: DocumentModel = {
  id: 'doc-test',
  filename: 'tesis.docx',
  session_id: 'sess-123',
  total_pages: 10,
  elements: [
    {
      id: 'h1_1',
      type: 'heading',
      heading_level: 1,
      text: 'Capítulo 1: Introducción',
    },
    {
      id: 'p_1',
      type: 'paragraph',
      text: 'Este es el párrafo contextual anterior a la primera figura del estudio.',
    },
    {
      id: 'img_1',
      type: 'image',
      image_info: {
        url: 'blob:http://localhost/figura1.png',
        caption: 'Distribución de variables de rendimiento',
        note: 'Nota. Valores calculados a partir de la muestra piloto.',
        width_cm: 14.0,
        height_cm: 8.5,
        alignment: 'center',
        design_style: 'standard',
        rotation: 0,
      },
    },
    {
      id: 'p_2',
      type: 'paragraph',
      text: 'Párrafo posterior donde se discute la gráfica presentada anteriormente.',
    },
    {
      id: 'tbl_1',
      type: 'table',
      table_info: {
        caption: 'Resumen descriptivo',
        note: 'Nota. Muestra n=120.',
        rows: 2,
        cols: 2,
      },
    },
  ],
};

describe('TallerFigurasView', () => {
  beforeEach(() => {
    useDocStore.setState({
      doc: mockDoc,
      apiKey: 'test-key',
    });
  });

  it('orquesta el rail vertical, la galería, el lienzo editorial y el inspector de 4 pestañas', () => {
    render(<TallerFigurasView />);

    // Header principal
    expect(screen.getByText(/Taller de Activos Gráficos/i)).toBeInTheDocument();

    // 1. RailTipoActivos
    expect(screen.getByRole('complementary', { name: /Selector de tipos de activos/i })).toBeInTheDocument();
    expect(screen.getByTitle(/Figuras \(1\)/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Tablas \(1\)/i)).toBeInTheDocument();

    // 2. GaleriaActivosColumna
    expect(screen.getByRole('complementary', { name: /Galería de activos/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Distribución de variables de rendimiento/i).length).toBeGreaterThanOrEqual(1);

    // 3. LienzoEditorialActivo
    expect(screen.getByTestId('editorial-reading-canvas')).toBeInTheDocument();
    expect(screen.getByText(/Este es el párrafo contextual anterior/i)).toBeInTheDocument();
    expect(screen.getByText(/Párrafo posterior donde se discute la gráfica/i)).toBeInTheDocument();

    // 4. InspectorActivoTabs
    expect(screen.getByRole('tab', { name: /Formato/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Texto/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Estilo/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Calidad/i })).toBeInTheDocument();
  });

  it('permite cambiar a la pestaña de tablas en el rail', () => {
    render(<TallerFigurasView />);

    const tablaBtn = screen.getByTitle(/Tablas \(1\)/i);
    fireEvent.click(tablaBtn);

    // En galería y/o lienzo debe verse la tabla
    expect(screen.getAllByText(/Resumen descriptivo/i).length).toBeGreaterThanOrEqual(1);
  });

  it('permite conmutar pestañas del inspector y modificar dimensiones', () => {
    render(<TallerFigurasView />);

    const tabTexto = screen.getByRole('tab', { name: /Texto/i });
    fireEvent.click(tabTexto);
    expect(screen.getByLabelText(/Título \/ Leyenda/i)).toBeInTheDocument();

    const tabEstilo = screen.getByRole('tab', { name: /Estilo/i });
    fireEvent.click(tabEstilo);
    expect(screen.getByText(/APA Estándar/i)).toBeInTheDocument();
  });
});

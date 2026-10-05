import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InspectorActivoTabs } from '../InspectorActivoTabs';
import type { ElementModel } from '../../../types';

describe('InspectorActivoTabs', () => {
  const baseElem: ElementModel = {
    id: 'img_1',
    type: 'image',
    image_info: {
      width_cm: 14.5,
      height_cm: 9.0,
      alignment: 'center',
      caption: 'Figura de prueba',
      note: 'Nota al pie descriptiva',
      alt_text: 'Descripción para accesibilidad',
      design_style: 'standard',
    },
  };

  it('permite conmutar entre las 4 pestañas: Formato, Texto, Estilo y Calidad', () => {
    render(
      <InspectorActivoTabs
        elem={baseElem}
        totalFiguras={4}
        onUpdate={vi.fn()}
        onApplyToAll={vi.fn()}
      />
    );

    expect(screen.getByRole('tab', { name: /Formato/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Texto/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Estilo/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Calidad/i })).toBeDefined();

    // Conmutar a Texto
    fireEvent.click(screen.getByRole('tab', { name: /Texto/i }));
    expect(screen.getByLabelText(/Título \/ Leyenda/i)).toBeDefined();

    // Conmutar a Estilo
    fireEvent.click(screen.getByRole('tab', { name: /Estilo/i }));
    expect(screen.getByText(/APA Estándar/i)).toBeDefined();

    // Conmutar a Calidad
    fireEvent.click(screen.getByRole('tab', { name: /Calidad/i }));
    expect(screen.getByText(/Diagnóstico APA 7/i)).toBeDefined();
  });

  it('pestaña Formato: maneja ajuste de dimensiones numéricas, slider, alineación y alcance', () => {
    const onUpdate = vi.fn();
    const onApplyToAll = vi.fn();

    render(
      <InspectorActivoTabs
        elem={baseElem}
        totalFiguras={4}
        onUpdate={onUpdate}
        onApplyToAll={onApplyToAll}
      />
    );

    // Dimensiones numéricas
    const inputAncho = screen.getByLabelText(/Ancho \(cm\)/i);
    fireEvent.change(inputAncho, { target: { value: '16.0' } });
    expect(onUpdate).toHaveBeenCalledWith('img_1', expect.objectContaining({ width_cm: 16.0 }));

    // Alineación
    const btnIzquierda = screen.getByRole('button', { name: /Alinear Izquierda/i });
    fireEvent.click(btnIzquierda);
    expect(onUpdate).toHaveBeenCalledWith('img_1', expect.objectContaining({ alignment: 'left' }));

    // Selector de alcance (esta vs todas)
    const selectAlcance = screen.getByRole('combobox', { name: /Alcance/i });
    fireEvent.change(selectAlcance, { target: { value: 'todas' } });
    const btnAplicarTodas = screen.getByRole('button', { name: /Aplicar a todas las figuras/i });
    fireEvent.click(btnAplicarTodas);
    expect(onApplyToAll).toHaveBeenCalled();
  });

  it('pestaña Texto: edita título/leyenda, nota al pie y texto alternativo', () => {
    const onUpdate = vi.fn();

    render(
      <InspectorActivoTabs
        elem={baseElem}
        totalFiguras={2}
        onUpdate={onUpdate}
        onApplyToAll={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Texto/i }));

    const inputLeyenda = screen.getByLabelText(/Título \/ Leyenda/i);
    fireEvent.change(inputLeyenda, { target: { value: 'Nuevo título experimental' } });
    expect(onUpdate).toHaveBeenCalledWith('img_1', expect.objectContaining({ caption: 'Nuevo título experimental' }));

    const inputNota = screen.getByLabelText(/Nota al pie/i);
    fireEvent.change(inputNota, { target: { value: 'Nota actualizada' } });
    expect(onUpdate).toHaveBeenCalledWith('img_1', expect.objectContaining({ note: 'Nota actualizada' }));

    const inputAlt = screen.getByLabelText(/Texto alternativo/i);
    fireEvent.change(inputAlt, { target: { value: 'Alt text nuevo' } });
    expect(onUpdate).toHaveBeenCalledWith('img_1', expect.objectContaining({ alt_text: 'Alt text nuevo' }));
  });

  it('pestaña Estilo: muestra los 6 presets visuales APA 7 con selección funcional', () => {
    const onUpdate = vi.fn();

    render(
      <InspectorActivoTabs
        elem={baseElem}
        totalFiguras={2}
        onUpdate={onUpdate}
        onApplyToAll={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Estilo/i }));

    expect(screen.getByText('APA Estándar')).toBeDefined();
    expect(screen.getByText('Científico')).toBeDefined();
    expect(screen.getByText('Ancho Completo')).toBeDefined();
    expect(screen.getByText('Compacto / Flotante')).toBeDefined();
    expect(screen.getByText('Doble Horizontal (a, b)')).toBeDefined();
    expect(screen.getByText('Cuadrícula 2×2 (a, b, c, d)')).toBeDefined();

    // Seleccionar preset científico
    fireEvent.click(screen.getByRole('button', { name: /Científico/i }));
    expect(onUpdate).toHaveBeenCalledWith('img_1', expect.objectContaining({ design_style: 'scientific' }));
  });

  it('pestaña Calidad: muestra diagnóstico de cumplimiento APA 7 y opción de autocompletar', () => {
    const onUpdate = vi.fn();
    const elemSinLeyenda: ElementModel = {
      id: 'img_2',
      type: 'image',
      image_info: {
        width_cm: 18.0, // mayor que 16.5cm
        height_cm: 10.0,
        alignment: 'center',
        caption: '',
        note: '',
        alt_text: '',
      },
    };

    render(
      <InspectorActivoTabs
        elem={elemSinLeyenda}
        totalFiguras={1}
        onUpdate={onUpdate}
        onApplyToAll={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Calidad/i }));

    expect(screen.getByText(/Diagnóstico APA 7/i)).toBeDefined();
    expect(screen.getByText(/Falta título o leyenda/i)).toBeDefined();
    expect(screen.getByText(/Excede ancho de caja útil/i)).toBeDefined();

    const btnAutocompletar = screen.getByRole('button', { name: /Autocompletar recomendación APA/i });
    fireEvent.click(btnAutocompletar);
    expect(onUpdate).toHaveBeenCalledWith(
      'img_2',
      expect.objectContaining({
        width_cm: 15.0,
      })
    );
  });

  it('en una tabla solo ofrece Texto y Calidad: sin controles exclusivos de imagen', () => {
    const elemTabla: ElementModel = {
      id: 'tbl_1',
      type: 'table',
      table_info: {
        element_id: 'tbl_1',
        headers: ['A', 'B'],
        rows: [['1', '2']],
        caption: 'Resumen',
        note: '',
        table_number: 1,
      },
    };

    render(
      <InspectorActivoTabs
        elem={elemTabla}
        totalFiguras={1}
        onUpdate={vi.fn()}
        onApplyToAll={vi.fn()}
      />
    );

    expect(screen.queryByRole('tab', { name: /Formato/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Estilo/i })).toBeNull();
    expect(screen.getByRole('tab', { name: /Texto/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Calidad/i })).toBeInTheDocument();
  });
});

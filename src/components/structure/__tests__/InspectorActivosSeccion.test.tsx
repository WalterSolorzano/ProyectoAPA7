import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InspectorActivosSeccion } from '../InspectorActivosSeccion';
import type { NodoJerarquia } from '../../../lib/jerarquia';
import type { ElementModel } from '../../../types';
import type { DiagnosticItem } from '../../../lib/academicRules';

describe('InspectorActivosSeccion', () => {
  const nodoMock: NodoJerarquia = {
    id: 'n-metodo',
    titulo: '2. Metodología',
    nivel: 1,
    elementoId: 'elem-h1',
    palabras: 650,
    figuras: 1,
    tablas: 0,
    citas: 4,
    fase: 'metodologia',
    hijos: [],
  };

  const elementosMock: ElementModel[] = [
    {
      id: 'elem-h1',
      type: 'heading',
      text: '2. Metodología',
      heading_level: 1,
      style_name: 'Heading 1',
      alignment: 'center',
      font_name: 'Times New Roman',
      font_size: 12,
      is_bold: true,
      is_italic: false,
      is_bullet: false,
      left_indent_cm: 0,
      confidence: 1,
      is_user_modified: false,
    },
    {
      id: 'elem-p1',
      type: 'paragraph',
      text: 'En este estudio se empleó un diseño descriptivo correlacional.',
      style_name: 'Normal',
      alignment: 'left',
      font_name: 'Times New Roman',
      font_size: 12,
      is_bold: false,
      is_italic: false,
      is_bullet: false,
      left_indent_cm: 1.27,
      confidence: 1,
      is_user_modified: false,
    },
    {
      id: 'elem-img1',
      type: 'image',
      text: '',
      style_name: 'Normal',
      alignment: 'center',
      font_name: 'Times New Roman',
      font_size: 12,
      is_bold: false,
      is_italic: false,
      is_bullet: false,
      left_indent_cm: 0,
      confidence: 1,
      is_user_modified: false,
      image_info: {
        id: 'img-1',
        element_id: 'elem-img1',
        filename: 'flujo.png',
        file_path: 'C:/docs/flujo.png',
        relative_url: '/assets/flujo.png',
        figure_number: 1,
        caption: 'Diagrama de flujo del procedimiento muestral',
        note: 'Nota. Elaboración propia a partir de datos del piloto.',
        design_style: 'standard',
        has_caption_in_doc: true,
        caption_placement: 'above',
        has_note_in_doc: true,
      },
    },
  ];

  const diagnosticosMock: DiagnosticItem[] = [
    {
      id: 'binomio_solitario',
      nodoId: 'n-metodo',
      tipo: 'binomio',
      mensaje: 'APA 7: Subdivisión solitaria detectada. Requiere un segundo subnivel correlativo.',
      gravedad: 'advertencia',
    },
    {
      id: 'llamada_fig_elem-img1',
      nodoId: 'n-metodo',
      tipo: 'llamada_figura',
      mensaje: 'La Figura 1 no tiene llamada explícita en el texto ("como se muestra en la Figura 1").',
      gravedad: 'advertencia',
    },
    {
      id: 'encuadre_n-metodo',
      nodoId: 'n-metodo',
      tipo: 'encuadre',
      mensaje: 'Falta párrafo introductorio de encuadre antes del primer subtítulo.',
      gravedad: 'sugerencia',
    },
  ];

  it('contiene la botonera de micro-chips [H1] [H2] [H3] [H4] [H5] para nivelación directa', () => {
    render(
      <InspectorActivosSeccion
        nodo={nodoMock}
        elementos={elementosMock}
        diagnosticos={diagnosticosMock}
        onLevelChange={vi.fn()}
        onOpenFigureEditor={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'H1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'H2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'H3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'H4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'H5' })).toBeInTheDocument();
  });

  it('prohibe cualquier uso de elementos <select> (combobox) para nivel jerárquico', () => {
    const { container } = render(
      <InspectorActivosSeccion
        nodo={nodoMock}
        elementos={elementosMock}
        diagnosticos={diagnosticosMock}
        onLevelChange={vi.fn()}
        onOpenFigureEditor={vi.fn()}
      />
    );

    const selectElements = container.querySelectorAll('select');
    expect(selectElements.length).toBe(0);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('dispara correctamente onLevelChange al pulsar un chip de nivel', () => {
    const handleLevelChange = vi.fn();
    render(
      <InspectorActivosSeccion
        nodo={nodoMock}
        elementos={elementosMock}
        diagnosticos={diagnosticosMock}
        onLevelChange={handleLevelChange}
        onOpenFigureEditor={vi.fn()}
      />
    );

    const chipH2 = screen.getByRole('button', { name: 'H2' });
    fireEvent.click(chipH2);

    expect(handleLevelChange).toHaveBeenCalledTimes(1);
    expect(handleLevelChange).toHaveBeenCalledWith(nodoMock, 2);
  });

  it('muestra la tarjeta del activo visual perteneciente al capítulo con botón para abrir editor', () => {
    const handleOpenFigure = vi.fn();
    render(
      <InspectorActivosSeccion
        nodo={nodoMock}
        elementos={elementosMock}
        diagnosticos={diagnosticosMock}
        onLevelChange={vi.fn()}
        onOpenFigureEditor={handleOpenFigure}
      />
    );

    expect(screen.getByText('Figura 1')).toBeInTheDocument();
    expect(screen.getByText(/Diagrama de flujo del procedimiento muestral/i)).toBeInTheDocument();

    const openButton = screen.getByRole('button', { name: /Abrir Estudio de Estilos & Leyenda/i });
    expect(openButton).toBeInTheDocument();

    fireEvent.click(openButton);
    expect(handleOpenFigure).toHaveBeenCalledTimes(1);
    expect(handleOpenFigure).toHaveBeenCalledWith(expect.objectContaining({ id: 'elem-img1' }));
  });

  it('muestra los diagnósticos académicos de academicRules (binomio, llamadas en texto, párrafo de encuadre)', () => {
    render(
      <InspectorActivosSeccion
        nodo={nodoMock}
        elementos={elementosMock}
        diagnosticos={diagnosticosMock}
        onLevelChange={vi.fn()}
        onOpenFigureEditor={vi.fn()}
      />
    );

    expect(screen.getByText(/Subdivisión solitaria detectada/i)).toBeInTheDocument();
    expect(screen.getByText(/no tiene llamada explícita en el texto/i)).toBeInTheDocument();
    expect(screen.getByText(/Falta párrafo introductorio de encuadre/i)).toBeInTheDocument();
  });
});

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EsqueletoNavegacion } from '../EsqueletoNavegacion';
import type { NodoJerarquia } from '../../../lib/jerarquia';
import type { DiagnosticItem } from '../../../lib/academicRules';

describe('EsqueletoNavegacion', () => {
  const arbolMock: NodoJerarquia[] = [
    {
      id: 'n-intro',
      titulo: '1. Introducción',
      nivel: 1,
      elementoId: 'elem-1',
      palabras: 450,
      figuras: 0,
      tablas: 0,
      citas: 2,
      fase: 'introduccion',
      hijos: [
        {
          id: 'n-ant',
          titulo: '1.1 Antecedentes',
          nivel: 2,
          elementoId: 'elem-2',
          palabras: 200,
          figuras: 0,
          tablas: 0,
          citas: 1,
          fase: 'introduccion',
          hijos: [
            {
              id: 'n-just',
              titulo: '1.1.1 Justificación Teórica',
              nivel: 3,
              elementoId: 'elem-3',
              palabras: 150,
              figuras: 0,
              tablas: 0,
              citas: 1,
              fase: 'introduccion',
              hijos: [],
            },
          ],
        },
      ],
    },
  ];

  it('renderiza árbol de capítulos con badges de nivel H1, H2, H3', () => {
    render(
      <EsqueletoNavegacion
        arbol={arbolMock}
        selectedId={null}
        diagnosticos={[]}
        onSelect={() => {}}
      />
    );

    expect(screen.getByText('1. Introducción')).toBeInTheDocument();
    expect(screen.getByText('1.1 Antecedentes')).toBeInTheDocument();
    expect(screen.getByText('1.1.1 Justificación Teórica')).toBeInTheDocument();

    expect(screen.getByText('H1')).toBeInTheDocument();
    expect(screen.getByText('H2')).toBeInTheDocument();
    expect(screen.getByText('H3')).toBeInTheDocument();
  });

  it('ejecuta callback onSelect al hacer clic en un nodo', () => {
    const handleSelect = vi.fn();
    render(
      <EsqueletoNavegacion
        arbol={arbolMock}
        selectedId="n-intro"
        diagnosticos={[]}
        onSelect={handleSelect}
      />
    );

    const nodoH2 = screen.getByText('1.1 Antecedentes');
    fireEvent.click(nodoH2);

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n-ant', titulo: '1.1 Antecedentes' })
    );
  });

  it('muestra indicador visual de alerta si el nodo tiene diagnósticos de academicRules', () => {
    const diagnosticosMock: DiagnosticItem[] = [
      {
        id: 'diag-1',
        nodoId: 'n-intro',
        tipo: 'binomio',
        mensaje: 'Subdivisión solitaria',
        gravedad: 'advertencia',
      },
    ];

    render(
      <EsqueletoNavegacion
        arbol={arbolMock}
        selectedId={null}
        diagnosticos={diagnosticosMock}
        onSelect={() => {}}
      />
    );

    const alerta = screen.getByTestId('alerta-nodo-n-intro');
    expect(alerta).toBeInTheDocument();
    expect(screen.queryByTestId('alerta-nodo-n-ant')).not.toBeInTheDocument();
  });
});

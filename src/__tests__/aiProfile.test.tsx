import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiProfile } from '../components/review/AiProfile';
import type { PerfilIA } from '../lib/aiPerfil';

const perfil: PerfilIA = {
  filas: [
    {
      h1Id: 'h1-a',
      titulo: 'Introducción',
      fase: 'introduccion',
      parrafos: [
        { elementId: 'e1', index: 0, score: 10, categoria: 'LOW', excerpt: 'uno', carril: 0 },
        { elementId: 'e2', index: 1, score: 60, categoria: 'HIGH', excerpt: 'dos', carril: 1 },
      ],
      porBanda: [1, 0, 1, 0],
      rigidezMedia: 35,
    },
    {
      h1Id: 'h1-b',
      titulo: 'Método',
      fase: 'metodo',
      parrafos: [{ elementId: 'e3', index: 2, score: 80, categoria: 'HIGH', excerpt: 'tres', carril: 0 }],
      porBanda: [0, 0, 0, 1],
      rigidezMedia: 80,
    },
  ],
  total: 3,
  porBanda: [1, 0, 1, 1],
  rigidezMedia: 50,
  vozHumana: 50,
  enAlerta: 2,
  filaMasRigida: null,
};

const props = { onOpenPhase: vi.fn(), onSelectParrafo: vi.fn() };

describe('AiProfile — perfil por fase', () => {
  it('dibuja un punto por párrafo medido', () => {
    render(<AiProfile perfil={perfil} {...props} />);
    expect(document.querySelectorAll('.aip-punto')).toHaveLength(3);
  });

  it('el title de un punto contiene su score', () => {
    render(<AiProfile perfil={perfil} {...props} />);
    const punto = document.querySelectorAll('.aip-punto')[1] as HTMLElement;
    expect(punto.getAttribute('title')).toContain('60');
  });

  it('click en el título de fase llama onOpenPhase con el h1Id', () => {
    const onOpenPhase = vi.fn();
    render(<AiProfile perfil={perfil} onOpenPhase={onOpenPhase} onSelectParrafo={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Método' }));
    expect(onOpenPhase).toHaveBeenCalledWith('h1-b');
  });

  it('click en un punto llama onSelectParrafo y NO onOpenPhase', () => {
    const onOpenPhase = vi.fn();
    const onSelectParrafo = vi.fn();
    render(<AiProfile perfil={perfil} onOpenPhase={onOpenPhase} onSelectParrafo={onSelectParrafo} />);
    fireEvent.click(document.querySelectorAll('.aip-punto')[1] as HTMLElement);
    expect(onSelectParrafo).toHaveBeenCalledWith('e2');
    expect(onOpenPhase).not.toHaveBeenCalled();
  });

  it('sin filas muestra el estado vacío', () => {
    render(<AiProfile perfil={{ ...perfil, filas: [] }} {...props} />);
    expect(document.querySelector('.aip-vacio')).toBeTruthy();
  });

  it('muestra la leyenda de las cuatro bandas', () => {
    render(<AiProfile perfil={perfil} {...props} />);
    expect(document.querySelectorAll('.aip-leyenda-item')).toHaveLength(4);
  });

  it('muestra el eje con los cortes de score', () => {
    render(<AiProfile perfil={perfil} {...props} />);
    const eje = document.querySelector('.aip-eje');
    expect(eje?.textContent).toContain('50');
    expect(eje?.textContent).toContain('100');
  });

  it('ubica cada punto en su carril vertical', () => {
    render(<AiProfile perfil={perfil} {...props} />);
    const puntos = document.querySelectorAll('.aip-punto') as unknown as HTMLElement[];
    expect(puntos[0].style.top).not.toBe(puntos[1].style.top);
  });
});

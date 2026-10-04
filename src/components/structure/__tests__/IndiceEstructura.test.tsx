/* Tests del índice de estructura: sin ruido por fila y H1 plegadas.
 *
 * El rediseño pide dos cosas que un árbol plano no puede dar: la fila deja de
 * repetir `sin elementos` / `sin comparar` / conteo de palabras, y las H1
 * arrancan cerradas para que el capítulo mande sobre sus secciones.
 *
 * Se usan títulos neutros (no de fase) para que el único botón que menciona la
 * sección sea el chevron de plegado y no un chip de fase homónimo.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { IndiceEstructura } from '../IndiceEstructura';
import { IndicePrevisualizacion } from '../IndicePrevisualizacion';
import { construirJerarquia } from '../../../lib/jerarquia';
import type { ElementModel } from '../../../types';

const elementos = [
  { id: 'h1', type: 'heading', text: 'Alfa', heading_level: 1 },
  { id: 'h2', type: 'heading', text: 'Sección interna', heading_level: 2 },
  { id: 'p1', type: 'paragraph', text: 'Texto de la sección interna.' },
  { id: 'h1b', type: 'heading', text: 'Beta', heading_level: 1 },
] as unknown as ElementModel[];

describe('IndiceEstructura', () => {
  it('no muestra ruido por fila', () => {
    render(<IndiceEstructura elementos={elementos} />);
    expect(screen.queryByText('sin elementos')).toBeNull();
    expect(screen.queryByText('sin comparar')).toBeNull();
  });

  it('no muestra el conteo de palabras en la fila', () => {
    render(<IndiceEstructura elementos={elementos} />);
    expect(screen.queryByText(/palabras/i)).toBeNull();
  });

  it('arranca con los H1 plegados y despliega al clic', () => {
    render(<IndiceEstructura elementos={elementos} />);
    expect(screen.queryByText('Sección interna')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Alfa/i }));
    expect(screen.getByText('Sección interna')).toBeTruthy();
  });
});

describe('IndicePrevisualizacion', () => {
  const raices = construirJerarquia(elementos);

  it('arranca en la raíz Documento', () => {
    render(<IndicePrevisualizacion raices={raices} />);
    expect(screen.getByText('Documento')).toBeTruthy();
  });

  it('pliega las H1 por defecto', () => {
    render(<IndicePrevisualizacion raices={raices} />);
    expect(screen.queryByText('Sección interna')).toBeNull();
  });

  it('despliega la rama al clic en la H1', () => {
    render(<IndicePrevisualizacion raices={raices} />);
    fireEvent.click(screen.getByRole('button', { name: /Alfa/i }));
    expect(screen.getByText('Sección interna')).toBeTruthy();
  });

  it('respeta la profundidad máxima visible', () => {
    render(<IndicePrevisualizacion raices={raices} profundidadMaxima={1} />);
    fireEvent.click(screen.getByRole('button', { name: /Alfa/i }));
    expect(screen.queryByText('Sección interna')).toBeNull();
  });
});

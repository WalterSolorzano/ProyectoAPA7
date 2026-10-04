import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReferenceCatalogItem } from '../ReferenceCatalogItem';
import type { ReferenciaModel } from '../../../types';

describe('ReferenceCatalogItem', () => {
  const mockRef: ReferenciaModel = {
    id: 'ref-1',
    authors: ['Hernández Sampieri, Roberto', 'Fernández Collado, Carlos'],
    year: '2014',
    title: 'Metodología de la investigación',
    source: 'McGraw-Hill',
    doi_or_url: 'https://doi.org/10.1000/182',
    raw_text: 'Hernández Sampieri, R. (2014). Metodología de la investigación. McGraw-Hill.',
    cited_count: 3,
    verificada: true,
  };

  it('renderiza autor principal, año y título de la referencia', () => {
    render(
      <ReferenceCatalogItem
        reference={mockRef}
        isSelected={false}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    expect(screen.getByText(/Hernández Sampieri/i)).toBeDefined();
    expect(screen.getByText(/2014/)).toBeDefined();
    expect(screen.getByText('Metodología de la investigación')).toBeDefined();
  });

  it('maneja referencias sin año (s.f.) y sin autores con fallbacks elegantes', () => {
    const fallbackRef: ReferenciaModel = {
      id: 'ref-2',
      authors: [],
      title: 'Estudio empírico preliminar',
      source: 'Web',
      raw_text: 'Estudio empírico preliminar.',
    };

    render(
      <ReferenceCatalogItem
        reference={fallbackRef}
        isSelected={false}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    expect(screen.getByText(/s\.f\./i)).toBeDefined();
    expect(screen.getByText(/Autor/i)).toBeDefined();
    expect(screen.getByText('Estudio empírico preliminar')).toBeDefined();
  });

  it('aplica estado activo cuando isSelected es true', () => {
    const { container, rerender } = render(
      <ReferenceCatalogItem
        reference={mockRef}
        isSelected={true}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('active');

    rerender(
      <ReferenceCatalogItem
        reference={mockRef}
        isSelected={false}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(card.className).not.toContain('active');
  });

  it('llama a onSelect al hacer click en la tarjeta', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ReferenceCatalogItem
        reference={mockRef}
        isSelected={false}
        onSelect={onSelect}
        onEdit={vi.fn()}
      />
    );

    const card = container.firstChild as HTMLElement;
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renderiza botón de editar flotante y dispara onEdit sin propagar a onSelect', () => {
    const onSelect = vi.fn();
    const onEdit = vi.fn();

    render(
      <ReferenceCatalogItem
        reference={mockRef}
        isSelected={false}
        onSelect={onSelect}
        onEdit={onEdit}
      />
    );

    const editBtn = screen.getByRole('button', { name: /editar/i });
    expect(editBtn).toBeDefined();

    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('muestra badge de verificada y cantidad de menciones', () => {
    render(
      <ReferenceCatalogItem
        reference={mockRef}
        isSelected={false}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    expect(screen.getByText(/Verificada/i)).toBeDefined();
    expect(screen.getByText(/3 menciones/i)).toBeDefined();
    expect(screen.getByText(/DOI/i)).toBeDefined();
  });

  it('muestra badge de sin citar si never_cited es true o cited_count es 0', () => {
    const orphanRef: ReferenciaModel = {
      ...mockRef,
      id: 'ref-orphan',
      cited_count: 0,
      never_cited: true,
      verificada: false,
    };

    render(
      <ReferenceCatalogItem
        reference={orphanRef}
        isSelected={false}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    expect(screen.getByText(/Sin citar/i)).toBeDefined();
  });

  it('cumple la regla de CERO emojis en el render', () => {
    const { container } = render(
      <ReferenceCatalogItem
        reference={mockRef}
        isSelected={false}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(container.innerHTML)).toBe(false);
  });
});

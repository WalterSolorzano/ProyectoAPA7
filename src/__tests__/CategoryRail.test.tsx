import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryRail, CATEGORY_META } from '../components/review/CategoryRail';
import { vi } from 'vitest';

describe('CategoryRail', () => {
  it('no incluye citas entre las categorias del modulo', () => {
    expect(CATEGORY_META.map((c) => c.id)).not.toContain('citations');
  });

  it('muestra el conteo de cada categoria', () => {
    const counts = Object.fromEntries(
      CATEGORY_META.map((c) => [c.id, c.id === 'ai' ? 12 : 0]),
    ) as any;
    render(<CategoryRail active="ai" counts={counts} onSelect={() => {}} />);
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('avisa que categoria se selecciono', () => {
    const onSelect = vi.fn();
    render(<CategoryRail active="ai" counts={{ ai: 1, style: 0, spelling: 0, citations: 0, structure: 0 }} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /estilo/i }));
    expect(onSelect).toHaveBeenCalledWith('style');
  });
});

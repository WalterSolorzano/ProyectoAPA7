/**
 * WordAPA7 — T15: el rack agrupa por motor y luego por subtipo, con la
   accion en masa pegada a la derecha. Una fila por subtipo, nunca una fila
   por aparicion.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EngineGroupCard, SubtypeRow } from '../components/review/EngineGroupCard';
import { FindingDetail } from '../components/review/FindingDetail';
import type { AuditItem, EngineGroup, SubtypeGroup } from '../hooks/useReviewWorkbench';

const item = (over: Partial<AuditItem> = {}): AuditItem => ({
  id: 'h1', element_id: 'e1', category: 'spelling', subtype: 'ortografia',
  severity: 'medium', summary: 'Ortografía', detail: 'Falta tilde',
  originalText: 'tambien', suggestedText: 'también', pageNumber: 3, ...over,
});

const subgrupo = (over: Partial<SubtypeGroup> = {}): SubtypeGroup => ({
  key: 'spelling:ortografia', label: 'Ortografía',
  items: [item(), item({ id: 'h2', element_id: 'e2', pageNumber: 14 })],
  action: 'accept', massLabel: 'Aceptar todos', ...over,
});

const motor = (over: Partial<EngineGroup> = {}): EngineGroup => ({
  engine: 'spelling', title: 'Ortografía', chip: 'Ortografía', count: 48,
  criticalHigh: 2, groups: [subgrupo()], massAction: 'accept', massLabel: 'Aceptar todas', ...over,
});

const detalle = (over: Partial<React.ComponentProps<typeof FindingDetail>> = {}) => {
  const props = {
    item: item(),
    index: 0,
    total: 3,
    onStep: vi.fn(),
    onAccept: vi.fn(),
    onMark: vi.fn(),
    onDismiss: vi.fn(),
    busy: false,
    ...over,
  };
  return { props, ...render(<FindingDetail {...props} />) };
};

describe('T15 — rack de hallazgos', () => {
  it('la cabecera del motor muestra el conteo y la acción en masa', () => {
    const onMassAction = vi.fn();
    render(
      <EngineGroupCard group={motor()} open onToggle={vi.fn()} openSubtypes={[]} onToggleSubtype={vi.fn()} onMassAction={onMassAction}>
        <span>contenido</span>
      </EngineGroupCard>,
    );
    expect(screen.getByRole('button', { name: /Aceptar todas/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Aceptar todas/ }));
    expect(onMassAction).toHaveBeenCalled();
  });

  it('la cabecera es un botón con aria-expanded, no un div con onClick', () => {
    render(
      <EngineGroupCard group={motor()} open={false} onToggle={vi.fn()} openSubtypes={[]} onToggleSubtype={vi.fn()} onMassAction={vi.fn()}>
        <span>c</span>
      </EngineGroupCard>,
    );
    const cabecera = screen.getByRole('button', { name: /Ortografía/ });
    expect(cabecera.getAttribute('aria-expanded')).toBe('false');
  });

  it('la fila de subtipo resume: original, sugerido, veces y páginas', () => {
    render(
      <SubtypeRow group={subgrupo()} open={false} onToggle={vi.fn()} onMassAction={vi.fn()}>
        <span>c</span>
      </SubtypeRow>,
    );
    expect(screen.getByText('tambien')).toBeTruthy();
    expect(screen.getByText('también')).toBeTruthy();
    expect(screen.getByText(/×2/)).toBeTruthy();
    expect(screen.getByText(/pág\./)).toBeTruthy();
  });

  it('un hallazgo de IA se marca, nunca se acepta', () => {
    const onAccept = vi.fn();
    const onMark = vi.fn();
    render(
      <FindingDetail
        item={item({ category: 'ai', subtype: 'muletilla', suggestedText: 'sin lugar a dudas' })}
        index={0} total={3} onStep={vi.fn()}
        onAccept={onAccept} onMark={onMark} onDismiss={vi.fn()} busy={false}
      />,
    );
    expect(screen.queryByRole('button', { name: /Aplicar corrección/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Marcar para revisar/i })).toBeTruthy();
  });

  it('un hallazgo objetivo sí se acepta, y navegar cambia de ocurrencia', () => {
    const onStep = vi.fn();
    render(
      <FindingDetail
        item={item()} index={0} total={3} onStep={onStep}
        onAccept={vi.fn()} onMark={vi.fn()} onDismiss={vi.fn()} busy={false}
      />,
    );
    expect(screen.getByRole('button', { name: /Aplicar corrección/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente aparición' }));
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it('el detalle explica que el motor es probabilístico en el caso de IA', () => {
    render(
      <FindingDetail
        item={item({ category: 'ai', subtype: 'muletilla' })} index={0} total={1}
        onStep={vi.fn()} onAccept={vi.fn()} onMark={vi.fn()} onDismiss={vi.fn()} busy={false}
      />,
    );
    // Las dos avisos: el encabezado de la propuesta y la explicación. Una
    // sugerencia de IA no entra como "Sugerencia académica APA 7".
    expect(screen.getByText(/Este motor es probabilístico/)).toBeTruthy();
    expect(screen.getByText('Revisión manual (motor probabilístico)')).toBeTruthy();
    expect(screen.queryByText(/Sugerencia académica/)).toBeNull();
  });

  it('el motor objetivo sí anuncia una propuesta académica, no una conjetura', () => {
    render(
      <FindingDetail
        item={item()} index={0} total={1}
        onStep={vi.fn()} onAccept={vi.fn()} onMark={vi.fn()} onDismiss={vi.fn()} busy={false}
      />,
    );
    expect(screen.getByText('Sugerencia académica APA 7')).toBeTruthy();
    expect(screen.queryByText(/probabilístico/)).toBeNull();
  });

  it('ninguna cadena del rack lleva emojis (Review Focus #5)', () => {
    const { container } = render(
      <SubtypeRow group={subgrupo()} open onToggle={vi.fn()} onMassAction={vi.fn()}>
        <span>c</span>
      </SubtypeRow>,
    );
    expect(container.textContent || '').not.toMatch(/\p{Extended_Pictographic}/u);
  });

  /* ── El rótulo lo decide el hook, no la vista ──────────────────────────── */

  it('la cabecera del motor IA dice "Marcar todos", no "Aceptar todas"', () => {
    render(
      <EngineGroupCard
        group={motor({ engine: 'ai', title: 'Patrones IA', massAction: 'mark', massLabel: 'Marcar todos' })}
        open onToggle={vi.fn()} openSubtypes={[]} onToggleSubtype={vi.fn()} onMassAction={vi.fn()}
      >
        <span>c</span>
      </EngineGroupCard>,
    );
    expect(screen.getByRole('button', { name: 'Marcar todos' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Aceptar/ })).toBeNull();
  });

  it('un grupo sin acción (massLabel vacío) no pinta botón vacío', () => {
    render(
      <EngineGroupCard
        group={motor({ massAction: 'none', massLabel: '' })}
        open onToggle={vi.fn()} openSubtypes={[]} onToggleSubtype={vi.fn()} onMassAction={vi.fn()}
      >
        <span>contenido</span>
      </EngineGroupCard>,
    );
    // Solo queda el botón de la cabecera: un `<button>` sin rótulo sería un
    // control que anuncia su nombre a nadie.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('una fila sin acción (subtipo "none") tampoco pinta botón vacío', () => {
    render(
      <SubtypeRow group={subgrupo({ action: 'none', massLabel: '' })} open onToggle={vi.fn()} onMassAction={vi.fn()}>
        <span>contenido</span>
      </SubtypeRow>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  /* ── Lo que el rack NO inventa ─────────────────────────────────────────── */

  it('los cuatro niveles de severidad tiñen el ×N (no hay un color por defecto)', () => {
    const colorDe = (severity: AuditItem['severity']): string => {
      const { unmount } = render(
        <SubtypeRow group={subgrupo({ items: [item({ severity })] })} open={false} onToggle={vi.fn()} onMassAction={vi.fn()}>
          <span>c</span>
        </SubtypeRow>,
      );
      const color = screen.getByText(/×1/).style.color;
      unmount();
      return color;
    };
    expect(colorDe('critical')).toBe('var(--color-danger)');
    expect(colorDe('high')).toBe('var(--color-warning)');
    expect(colorDe('medium')).toBe('var(--color-info)');
    expect(colorDe('low')).toBe('var(--color-text-tertiary)');
  });

  it('sin página real la fila no inventa una: sin "pág." y sin página 0', () => {
    render(
      <SubtypeRow
        group={subgrupo({ items: [item({ id: 'h1', pageNumber: null }), item({ id: 'h2', pageNumber: null })] })}
        open={false} onToggle={vi.fn()} onMassAction={vi.fn()}
      >
        <span>c</span>
      </SubtypeRow>,
    );
    expect(screen.queryByText(/pág\./)).toBeNull();
  });

  it('un subtipo sin páginas y sin sugerencia no rompe la fila', () => {
    render(
      <SubtypeRow
        group={subgrupo({ items: [item({ pageNumber: null, suggestedText: undefined, originalText: '' })] })}
        open={false} onToggle={vi.fn()} onMassAction={vi.fn()}
      >
        <span>c</span>
      </SubtypeRow>,
    );
    expect(screen.getByText(/×1/)).toBeTruthy();
    expect(screen.getByText('Ortografía')).toBeTruthy();
  });

  /* ── Despliegue ────────────────────────────────────────────────────────── */

  it('cerrado, el motor no monta sus filas', () => {
    const { unmount } = render(
      <EngineGroupCard group={motor()} open={false} onToggle={vi.fn()} openSubtypes={[]} onToggleSubtype={vi.fn()} onMassAction={vi.fn()}>
        <span>filas del motor</span>
      </EngineGroupCard>,
    );
    expect(screen.queryByText('filas del motor')).toBeNull();
    unmount();
  });

  it('abierta, la fila sí monta sus apariciones', () => {
    render(
      <SubtypeRow group={subgrupo()} open onToggle={vi.fn()} onMassAction={vi.fn()}>
        <span>apariciones</span>
      </SubtypeRow>,
    );
    expect(screen.getByText('apariciones')).toBeTruthy();
  });

  it('un grupo vacío no rompe la fila', () => {
    render(
      <SubtypeRow group={subgrupo({ items: [] })} open onToggle={vi.fn()} onMassAction={vi.fn()}>
        <span>c</span>
      </SubtypeRow>,
    );
    expect(screen.getByText('×0')).toBeTruthy();
    expect(screen.getByText('Ortografía')).toBeTruthy();
  });

  it('cerrado, aria-controls no apunta a una región que no existe', () => {
    const { unmount } = render(
      <EngineGroupCard group={motor()} open={false} onToggle={vi.fn()} openSubtypes={[]} onToggleSubtype={vi.fn()} onMassAction={vi.fn()}>
        <span>c</span>
      </EngineGroupCard>,
    );
    // Un id que no está en el DOM es un puntero colgado para quien navegue
    // con teclado o escuche la región expandida.
    expect(screen.getByRole('button', { name: /Ortografía/ }).getAttribute('aria-controls')).toBeNull();
    unmount();
  });

  it('abierto, aria-controls sí nombra la región que se desplegó', () => {
    const { unmount } = render(
      <EngineGroupCard group={motor()} open onToggle={vi.fn()} openSubtypes={[]} onToggleSubtype={vi.fn()} onMassAction={vi.fn()}>
        <span>c</span>
      </EngineGroupCard>,
    );
    expect(screen.getByRole('button', { name: /Ortografía/ }).getAttribute('aria-controls')).toBe('engine-spelling');
    unmount();
    render(
      <SubtypeRow group={subgrupo()} open onToggle={vi.fn()} onMassAction={vi.fn()}>
        <span>c</span>
      </SubtypeRow>,
    );
    expect(screen.getByRole('button', { name: /Ortografía/ }).getAttribute('aria-controls')).toBe('subtype-spelling:ortografia');
  });

  /* ── El detalle: qué acción existe y cuál no ───────────────────────────── */

  it('un hallazgo sin sugerencia no ofrece "Aplicar corrección"', () => {
    const { props } = detalle({ item: item({ suggestedText: undefined, subtype: 'voz_pasiva' }) });
    expect(screen.queryByRole('button', { name: /Aplicar corrección/i })).toBeNull();
    // Descartar sí: es lo único honesto que se puede hacer con un hallazgo sin
    // corrección automática.
    expect(screen.getByRole('button', { name: /Descartar/i })).toBeTruthy();
    expect(props.onAccept).not.toHaveBeenCalled();
  });

  it('con una sola aparición no hay flechas que no tienen a dónde ir', () => {
    detalle({ index: 0, total: 1 });
    expect(screen.queryByRole('button', { name: 'Siguiente aparición' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aparición anterior' })).toBeNull();
  });

  it('el detalle dice en qué aparición estás, y en cuál de cuántas', () => {
    detalle({ index: 1, total: 3 });
    expect(screen.getByText('2 de 3')).toBeTruthy();
  });

  it('cada acción entrega el hallazgo que se está viendo, no otro', () => {
    const { props } = detalle({ item: item({ id: 'h9', pageNumber: 77 }) });
    fireEvent.click(screen.getByRole('button', { name: /Aplicar corrección/i }));
    expect(props.onAccept).toHaveBeenCalledWith(props.item);
    fireEvent.click(screen.getByRole('button', { name: /Descartar/i }));
    expect(props.onDismiss).toHaveBeenCalledWith(props.item);
  });

  it('marcar un hallazgo de IA lo entrega a onMark, no a onAccept', () => {
    const { props } = detalle({ item: item({ category: 'ai', subtype: 'muletilla' }) });
    fireEvent.click(screen.getByRole('button', { name: /Marcar para revisar/i }));
    expect(props.onMark).toHaveBeenCalledWith(props.item);
    expect(props.onAccept).not.toHaveBeenCalled();
  });

  it('mientras está ocupado, ninguna acción se puede disparar dos veces', () => {
    const { props } = detalle({ busy: true });
    expect(screen.getByRole('button', { name: /Aplicar corrección/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Descartar/i })).toBeDisabled();
    expect(props.onAccept).not.toHaveBeenCalled();
  });

  it('sin página real el detalle lo dice en vez de inventar la página 0', () => {
    detalle({ item: item({ pageNumber: null }) });
    expect(screen.getByText('Sin página asignada')).toBeTruthy();
  });

  it('sin página real, el desplazamiento entre apariciones sigue disponible', () => {
    const { props } = detalle({ item: item({ pageNumber: null }), total: 4 });
    expect(screen.getByText('Sin página asignada')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente aparición' }));
    expect(props.onStep).toHaveBeenCalledWith(1);
  });
});

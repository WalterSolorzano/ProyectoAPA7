/**
 * WordAPA7 — T13: la tira de Revision lleva los filtros por motor a la
 * izquierda y el paginador a la derecha. Es la unica barra de la vista.
 *
 * Tres reglas de producto que estos tests sostienen, no azucar:
 * - El chip activo se REPRESENTA (aria-pressed), no se filtra aqui: quien
 *   filtra el rack y el minimapa es `useReviewWorkbench`.
 * - El cumplimiento solo aparece si fue medido (`number | null`).
 * - El paginador no pasa de sus extremos: en la primera pagina "anterior" no
 *   hace nada, en la ultima "siguiente" tampoco.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { ReviewStrip } from '../components/review/ReviewStrip';
import { ENGINE_META, type EngineGroup } from '../hooks/useReviewWorkbench';

const grupo = (engine: EngineGroup['engine'], count: number): EngineGroup => ({
  engine,
  title: ENGINE_META[engine].title,
  chip: ENGINE_META[engine].chip,
  count,
  criticalHigh: 0,
  groups: [],
  massAction: 'accept',
  massLabel: 'Aceptar todas',
  covered: count,
});

const setup = (over: Partial<React.ComponentProps<typeof ReviewStrip>> = {}) => {
  const onFilter = vi.fn();
  const onPage = vi.fn();
  const onNextFinding = vi.fn();
  const onViewMode = vi.fn();
  const utils = render(
    <ReviewStrip
      engineGroups={[grupo('spelling', 48), grupo('ai', 14)]}
      filter="all"
      onFilter={onFilter}
      totalPages={132}
      currentPage={14}
      onPage={onPage}
      onNextFinding={onNextFinding}
      compliance={97}
      viewMode="focus"
      onViewMode={onViewMode}
      hasFindings
      onScan={vi.fn()}
      isScanning={false}
      total={62}
      {...over}
    />,
  );
  return { ...utils, onFilter, onPage, onNextFinding, onViewMode };
};

describe('T13 — ReviewStrip', () => {
  it('lista un chip por motor con su contador, más el chip Todo', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Todo 62' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ortografía 48' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Patrones IA 14' })).toBeTruthy();
  });

  it('marca el chip activo con aria-pressed', () => {
    setup({ filter: 'spelling' });
    expect(screen.getByRole('button', { name: 'Ortografía 48' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Todo 62' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('pedir un chip pide ese filtro, y no filtra nada por su cuenta', () => {
    const { onFilter } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Ortografía 48' }));
    expect(onFilter).toHaveBeenCalledWith('spelling');
    fireEvent.click(screen.getByRole('button', { name: 'Todo 62' }));
    expect(onFilter).toHaveBeenLastCalledWith('all');
    // La tira no vuelve a filtrar lo que le pasaron: pide el filtro y sigue
    // mostrando lo que llegó. (Que el hook estreche `groups` es cosa del hook;
    // esta barra recibe `engineGroups`, el resumen SIN filtro, y un `total`.)
    expect(screen.getByRole('button', { name: 'Patrones IA 14' })).toBeTruthy();
  });

  it('el chip Todo publica el total que recibe, no la suma de los chips', () => {
    // "Todo 130" con chips que suman 62 es incoherente; la suma era una
    // re-derivación de un número que el hook ya tiene (`metrics.total`).
    setup({ engineGroups: [grupo('spelling', 48)], total: 130 });
    expect(screen.getByRole('button', { name: 'Todo 130' })).toBeTruthy();
  });

  it('el grupo "Filtros por motor" contiene solo filtros, no el escaneo', () => {
    setup({ hasFindings: false });
    const grupoFiltros = screen.getByRole('group', { name: 'Filtros por motor' });
    // "Escanear" NO es un filtro: si viviera dentro, un lector de pantalla lo
    // anunciaría como parte del conjunto de filtros.
    expect(within(grupoFiltros).queryByRole('button', { name: 'Escanear' })).toBeNull();
    expect(within(grupoFiltros).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Todo 62',
      'Ortografía 48',
      'Patrones IA 14',
    ]);
    // Y sigue disponible, fuera del grupo.
    expect(screen.getByRole('button', { name: 'Escanear' })).toBeTruthy();
  });

  it('publica la página actual sobre el total', () => {
    setup();
    expect(screen.getByText('Página 14 de 132')).toBeTruthy();
  });

  it('en la primera página, "anterior" no pagina', () => {
    const { onPage } = setup({ currentPage: 1 });
    const prev = screen.getByRole('button', { name: 'Página anterior' });
    expect(prev.hasAttribute('disabled')).toBe(true);
    fireEvent.click(prev);
    expect(onPage).not.toHaveBeenCalled();
  });

  it('en la última página, "siguiente" no pagina', () => {
    const { onPage } = setup({ currentPage: 132 });
    const next = screen.getByRole('button', { name: 'Página siguiente' });
    expect(next.hasAttribute('disabled')).toBe(true);
    fireEvent.click(next);
    expect(onPage).not.toHaveBeenCalled();
  });

  it('en medio del documento, las flechas paginan de a uno', () => {
    const { onPage } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(onPage).toHaveBeenCalledWith(13);
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(onPage).toHaveBeenCalledWith(15);
  });

  it('sin páginas, no inventa un paginador', () => {
    setup({ totalPages: 0, currentPage: 1 });
    expect(screen.queryByText(/Página/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Página anterior' })).toBeNull();
  });

  it('"Siguiente hallazgo" dispara su acción', () => {
    const { onNextFinding } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente hallazgo' }));
    expect(onNextFinding).toHaveBeenCalledTimes(1);
  });

  it('el toggle de vista ofrece Foco y Hoja, y refleja la activa', () => {
    const { onViewMode } = setup();
    expect(screen.getByRole('button', { name: 'Foco' }).getAttribute('aria-pressed')).toBe('true');
    const hoja = screen.getByRole('button', { name: 'Hoja' });
    expect(hoja.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(hoja);
    expect(onViewMode).toHaveBeenCalledWith('canvas');
  });

  it('con cumplimiento medido, lo publica', () => {
    setup({ compliance: 97 });
    expect(screen.getByText('Cumplimiento 97%')).toBeTruthy();
  });

  it('sin cumplimiento medido, no inventa un porcentaje', () => {
    setup({ compliance: null });
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('sin medir, LO DICE: un hueco y un 0 se leen igual', () => {
    // El HUD antiguo decía "Sin analizar". Un espacio vacío en el mismo sitio
    // del número no dice si falta medir o si el documento está impecable, y en
    // una pantalla cuya función es ser honesta con lo que no sabe, esa
    // diferencia es el contenido.
    setup({ compliance: null });
    expect(screen.getByText(/sin medir/i)).toBeTruthy();
  });

  it('con hallazgos, "Escanear" sigue ahí: sin él no hay rescan', () => {
    // Un "Escanear" que solo existe en el documento sin hallazgos deja sin
    // forma de re-correr el escaneo completo después de editar, que es
    // exactamente cuando se quiere, y hace inalcanzable el estado "Escaneando"
    // en el único caso en que hace falta. El botón se apaga, no se esconde.
    const onScan = vi.fn();
    setup({ onScan });
    const btn = screen.getByRole('button', { name: 'Escanear' });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onScan).toHaveBeenCalled();
  });

  it('mientras escanea, el botón lo dice y no se puede volver a pulsar', () => {
    setup({ isScanning: true });
    const btn = screen.getByRole('button', { name: 'Escaneando' });
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('sin resultados, ofrece Escanear y "Todo 0"', () => {
    const onScan = vi.fn();
    setup({ hasFindings: false, engineGroups: [], total: 0, onScan });
    fireEvent.click(screen.getByRole('button', { name: 'Escanear' }));
    expect(onScan).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Todo 0' })).toBeTruthy();
  });

  it('sin hallazgos, "Siguiente hallazgo" existe pero no puede hacer nada', () => {
    // Se DESHABILITA en vez de desaparecer: el control es parte de la barra y
    // su ausencia haría que la barra saltara al escanear. Un botón primario
    // que nunca puede hacer nada es una mentira sobre el documento.
    const { onNextFinding } = setup({ hasFindings: false, engineGroups: [], total: 0 });
    const btn = screen.getByRole('button', { name: 'Siguiente hallazgo' });
    expect(btn.hasAttribute('disabled')).toBe(true);
    fireEvent.click(btn);
    expect(onNextFinding).not.toHaveBeenCalled();
  });

  it('con hallazgos, "Siguiente hallazgo" está habilitado', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Siguiente hallazgo' }).hasAttribute('disabled')).toBe(false);
  });

  it('el clic al escaneo conecta un manejador de rechazo a lo que onScan devuelve', async () => {
    // `scanAll` devuelve una promesa y el manejador del clic no la espera: sin
    // guardia, su rechazo se reportaría como unhandled rejection en la consola
    // de la persona, sin aviso y sin dueño. Una promesa real que rechaza no
    // deja huella observable desde el test (el proceso se la come), así que la
    // sonda es un thenable: si la vista le engancha un manejador, el `then` lo
    // recibe; si lo ignora, `rechazoHandler` nunca se define.
    let rechazoHandler: unknown;
    const onScan = vi.fn(() => ({
      then: (_resolucion: unknown, rechazo: unknown) => {
        rechazoHandler = rechazo;
        return Promise.resolve();
      },
    })) as unknown as () => Promise<void>;

    setup({ hasFindings: false, engineGroups: [], total: 0, onScan });
    fireEvent.click(screen.getByRole('button', { name: 'Escanear' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(typeof rechazoHandler).toBe('function');
  });

  it('mientras escanea, el botón lo dice y no se repite', () => {
    const onScan = vi.fn();
    setup({ hasFindings: false, engineGroups: [], total: 0, onScan, isScanning: true });
    const btn = screen.getByRole('button', { name: 'Escaneando' });
    expect(btn.hasAttribute('disabled')).toBe(true);
    fireEvent.click(btn);
    expect(onScan).not.toHaveBeenCalled();
  });
});

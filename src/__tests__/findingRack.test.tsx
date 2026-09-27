/**
 * WordAPA7 — T15: el rack agrupa por motor y luego por subtipo, con la
   accion en masa pegada a la derecha. Una fila por subtipo, nunca una fila
   por aparicion.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
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
    /* Por defecto un motor OBJETIVO: es el único caso donde la vista ofrece
       "Aplicar corrección". Los que no lo hacen pasan su `action` real. */
    action: 'accept' as const,
    index: 0,
    total: 3,
    onStep: vi.fn(),
    onAccept: vi.fn(),
    onMark: vi.fn(),
    onDismiss: vi.fn(),
    onEngineAction: vi.fn(),
    busy: false,
    ...over,
  };
  return { props, ...render(<FindingDetail {...props} />) };
};

/* La hoja de estilos en crudo, para comparar el COLOR que sale por pantalla y
   no el NOMBRE del token: `--color-info` y `--color-accent` son dos nombres
   para el mismo azul.
   Specifier en variable + import dinámico a propósito: si Vite puede analizar
   el specifier lo pasa por `vite-plugin-node-polyfills`, cuyos shims de
   browser no traen `readFileSync` (mismo truco que `designTokens.test.ts`). */
const NODE_FS = 'node:fs';
const NODE_PATH = 'node:path';
const NODE_URL = 'node:url';
let hojaDeEstilos = '';
beforeAll(async () => {
  const { readFileSync } = await import(/* @vite-ignore */ NODE_FS);
  const { resolve } = await import(/* @vite-ignore */ NODE_PATH);
  const { fileURLToPath } = await import(/* @vite-ignore */ NODE_URL);
  const testDir = fileURLToPath(import.meta.url).replace(/[^/\\]+$/, '');
  hojaDeEstilos = readFileSync(resolve(testDir, '../styles/design-system.css'), 'utf8');
});

describe('T15 — rack de hallazgos', () => {
  it('la cabecera del motor muestra el conteo y la acción en masa', () => {
    const onMassAction = vi.fn();
    render(
      <EngineGroupCard group={motor()} open onToggle={vi.fn()} onMassAction={onMassAction}>
        <span>contenido</span>
      </EngineGroupCard>,
    );
    expect(screen.getByRole('button', { name: /Aceptar todas/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Aceptar todas/ }));
    expect(onMassAction).toHaveBeenCalled();
  });

  it('la cabecera es un botón con aria-expanded, no un div con onClick', () => {
    render(
      <EngineGroupCard group={motor()} open={false} onToggle={vi.fn()} onMassAction={vi.fn()}>
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
        action="mark"
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
        item={item()} action="accept" index={0} total={3} onStep={onStep}
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
        item={item({ category: 'ai', subtype: 'muletilla' })} action="mark" index={0} total={1}
        onStep={vi.fn()} onAccept={vi.fn()} onMark={vi.fn()} onDismiss={vi.fn()} busy={false}
      />,
    );
    // Los dos avisos: el encabezado de la propuesta y la explicación. Una
    // sugerencia de IA no entra como "Sugerencia académica APA 7".
    expect(screen.getByText(/Este motor es probabilístico/)).toBeTruthy();
    expect(screen.getByText('Revisión manual (motor probabilístico)')).toBeTruthy();
    expect(screen.queryByText(/Sugerencia académica/)).toBeNull();
  });

  it('el motor objetivo sí anuncia una propuesta académica, no una conjetura', () => {
    render(
      <FindingDetail
        item={item()} action="accept" index={0} total={1}
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
        open onToggle={vi.fn()} onMassAction={vi.fn()}
      >
        <span>c</span>
      </EngineGroupCard>,
    );
    expect(screen.getByRole('button', { name: 'Marcar todos' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Aceptar/ })).toBeNull();
  });

  /* ── El acento sólido es de la acción que corrige, no de cualquier botón ── */

  it('solo "Aceptar" lleva el acento sólido; marcar y las de documento no', () => {
    /* El acento de `--color-accent` está reservado a la acción que escribe el
       texto de alguien. "Marcar todos" no borra nada, y "Rotular todo el
       documento" / "Resolver citas del documento" son de todo el archivo, llaman
       a la red y mutan el documento: los tres con el mismo relleno de acento
       hacían que la cabecera pareciera un solo botón con tres nombres. */
    const botonDe = (massAction: AuditItem['severity'] | SubtypeGroup['action'], massLabel: string) => {
      const { unmount } = render(
        <EngineGroupCard
          group={motor({ massAction: massAction as EngineGroup['massAction'], massLabel })}
          open onToggle={vi.fn()} onMassAction={vi.fn()}
        >
          <span>contenido</span>
        </EngineGroupCard>,
      );
      const boton = screen.getByRole('button', { name: massLabel });
      const estilo = { fondo: boton.style.background, color: boton.style.color, borde: boton.style.border };
      unmount();
      return estilo;
    };

    const aceptar = botonDe('accept', 'Aceptar todas');
    expect(aceptar.fondo).toBe('var(--color-accent)');
    expect(aceptar.color).toBe('var(--color-text-on-accent)');

    for (const [accion, rotulo] of [
      ['mark', 'Marcar todos'],
      ['autoCaption', 'Rotular todo el documento'],
      ['resolveGhosts', 'Resolver citas del documento'],
    ] as const) {
      const b = botonDe(accion, rotulo);
      // Con borde y sin relleno: se ve como un control, no como la aceptación.
      expect(b.fondo, `${rotulo} no debería llevar el acento`).toBe('transparent');
      expect(b.borde, `${rotulo} debería llevar borde`).toContain('1px solid');
      expect(b.color).not.toBe('var(--color-text-on-accent)');
    }
  });

  it('un grupo sin acción (massLabel vacío) no pinta botón vacío', () => {
    render(
      <EngineGroupCard
        group={motor({ massAction: 'none', massLabel: '' })}
        open onToggle={vi.fn()} onMassAction={vi.fn()}
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
    expect(colorDe('medium')).toBe('var(--color-text-secondary)');
    expect(colorDe('low')).toBe('var(--color-text-tertiary)');
  });

  it('el ×N se tiñe por la severidad MÁS ALTA del grupo, no por su primer ítem', () => {
    render(
      <SubtypeRow
        group={subgrupo({
          items: [item({ id: 'a', severity: 'low' }), item({ id: 'b', severity: 'critical' })],
        })}
        open={false} onToggle={vi.fn()} onMassAction={vi.fn()}
      >
        <span>c</span>
      </SubtypeRow>,
    );
    // El orden de los ítems lo produce el motor, no la severidad: si el badge
    // leyera el primero, un grupo con un `critical` se pintaría gris.
    expect(screen.getByText('×2').style.color).toBe('var(--color-danger)');
  });

  it('el ×N de severidad media no se confunde con el color de la sugerencia', () => {
    render(
      <SubtypeRow group={subgrupo({ items: [item({ severity: 'medium' })] })} open={false} onToggle={vi.fn()} onMassAction={vi.fn()}>
        <span>c</span>
      </SubtypeRow>,
    );
    // Comparar los TOKENS no prueba nada: `--color-info` y `--color-accent`
    // son nombres distintos para el mismo azul (#4f7cff). Lo que se tiene que
    // distinguir es el color que sale por pantalla, así que se resuelven los
    // dos tokens contra la hoja de estilos real.
    const badge = screen.getByText('×1').style.color;
    const sugerencia = screen.getByText('también').style.color;
    expect(badge).not.toBe(sugerencia);
    const claro = hojaDeEstilos.slice(
      hojaDeEstilos.indexOf(':root,'),
      hojaDeEstilos.indexOf(':root[data-theme="dark"]'),
    );
    const valorDe = (declarado: string): string => {
      const token = declarado.replace(/^var\(/, '').replace(/\)$/, '');
      return claro.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1].trim() ?? '';
    };
    expect(valorDe(badge)).toBeTruthy();
    expect(valorDe(badge)).not.toBe(valorDe(sugerencia));
  });

  it('una sugerencia larga se recorta en la fila, y el texto íntegro queda en el title', () => {
    const originalLargo = 'La muestra experimental se tomó durante el segundo semestre del año academic';
    const sugerenciaLarga = 'Figura 1. Representación esquemática del procedimiento experimental completo';
    render(
      <SubtypeRow
        group={subgrupo({ items: [item({ originalText: originalLargo, suggestedText: sugerenciaLarga, pageNumber: 3 })] })}
        open={false} onToggle={vi.fn()} onMassAction={vi.fn()}
      >
        <span>c</span>
      </SubtypeRow>,
    );
    const sugerencia = screen.getByText(sugerenciaLarga);
    expect(sugerencia.getAttribute('title')).toBe(sugerenciaLarga);
    expect(sugerencia.style.overflow).toBe('hidden');
    expect(sugerencia.style.textOverflow).toBe('ellipsis');
    expect(sugerencia.style.minWidth).toBe('0px');
    // Ni el original ni el envoltorio de la sugerencia pueden negarse a
    // encogerse: con `flex-shrink: 0` empujan al resto fuera del botón.
    const envoltorio = sugerencia.parentElement as HTMLElement;
    expect(envoltorio.style.flexShrink).not.toBe('0');
    expect(sugerencia.style.flexShrink).not.toBe('0');
    const tachado = screen.getByText(originalLargo);
    expect(tachado.getAttribute('title')).toBe(originalLargo);
    expect(tachado.style.minWidth).toBe('0px');
    expect(tachado.style.overflow).toBe('hidden');
    expect(tachado.style.flexShrink).not.toBe('0');
  });

  it('sin página real la fila no muestra un "pág." vacío', () => {
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
      <EngineGroupCard group={motor()} open={false} onToggle={vi.fn()} onMassAction={vi.fn()}>
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
      <EngineGroupCard group={motor()} open={false} onToggle={vi.fn()} onMassAction={vi.fn()}>
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
      <EngineGroupCard group={motor()} open onToggle={vi.fn()} onMassAction={vi.fn()}>
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

  /* ── El detalle: la acción la DECLARA el grupo, no el texto que traiga ── */

  it('un hallazgo sin sugerencia no ofrece "Aplicar corrección"', () => {
    detalle({ item: item({ suggestedText: undefined, subtype: 'voz_pasiva' }), action: 'accept' });
    expect(screen.queryByRole('button', { name: /Aplicar corrección/i })).toBeNull();
    // Descartar sí: es lo único honesto que se puede hacer con un hallazgo sin
    // corrección automática.
    expect(screen.getByRole('button', { name: /Descartar/i })).toBeTruthy();
  });

  it('un hallazgo de estructura NO se acepta: el motor rotula, no corrige', () => {
    const { props } = detalle({
      item: item({
        id: 'fig1', category: 'structure', subtype: 'figura',
        originalText: '[Figura sin rotular]',
        suggestedText: 'Figura 1. Representación esquemática del procedimiento.',
      }),
      action: 'autoCaption',
    });
    // El subtipo trae `suggestedText` (una leyenda genérica) y aun así su
    // acción es 'autoCaption': "Aplicar corrección" mandaría esa cadena al
    // documento y pisaría la rotulación real de la figura.
    expect(screen.queryByRole('button', { name: /Aplicar corrección/i })).toBeNull();
    const rotular = screen.getByRole('button', { name: /Rotular/i });
    fireEvent.click(rotular);
    expect(props.onEngineAction).toHaveBeenCalled();
    expect(props.onAccept).not.toHaveBeenCalled();
  });

  it('un hallazgo de estructura no se anuncia como "Sugerencia académica"', () => {
    detalle({
      item: item({ id: 'fig1', category: 'structure', subtype: 'figura', suggestedText: 'Figura 1. Representación esquemática del procedimiento.' }),
      action: 'autoCaption',
    });
    expect(screen.getByText('Rotulación propuesta por el motor')).toBeTruthy();
    expect(screen.queryByText(/Sugerencia académica/)).toBeNull();
  });

  it('un subtipo que el motor detecta pero no corrige se marca, aunque no sea IA', () => {
    // voz_pasiva es de Redacción & Bloom, no del detector de IA, y aun así su
    // acción es 'mark': el motor sabe que está mal y no sabe arreglarlo.
    detalle({ item: item({ category: 'style', subtype: 'voz_pasiva', suggestedText: undefined }), action: 'mark' });
    expect(screen.queryByRole('button', { name: /Aplicar corrección/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Marcar para revisar/i })).toBeTruthy();
  });

  it('un subtipo sin acción automática lo dice y solo ofrece descartarlo', () => {
    const { props } = detalle({
      item: item({ id: 'h1', category: 'citations', subtype: 'referencia_huerfana', suggestedText: undefined }),
      action: 'none',
    });
    expect(screen.queryByRole('button', { name: /Aplicar corrección/i })).toBeNull();
    expect(screen.getByText(/no tiene corrección automática/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Descartar/i }));
    expect(props.onDismiss).toHaveBeenCalledWith(props.item);
  });

  it('un subtipo de citas ofrece resolverlas, no aceptarlas', () => {
    const { props } = detalle({
      item: item({ id: 'c1', category: 'citations', subtype: 'cita_fantasma', suggestedText: undefined }),
      action: 'resolveGhosts',
    });
    expect(screen.queryByRole('button', { name: /Aplicar corrección/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Resolver citas/i }));
    expect(props.onEngineAction).toHaveBeenCalled();
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
    const { props } = detalle({ item: item({ id: 'h9', pageNumber: 77 }), action: 'accept' });
    fireEvent.click(screen.getByRole('button', { name: /Aplicar corrección/i }));
    expect(props.onAccept).toHaveBeenCalledWith(props.item);
    fireEvent.click(screen.getByRole('button', { name: /Descartar/i }));
    expect(props.onDismiss).toHaveBeenCalledWith(props.item);
  });

  it('marcar un hallazgo lo entrega a onMark, no a onAccept', () => {
    const { props } = detalle({ item: item({ category: 'ai', subtype: 'muletilla' }), action: 'mark' });
    fireEvent.click(screen.getByRole('button', { name: /Marcar para revisar/i }));
    expect(props.onMark).toHaveBeenCalledWith(props.item);
    expect(props.onAccept).not.toHaveBeenCalled();
  });

  it('mientras está ocupado, ninguna acción se puede disparar dos veces', () => {
    detalle({ busy: true, action: 'accept' });
    expect(screen.getByRole('button', { name: /Aplicar corrección/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Descartar/i })).toBeDisabled();
  });

  it('sin página real el detalle lo dice en vez de inventar un número', () => {
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

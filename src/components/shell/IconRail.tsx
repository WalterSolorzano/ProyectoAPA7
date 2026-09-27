/* WordAPA7 — shell: rail de iconos de 56px.
   Ocho botones de 40x40 y nada más. El detalle de cada fase vive en el
   flyout, para que la columna nunca le robe ancho al documento. */

import React, { useState } from 'react';
import { Pin } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import type { RailDestination } from './railItems';

export interface IconRailProps {
  items: RailDestination[];
  onHoverItem: (item: RailDestination | null) => void;
  /** Clic en un destino: navega a su fase. El hover solo muestra el detalle, así
   *  que esta es la única vía de navegación con teclado. */
  onSelect: (item: RailDestination) => void;
  onTogglePin: () => void;
  pinned: boolean;
  /** Inicio pasa "Navegación principal": sus destinos no son fases. */
  ariaLabel?: string;
}

const RAIL_WIDTH = 56;
const PinIcon = Pin;

// Superficie y tinta de un botón del rail, en el orden de precedencia que fija
// la spec 4.2: la fase activa manda, el hover solo sustituye al reposo.
const surface = (active: boolean, hovered: boolean) =>
  active ? 'var(--color-accent-soft)' : hovered ? 'var(--color-bg-surface-alt)' : 'transparent';
const ink = (active: boolean, hovered: boolean) =>
  active ? 'var(--color-accent)' : hovered ? 'var(--color-text-primary)' : 'var(--color-text-secondary)';
const BUTTON_TRANSITION = 'background var(--transition-fast), color var(--transition-fast)';

export function IconRail({ items, onHoverItem, onSelect, onTogglePin, pinned, ariaLabel }: IconRailProps) {
  // La fase activa la lee el propio rail, no el shell: una sola fuente, para
  // que el icono y la barra de trabajo no puedan desincronizarse. `current` es la
  // otra mitad de la misma pregunta —"¿dónde estoy?"— para los destinos que no
  // son fases: el editor no lo fija, así que acá sigue mandando el store.
  const wizardStep = useDocStore((s) => s.wizardStep);
  const isActive = (item: RailDestination) =>
    item.current === true || (item.step !== null && wizardStep === item.step);
  // El hover vive en estado local: los estilos son inline y no hay :hover.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinHovered, setPinHovered] = useState(false);
  const release = (id: string) => () => setHoveredId((cur) => (cur === id ? null : cur));

  return (
    <nav
      aria-label={ariaLabel ?? 'Fases de la transformación'}
      data-testid="icon-rail"
      onMouseLeave={() => {
        // El puntero puede salirse por el borde del rail sin cruzar ningún
        // botón: aquí también se sueltan las superficies de hover.
        setHoveredId(null);
        setPinHovered(false);
        onHoverItem(null);
      }}
      style={{
        width: RAIL_WIDTH,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: '12px 0',
        backgroundColor: 'var(--color-bg-surface)',
        borderRight: '1px solid var(--color-border-subtle)',
      }}
    >
      {items.map((item) => {
        const { id, label, Icon, status, pending = 0, step } = item;
        const active = isActive(item);
        const hovered = hoveredId === id;
        /* El punto de estado NO alcanza como información: un `aria-label` en un
           <span> dentro de un botón no le suma nada al nombre accesible, que lo
           da el `aria-label` del botón. El nombre que anuncia el lector es
           "Figuras" haya 3 pendientes o ninguno, así que el conteo y el "Listo"
           van dentro del nombre del botón. */
        const nombre = status === 'pending' && pending > 0
          ? `${label}, ${pending} pendientes`
          : status === 'done'
            ? `${label}, listo`
            : label;
        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={nombre}
            /* El color de la superficie activa no le dice nada a un lector de
               pantalla: el estado va también en `aria-current`. Una fase del
               asistente es un paso del recorrido; un destino de Inicio, una
               página — que es como lo nombraba el sidebar que este rail reemplaza. */
            aria-current={active ? (step === null ? 'page' : 'step') : undefined}
            data-active={active ? 'true' : 'false'}
            onMouseEnter={() => {
              setHoveredId(id);
              onHoverItem(item);
            }}
            onMouseLeave={release(id)}
            onClick={() => onSelect(item)}
            style={{
              position: 'relative',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              backgroundColor: surface(active, hovered),
              color: ink(active, hovered),
              cursor: 'pointer',
              transition: BUTTON_TRANSITION,
            }}
          >
            <Icon size={17} strokeWidth={1.75} aria-hidden />
            {pending > 0 && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 6,
                  height: 6,
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-accent)',
                }}
              />
            )}
            {status === 'done' && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 6,
                  height: 6,
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-success)',
                }}
              />
            )}
          </button>
        );
      })}

      {/* Hairline que separa las fases de los destinos de la aplicación. */}
      <div
        aria-hidden
        style={{
          width: 24,
          height: '1px',
          flexShrink: 0,
          backgroundColor: 'var(--color-border-subtle)',
        }}
      />

      {/* El nombre NO cambia con el estado: `aria-pressed` ya lo lleva, y un
          control cuyo nombre muta con el estado es dos controles distintos
          para el lector de pantalla. Además, este pin y el del flyout son el
          MISMO flag global, y se nombran igual.

          La superficie anclada es un contorno, no un relleno de acento: dentro
          de esta misma columna de 56px, `--color-accent-soft` significa "fase
          actual" a ocho píxeles de distancia, y el pin no es una fase. */}
      <button
        type="button"
        title="Anclar panel"
        aria-label="Anclar panel"
        aria-pressed={pinned}
        onMouseEnter={() => setPinHovered(true)}
        onMouseLeave={() => setPinHovered(false)}
        onClick={onTogglePin}
        style={{
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-md)',
          border: pinned ? '1px solid var(--color-accent)' : '1px solid transparent',
          backgroundColor: pinned ? 'transparent' : pinHovered ? 'var(--color-bg-surface-alt)' : 'transparent',
          color: pinned ? 'var(--color-accent)' : pinHovered ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          cursor: 'pointer',
          transition: BUTTON_TRANSITION,
        }}
      >
        <PinIcon size={17} strokeWidth={1.75} aria-hidden />
      </button>
    </nav>
  );
}

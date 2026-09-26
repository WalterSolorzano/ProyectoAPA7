/* WordAPA7 — shell: rail de iconos de 56px.
   Ocho botones de 40x40 y nada más. El detalle de cada fase vive en el
   flyout, para que la columna nunca le robe ancho al documento. */

import React from 'react';
import { Pin } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import type { RailDestination } from './railItems';

export interface IconRailProps {
  items: RailDestination[];
  onHoverItem: (item: RailDestination | null) => void;
  onTogglePin: () => void;
  pinned: boolean;
  /** Inicio pasa "Navegación principal": sus destinos no son fases. */
  ariaLabel?: string;
}

const RAIL_WIDTH = 56;
const PinIcon = Pin;

export function IconRail({ items, onHoverItem, onTogglePin, pinned, ariaLabel }: IconRailProps) {
  // La fase activa la lee el propio rail, no el shell: una sola fuente, para
  // que el icono y la barra de trabajo no puedan desincronizarse.
  const wizardStep = useDocStore((s) => s.wizardStep);
  const isActive = (step: number | null) => step !== null && wizardStep === step;

  return (
    <nav
      aria-label={ariaLabel ?? 'Fases de la transformación'}
      data-testid="icon-rail"
      onMouseLeave={() => onHoverItem(null)}
      style={{
        width: RAIL_WIDTH,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-1, 8px)',
        padding: '12px 0',
        backgroundColor: 'var(--color-bg-surface)',
        borderRight: '1px solid var(--color-border-subtle)',
      }}
    >
      {items.map((item) => {
        const { id, label, Icon, status, pending, step } = item;
        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            data-active={isActive(step) ? 'true' : 'false'}
            onMouseEnter={() => onHoverItem(item)}
            onClick={onTogglePin}
            style={{
              position: 'relative',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: isActive(step) ? 'var(--color-accent-soft)' : 'transparent',
              color: isActive(step) ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              transition: 'background var(--transition-fast), color var(--transition-fast)',
            }}
          >
            <Icon size={17} strokeWidth={1.75} aria-hidden />
            {pending > 0 && (
              <span
                aria-label={`${pending} pendientes`}
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
                aria-label="Listo"
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

      <button
        type="button"
        title={pinned ? 'Anclado' : 'Anclar panel'}
        aria-label={pinned ? 'Anclado' : 'Anclar panel'}
        aria-pressed={pinned}
        onClick={onTogglePin}
        style={{
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          background: pinned ? 'var(--color-accent-soft)' : 'transparent',
          color: pinned ? 'var(--color-accent)' : 'var(--color-text-secondary)',
          cursor: 'pointer',
        }}
      >
        <PinIcon size={17} strokeWidth={1.75} aria-hidden />
      </button>
    </nav>
  );
}

/* WordAPA7 — shell: el marco de la aplicación.
   TopBar 48px → rail de 56px + workbench → StatusBar. El rail vive siempre,
   también en la vista de exportación: la navegación no desaparece al cambiar
   de fase, que es justo lo que hacía el rail por fases anterior con sus casos
   condicionales. */

import React, { useCallback } from 'react';
import { UnifiedToolbar } from '../toolbar/UnifiedToolbar';
import { ProjectTabs } from '../layout/ProjectTabs';
import { StatusBar } from '../layout/StatusBar';
import { IconRail } from './IconRail';
import { RailFlyout } from './RailFlyout';
import { useRailDestinations } from '../../hooks/useRailDestinations';
import { useRailFlyout } from '../../hooks/useRailFlyout';
import { useDocStore } from '../../store/useDocStore';
import type { RailDestination } from './railItems';

export function AppShell({ children }: { children: React.ReactNode }) {
  const items = useRailDestinations();
  const setWizardStep = useDocStore((s) => s.setWizardStep);
  const viewMode = useDocStore((s) => s.viewMode);
  const setViewMode = useDocStore((s) => s.setViewMode);

  // La navegación del rail: un destino es una FASE del editor. Si el centro que
  // está a la vista no es el editor (túnel de export, vista nativa, split),
  // quedarse ahí repinta el acento sobre una fase que no se ve: el rail
  // afirmaría dónde está el trabajo mientras la pantalla muestra otra cosa. Por
  // eso el clic también vuelve a 'edit', igual que el atajo `Ctrl+Shift+[` de
  // App.tsx. La máquina de abrir/cerrar/anclar vive en `useRailFlyout`, el
  // mismo hook que usa Inicio: los dos rails escriben el mismo flag global.
  const navigate = useCallback(
    (item: RailDestination) => {
      if (item.step === null) return;
      if (viewMode !== 'edit') setViewMode('edit');
      setWizardStep(item.step);
    },
    [viewMode, setViewMode, setWizardStep],
  );

  const flyout = useRailFlyout(navigate);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--color-bg-canvas)',
        position: 'relative',
      }}
    >
      <UnifiedToolbar />
      <ProjectTabs />

      {/* `position: relative` NO es decorativo: es el bloque contenedor del
          flyout. Sin él, el `top: 12` del panel se resolvería contra la raíz del
          shell —que está en el borde de la ventana— y la barra de 48px se
          comería su primera fila, que es justo la que lleva la etiqueta del
          destino y el botón de anclar. Con esta línea, los 12px son los 12px
          del `padding` del rail: el panel arranca a la altura del primer botón
          en el editor y en Inicio, donde el rail también empieza abajo de su
          franja. `left: 64` (56 del rail + 8 de hueco) depende de lo mismo. */}
      <div
        className="app-main"
        style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0, position: 'relative' }}
      >
        <IconRail
          items={items}
          onHoverItem={flyout.hoverItem}
          onSelect={flyout.selectItem}
          onTogglePin={flyout.togglePin}
          pinned={flyout.railPinned}
        />
        <RailFlyout
          item={flyout.item}
          onClose={flyout.close}
          onEnter={flyout.onEnterPanel}
          onLeave={flyout.onLeavePanel}
        />
        <main style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
          {children}
        </main>
      </div>

      <StatusBar />
    </div>
  );
}

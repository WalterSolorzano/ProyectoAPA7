/* WordAPA7 — shell: el marco de la aplicación.
   TopBar 48px → rail de 56px + workbench → StatusBar. El rail vive siempre,
   también en la vista de exportación: la navegación no desaparece al cambiar
   de fase, que es justo lo que hacía StepRail con sus casos condicionales. */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UnifiedToolbar } from '../toolbar/UnifiedToolbar';
import { ProjectTabs } from '../layout/ProjectTabs';
import { StatusBar } from '../layout/StatusBar';
import { IconRail } from './IconRail';
import { RailFlyout, FLYOUT_CLOSE_GRACE_MS } from './RailFlyout';
import { useRailDestinations } from '../../hooks/useRailDestinations';
import { useDocStore } from '../../store/useDocStore';
import type { RailDestination } from './railItems';

export function AppShell({ children }: { children: React.ReactNode }) {
  const items = useRailDestinations();
  const [hovered, setHovered] = useState<RailDestination | null>(null);
  const railPinned = useDocStore((s) => s.railPinned);
  const setRailPinned = useDocStore((s) => s.setRailPinned);
  const setWizardStep = useDocStore((s) => s.setWizardStep);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    cancelClose();
    setHovered(null);
  }, [cancelClose]);

  // El cierre es de la unión rail + flyout, así que el timer es de la unión y
  // vive aquí: el rail y el panel quedan separados por un hueco de 8px y si cada
  // uno cerrara por su cuenta, el puntero no podría cruzar sin perder el panel
  // por el camino. El `onEnter` del flyout cancela este mismo timer.
  const scheduleClose = useCallback(() => {
    if (railPinned) return;
    cancelClose();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setHovered(null);
    }, FLYOUT_CLOSE_GRACE_MS);
  }, [railPinned, cancelClose]);

  // El timer en vuelo no sobrevive al desmontaje: cerraría un panel que ya no
  // existe (y en tests, escribiría estado de un componente muerto).
  useEffect(() => cancelClose, [cancelClose]);

  const handleHoverItem = useCallback(
    (item: RailDestination | null) => {
      // El clic ancla; el hover solo hace aparecer. Por eso un clic en el rail
      // navega y suelta el flyout a la vez.
      if (item) {
        cancelClose();
        setHovered(item);
        if (item.step !== null) setWizardStep(item.step);
        return;
      }
      scheduleClose();
    },
    [cancelClose, scheduleClose, setWizardStep],
  );

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

      <div
        className="app-main"
        style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}
      >
        <IconRail
          items={items}
          onHoverItem={handleHoverItem}
          onTogglePin={() => setRailPinned(!railPinned)}
          pinned={railPinned}
        />
        <RailFlyout item={hovered} onClose={close} onEnter={cancelClose} />
        <main style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
          {children}
        </main>
      </div>

      <StatusBar />
    </div>
  );
}

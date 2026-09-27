/* WordAPA7 — shell: la máquina de la unión rail + flyout.
   El cierre es de la UNIÓN, no de un componente: el rail y el panel están
   separados por un hueco de 8px y si cada uno cerrara por su cuenta, el puntero
   no podría cruzar sin perder el panel por el camino. El timer de 120ms
   (FLYOUT_CLOSE_GRACE_MS) lo programa la salida de cualquiera de los dos y lo
   cancela la entrada en cualquiera de los dos.

   Vivía duplicado —verbo y medio— en `AppShell` y en `Step0QuickStart`, y son
   los dos ESCRITORES del mismo flag global `railPinned`. Dos copias de una
   máquina de estados que decide si un panel se va es exactamente donde las dos
   divergen sin que nada lo diga. Esta es la copia única.

   `clearPinOnMount` existe para Inicio: la pantalla de inicio no tiene un
   panel que sobreviva a la pantalla, así que un pin puesto en el editor sería un
   fantasma que aparece en el siguiente documento. No se silencia el pin, se
   suelta en el borde de entrar y en el de salir. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDocStore } from '../store/useDocStore';
import { FLYOUT_CLOSE_GRACE_MS } from '../components/shell/RailFlyout';
import type { RailDestination } from '../components/shell/railItems';

export interface RailFlyoutState {
  /** El destino cuyo detalle está a la vista, o `null` si el panel está cerrado. */
  item: RailDestination | null;
  railPinned: boolean;
  /** Reporta la entrada del puntero hacia arriba: cancela el cierre en vuelo. */
  onEnterPanel: () => void;
  /** Reporta la salida del puntero hacia arriba: programa la gracia. */
  onLeavePanel: () => void;
  hoverItem: (item: RailDestination | null) => void;
  /** Clic en un destino: abre el detalle, navega y ancla. */
  selectItem: (item: RailDestination) => void;
  close: () => void;
  togglePin: () => void;
}

export function useRailFlyout(onSelect?: (item: RailDestination) => void): RailFlyoutState {
  const railPinned = useDocStore((s) => s.railPinned);
  const setRailPinned = useDocStore((s) => s.setRailPinned);
  const [item, setItem] = useState<RailDestination | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    cancelClose();
    setItem(null);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    if (railPinned) return;
    cancelClose();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setItem(null);
    }, FLYOUT_CLOSE_GRACE_MS);
  }, [railPinned, cancelClose]);

  // El timer en vuelo no sobrevive al desmontaje: cerraría un panel que ya no
  // existe (y en tests, escribiría estado de un componente muerto).
  useEffect(() => cancelClose, [cancelClose]);

  // El ancla es un flag GLOBAL: entra limpia desde esta pantalla y sale limpia
  // también. Inicio no tiene un panel que sobreviva a la pantalla, así que un
  // pin puesto acá sería un fantasma que aparece en el editor al abrir el
  // siguiente documento.
  useEffect(() => {
    const soltar = () => {
      const st = useDocStore.getState();
      if (st.railPinned) st.setRailPinned(false);
    };
    soltar();
    return soltar;
  }, []);

  // El hover solo hace aparecer el detalle. Navegar desde el hover montaría y
  // desmontaría la fase que el usuario está leyendo cada vez que el puntero
  // cruza el borde izquierdo, y con el panel anclado el documento de detrás
  // cambiaría solo.
  const hoverItem = useCallback(
    (next: RailDestination | null) => {
      if (next) {
        cancelClose();
        setItem(next);
        return;
      }
      scheduleClose();
    },
    [cancelClose, scheduleClose],
  );

  // El clic es la acción deliberada: lleva a la fase y ancla el panel. También
  // lo abre, porque con teclado no hay hover que lo haya abierto.
  const selectItem = useCallback(
    (next: RailDestination) => {
      cancelClose();
      setItem(next);
      onSelect?.(next);
      setRailPinned(true);
    },
    [cancelClose, onSelect, setRailPinned],
  );

  const togglePin = useCallback(() => {
    setRailPinned(!useDocStore.getState().railPinned);
  }, [setRailPinned]);

  return {
    item,
    railPinned,
    onEnterPanel: cancelClose,
    onLeavePanel: scheduleClose,
    hoverItem,
    selectItem,
    close,
    togglePin,
  };
}

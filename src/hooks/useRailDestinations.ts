/* WordAPA7 — shell: estado de cada destino del rail.
   Concentra aquí el cálculo de "listo" y "pendientes" para que el rail de 56px,
   su flyout y el atajo de teclado no puedan discrepar entre sí.

   Y ahora también lo que el atajo de teclado de `App.tsx` necesita: la cuenta
   sale de `lib/railPending`, la misma que usa el workbench de Revisión a través
   de `lib/auditItems`. El rail no puede prometer menos trabajo del que la
   pantalla abre, ni más del que la pantalla resuelve. */

import { useMemo } from 'react';
import { useDocStore } from '../store/useDocStore';
import type { DocState } from '../store/types';
import { EDITOR_RAIL_ITEMS, type RailDestination, type RailStatus } from '../components/shell/railItems';
import { readPhaseStates, type PhaseState, type RailPendingInput } from '../lib/railPending';

/** Lee el estado del store y arma la entrada de `lib/railPending`. Sirve para el
 *  rail (con `useRailDestinations`) y para el atajo de teclado de `App.tsx`,
 *  que no puede usar un hook. Elhiaje de campos va acá, no en quien llama: dos
 *  llamadas que arman la entrada a mano vuelven a ser dos verdades. */
export function railPendingInputFrom(state: DocState): RailPendingInput {
  return {
    hasDoc: !!state.doc,
    portada: state.portada,
    coverSetupDone: state.coverSetupDone,
    elements: state.doc?.elements || [],
    hasReferences: (state.doc?.referencias?.length || 0) > 0,
    reviewResult: state.reviewResult,
    proofreadFindings: state.proofreadFindings,
    citationAuditResult: state.citationAuditResult,
  };
}

export function useRailDestinations(): RailDestination[] {
  const doc = useDocStore((s) => s.doc);
  const portada = useDocStore((s) => s.portada);
  const coverSetupDone = useDocStore((s) => s.coverSetupDone);
  const reviewResult = useDocStore((s) => s.reviewResult);
  const proofreadFindings = useDocStore((s) => s.proofreadFindings);
  const citationAuditResult = useDocStore((s) => s.citationAuditResult);

  const viewMode = useDocStore((s) => s.viewMode);

  return useMemo<RailDestination[]>(() => {
    const states: Record<number, PhaseState> = readPhaseStates({
      hasDoc: !!doc,
      portada,
      coverSetupDone,
      elements: doc?.elements || [],
      hasReferences: (doc?.referencias?.length || 0) > 0,
      reviewResult,
      proofreadFindings,
      citationAuditResult,
    });

    return EDITOR_RAIL_ITEMS.map(({ step, label, shortLabel, Icon, showOutline }) => {
      // La 6 (Exportar) no tiene clave: exportarle algo al usuario no es una
      // tarea con estado, y una fase sin clave tiene 0 pendientes. Antes se
      // inventaba un "Listo" para un destino que no se puede terminar.
      const state = states[step];
      const pending = state?.pending ?? 0;
      const status: RailStatus = !doc
        ? 'idle'
        : !state
          ? 'idle'
          : state.done
            ? 'done'
            : pending > 0
              ? 'pending'
              : 'idle';
      /* Con el túnel de export abierto, el destino a la vista es Exportar, y
         no la fase que quedó de fondo. Sin esto, entrar al túnel por el paleta
         de comandos dejaba el acento del rail en una fase cuya vista ni
         siquiera está montada. */
      return {
        id: `step-${step}`,
        step,
        label,
        shortLabel,
        Icon,
        status,
        pending,
        showOutline,
        current: step === 6 && viewMode === 'export' ? true : undefined,
      };
    });
  }, [doc, portada, coverSetupDone, reviewResult, proofreadFindings, citationAuditResult, viewMode]);
}

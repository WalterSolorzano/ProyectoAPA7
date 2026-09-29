/* WordAPA7 ? Complete Unified State Management (Zustand) */

import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { setRequestIdListener } from '../api/http';

import { DocState, ActivityEvent, UISlice, CoverSlice, AuditSlice, DocumentSlice } from './types';
import { createUISlice } from './slices/uiSlice';
import { createCoverSlice, defaultPortada, syncCoverFieldToElements } from './slices/coverSlice';
import { createAuditSlice } from './slices/auditSlice';
import { createDocumentSlice } from './slices/documentSlice';

// Re-export text utilities, helper functions and types for 100% backward compatibility
export { toRoman, cleanHeadingPrefix, migrateDocument } from '../lib/textUtils';
export { syncCoverFieldToElements, defaultPortada } from './slices/coverSlice';
export type { DocState, ActivityEvent, UISlice, CoverSlice, AuditSlice, DocumentSlice } from './types';

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

/** La clave con la que este store se escribe en el almacenamiento. */
export const PERSIST_NOMBRE = 'wordapa7-storage';

/**
 * Lo que se persiste, en un SOLO lugar.
 *
 * F7 Task 1. `projectImages` entra acá. Antes no entraba: las imagenes del
 * proyecto eran un `object URL` en memoria, asi que no habia nada que
 * persistir y por eso no estaban en esta lista. Ahora lo que se persiste es el
 * `assetId` y la URL del asset, que es lo unico que sigue resolviendo manana.
 *
 * Esta funcion se EXPORTA, y no por adorno: el test de la fase la usa para
 * serializar el estado con la misma logica que usa la app. Un `partialize`
 * reescrito en el test seria otra verdad, y mediria la copia y no la cosa.
 */
export const persistPartialize = (state: DocState) => ({
  apiKey: state.apiKey,
  rules: state.rules,
  ruleProfiles: state.ruleProfiles,
  portadaProfiles: state.portadaProfiles,
  aiProviderConfig: state.aiProviderConfig,
  activeProfileId: state.activeProfileId,
  profiles: state.profiles,
  hasSeenTour: state.hasSeenTour,
  projectImages: state.projectImages,
});

export const useDocStore = create<DocState>()(
  persist(
    (set, get, api) => ({
      ...createUISlice(set, get, api),
      ...createCoverSlice(set, get, api),
      ...createAuditSlice(set, get, api),
      ...createDocumentSlice(set, get, api),
    } as DocState),
    {
      name: PERSIST_NOMBRE,
      storage: createJSONStorage(() => idbStorage),
      partialize: persistPartialize,
    }
  )
);

// Tracing de X-Request-ID
setRequestIdListener((id) => useDocStore.getState().setLastRequestId(id));

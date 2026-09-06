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

export const useDocStore = create<DocState>()(
  persist(
    (set, get, api) => ({
      ...createUISlice(set, get, api),
      ...createCoverSlice(set, get, api),
      ...createAuditSlice(set, get, api),
      ...createDocumentSlice(set, get, api),
    } as DocState),
    {
      name: 'wordapa7-storage',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        apiKey: state.apiKey,
        rules: state.rules,
        ruleProfiles: state.ruleProfiles,
        portadaProfiles: state.portadaProfiles,
        aiProviderConfig: state.aiProviderConfig,
        activeProfileId: state.activeProfileId,
        profiles: state.profiles,
        hasSeenTour: state.hasSeenTour,
      }),
    }
  )
);

// Tracing de X-Request-ID
setRequestIdListener((id) => useDocStore.getState().setLastRequestId(id));

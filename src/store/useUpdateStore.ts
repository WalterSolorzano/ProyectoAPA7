/* WordAPA7 — Estado de actualizaciones (menú de update).
   Store liviano NO persistido. Se conecta al autoUpdater de Electron vía IPC
   (electronAPI.onUpdateStatus) y expone acciones: check() e install(). */

import { create } from 'zustand';

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error';

interface UpdateStoreState {
  state: UpdateState;
  version: string;
  availableVersion?: string;
  progress?: number;
  message?: string;
  _subscribed?: boolean;
  init: () => void;
  check: () => void;
  install: () => void;
}

const ew = () => (window as any).electronAPI;

export const useUpdateStore = create<UpdateStoreState>((set, get) => ({
  state: 'idle',
  version: '1.0.18',
  availableVersion: undefined,
  progress: undefined,
  message: undefined,

  init: () => {
    const api = ew();
    if (!api || get()._subscribed) return;
    set({ _subscribed: true });

    try {
      const v = api.getAppVersion ? api.getAppVersion() : undefined;
      if (v) set({ version: v });
    } catch { /* noop */ }

    if (api.onUpdateStatus) {
      api.onUpdateStatus((status: any) => {
        const s = status || {};
        set({
          state: s.state || 'idle',
          progress: typeof s.progress === 'number' ? s.progress : undefined,
          message: s.message,
          availableVersion: s.info?.version || get().availableVersion,
        });
      });
    }
  },

  check: () => {
    const api = ew();
    if (!api?.checkForUpdates) return;
    set({ state: 'checking', message: undefined });
    api.checkForUpdates();
  },

  install: () => {
    const api = ew();
    if (api?.installUpdate) api.installUpdate();
  },
}));

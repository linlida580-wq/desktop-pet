// Global UI state (Zustand, R-09). Single source of truth shared between the
// pet canvas, settings panel, and toast host.

import { create } from "zustand";
import type { Config, PetState, Reminder } from "../types";
import { defaultConfig } from "../types";
import * as api from "../ipc/api";

export interface Toast {
  id: string;
  message: string;
  withSound: boolean;
}

interface PetStore {
  loaded: boolean;
  config: Config;
  currentState: PetState;
  visible: boolean;
  settingsOpen: boolean;
  toasts: Toast[];

  // actions
  setLoaded: (v: boolean) => void;
  setConfig: (cfg: Config) => void;
  /** Merge a partial config, persist, and push relevant side-effects. */
  updateConfig: (patch: Partial<Config>) => Promise<void>;
  updateReminders: (reminders: Reminder[]) => Promise<void>;
  setCurrentState: (s: PetState) => void;
  /** Update the live window position in-memory (no persist) so later
   *  `configSave` calls don't clobber a dragged position (R-02). */
  setPosition: (x: number, y: number) => void;
  setVisible: (v: boolean) => void;
  openSettings: () => void;
  closeSettings: () => void;
  addToast: (t: Toast) => void;
  removeToast: (id: string) => void;
}

export const usePetStore = create<PetStore>((set, get) => ({
  loaded: false,
  config: defaultConfig(),
  currentState: "idle",
  visible: true,
  settingsOpen: false,
  toasts: [],

  setLoaded: (v) => set({ loaded: v }),
  setConfig: (cfg) => set({ config: cfg }),
  updateConfig: async (patch) => {
    const next = { ...get().config, ...patch };
    set({ config: next });
    await api.configSave(next);
    // side effects
    if (patch.behavior) {
      await api.windowSetClickThrough(next.behavior.clickThrough);
    }
  },
  updateReminders: async (reminders) => {
    const next = { ...get().config, reminders };
    set({ config: next });
    await api.configSave(next);
  },
  setCurrentState: (s) => set({ currentState: s }),
  setPosition: (x, y) => set((s) => ({ config: { ...s.config, position: { x, y } } })),
  setVisible: (v) => set({ visible: v }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  addToast: (t) => set((s) => ({ toasts: [...s.toasts, t] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Shared TypeScript types — kept in sync with `src-tauri/src/config/model.rs`.
// PetState union must match the Rust `PetState` enum and the backend strings.

export type PetState = "idle" | "walk" | "sleep" | "play";

export interface Point {
  x: number;
  y: number;
}

export interface Appearance {
  colors: Record<string, string>;
  accessories: string[];
  /** Pet draw scale multiplier (1.0 = manifest default). */
  scale: number;
}

export interface PetProfile {
  id: string;
  name: string;
  manifest: string;
}

export type ReminderType = "water" | "rest" | "eye" | "custom";
export type CycleMode = "daily" | "weekday" | "weekend";

export interface Reminder {
  id: string;
  type: ReminderType;
  /** "HH:MM" 24h local time. */
  time: string;
  cycle: CycleMode;
  enabled: boolean;
  message: string;
  withSound: boolean;
}

export interface Behavior {
  followMouse: boolean;
  followSpeed: number;
  clickThrough: boolean;
}

export interface Config {
  version: number;
  pet: PetProfile;
  appearance: Appearance;
  reminders: Reminder[];
  behavior: Behavior;
  autostart: boolean;
  position: Point;
}

/** Payload emitted by the backend on `reminder_trigger`. */
export interface ReminderTrigger {
  id: string;
  message: string;
  withSound: boolean;
}

/** Payload emitted on `visibility_changed`. */
export interface VisibilityState {
  visible: boolean;
}

/** Payload emitted on `mouse_move`. */
export interface MousePos {
  x: number;
  y: number;
}

export const PET_STATES: PetState[] = ["idle", "walk", "sleep", "play"];

export function defaultConfig(): Config {
  return {
    version: 1,
    pet: { id: "default", name: "豆豆", manifest: "assets/default_pet/manifest.json" },
    appearance: { colors: {}, accessories: [], scale: 1 },
    reminders: [],
    behavior: { followMouse: false, followSpeed: 120, clickThrough: true },
    autostart: false,
    position: { x: 200, y: 200 },
  };
}

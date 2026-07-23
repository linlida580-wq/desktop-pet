// Thin wrapper around Tauri `invoke` / `listen` so the rest of the UI never
// touches the IPC layer directly (architecture §3: `IpcApi` is the only bridge).
//
// Command + event names follow architecture §7:
//   commands: window_move / window_toggle / config_load / config_save /
//             config_save_position / reminder_add|remove|update / autostart_set
//   events:   reminder_trigger / visibility_changed / tray_toggle_visibility /
//             open_settings / open_about / mouse_move

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  Config,
  MousePos,
  Reminder,
  ReminderTrigger,
  VisibilityState,
} from "../types";

export async function windowMove(x: number, y: number): Promise<void> {
  await invoke("window_move", { x: Math.round(x), y: Math.round(y) });
}

export async function windowToggle(): Promise<boolean> {
  return invoke<boolean>("window_toggle");
}

export async function windowSetHitRect(
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<void> {
  await invoke("window_set_hit_rect", {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
  });
}

export async function windowSetClickThrough(enabled: boolean): Promise<void> {
  await invoke("window_set_click_through", { enabled });
}

export async function configLoad(): Promise<Config> {
  return invoke<Config>("config_load");
}

export async function configSave(cfg: Config): Promise<void> {
  await invoke("config_save", { cfg });
}

export async function configSavePosition(x: number, y: number): Promise<void> {
  await invoke("config_save_position", { x: Math.round(x), y: Math.round(y) });
}

export async function reminderAdd(reminder: Reminder): Promise<void> {
  await invoke("reminder_add", { reminder });
}

export async function reminderRemove(id: string): Promise<void> {
  await invoke("reminder_remove", { id });
}

export async function reminderUpdate(reminder: Reminder): Promise<void> {
  await invoke("reminder_update", { reminder });
}

export async function autostartSet(enabled: boolean): Promise<void> {
  await invoke("autostart_set", { enabled });
}

export async function reminderTest(): Promise<void> {
  await invoke("reminder_test");
}

// --- Event subscriptions (return an unlisten function) ---

export function onReminderTrigger(
  cb: (payload: ReminderTrigger) => void,
): Promise<UnlistenFn> {
  return listen<ReminderTrigger>("reminder_trigger", (e) => cb(e.payload));
}

export function onVisibilityChanged(
  cb: (payload: VisibilityState) => void,
): Promise<UnlistenFn> {
  return listen<VisibilityState>("visibility_changed", (e) => cb(e.payload));
}

export function onTrayToggle(cb: () => void): Promise<UnlistenFn> {
  return listen("tray_toggle_visibility", () => cb());
}

export function onOpenSettings(cb: () => void): Promise<UnlistenFn> {
  return listen("open_settings", () => cb());
}

export function onOpenAbout(cb: () => void): Promise<UnlistenFn> {
  return listen("open_about", () => cb());
}

export function onMouseMove(cb: (pos: MousePos) => void): Promise<UnlistenFn> {
  return listen<MousePos>("mouse_move", (e) => cb(e.payload));
}

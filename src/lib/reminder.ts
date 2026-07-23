// Pure reminder logic (mirror of `src-tauri/src/reminder/model.rs`) so the
// frontend can preview/validate without a backend round-trip. Unit-tested.

import type { CycleMode } from "../types";

export const TRIGGER_TOLERANCE_SEC = 2;

export function parseTime(t: string): [number, number] | null {
  const parts = t.split(":");
  if (parts.length !== 2) return null;
  // Strict `HH:MM`: require zero-padded two-digit hour and minute.
  if (parts[0].length !== 2 || parts[1].length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h >= 24 || m < 0 || m >= 60) return null;
  return [h, m];
}

export function shouldTriggerAt(t: string, now: Date, tolerance = TRIGGER_TOLERANCE_SEC): boolean {
  const parsed = parseTime(t);
  if (!parsed) return false;
  const [h, m] = parsed;
  const targetSec = h * 3600 + m * 60;
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const diff = nowSec - targetSec;
  return diff >= 0 && diff <= tolerance;
}

export function cycleAllows(cycle: CycleMode, date: Date): boolean {
  const day = date.getDay(); // 0=Sun..6=Sat
  switch (cycle) {
    case "daily":
      return true;
    case "weekday":
      return day !== 0 && day !== 6;
    case "weekend":
      return day === 0 || day === 6;
    default:
      return true;
  }
}

/** Seconds until the next occurrence of `time` today/tomorrow (for previews). */
export function secondsUntilNext(t: string, now: Date): number {
  const parsed = parseTime(t);
  if (!parsed) return Infinity;
  const [h, m] = parsed;
  const targetSec = h * 3600 + m * 60;
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  let diff = targetSec - nowSec;
  if (diff <= 0) diff += 86400;
  return diff;
}

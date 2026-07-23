// Supplementary tests for the automatic state-switching policy (R-11).
// Night window + desired-state priority: click > night > move > idle > none.

import { describe, expect, it } from "vitest";
import { isNight, nextAutoState } from "./autoPolicy";

function at(h: number, m = 0): Date {
  // 2025-01-15 is a Wednesday — irrelevant here, we only use the time.
  return new Date(2025, 0, 15, h, m, 0);
}

describe("isNight", () => {
  it("honours the default night window 22:00–06:00", () => {
    expect(isNight(at(23))).toBe(true);
    expect(isNight(at(0))).toBe(true);
    expect(isNight(at(5, 59))).toBe(true);
    expect(isNight(at(6))).toBe(false); // 06:00 is morning, not night
    expect(isNight(at(21, 59))).toBe(false);
    expect(isNight(at(22))).toBe(true);
    expect(isNight(at(12))).toBe(false);
  });

  it("supports a custom ordered window (00:00–08:00)", () => {
    expect(isNight(at(7), 0, 8)).toBe(true);
    expect(isNight(at(8), 0, 8)).toBe(false);
    expect(isNight(at(12), 0, 8)).toBe(false);
  });
});

describe("nextAutoState", () => {
  it("prioritises click feedback (play) over night and movement", () => {
    expect(
      nextAutoState({ isMoving: true, recentlyClicked: true, idleMs: 0, now: at(23) }),
    ).toBe("play");
  });

  it("sleeps at night when not clicked or moving", () => {
    expect(
      nextAutoState({ isMoving: false, recentlyClicked: false, idleMs: 0, now: at(23) }),
    ).toBe("sleep");
  });

  it("walks while moving during the day", () => {
    expect(
      nextAutoState({ isMoving: true, recentlyClicked: false, idleMs: 0, now: at(12) }),
    ).toBe("walk");
  });

  it("idles after a long period of inactivity during the day", () => {
    expect(
      nextAutoState({ isMoving: false, recentlyClicked: false, idleMs: 5000, now: at(12) }),
    ).toBe("idle");
  });

  it("returns null when no state change is suggested", () => {
    expect(
      nextAutoState({ isMoving: false, recentlyClicked: false, idleMs: 100, now: at(12) }),
    ).toBeNull();
  });
});

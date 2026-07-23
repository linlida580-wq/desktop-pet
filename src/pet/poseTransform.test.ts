// Unit tests for the procedural pose transform (R-overlay). The module is a
// pure function of (state, elapsedMs), so we can assert its math directly
// without a browser or canvas.

import { describe, expect, it } from "vitest";
import {
  computePoseTransform,
  PROCEDURAL_ANIM_ENABLED,
  type PoseTransform,
} from "./poseTransform";
import type { PetState } from "../types";

const ALL_STATES: PetState[] = ["idle", "walk", "sleep", "play"];

describe("computePoseTransform — idle", () => {
  it("keeps dx, dy and rot at zero", () => {
    for (const ms of [0, 250, 625, 1250, 2500]) {
      const t = computePoseTransform("idle", ms);
      expect(t.dx).toBe(0);
      expect(t.dy).toBe(0);
      expect(t.rot).toBe(0);
    }
  });

  it("oscillates scaleY around 1 within ±0.03 amplitude", () => {
    for (const ms of [0, 100, 500, 1000, 1800, 2400]) {
      const t = computePoseTransform("idle", ms);
      expect(t.scaleY).toBeGreaterThan(1 - 0.03 - 1e-9);
      expect(t.scaleY).toBeLessThan(1 + 0.03 + 1e-9);
    }
  });

  it("starts at rest (scale 1) when elapsed is 0", () => {
    const t = computePoseTransform("idle", 0);
    expect(t.scaleY).toBeCloseTo(1, 10);
    expect(t.scaleX).toBeCloseTo(1, 10);
  });

  it("has a 2500ms period", () => {
    const a = computePoseTransform("idle", 300);
    const b = computePoseTransform("idle", 300 + 2500);
    expect(a.scaleY).toBeCloseTo(b.scaleY, 10);
    expect(a.scaleX).toBeCloseTo(b.scaleX, 10);
  });
});

describe("computePoseTransform — walk", () => {
  it("bobs vertically within ±4px, no scale, tiny rotation", () => {
    const rotLimit = (1.5 * Math.PI) / 180;
    for (const ms of [0, 75, 150, 225, 300]) {
      const t = computePoseTransform("walk", ms);
      expect(t.dx).toBe(0);
      expect(Math.abs(t.dy)).toBeLessThanOrEqual(4 + 1e-9);
      expect(Math.abs(t.rot)).toBeLessThanOrEqual(rotLimit + 1e-9);
      expect(t.scaleX).toBeCloseTo(1, 10);
      expect(t.scaleY).toBeCloseTo(1, 10);
    }
  });

  it("changes with elapsed time", () => {
    const a = computePoseTransform("walk", 0);
    const b = computePoseTransform("walk", 75);
    expect(b.dy).not.toBeCloseTo(a.dy, 6);
  });
});

describe("computePoseTransform — sleep", () => {
  it("breathes within ±2px with no rotation and no scale", () => {
    for (const ms of [0, 500, 1000, 2000, 4000]) {
      const t = computePoseTransform("sleep", ms);
      expect(t.dx).toBe(0);
      expect(t.rot).toBe(0);
      expect(Math.abs(t.dy)).toBeLessThanOrEqual(2 + 1e-9);
      expect(t.scaleX).toBeCloseTo(1, 10);
      expect(t.scaleY).toBeCloseTo(1, 10);
    }
  });

  it("changes with elapsed time", () => {
    const a = computePoseTransform("sleep", 0);
    const b = computePoseTransform("sleep", 1000);
    expect(b.dy).not.toBeCloseTo(a.dy, 6);
  });
});

describe("computePoseTransform — play", () => {
  it("bounces upward (dy is mostly <= 0 across a period)", () => {
    const samples = 40;
    let nonPositive = 0;
    for (let i = 0; i < samples; i++) {
      const ms = (i / samples) * 500; // one full period
      const t = computePoseTransform("play", ms);
      if (t.dy <= 0) nonPositive += 1;
    }
    // Only the two ground contacts (ms=0 and ms=500) are exactly 0; the rest
    // are negative, so nearly all samples must be <= 0.
    expect(nonPositive).toBeGreaterThanOrEqual(samples - 2);
  });

  it("reaches a clear apex (dy well below 0 at mid-period)", () => {
    const mid = computePoseTransform("play", 250); // p = 0.5
    expect(mid.dy).toBeLessThan(-5);
  });

  it("applies a landing squash/stretch pop near the ground", () => {
    const ground = computePoseTransform("play", 0); // p = 0, contact
    expect(ground.scaleY).toBeCloseTo(1.04, 6);
    expect(ground.scaleX).toBeCloseTo(0.97, 6);
    const apex = computePoseTransform("play", 250); // p = 0.5, apex
    expect(apex.scaleY).toBeCloseTo(1, 6); // no pop at apex
    expect(apex.scaleX).toBeCloseTo(1, 6);
  });

  it("has a 500ms period", () => {
    const a = computePoseTransform("play", 123);
    const b = computePoseTransform("play", 123 + 500);
    expect(a.dy).toBeCloseTo(b.dy, 10);
    expect(a.scaleY).toBeCloseTo(b.scaleY, 10);
  });
});

describe("computePoseTransform — sane ranges & purity", () => {
  it("keeps scale factors within a safe band for all states", () => {
    for (const state of ALL_STATES) {
      for (let ms = 0; ms < 5000; ms += 37) {
        const t = computePoseTransform(state, ms);
        expect(t.scaleX).toBeGreaterThan(0.9);
        expect(t.scaleX).toBeLessThan(1.1);
        expect(t.scaleY).toBeGreaterThan(0.9);
        expect(t.scaleY).toBeLessThan(1.1);
      }
    }
  });

  it("returns an equal object for identical inputs (pure)", () => {
    for (const state of ALL_STATES) {
      const a: PoseTransform = computePoseTransform(state, 1234.5);
      const b: PoseTransform = computePoseTransform(state, 1234.5);
      expect(a).toEqual(b);
    }
  });

  it("PROCEDURAL_ANIM_ENABLED is on by default", () => {
    expect(PROCEDURAL_ANIM_ENABLED).toBe(true);
  });
});

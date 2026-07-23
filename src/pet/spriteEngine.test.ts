// Supplementary tests for the sprite frame engine (R-03).
// The engine loads PNGs via `fetch`/`Image` only inside `load()`/`render()`,
// so we inject a mock manifest directly (private field) and exercise the pure
// frame-advance + bounds math without a browser/WebView.

import { describe, expect, it } from "vitest";
import { SpriteEngine, type SpriteManifest, type SpriteStateDef } from "./spriteEngine";
import type { PetState } from "../types";

function makeStateDef(over: Partial<SpriteStateDef> = {}): SpriteStateDef {
  return { label: "x", fps: 2, loop: true, frames: ["a.png", "b.png", "c.png"], ...over };
}

function manifestWith(idle: SpriteStateDef, baseScale = 0.5): SpriteManifest {
  return {
    version: 1,
    name: "test",
    frameWidth: 256,
    frameHeight: 256,
    anchor: { x: 128, y: 240 },
    defaultScale: baseScale,
    base: "base.png",
    states: {
      idle,
      walk: makeStateDef(),
      sleep: makeStateDef(),
      play: makeStateDef(),
    },
  };
}

function setManifest(engine: SpriteEngine, m: SpriteManifest): void {
  (engine as unknown as { manifest: SpriteManifest }).manifest = m;
}

function frameIndex(engine: SpriteEngine): number {
  return (engine as unknown as { frameIndex: number }).frameIndex;
}

function setFrame(engine: SpriteEngine, i: number): void {
  (engine as unknown as { frameIndex: number }).frameIndex = i;
}

describe("SpriteEngine.getBounds", () => {
  it("scales the frame by defaultScale and anchors at bottom-center", () => {
    const engine = new SpriteEngine();
    setManifest(engine, manifestWith(makeStateDef(), 0.5));
    engine.setUserScale(1);
    const b = engine.getBounds(800, 600);
    const w = 256 * 0.5; // 128
    expect(b.w).toBeCloseTo(w);
    expect(b.h).toBeCloseTo(w);
    // x = cw/2 - anchor.x*scale = 400 - 64 = 336
    expect(b.x).toBeCloseTo(400 - 64);
    // y = ch - margin(4) - anchor.y*scale = 600 - 4 - 120 = 476
    expect(b.y).toBeCloseTo(600 - 4 - 120);
  });

  it("applies the user scale multiplier on top of defaultScale", () => {
    const engine = new SpriteEngine();
    setManifest(engine, manifestWith(makeStateDef(), 0.5));
    engine.setUserScale(2);
    const b = engine.getBounds(800, 600);
    expect(b.w).toBeCloseTo(256 * 0.5 * 2);
  });

  it("returns the full rect when no manifest is loaded", () => {
    const engine = new SpriteEngine();
    const b = engine.getBounds(800, 600);
    expect(b).toEqual({ x: 0, y: 0, w: 800, h: 600 });
  });
});

describe("SpriteEngine.setState", () => {
  it("resets the frame cursor when the state changes", () => {
    const engine = new SpriteEngine();
    setManifest(engine, manifestWith(makeStateDef({ fps: 1 })));
    engine.setUserScale(1);
    engine.setState("idle");
    engine.tick(2000);
    expect(frameIndex(engine)).toBeGreaterThan(0);
    engine.setState("walk");
    expect(frameIndex(engine)).toBe(0);
    expect(engine.getState()).toBe("walk");
  });

  it("does not reset the cursor for a same-state call", () => {
    const engine = new SpriteEngine();
    setManifest(engine, manifestWith(makeStateDef()));
    engine.setState("idle");
    setFrame(engine, 2);
    engine.setState("idle");
    expect(frameIndex(engine)).toBe(2);
  });
});

describe("SpriteEngine.tick frame advance", () => {
  it("loops cyclically across frames", () => {
    const engine = new SpriteEngine();
    // 3 frames, fps=1 => frameMs=1000
    setManifest(engine, manifestWith(makeStateDef({ fps: 1, loop: true, frames: ["a", "b", "c"] })));
    engine.setState("idle");
    engine.tick(1000);
    expect(frameIndex(engine)).toBe(1);
    engine.tick(1000);
    expect(frameIndex(engine)).toBe(2);
    engine.tick(1000);
    expect(frameIndex(engine)).toBe(0); // wrap
  });

  it("non-looping animation plays once and holds the last frame", () => {
    const engine = new SpriteEngine();
    setManifest(engine, manifestWith(makeStateDef({ fps: 1, loop: false, frames: ["a", "b", "c"] })));
    engine.setState("idle");
    engine.tick(5000);
    expect(frameIndex(engine)).toBe(2);
    engine.tick(5000);
    expect(frameIndex(engine)).toBe(2); // stays on last frame
  });

  it("single-frame (count<=1) always stays at index 0, even when looping", () => {
    const engine = new SpriteEngine();
    setManifest(engine, manifestWith(makeStateDef({ fps: 10, loop: true, frames: ["only.png"] })));
    engine.setState("idle");
    engine.tick(10000);
    expect(frameIndex(engine)).toBe(0);
    expect(engine.isLoaded()).toBe(true);
  });

  it("large dt advances multiple frames without an infinite loop", () => {
    const engine = new SpriteEngine();
    // 2 frames, fps=2 => frameMs=500; dt=5000 => 10 frame steps => ends at 0
    setManifest(engine, manifestWith(makeStateDef({ fps: 2, loop: true, frames: ["a", "b"] })));
    engine.setState("idle");
    engine.tick(5000);
    expect(frameIndex(engine)).toBe(0);
  });

  it("is a safe no-op when the manifest is missing", () => {
    const engine = new SpriteEngine();
    expect(() => engine.tick(1000)).not.toThrow();
  });
});

describe("SpriteEngine.getDefaultScale", () => {
  it("returns the manifest defaultScale once loaded", () => {
    const engine = new SpriteEngine();
    setManifest(engine, manifestWith(makeStateDef(), 0.42));
    expect(engine.getDefaultScale()).toBe(0.42);
  });

  it("falls back to 0.18 before load", () => {
    const engine = new SpriteEngine();
    expect(engine.getDefaultScale()).toBe(0.18);
  });
});

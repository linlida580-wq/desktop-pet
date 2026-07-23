// Procedural pose transform — a time-driven animation overlay (R-overlay).
//
// This module computes a purely mathematical 2D transform (scale / translate /
// rotate) for each pet state, layered *on top of* the existing sprite frame
// playback. The idea is to let the math dominate the perceived motion so the
// loop looks smooth and stable even when the AI-generated per-frame art drifts
// slightly between frames.
//
// Design goals:
//  - Pure: `computePoseTransform(state, elapsedMs)` has no side effects and
//    returns the identical `PoseTransform` for identical inputs, so it is
//    trivially unit-testable.
//  - State-local: `elapsedMs` is the time (ms) since the pet entered the given
//    state. Each state owns its own period, so entry naturally resets the
//    motion (e.g. a bounce restarts when `play` begins).
//  - Feet-anchored: the consumer (SpriteEngine) applies the transform with the
//    pivot at the pet's bottom-center (the feet), so squash/stretch and
//    rotation happen around the ground contact point.
//
// The master switch `PROCEDURAL_ANIM_ENABLED` lives here. It is a
// compile-time constant for now (kept out of the Rust config to avoid
// unverifiable sandbox builds). A future settings panel can flip it at runtime
// via `SpriteEngine.setProceduralEnabled()`.

import type { PetState } from "../types";

/** A 2D transform expressed in logical pixels / radians. */
export interface PoseTransform {
  /** Horizontal scale factor (1 = unchanged). */
  scaleX: number;
  /** Vertical scale factor (1 = unchanged). */
  scaleY: number;
  /** Horizontal translation in logical px (+right). */
  dx: number;
  /** Vertical translation in logical px (+down, so negative = up). */
  dy: number;
  /** Rotation in radians (clockwise positive). */
  rot: number;
}

/** Master switch for the procedural overlay. See module docs above. */
export const PROCEDURAL_ANIM_ENABLED = true;

const DEG = Math.PI / 180;

// --- idle: very slow vertical breathing (squash / stretch) -----------------
const IDLE_PERIOD = 2500; // ms
const IDLE_AMP = 0.03; // scaleY amplitude (±3%)
function idleTransform(elapsedMs: number): PoseTransform {
  const phase = (elapsedMs / IDLE_PERIOD) * 2 * Math.PI;
  const s = Math.sin(phase);
  const scaleY = 1 + IDLE_AMP * s;
  // Inverse compensation keeps the silhouette volume roughly constant:
  // when it stretches taller it narrows, when it squashes it widens.
  const scaleX = 1 - IDLE_AMP * s;
  return { scaleX, scaleY, dx: 0, dy: 0, rot: 0 };
}

// --- walk: gentle bob + tiny rotation wobble -------------------------------
const WALK_PERIOD = 300; // ms
const WALK_BOB = 4; // px (dy amplitude)
const WALK_ROT = 1.5 * DEG; // rad (rot amplitude)
function walkTransform(elapsedMs: number): PoseTransform {
  const phase = (elapsedMs / WALK_PERIOD) * 2 * Math.PI;
  const dy = -WALK_BOB * Math.sin(phase); // negative = up
  const rot = WALK_ROT * Math.sin(phase); // ≈±1.5°
  return { scaleX: 1, scaleY: 1, dx: 0, dy, rot };
}

// --- sleep: slow breathing bob, no rotation --------------------------------
const SLEEP_PERIOD = 4000; // ms
const SLEEP_BOB = 2; // px (dy amplitude)
function sleepTransform(elapsedMs: number): PoseTransform {
  const phase = (elapsedMs / SLEEP_PERIOD) * 2 * Math.PI;
  const dy = -SLEEP_BOB * Math.sin(phase);
  return { scaleX: 1, scaleY: 1, dx: 0, dy, rot: 0 };
}

// --- play: obvious bounce with a landing squash/stretch pop ----------------
const PLAY_PERIOD = 500; // ms
const PLAY_JUMP = 14; // px (peak bounce height, upward)
const PLAY_POP = 0.04; // max scaleY increase at landing (1.04)
function playTransform(elapsedMs: number): PoseTransform {
  // p in [0,1): 0 and 1 are ground contact, 0.5 is apex.
  const p = (elapsedMs % PLAY_PERIOD) / PLAY_PERIOD;
  // Smooth arc: 0 on the ground, -PLAY_JUMP at apex -> dy is mostly negative
  // (the pet is in the air for the whole arc except the two contacts).
  const dy = (-PLAY_JUMP * (1 - Math.cos(2 * Math.PI * p))) * 0.5;
  // Ground proximity: 1 at contact, 0 at apex (squared cos keeps it local).
  const ground = Math.pow(Math.cos(Math.PI * p), 2);
  const pop = PLAY_POP * ground; // 0 .. PLAY_POP
  const scaleY = 1 + pop; // taller at landing (≈1.04)
  const scaleX = 1 - 0.75 * pop; // narrower at landing (≈0.97)
  return { scaleX, scaleY, dx: 0, dy, rot: 0 };
}

/**
 * Compute the pose transform for a pet `state` at a given `elapsedMs` (ms
 * since the state was entered). Pure: identical inputs yield an identical
 * object.
 */
export function computePoseTransform(
  state: PetState,
  elapsedMs: number,
): PoseTransform {
  switch (state) {
    case "idle":
      return idleTransform(elapsedMs);
    case "walk":
      return walkTransform(elapsedMs);
    case "sleep":
      return sleepTransform(elapsedMs);
    case "play":
      return playTransform(elapsedMs);
    default:
      return { scaleX: 1, scaleY: 1, dx: 0, dy: 0, rot: 0 };
  }
}

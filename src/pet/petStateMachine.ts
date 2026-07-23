// Pet animation state machine (R-03 / R-11). Pure logic, unit-tested.
// Transition rules mirror `src-tauri/src/pet/mod.rs` `can_transition`.

import type { PetState } from "../types";

/** Validate a transition per the PRD state diagram. */
export function canTransition(from: PetState, to: PetState): boolean {
  if (from === to) return true;
  switch (from) {
    case "idle":
      return to === "walk" || to === "sleep" || to === "play";
    case "walk":
      return to === "idle";
    case "sleep":
      return to === "idle";
    case "play":
      return to === "idle";
    default:
      return false;
  }
}

export interface StateContext {
  isNight: boolean;
  isMoving: boolean; // dragging or following
  recentlyClicked: boolean; // within clickFeedback window
  idleMs: number; // ms since last activity
}

/**
 * Decide the desired state from context (auto policy, R-11).
 * Returns `null` when no change is suggested.
 */
export function desiredState(ctx: StateContext): PetState | null {
  if (ctx.recentlyClicked) return "play";
  if (ctx.isNight) return "sleep";
  if (ctx.isMoving) return "walk";
  if (ctx.idleMs > 3000) return "idle";
  return null;
}

export class PetStateMachine {
  private current: PetState;

  constructor(initial: PetState = "idle") {
    this.current = initial;
  }

  get state(): PetState {
    return this.current;
  }

  /** Attempt a transition; ignored (returns false) if illegal. */
  transition(to: PetState): boolean {
    if (!canTransition(this.current, to)) return false;
    this.current = to;
    return true;
  }

  /** Force a state ignoring rules (e.g. on config load). */
  force(to: PetState): void {
    this.current = to;
  }
}

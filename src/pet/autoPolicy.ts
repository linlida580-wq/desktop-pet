// Automatic state-switching policy (R-11). Decides the desired pet state from
// context: night -> sleep, moving (drag/follow) -> walk, recent click -> play,
// else idle. Mirrors the rules in `petStateMachine.desiredState`.

import type { PetState } from "../types";
import { desiredState, type StateContext } from "./petStateMachine";

/** Night window: 22:00 – 06:00 local time. */
export function isNight(date: Date, startHour = 22, endHour = 6): boolean {
  const h = date.getHours();
  if (startHour > endHour) {
    return h >= startHour || h < endHour;
  }
  return h >= startHour && h < endHour;
}

export interface AutoContext {
  isMoving: boolean;
  recentlyClicked: boolean;
  idleMs: number;
  now?: Date;
}

/** Compute the desired state, or `null` if nothing should change. */
export function nextAutoState(ctx: AutoContext): PetState | null {
  const night = isNight(ctx.now ?? new Date());
  const context: StateContext = {
    isNight: night,
    isMoving: ctx.isMoving,
    recentlyClicked: ctx.recentlyClicked,
    idleMs: ctx.idleMs,
  };
  return desiredState(context);
}

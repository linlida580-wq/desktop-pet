import { describe, expect, it } from "vitest";
import { canTransition, desiredState, PetStateMachine } from "./petStateMachine";

describe("canTransition", () => {
  it("follows the PRD state diagram", () => {
    expect(canTransition("idle", "walk")).toBe(true);
    expect(canTransition("idle", "sleep")).toBe(true);
    expect(canTransition("idle", "play")).toBe(true);
    expect(canTransition("walk", "idle")).toBe(true);
    expect(canTransition("sleep", "idle")).toBe(true);
    expect(canTransition("play", "idle")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransition("sleep", "play")).toBe(false);
    expect(canTransition("walk", "sleep")).toBe(false);
    expect(canTransition("play", "walk")).toBe(false);
  });

  it("allows self transitions", () => {
    expect(canTransition("idle", "idle")).toBe(true);
  });
});

describe("desiredState (auto policy)", () => {
  it("prioritises click feedback", () => {
    expect(desiredState({ recentlyClicked: true, isNight: true, isMoving: false, idleMs: 0 })).toBe("play");
  });
  it("sleeps at night", () => {
    expect(desiredState({ recentlyClicked: false, isNight: true, isMoving: false, idleMs: 0 })).toBe("sleep");
  });
  it("walks while moving", () => {
    expect(desiredState({ recentlyClicked: false, isNight: false, isMoving: true, idleMs: 0 })).toBe("walk");
  });
  it("idles after inactivity", () => {
    expect(desiredState({ recentlyClicked: false, isNight: false, isMoving: false, idleMs: 5000 })).toBe("idle");
  });
});

describe("PetStateMachine", () => {
  it("ignores illegal transitions", () => {
    const m = new PetStateMachine("idle");
    expect(m.transition("play")).toBe(true);
    expect(m.transition("sleep")).toBe(false); // play -> sleep illegal
    expect(m.state).toBe("play");
  });
});

// Config schema round-trip tests (architecture §7). Verifies the frontend
// `defaultConfig()` shape, validation, and JSON serialization stability so the
// schema stays in lock-step with the Rust `Config` serde model.

import { describe, expect, it } from "vitest";
import { defaultConfig, type Config } from "../types";
import { validateConfig } from "./validate";

describe("defaultConfig", () => {
  it("produces a config accepted by validateConfig", () => {
    const cfg = defaultConfig();
    expect(cfg.version).toBe(1);
    expect(cfg.pet.id).toBe("default");
    const res = validateConfig(cfg);
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it("survives a JSON stringify/parse round-trip unchanged", () => {
    const cfg = defaultConfig();
    const json = JSON.stringify(cfg);
    const back = JSON.parse(json) as Config;
    expect(back).toEqual(cfg);
    expect(validateConfig(back).ok).toBe(true);
  });
});

describe("config schema shape (architecture §7)", () => {
  it("exposes the documented top-level + behaviour fields", () => {
    const cfg = defaultConfig();
    for (const key of ["version", "pet", "appearance", "reminders", "behavior", "autostart", "position"]) {
      expect(cfg).toHaveProperty(key);
    }
    expect(cfg.behavior).toHaveProperty("followMouse");
    expect(cfg.behavior).toHaveProperty("followSpeed");
    expect(cfg.behavior).toHaveProperty("clickThrough");
    expect(Array.isArray(cfg.reminders)).toBe(true);
    expect(cfg.reminders).toEqual([]);
  });

  it("flags a non-numeric version", () => {
    const bad = defaultConfig();
    (bad as unknown as { version: unknown }).version = "one";
    expect(validateConfig(bad).ok).toBe(false);
  });

  it("flags a non-numeric position coordinate", () => {
    const bad = defaultConfig();
    (bad as unknown as { position: { x: unknown; y: number } }).position = { x: "nope", y: 10 };
    const res = validateConfig(bad);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("position"))).toBe(true);
  });

  it("flags a negative followSpeed", () => {
    const bad = defaultConfig();
    bad.behavior.followSpeed = -5;
    const res = validateConfig(bad);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("followSpeed"))).toBe(true);
  });
});

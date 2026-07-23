import { describe, expect, it } from "vitest";
import { validateConfig } from "./validate";
import { defaultConfig } from "../types";

describe("validateConfig", () => {
  it("accepts the default config", () => {
    expect(validateConfig(defaultConfig()).ok).toBe(true);
  });

  it("flags bad reminder time and duplicate ids", () => {
    const cfg = defaultConfig();
    cfg.reminders = [
      { id: "a", type: "water", time: "99:99", cycle: "daily", enabled: true, message: "", withSound: true },
      { id: "a", type: "rest", time: "10:00", cycle: "daily", enabled: true, message: "", withSound: true },
    ];
    const res = validateConfig(cfg);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("时间格式"))).toBe(true);
    expect(res.errors.some((e) => e.includes("重复"))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  cycleAllows,
  parseTime,
  secondsUntilNext,
  shouldTriggerAt,
} from "./reminder";

function at(h: number, m: number, s = 0, day = 3): Date {
  const d = new Date(2025, 0, day, h, m, s);
  return d;
}

describe("parseTime", () => {
  it("parses valid times", () => {
    expect(parseTime("09:30")).toEqual([9, 30]);
    expect(parseTime("23:59")).toEqual([23, 59]);
  });
  it("rejects invalid times", () => {
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("9:5")).toBeNull();
    expect(parseTime("nope")).toBeNull();
  });
});

describe("shouldTriggerAt", () => {
  it("triggers within tolerance", () => {
    expect(shouldTriggerAt("10:00", at(10, 0, 0))).toBe(true);
    expect(shouldTriggerAt("10:00", at(10, 0, 1))).toBe(true);
    expect(shouldTriggerAt("10:00", at(10, 0, 3))).toBe(false);
    expect(shouldTriggerAt("10:00", at(9, 59, 59))).toBe(false);
  });
});

describe("cycleAllows", () => {
  it("honours cycle rules", () => {
    // NOTE: the 4th arg of `at()` is the MONTH DAY (1-31); the weekday is
    // derived from the real 2025 calendar: Jan 1=Wed, Jan 2=Thu, Jan 3=Fri,
    // Jan 4=Sat, Jan 5=Sun, Jan 6=Mon.
    expect(cycleAllows("daily", at(0, 0, 0, 1))).toBe(true); // Jan 1 Wed
    expect(cycleAllows("weekday", at(0, 0, 0, 2))).toBe(true); // Jan 2 Thu
    expect(cycleAllows("weekday", at(0, 0, 0, 4))).toBe(false); // Jan 4 Sat
    expect(cycleAllows("weekend", at(0, 0, 0, 4))).toBe(true); // Jan 4 Sat
    expect(cycleAllows("weekend", at(0, 0, 0, 3))).toBe(false); // Jan 3 Fri
  });
});

describe("secondsUntilNext", () => {
  it("computes upcoming trigger", () => {
    expect(secondsUntilNext("10:00", at(9, 0, 0))).toBe(3600);
    // past -> next day
    expect(secondsUntilNext("10:00", at(11, 0, 0))).toBe(82800);
  });
});

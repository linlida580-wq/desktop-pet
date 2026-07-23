// Config validation (mirrors Rust `Config` schema; surfaces friendly errors
// in the settings UI). Pure + unit-tested.

import type { Config } from "../types";
import { parseTime } from "./reminder";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateConfig(cfg: Config): ValidationResult {
  const errors: string[] = [];

  if (typeof cfg.version !== "number") errors.push("version 必须为数字");
  if (!cfg.pet?.id) errors.push("pet.id 不能为空");

  if (cfg.behavior) {
    if (typeof cfg.behavior.followSpeed !== "number" || cfg.behavior.followSpeed < 0) {
      errors.push("followSpeed 必须为非负数字");
    }
  }

  if (!Array.isArray(cfg.reminders)) {
    errors.push("reminders 必须为数组");
  } else {
    const seen = new Set<string>();
    for (const r of cfg.reminders) {
      if (!r.id) errors.push("提醒缺少 id");
      if (seen.has(r.id)) errors.push(`提醒 id 重复: ${r.id}`);
      seen.add(r.id);
      if (!parseTime(r.time)) errors.push(`提醒 ${r.id} 时间格式错误: ${r.time}`);
    }
  }

  if (typeof cfg.position?.x !== "number" || typeof cfg.position?.y !== "number") {
    errors.push("position 必须为数字坐标");
  }

  return { ok: errors.length === 0, errors };
}

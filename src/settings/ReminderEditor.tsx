// Reminder editor (R-10): add / edit / remove, enable toggle, cycle rule
// (daily / weekday / weekend), time + message. Persists via `updateReminders`.

import { usePetStore } from "../store/usePetStore";
import type { CSSProperties } from "react";
import type { CycleMode, Reminder, ReminderType } from "../types";
import { secondsUntilNext } from "../lib/reminder";

const TYPES: { value: ReminderType; label: string }[] = [
  { value: "water", label: "喝水" },
  { value: "rest", label: "休息" },
  { value: "eye", label: "护眼" },
  { value: "custom", label: "自定义" },
];

const CYCLES: { value: CycleMode; label: string }[] = [
  { value: "daily", label: "每日" },
  { value: "weekday", label: "工作日" },
  { value: "weekend", label: "周末" },
];

function fmtDuration(sec: number): string {
  if (!isFinite(sec)) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} 小时 ${m} 分后`;
  if (m > 0) return `${m} 分后`;
  return `不到 1 分`;
}

export default function ReminderEditor() {
  const reminders = usePetStore((s) => s.config.reminders);
  const updateReminders = usePetStore((s) => s.updateReminders);

  const commit = (next: Reminder[]) => updateReminders(next);

  const addReminder = () => {
    const r: Reminder = {
      id: `rem_${Date.now()}`,
      type: "custom",
      time: "12:00",
      cycle: "daily",
      enabled: true,
      message: "新提醒",
      withSound: true,
    };
    commit([...reminders, r]);
  };

  const patch = (id: string, p: Partial<Reminder>) => {
    commit(reminders.map((r) => (r.id === id ? { ...r, ...p } : r)));
  };

  const remove = (id: string) => commit(reminders.filter((r) => r.id !== id));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>提醒列表（{reminders.length}）</span>
        <button onClick={addReminder} style={addBtn}>
          + 添加提醒
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto" }}>
        {reminders.map((r) => (
          <div key={r.id} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <input
                type="time"
                value={r.time}
                onChange={(e) => patch(r.id, { time: e.target.value })}
                style={inputStyle}
              />
              <select
                value={r.type}
                onChange={(e) => patch(r.id, { type: e.target.value as ReminderType })}
                style={inputStyle}
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                value={r.cycle}
                onChange={(e) => patch(r.id, { cycle: e.target.value as CycleMode })}
                style={inputStyle}
              >
                {CYCLES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 3 }}>
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => patch(r.id, { enabled: e.target.checked })}
                />
                启用
              </label>
              <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 3 }}>
                <input
                  type="checkbox"
                  checked={r.withSound}
                  onChange={(e) => patch(r.id, { withSound: e.target.checked })}
                />
                声音
              </label>
              <button onClick={() => remove(r.id)} style={delBtn}>
                删除
              </button>
            </div>
            <input
              type="text"
              value={r.message}
              placeholder="提醒内容"
              onChange={(e) => patch(r.id, { message: e.target.value })}
              style={{ ...inputStyle, width: "100%", marginTop: 6 }}
            />
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              下次触发：{fmtDuration(secondsUntilNext(r.time, new Date()))}
            </div>
          </div>
        ))}
        {reminders.length === 0 && (
          <div style={{ fontSize: 12, color: "#999" }}>暂无提醒，点击“添加提醒”创建。</div>
        )}
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 10,
  padding: 8,
  background: "#fff",
};
const inputStyle: CSSProperties = {
  fontSize: 12,
  padding: "3px 6px",
  borderRadius: 6,
  border: "1px solid #ccc",
};
const addBtn: CSSProperties = {
  fontSize: 12,
  padding: "4px 10px",
  borderRadius: 8,
  border: "none",
  background: "#ff9eb5",
  color: "#fff",
  cursor: "pointer",
};
const delBtn: CSSProperties = {
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 6,
  border: "1px solid #f3a0a0",
  background: "#fff",
  color: "#d9534f",
  cursor: "pointer",
};

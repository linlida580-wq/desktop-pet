// Settings panel container (R-09): tabbed 外观 / 行为 / 提醒 / 通用.
// Behaviour + auto-start controls live here; appearance and reminders have
// their own editors.

import { useState } from "react";
import type { ReactNode } from "react";
import { usePetStore } from "../store/usePetStore";
import * as api from "../ipc/api";
import AppearanceEditor from "./AppearanceEditor";
import ReminderEditor from "./ReminderEditor";

type Tab = "appearance" | "behavior" | "reminder" | "general";

const TABS: { key: Tab; label: string }[] = [
  { key: "appearance", label: "外观" },
  { key: "behavior", label: "行为" },
  { key: "reminder", label: "提醒" },
  { key: "general", label: "通用" },
];

export default function SettingsPanel() {
  const [tab, setTab] = useState<Tab>("appearance");
  const config = usePetStore((s) => s.config);
  const updateConfig = usePetStore((s) => s.updateConfig);
  const closeSettings = usePetStore((s) => s.closeSettings);

  const toggleAutostart = async (enabled: boolean) => {
    await api.autostartSet(enabled);
    await updateConfig({ autostart: enabled });
  };

  return (
    <div
      className="settings-layer"
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(255,255,255,0.96)",
        borderRadius: 16,
        padding: 14,
        boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
        display: "flex",
        flexDirection: "column",
        color: "#4a3b3f",
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong style={{ fontSize: 15 }}>设置</strong>
        <button onClick={closeSettings} style={{ border: "none", background: "#eee", borderRadius: 8, padding: "2px 10px", cursor: "pointer" }}>
          ✕
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: "6px 0",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              background: tab === t.key ? "#ff9eb5" : "#f3f3f3",
              color: tab === t.key ? "#fff" : "#555",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "appearance" && <AppearanceEditor />}
        {tab === "reminder" && <ReminderEditor />}
        {tab === "behavior" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Row label="跟随鼠标">
              <input
                type="checkbox"
                checked={config.behavior.followMouse}
                onChange={(e) => updateConfig({ behavior: { ...config.behavior, followMouse: e.target.checked } })}
              />
            </Row>
            <Row label={`跟随速度：${config.behavior.followSpeed} px/s`}>
              <input
                type="range"
                min={40}
                max={400}
                step={10}
                value={config.behavior.followSpeed}
                onChange={(e) =>
                  updateConfig({ behavior: { ...config.behavior, followSpeed: Number(e.target.value) } })
                }
                style={{ width: "100%" }}
              />
            </Row>
            <Row label="鼠标穿透（透明区可点击桌面）">
              <input
                type="checkbox"
                checked={config.behavior.clickThrough}
                onChange={(e) => updateConfig({ behavior: { ...config.behavior, clickThrough: e.target.checked } })}
              />
            </Row>
            <p style={{ fontSize: 12, color: "#888" }}>
              提示：拖拽宠物可移动位置（自动保存）；点击宠物会触发玩耍动画。
            </p>
          </div>
        )}
        {tab === "general" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Row label="开机自启（默认关闭，R-12）">
              <input
                type="checkbox"
                checked={config.autostart}
                onChange={(e) => toggleAutostart(e.target.checked)}
              />
            </Row>
            <Row label="版本">
              <span style={{ fontSize: 13 }}>v{config.version}.0 · Desktop Pet</span>
            </Row>
            <p style={{ fontSize: 12, color: "#888" }}>
              数据保存在本地 config.json，不上传任何服务器（Q7）。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

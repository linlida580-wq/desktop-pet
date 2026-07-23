// Appearance editor (R-08): >=8 preset colours, >=5 accessories, scale slider,
// and a live preview. Edits are persisted immediately via `updateConfig`.

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { usePetStore } from "../store/usePetStore";
import { ACCESSORIES } from "../pet/accessories";
import { SpriteEngine } from "../pet/spriteEngine";
import type { Appearance } from "../types";

// >= 8 preset colours (R-08).
const PALETTE = [
  "#ff9eb5", "#ffd1dc", "#f4a261", "#ffd659",
  "#78c8b4", "#88c0ff", "#b39ddb", "#a5d6a7",
  "#ff8fab", "#ffe0b2", "#b0bec5", "#ffffff",
];

// Recolour-able slots on the pet.
const SLOTS: { key: keyof Appearance["colors"]; label: string }[] = [
  { key: "body", label: "身体" },
  { key: "hair", label: "头发" },
  { key: "dress", label: "裙子" },
  { key: "cheek", label: "腮红" },
];

function PreviewPet({ appearance }: { appearance: Appearance }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SpriteEngine | null>(null);

  useEffect(() => {
    const engine = new SpriteEngine();
    engineRef.current = engine;
    engine.load("/pets/manifest.json").catch(() => undefined);
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const engine = engineRef.current;
      const canvas = ref.current;
      if (engine && engine.isLoaded() && canvas) {
        engine.setUserScale(appearance.scale || 1);
        engine.setState("idle");
        const dpr = window.devicePixelRatio || 1;
        const cw = canvas.clientWidth;
        const ch = canvas.clientHeight;
        if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
          canvas.width = cw * dpr;
          canvas.height = ch * dpr;
        }
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          engine.render(ctx, cw, ch, appearance);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [appearance]);

  return (
    <canvas
      ref={ref}
      style={{ width: 120, height: 120, background: "transparent", borderRadius: 12, border: "1px solid #eee" }}
    />
  );
}

export default function AppearanceEditor() {
  const config = usePetStore((s) => s.config);
  const updateConfig = usePetStore((s) => s.updateConfig);
  const appearance = config.appearance;

  const setColor = (slot: keyof Appearance["colors"], color: string) => {
    updateConfig({ appearance: { ...appearance, colors: { ...appearance.colors, [slot]: color } } });
  };

  const toggleAccessory = (id: string) => {
    const has = appearance.accessories.includes(id);
    const next = has
      ? appearance.accessories.filter((a) => a !== id)
      : [...appearance.accessories, id];
    updateConfig({ appearance: { ...appearance, accessories: next } });
  };

  const setScale = (scale: number) => {
    updateConfig({ appearance: { ...appearance, scale } });
  };

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div style={{ flex: 1 }}>
        {SLOTS.map((slot) => (
          <div key={slot.key} style={{ marginBottom: 10 }}>
            <div style={labelStyle}>{slot.label}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PALETTE.map((c) => {
                const selected = appearance.colors[slot.key] === c;
                return (
                  <button
                    key={c}
                    title={c}
                    onClick={() => setColor(slot.key, c)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: c,
                      border: selected ? "3px solid #333" : "1px solid #ccc",
                      cursor: "pointer",
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>配饰（{appearance.accessories.length}）</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ACCESSORIES.map((a) => {
              const on = appearance.accessories.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggleAccessory(a.id)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 8,
                    border: on ? "2px solid #ff9eb5" : "1px solid #ccc",
                    background: on ? "#fff0f5" : "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={labelStyle}>大小：{(appearance.scale || 1).toFixed(2)}x</div>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={appearance.scale || 1}
            onChange={(e) => setScale(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={labelStyle}>实时预览</div>
        <PreviewPet appearance={appearance} />
      </div>
    </div>
  );
}

function labelStyle(): CSSProperties {
  return { fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#4a3b3f" };
}

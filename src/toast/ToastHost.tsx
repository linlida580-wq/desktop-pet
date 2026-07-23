// Reminder toast host (R-06). Lightweight pills shown inside the pet window,
// auto-dismiss after 5s, with a "5 分钟后再提醒" snooze and optional sound.

import { useEffect } from "react";
import type { CSSProperties } from "react";
import { usePetStore, type Toast } from "../store/usePetStore";

function playBeep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 200);
  } catch {
    /* audio not available; ignore */
  }
}

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = usePetStore((s) => s.removeToast);

  useEffect(() => {
    if (toast.withSound) playBeep();
    const t = window.setTimeout(() => removeToast(toast.id), 5000);
    return () => window.clearTimeout(t);
  }, [toast.id, toast.withSound, removeToast]);

  const snooze = () => {
    removeToast(toast.id);
    window.setTimeout(() => {
      usePetStore.getState().addToast({ ...toast, id: toast.id + "-s" });
    }, 5 * 60 * 1000);
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.96)",
        color: "#4a3b3f",
        borderRadius: 12,
        padding: "8px 10px",
        margin: "4px 0",
        boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
        fontSize: 13,
        maxWidth: 200,
        textAlign: "center",
      }}
    >
      <div style={{ marginBottom: 6 }}>{toast.message}</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button
          onClick={() => removeToast(toast.id)}
          style={btnStyle("#ff9eb5")}
        >
          知道了
        </button>
        <button onClick={snooze} style={btnStyle("#cfcfcf")}>
          5 分钟后再提醒
        </button>
      </div>
    </div>
  );
}

function btnStyle(bg: string): CSSProperties {
  return {
    border: "none",
    background: bg,
    color: "#fff",
    borderRadius: 8,
    padding: "3px 8px",
    fontSize: 12,
    cursor: "pointer",
  };
}

export default function ToastHost() {
  const toasts = usePetStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "auto",
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

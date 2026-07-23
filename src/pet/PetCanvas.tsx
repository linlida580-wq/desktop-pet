// Pet canvas: renders the sprite animation, handles drag/click interaction,
// follows the mouse, and drives performance throttling (R-02 / R-05 / R-09 /
// R-11 / T11). All backend calls go through `src/ipc/api.ts`.
//
// Interaction model: the <canvas> is `pointer-events: none` so the transparent
// margins of the window pass clicks through to the desktop. A small overlay
// <div> sized to the pet's bounding box captures drag/click, giving reliable
// "pet body interactive, transparent area click-through" (R-05 / Q5).

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { SpriteEngine } from "./spriteEngine";
import { PetStateMachine, canTransition } from "./petStateMachine";
import { nextAutoState } from "./autoPolicy";
import { usePetStore } from "../store/usePetStore";
import * as api from "../ipc/api";

const CLICK_FEEDBACK_MS = 1500;
const IDLE_FRAME_MS = 500; // low fps when idle/sleep (saves CPU, R-07)
const ACTIVE_FRAME_MS = 33; // ~30 fps when animating (R-07)

interface DragState {
  active: boolean;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startWinX: number;
  startWinY: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function PetCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SpriteEngine | null>(null);
  const machineRef = useRef(new PetStateMachine("idle"));
  const [hit, setHit] = useState<Rect | null>(null);
  const timerRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  const lastTimeRef = useRef(performance.now());
  const dragRef = useRef<DragState>({
    active: false,
    pointerId: 0,
    startClientX: 0,
    startClientY: 0,
    startWinX: 0,
    startWinY: 0,
  });
  const winPosRef = useRef({ x: 200, y: 200 });
  const cursorRef = useRef({ x: 0, y: 0 });
  const lastClickRef = useRef(0);
  const lastActivityRef = useRef(performance.now());
  const dprRef = useRef(1);
  const lastHitScaleRef = useRef(-1);

  // --- Mount: load engine, apply position, start loop, bind mouse poller ---
  useEffect(() => {
    aliveRef.current = true; // re-enabled for React StrictMode remount
    const store = usePetStore.getState();
    winPosRef.current = { ...store.config.position };
    lastClickRef.current = 0;
    lastActivityRef.current = performance.now();

    const engine = new SpriteEngine();
    engineRef.current = engine;
    let unlistenMouse: (() => void) | null = null;

    engine
      .load("/pets/manifest.json")
      .then(() => {
        if (!aliveRef.current) return;
        engine.setUserScale(store.config.appearance.scale || 1);
        engine.setState(store.currentState);
        api.windowMove(winPosRef.current.x, winPosRef.current.y);
        updateHitRegion(engine, store.config.appearance.scale || 1);
        api.onMouseMove((pos) => {
          cursorRef.current = { x: pos.x, y: pos.y };
        }).then((u) => (unlistenMouse = u));
        startLoop();
      })
      .catch((err) => console.error("sprite engine load failed", err));

    return () => {
      aliveRef.current = false;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      unlistenMouse?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateHitRegion(engine: SpriteEngine, scale: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = canvas.clientWidth || 220;
    const ch = canvas.clientHeight || 220;
    const dpr = window.devicePixelRatio || 1;
    const b = engine.getBounds(cw, ch);
    // DOM hit region (logical px) for reliable click-through.
    setHit({ x: b.x, y: b.y, w: b.w, h: b.h });
    // Backend hit region (device px) — best-effort redundancy for the WebView.
    api.windowSetHitRect(b.x * dpr, b.y * dpr, b.w * dpr, b.h * dpr);
    lastHitScaleRef.current = scale;
  }

  function renderFrame(engine: SpriteEngine) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    engine.render(ctx, cw, ch, usePetStore.getState().config.appearance);
  }

  function startLoop() {
    lastTimeRef.current = performance.now();
    loop();
  }

  function loop() {
    if (!aliveRef.current) return;
    const now = performance.now();
    const dt = now - lastTimeRef.current;
    lastTimeRef.current = now;
    const st = usePetStore.getState();

    // Paused while hidden — poll infrequently to resume quickly (R-07 / T11).
    if (!st.visible) {
      timerRef.current = window.setTimeout(loop, 500);
      return;
    }

    const engine = engineRef.current;
    if (engine && engine.isLoaded()) {
      const isMoving = dragRef.current.active || st.config.behavior.followMouse;
      const recentlyClicked = now - lastClickRef.current < CLICK_FEEDBACK_MS;
      const idleMs = now - lastActivityRef.current;
      let desired = nextAutoState({ isMoving, recentlyClicked, idleMs, now: new Date() });
      if (dragRef.current.active) desired = "walk";
      const machine = machineRef.current;
      if (desired && desired !== machine.state && canTransition(machine.state, desired)) {
        machine.transition(desired);
      }
      const ms = machine.state;
      if (ms !== st.currentState) st.setCurrentState(ms);
      engine.setState(ms);
      engine.setUserScale(st.config.appearance.scale || 1);

      // Follow mouse (throttled by followSpeed, R-05).
      if (st.config.behavior.followMouse && !dragRef.current.active) {
        const cw = canvasRef.current?.clientWidth || 220;
        const ch = canvasRef.current?.clientHeight || 220;
        const b = engine.getBounds(cw, ch);
        const targetX = cursorRef.current.x - b.w / 2;
        const targetY = cursorRef.current.y - b.h;
        const dx = targetX - winPosRef.current.x;
        const dy = targetY - winPosRef.current.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
          const step = (st.config.behavior.followSpeed || 120) * (dt / 1000);
          const move = Math.min(step, dist);
          winPosRef.current = {
            x: winPosRef.current.x + (dx / dist) * move,
            y: winPosRef.current.y + (dy / dist) * move,
          };
          api.windowMove(Math.round(winPosRef.current.x), Math.round(winPosRef.current.y));
        }
      }

      renderFrame(engine);

      const scale = st.config.appearance.scale || 1;
      if (scale !== lastHitScaleRef.current) updateHitRegion(engine, scale);
    }

    const stateNow = machineRef.current?.state ?? "idle";
    const interval =
      stateNow === "idle" || stateNow === "sleep" ? IDLE_FRAME_MS : ACTIVE_FRAME_MS;
    timerRef.current = window.setTimeout(loop, interval);
  }

  // --- Pointer interaction on the pet hit region (drag + click feedback) ---
  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWinX: winPosRef.current.x,
      startWinY: winPosRef.current.y,
    };
    lastClickRef.current = performance.now();
    lastActivityRef.current = performance.now();
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    const dpr = dprRef.current || window.devicePixelRatio || 1;
    const dx = (e.clientX - dragRef.current.startClientX) * dpr;
    const dy = (e.clientY - dragRef.current.startClientY) * dpr;
    winPosRef.current = {
      x: dragRef.current.startWinX + dx,
      y: dragRef.current.startWinY + dy,
    };
    api.windowMove(Math.round(winPosRef.current.x), Math.round(winPosRef.current.y));
    lastActivityRef.current = performance.now();
  }

  function endDrag() {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    const fx = Math.round(winPosRef.current.x);
    const fy = Math.round(winPosRef.current.y);
    // Keep the in-memory position in sync so a later settings save
    // (which replaces the whole config) preserves the dragged position.
    usePetStore.getState().setPosition(fx, fy);
    api.configSavePosition(fx, fy);
    lastActivityRef.current = performance.now();
  }

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      />
      {hit && (
        <div
          style={{
            position: "absolute",
            left: hit.x,
            top: hit.y,
            width: hit.w,
            height: hit.h,
            pointerEvents: "auto",
            cursor: "grab",
            touchAction: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      )}
    </div>
  );
}

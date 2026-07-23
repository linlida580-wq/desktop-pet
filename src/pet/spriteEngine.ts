// Sprite frame animation engine (R-03). Loads the manifest + per-state PNG
// frames (supports multi-frame arrays; single frame = static), and renders the
// current frame onto a 2D canvas context. Drives the frontend `PetStateMachine`.

import type { Appearance, PetState } from "../types";
import { drawAccessory } from "./accessories";
import { computePoseTransform, PROCEDURAL_ANIM_ENABLED } from "./poseTransform";

export interface SpriteStateDef {
  label: string;
  fps: number;
  loop: boolean;
  frames: string[];
}

export interface SpriteManifest {
  version: number;
  name: string;
  description?: string;
  frameWidth: number;
  frameHeight: number;
  anchor: { x: number; y: number };
  defaultScale: number;
  base: string;
  states: Record<PetState, SpriteStateDef>;
  notes?: string[];
}

export interface DrawRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}

export class SpriteEngine {
  private manifest: SpriteManifest | null = null;
  private images = new Map<string, HTMLImageElement>();
  private baseUrl = "/pets/";
  private state: PetState = "idle";
  private frameIndex = 0;
  private frameAccumulator = 0;
  /** User-adjustable scale multiplier on top of manifest.defaultScale. */
  private userScale = 1;

  /** Master switch for the procedural pose overlay (see poseTransform.ts). */
  private proceduralEnabled = PROCEDURAL_ANIM_ENABLED;
  /** performance.now() timestamp when the current state was entered. */
  private stateEnteredAt = 0;

  /** Fetch + decode the manifest and all referenced PNG frames. */
  async load(url: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
    const manifest = (await res.json()) as SpriteManifest;
    this.manifest = manifest;

    const files = new Set<string>();
    files.add(manifest.base);
    for (const key of Object.keys(manifest.states) as PetState[]) {
      for (const f of manifest.states[key].frames) files.add(f);
    }
    await Promise.all(
      Array.from(files).map(async (f) => {
        const img = await loadImage(this.baseUrl + f);
        this.images.set(f, img);
      }),
    );
  }

  isLoaded(): boolean {
    return this.manifest !== null;
  }

  setUserScale(scale: number): void {
    this.userScale = scale > 0 ? scale : 1;
  }

  getDefaultScale(): number {
    return this.manifest?.defaultScale ?? 0.18;
  }

  /** Enable or disable the procedural pose overlay at runtime. */
  setProceduralEnabled(enabled: boolean): void {
    this.proceduralEnabled = enabled;
  }

  /** Milliseconds the current state has been active (drives the overlay). */
  private elapsedInState(): number {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (this.stateEnteredAt === 0) this.stateEnteredAt = now;
    return now - this.stateEnteredAt;
  }

  /** Switch animation state; resets the frame cursor. */
  setState(state: PetState): void {
    if (this.state === state) return;
    this.state = state;
    this.frameIndex = 0;
    this.frameAccumulator = 0;
    this.stateEnteredAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  getState(): PetState {
    return this.state;
  }

  /** Advance the frame cursor based on elapsed dt (ms). */
  tick(dt: number): void {
    const def = this.manifest?.states[this.state];
    if (!def) return;
    const fps = def.fps > 0 ? def.fps : 1;
    this.frameAccumulator += dt;
    const frameMs = 1000 / fps;
    while (this.frameAccumulator >= frameMs) {
      this.frameAccumulator -= frameMs;
      const count = def.frames.length;
      if (count <= 1) {
        this.frameIndex = 0;
      } else if (def.loop) {
        this.frameIndex = (this.frameIndex + 1) % count;
      } else if (this.frameIndex < count - 1) {
        this.frameIndex += 1;
      }
    }
  }

  /** Compute the pet draw rectangle (logical px) for hit-testing. */
  getBounds(logicalW: number, logicalH: number): DrawRect {
    const m = this.manifest;
    if (!m) return { x: 0, y: 0, w: logicalW, h: logicalH };
    const scale = m.defaultScale * this.userScale;
    const w = m.frameWidth * scale;
    const h = m.frameHeight * scale;
    const ax = m.anchor.x * scale;
    const ay = m.anchor.y * scale;
    const margin = 4;
    const x = logicalW / 2 - ax;
    const y = logicalH - margin - ay;
    return { x, y, w, h };
  }

  /** Draw the current frame + accessories at the computed anchor. */
  render(
    ctx: CanvasRenderingContext2D,
    logicalW: number,
    logicalH: number,
    appearance: Appearance,
  ): void {
    const m = this.manifest;
    if (!m) return;
    const def = m.states[this.state];
    const frameName = def.frames[this.frameIndex] ?? def.frames[0];
    const img = this.images.get(frameName) ?? this.images.get(m.base);
    if (!img) return;

    const bounds = this.getBounds(logicalW, logicalH);
    ctx.clearRect(0, 0, logicalW, logicalH);

    if (this.proceduralEnabled) {
      // Procedural overlay: a time-driven scale/rotate/translate anchored at
      // the pet's feet (bottom-center pivot) so the math dominates the
      // perceived motion and smooths over per-frame AI art drift. Only the
      // main sprite is transformed; accessories and body tint are drawn
      // afterwards, untransformed, accepting a tiny visual desync.
      const t = computePoseTransform(this.state, this.elapsedInState());
      const pivotX = bounds.x + bounds.w / 2;
      const pivotY = bounds.y + bounds.h;
      ctx.save();
      ctx.translate(t.dx, t.dy);
      ctx.translate(pivotX, pivotY);
      ctx.rotate(t.rot);
      ctx.scale(t.scaleX, t.scaleY);
      ctx.translate(-pivotX, -pivotY);
      ctx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.restore();
    } else {
      ctx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h);
    }

    // Accessories drawn relative to the pet bounds (R-08).
    for (const acc of appearance.accessories) {
      drawAccessory(ctx, acc, bounds, appearance.colors);
    }

    // Optional body tint (R-08): recolour the pet silhouette using the chosen
    // `body` colour. `source-atop` only paints over existing (pet) pixels, so
    // transparent margins stay clear. Light alpha keeps the art readable.
    const body = appearance.colors?.body;
    if (body) {
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = body;
      ctx.fillRect(0, 0, logicalW, logicalH);
      ctx.restore();
    }
  }
}

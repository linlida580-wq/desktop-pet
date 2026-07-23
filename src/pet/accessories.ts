// Accessory catalog + procedural drawing (R-08).
//
// The architecture notes accessories may start as placeholder interfaces;
// here each accessory is drawn procedurally on the canvas (no binary assets
// required yet). Replace `drawAccessory` with image-based overlays later.

export interface AccessoryDef {
  id: string;
  label: string;
  /** Default tint; can be overridden by `appearance.colors`. */
  color: string;
}

export const ACCESSORIES: AccessoryDef[] = [
  { id: "hat", label: "帽子", color: "#f4a261" },
  { id: "glasses", label: "眼镜", color: "#46464f" },
  { id: "bow", label: "蝴蝶结", color: "#e76f8c" },
  { id: "scarf", label: "围巾", color: "#78c8b4" },
  { id: "star", label: "星星", color: "#ffd659" },
  { id: "flower", label: "小花", color: "#ff8fab" },
];

export function getAccessory(id: string): AccessoryDef | undefined {
  return ACCESSORIES.find((a) => a.id === id);
}

type DrawRect = { x: number; y: number; w: number; h: number };
type Colors = Record<string, string>;

/** Draw one accessory relative to the pet bounding box (logical px). */
export function drawAccessory(
  ctx: CanvasRenderingContext2D,
  id: string,
  bounds: DrawRect,
  colors: Colors,
): void {
  const def = getAccessory(id);
  const color = colors[`acc_${id}`] ?? def?.color ?? "#ffd659";
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, bounds.w * 0.02);

  const cx = bounds.x + bounds.w / 2;
  const top = bounds.y;
  const headR = bounds.w * 0.32;

  switch (id) {
    case "hat": {
      ctx.beginPath();
      ctx.ellipse(cx, top + headR * 0.5, headR * 0.9, headR * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - headR * 0.5, top - headR * 0.1, headR, headR * 0.6);
      break;
    }
    case "glasses": {
      const ey = top + bounds.h * 0.42;
      ctx.lineWidth = Math.max(2, bounds.w * 0.03);
      ctx.beginPath();
      ctx.arc(cx - headR * 0.45, ey, headR * 0.28, 0, Math.PI * 2);
      ctx.arc(cx + headR * 0.45, ey, headR * 0.28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - headR * 0.17, ey);
      ctx.lineTo(cx + headR * 0.17, ey);
      ctx.stroke();
      break;
    }
    case "bow": {
      const bx = cx + headR * 0.9;
      const by = top + headR * 0.4;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - headR * 0.4, by - headR * 0.3);
      ctx.lineTo(bx - headR * 0.4, by + headR * 0.3);
      ctx.closePath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + headR * 0.4, by - headR * 0.3);
      ctx.lineTo(bx + headR * 0.4, by + headR * 0.3);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "scarf": {
      const sy = top + bounds.h * 0.72;
      ctx.fillRect(bounds.x + bounds.w * 0.28, sy, bounds.w * 0.44, bounds.h * 0.08);
      ctx.fillRect(cx, sy, bounds.w * 0.12, bounds.h * 0.18);
      break;
    }
    case "star": {
      drawStar(ctx, cx + headR * 0.8, top + bounds.h * 0.2, headR * 0.35, color);
      break;
    }
    case "flower": {
      drawStar(ctx, cx - headR * 0.8, top + bounds.h * 0.18, headR * 0.2, color, 5, 0.5);
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  points = 5,
  innerRatio = 0.45,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : r * innerRatio;
    const a = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + radius * Math.cos(a);
    const y = cy + radius * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

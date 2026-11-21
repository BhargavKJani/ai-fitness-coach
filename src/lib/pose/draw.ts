import { sideIndex, type Joint, type Side } from "./angles";
import { POSE_CONNECTIONS, type Landmark } from "./landmarks";

export interface DrawOptions {
  /** Mirror horizontally (selfie view). */
  mirror?: boolean;
  highlight?: { side: Side; joints: readonly Joint[] };
  warn?: boolean;
  angle?: number | null;
  angleJoint?: Joint;
}

const CYAN = "rgba(34, 211, 238, 0.95)";
const MAGENTA = "rgba(232, 121, 249, 0.95)";
const AMBER = "rgba(251, 191, 36, 0.95)";

/** Draw the neon skeleton overlay onto a 2D canvas context sized to the video. */
export function drawSkeleton(ctx: CanvasRenderingContext2D, lms: readonly Landmark[], opts: DrawOptions = {}): void {
  const { width: w, height: h } = ctx.canvas;
  const X = (l: Landmark) => (opts.mirror ? 1 - l.x : l.x) * w;
  const Y = (l: Landmark) => l.y * h;
  const vis = (l?: Landmark) => !!l && (l.visibility ?? 1) > 0.3;
  const hl = new Set(opts.highlight ? opts.highlight.joints.map((j) => sideIndex(opts.highlight!.side, j)) : []);
  const accent = opts.warn ? AMBER : MAGENTA;
  const scale = Math.max(1, Math.min(w, h) / 360);

  ctx.save();
  ctx.lineCap = "round";
  ctx.shadowBlur = 14 * scale;
  for (const [a, b] of POSE_CONNECTIONS) {
    const la = lms[a];
    const lb = lms[b];
    if (!vis(la) || !vis(lb)) continue;
    const strong = hl.has(a) && hl.has(b);
    ctx.strokeStyle = strong ? accent : CYAN;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.globalAlpha = Math.min(la.visibility ?? 1, lb.visibility ?? 1) < 0.7 ? 0.45 : 1;
    ctx.lineWidth = (strong ? 5 : 3) * scale;
    ctx.beginPath();
    ctx.moveTo(X(la), Y(la));
    ctx.lineTo(X(lb), Y(lb));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < lms.length; i++) {
    const l = lms[i];
    if (!vis(l) || i > 32) continue;
    const strong = hl.has(i);
    ctx.fillStyle = strong ? accent : "#e0f2fe";
    ctx.shadowColor = strong ? accent : CYAN;
    ctx.beginPath();
    ctx.arc(X(l), Y(l), (strong ? 6 : 3.5) * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  if (opts.highlight && opts.angleJoint && opts.angle != null && !Number.isNaN(opts.angle)) {
    const j = lms[sideIndex(opts.highlight.side, opts.angleJoint)];
    if (vis(j)) {
      ctx.shadowBlur = 0;
      ctx.font = `600 ${14 * scale}px ui-monospace, monospace`;
      const label = `${Math.round(opts.angle)}°`;
      const tx = X(j) + 12 * scale;
      const ty = Y(j) - 10 * scale;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(2, 6, 23, 0.75)";
      ctx.fillRect(tx - 6 * scale, ty - 15 * scale, tw + 12 * scale, 21 * scale);
      ctx.fillStyle = accent;
      ctx.fillText(label, tx, ty);
    }
  }
  ctx.restore();
}

/** Futuristic grid backdrop used in demo mode when there is no video. */
export function drawDemoBackdrop(ctx: CanvasRenderingContext2D, t: number): void {
  const { width: w, height: h } = ctx.canvas;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#050816");
  g.addColorStop(1, "#0b1030");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.strokeStyle = "rgba(99, 102, 241, 0.14)";
  ctx.lineWidth = 1;
  const step = Math.max(24, w / 24);
  const off = (t * 20) % step;
  for (let x = -off; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = off; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(34, 211, 238, 0.35)";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.93);
  ctx.lineTo(w, h * 0.93);
  ctx.stroke();
  ctx.restore();
}

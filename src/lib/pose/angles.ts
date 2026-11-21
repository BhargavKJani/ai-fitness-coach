import { LM, type Landmark } from "./landmarks";

export type Side = "left" | "right";

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Interior angle ABC in degrees (0..180), with B as the vertex.
 * Uses 2D image coordinates, which is what form cues are judged on.
 * Returns NaN when a segment has zero length.
 */
export function jointAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  if ((v1x === 0 && v1y === 0) || (v2x === 0 && v2y === 0)) return Number.NaN;
  // atan2(|cross|, dot) is numerically stable near 0° and 180°, unlike acos.
  const cross = v1x * v2y - v1y * v2x;
  const dot = v1x * v2x + v1y * v2y;
  return Math.atan2(Math.abs(cross), dot) * RAD_TO_DEG;
}

/**
 * Angle in degrees (0..180) between segment from→to and the vertical axis.
 * 0 = perfectly upright (to is directly above from), 90 = horizontal.
 */
export function angleFromVertical(from: Landmark, to: Landmark): number {
  const dx = to.x - from.x;
  const dy = from.y - to.y; // image y grows downward
  if (dx === 0 && dy === 0) return Number.NaN;
  return Math.abs(Math.atan2(dx, dy)) * RAD_TO_DEG;
}

/** Midpoint of two landmarks. */
export function midpoint(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

const SIDE_IDX = {
  left: {
    shoulder: LM.LEFT_SHOULDER,
    elbow: LM.LEFT_ELBOW,
    wrist: LM.LEFT_WRIST,
    hip: LM.LEFT_HIP,
    knee: LM.LEFT_KNEE,
    ankle: LM.LEFT_ANKLE,
  },
  right: {
    shoulder: LM.RIGHT_SHOULDER,
    elbow: LM.RIGHT_ELBOW,
    wrist: LM.RIGHT_WRIST,
    hip: LM.RIGHT_HIP,
    knee: LM.RIGHT_KNEE,
    ankle: LM.RIGHT_ANKLE,
  },
} as const;

export type Joint = keyof (typeof SIDE_IDX)["left"];

export function sideIndex(side: Side, joint: Joint): number {
  return SIDE_IDX[side][joint];
}

/** Mean visibility of a set of landmark indices (missing = 0, undefined visibility = 1). */
export function meanVisibility(lms: readonly Landmark[], idx: readonly number[]): number {
  if (idx.length === 0) return 0;
  let s = 0;
  for (const i of idx) {
    const l = lms[i];
    s += l ? (l.visibility ?? 1) : 0;
  }
  return s / idx.length;
}

/** Choose the body side the camera sees best for the given joints. */
export function pickSide(lms: readonly Landmark[], joints: readonly Joint[]): Side {
  const left = meanVisibility(lms, joints.map((j) => sideIndex("left", j)));
  const right = meanVisibility(lms, joints.map((j) => sideIndex("right", j)));
  return right > left ? "right" : "left";
}

/** Exponential moving average smoother, used to de-jitter angles. */
export class Ema {
  private value: number | null = null;
  constructor(private readonly alpha = 0.5) {
    if (alpha <= 0 || alpha > 1) throw new RangeError("alpha must be in (0, 1]");
  }
  next(x: number): number {
    if (Number.isNaN(x)) return this.value ?? x;
    this.value = this.value === null ? x : this.alpha * x + (1 - this.alpha) * this.value;
    return this.value;
  }
  reset(): void {
    this.value = null;
  }
  get current(): number | null {
    return this.value;
  }
}

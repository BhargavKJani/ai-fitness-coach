import type { ExerciseId } from "./exercises";
import { LANDMARK_COUNT, LM, type Landmark } from "./landmarks";

/**
 * Synthetic, side-view pose generator used for demo mode and tests.
 * Produces physically plausible 33-point landmark frames via simple forward
 * kinematics, so the real rep-counting pipeline runs without a camera.
 */

export interface SyntheticOptions {
  /** Seconds per rep cycle. */
  period?: number;
  /** Seconds of standing still before the first rep. */
  lead?: number;
  /** Every Nth rep (1-based) is shallow (partial range). 0 disables. */
  shallowEvery?: number;
  /** Every Nth rep (1-based) has a form fault. 0 disables. */
  faultEvery?: number;
  /** Amplitude of deterministic jitter in normalized units. */
  jitter?: number;
  /** Target image width / height; x is squashed like real normalized landmarks. */
  aspect?: number;
}

export const SYNTH_DEFAULTS: Required<SyntheticOptions> = {
  period: 2.2,
  lead: 0.8,
  shallowEvery: 4,
  faultEvery: 5,
  jitter: 0.002,
  aspect: 1,
};

const D2R = Math.PI / 180;
const pt = (x: number, y: number, visibility = 0.95): Landmark => ({ x, y, z: 0, visibility });

interface Cycle {
  /** 0 = top/extended, 1 = full depth. */
  depth: number;
  shallow: boolean;
  fault: boolean;
  repIndex: number;
}

export function cycleAt(t: number, o: Required<SyntheticOptions>): Cycle {
  const tt = t - o.lead;
  if (tt < 0) return { depth: 0, shallow: false, fault: false, repIndex: -1 };
  const repIndex = Math.floor(tt / o.period);
  const phase = (tt % o.period) / o.period;
  const n = repIndex + 1;
  const shallow = o.shallowEvery > 0 && n % o.shallowEvery === 0;
  const fault = !shallow && o.faultEvery > 0 && n % o.faultEvery === 0;
  // Smooth down-and-up profile with a short hold at the top.
  const active = Math.min(1, phase / 0.85);
  const depth = phase < 0.85 ? 0.5 - 0.5 * Math.cos(2 * Math.PI * active) : 0;
  return { depth: shallow ? depth * 0.45 : depth, shallow, fault, repIndex };
}

function jitter(t: number, i: number, amp: number): number {
  return amp * Math.sin(t * 13.7 + i * 2.3) * Math.cos(t * 7.1 + i * 0.7);
}

function blank(): Landmark[] {
  return Array.from({ length: LANDMARK_COUNT }, () => pt(0.5, 0.5, 0));
}

/** Fill the minor face / hand landmarks around their parent joints. */
function fillDetails(l: Landmark[]): void {
  const near = (i: number, dx: number, dy: number, v = 0.8) => pt(l[i].x + dx, l[i].y + dy, v);
  l[1] = near(LM.LEFT_EYE, 0.004, 0);
  l[3] = near(LM.LEFT_EYE, -0.004, 0);
  l[9] = near(LM.NOSE, -0.006, 0.018);
  l[10] = near(LM.NOSE, 0.002, 0.018, 0.5);
  for (const [w, base] of [[LM.LEFT_WRIST, 17], [LM.RIGHT_WRIST, 18]] as const) {
    const v = l[w].visibility ?? 0.9;
    l[base] = near(w, 0.012, 0.012, v);
    l[base + 2] = near(w, 0.016, 0.004, v);
    l[base + 4] = near(w, 0.008, -0.008, v);
  }
  l[4] = near(LM.RIGHT_EYE, 0.004, 0, 0.5);
  l[6] = near(LM.RIGHT_EYE, -0.004, 0, 0.5);
}

/** Copy near-side (left) joints to the far side with a small offset and lower visibility. */
function mirrorFarSide(l: Landmark[]): void {
  const pairs: Array<[number, number]> = [
    [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
    [LM.LEFT_ELBOW, LM.RIGHT_ELBOW],
    [LM.LEFT_WRIST, LM.RIGHT_WRIST],
    [LM.LEFT_HIP, LM.RIGHT_HIP],
    [LM.LEFT_KNEE, LM.RIGHT_KNEE],
    [LM.LEFT_ANKLE, LM.RIGHT_ANKLE],
    [LM.LEFT_HEEL, LM.RIGHT_HEEL],
    [LM.LEFT_FOOT, LM.RIGHT_FOOT],
    [LM.LEFT_EYE, LM.RIGHT_EYE],
    [LM.LEFT_EAR, LM.RIGHT_EAR],
  ];
  for (const [a, b] of pairs) l[b] = pt(l[a].x + 0.012, l[a].y - 0.006, 0.55);
}

function head(l: Landmark[], shoulder: Landmark, dirX: number, upX: number, upY: number): void {
  const nx = shoulder.x + upX * 0.09 + dirX * 0.03;
  const ny = shoulder.y + upY * 0.09;
  l[LM.NOSE] = pt(nx, ny);
  l[LM.LEFT_EYE] = pt(nx - dirX * 0.012, ny - 0.012);
  l[LM.LEFT_EAR] = pt(nx - dirX * 0.04, ny - 0.004);
}

function feet(l: Landmark[], ankle: Landmark, dirX: number): void {
  l[LM.LEFT_ANKLE] = ankle;
  l[LM.LEFT_HEEL] = pt(ankle.x - dirX * 0.025, ankle.y + 0.02);
  l[LM.LEFT_FOOT] = pt(ankle.x + dirX * 0.06, ankle.y + 0.025);
}

function squat(c: Cycle): Landmark[] {
  const l = blank();
  const knee = 175 - c.depth * 95; // 175° standing → 80° bottom
  const lean = c.fault ? 15 + c.depth * 50 : 12 + c.depth * 26;
  const s = ((180 - knee) / 2) * D2R;
  const ankle = pt(0.5, 0.88);
  const kn = pt(ankle.x + 0.2 * Math.sin(s), ankle.y - 0.2 * Math.cos(s));
  const hip = pt(kn.x - 0.21 * Math.sin(s), kn.y - 0.21 * Math.cos(s));
  const L = lean * D2R;
  const sh = pt(hip.x + 0.27 * Math.sin(L), hip.y - 0.27 * Math.cos(L));
  const el = pt(sh.x + 0.14, sh.y + 0.01);
  const wr = pt(el.x + 0.13, el.y);
  feet(l, ankle, 1);
  l[LM.LEFT_KNEE] = kn;
  l[LM.LEFT_HIP] = hip;
  l[LM.LEFT_SHOULDER] = sh;
  l[LM.LEFT_ELBOW] = el;
  l[LM.LEFT_WRIST] = wr;
  head(l, sh, 1, Math.sin(L), -Math.cos(L));
  return l;
}

function pushup(c: Cycle): Landmark[] {
  const l = blank();
  const elbow = 168 - c.depth * 88; // 168° locked out → 80° bottom
  const f = ((180 - elbow) / 2) * D2R;
  const wr = pt(0.3, 0.8);
  const el = pt(wr.x + 0.13 * Math.sin(f), wr.y - 0.13 * Math.cos(f));
  const sh = pt(el.x - 0.14 * Math.sin(f), el.y - 0.14 * Math.cos(f));
  const ankle = pt(0.86, 0.8);
  const sag = c.fault ? 0.075 * Math.min(1, c.depth * 1.6) : 0;
  const hip = pt(sh.x + 0.48 * (ankle.x - sh.x), sh.y + 0.48 * (ankle.y - sh.y) + sag);
  const kn = pt((hip.x + ankle.x) / 2, (hip.y + ankle.y) / 2 + sag / 2);
  feet(l, ankle, 0);
  l[LM.LEFT_HEEL] = pt(ankle.x + 0.02, ankle.y - 0.02);
  l[LM.LEFT_FOOT] = pt(ankle.x + 0.01, ankle.y + 0.02);
  l[LM.LEFT_KNEE] = kn;
  l[LM.LEFT_HIP] = hip;
  l[LM.LEFT_SHOULDER] = sh;
  l[LM.LEFT_ELBOW] = el;
  l[LM.LEFT_WRIST] = wr;
  l[LM.NOSE] = pt(sh.x - 0.08, sh.y - 0.01);
  l[LM.LEFT_EYE] = pt(sh.x - 0.075, sh.y - 0.025);
  l[LM.LEFT_EAR] = pt(sh.x - 0.045, sh.y - 0.02);
  return l;
}

function curl(c: Cycle): Landmark[] {
  const l = blank();
  const elbow = 168 - c.depth * 133; // 168° extended → 35° fully curled
  const sway = c.fault ? c.depth * 26 : c.depth * 4;
  const hip = pt(0.5, 0.56);
  const L = -sway * D2R; // swinging backward
  const sh = pt(hip.x + 0.27 * Math.sin(L), hip.y - 0.27 * Math.cos(L));
  const tuck = 6 * D2R;
  const el = pt(sh.x + 0.15 * Math.sin(tuck + L), sh.y + 0.15 * Math.cos(tuck + L));
  const a = (180 - elbow) * D2R + L;
  const wr = pt(el.x + 0.14 * Math.sin(a), el.y + 0.14 * Math.cos(a));
  const kn = pt(0.505, 0.73);
  const ankle = pt(0.5, 0.9);
  feet(l, ankle, 1);
  l[LM.LEFT_KNEE] = kn;
  l[LM.LEFT_HIP] = hip;
  l[LM.LEFT_SHOULDER] = sh;
  l[LM.LEFT_ELBOW] = el;
  l[LM.LEFT_WRIST] = wr;
  head(l, sh, 1, Math.sin(L), -Math.cos(L));
  return l;
}

const GENERATORS: Record<ExerciseId, (c: Cycle) => Landmark[]> = { squat, pushup, curl };

/** Landmarks for `exercise` at time `t` seconds. Deterministic for a given t and options. */
export function syntheticFrame(exercise: ExerciseId, t: number, options: SyntheticOptions = {}): Landmark[] {
  const o = { ...SYNTH_DEFAULTS, ...options };
  const l = GENERATORS[exercise](cycleAt(t, o));
  mirrorFarSide(l);
  fillDetails(l);
  for (let i = 0; i < l.length; i++) {
    const x = l[i].x + (o.jitter > 0 ? jitter(t, i, o.jitter) : 0);
    const y = l[i].y + (o.jitter > 0 ? jitter(t, i + 50, o.jitter) : 0);
    l[i] = { ...l[i], x: 0.5 + (x - 0.5) / o.aspect, y };
  }
  return l;
}

/** Pre-render a sequence of frames at `fps` for `seconds`. */
export function syntheticSequence(
  exercise: ExerciseId,
  seconds: number,
  fps = 30,
  options: SyntheticOptions = {},
): Array<{ t: number; landmarks: Landmark[] }> {
  const out: Array<{ t: number; landmarks: Landmark[] }> = [];
  const n = Math.floor(seconds * fps);
  for (let i = 0; i <= n; i++) {
    const t = i / fps;
    out.push({ t, landmarks: syntheticFrame(exercise, t, options) });
  }
  return out;
}

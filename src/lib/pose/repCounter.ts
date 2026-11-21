import { Ema, meanVisibility, pickSide, sideIndex, type Side } from "./angles";
import { EXERCISES, type ExerciseDef, type ExerciseId } from "./exercises";
import type { Landmark } from "./landmarks";

/**
 * Rep state machine phases:
 *  - idle:   waiting for the user to reach the extended start position
 *  - up:     extended, ready for the next rep
 *  - down:   moving toward flexion, bottom not yet reached
 *  - bottom: full range reached, waiting to return to extended
 */
export type Phase = "idle" | "up" | "down" | "bottom";

export type FeedbackLevel = "info" | "good" | "warn";

export interface Feedback {
  id: string;
  message: string;
  level: FeedbackLevel;
}

export interface RepEvent {
  /** Rep number (1-based) among counted reps. */
  n: number;
  /** Lowest angle reached during the rep. */
  minAngle: number;
  /** Seconds from leaving "up" to returning. */
  duration: number;
  /** Form-check ids that fired during the rep. */
  faults: string[];
}

export interface RepState {
  exercise: ExerciseId;
  phase: Phase;
  reps: number;
  goodReps: number;
  partialReps: number;
  angle: number | null;
  side: Side;
  feedback: Feedback;
  lastRep: RepEvent | null;
  history: RepEvent[];
  /** Fault id → count across the session. */
  faultCounts: Record<string, number>;
}

export interface RepCounterOptions {
  /** Minimum landmark visibility to trust a frame. */
  minVisibility?: number;
  /** Degrees below upThreshold the angle must drop before a rep is considered started. */
  startMargin?: number;
  /** Minimum seconds for a full rep; faster transitions are treated as jitter. */
  minRepSeconds?: number;
  /** EMA alpha for angle smoothing (1 = no smoothing). */
  smoothing?: number;
  /** Frames a form fault must persist before it is recorded (debounce). */
  faultFrames?: number;
  /**
   * Image width / height. Normalized landmarks squash x by this ratio, so angles
   * are computed after scaling x back to square pixels.
   */
  aspect?: number;
}

const DEFAULTS: Required<RepCounterOptions> = {
  minVisibility: 0.5,
  startMargin: 20,
  minRepSeconds: 0.4,
  smoothing: 0.6,
  faultFrames: 3,
  aspect: 1,
};

const FB = {
  ready: (d: ExerciseDef): Feedback => ({
    id: "ready",
    message: d.readyCheck ? d.readyCheck.message : "Get into the start position",
    level: "info",
  }),
  frame: { id: "frame", message: "Step into frame so your full body is visible", level: "warn" } as Feedback,
  go: { id: "go", message: "Ready — start your rep", level: "info" } as Feedback,
  good: { id: "good", message: "Good rep! 🔥", level: "good" } as Feedback,
  up: (d: ExerciseDef): Feedback => ({
    id: "finish",
    message: d.id === "curl" ? "Now lower all the way down" : "Now push back up",
    level: "info",
  }),
};

/** Pure, frame-driven rep counter. Feed it landmarks + a timestamp in seconds. */
export class RepCounter {
  readonly def: ExerciseDef;
  private readonly opts: Required<RepCounterOptions>;
  private readonly ema: Ema;
  private s: RepState;
  private repStart = 0;
  private repMin = Infinity;
  private repFaults = new Set<string>();
  private faultStreak: Record<string, number> = {};

  constructor(exercise: ExerciseId, options: RepCounterOptions = {}) {
    this.def = EXERCISES[exercise];
    this.opts = { ...DEFAULTS, ...options };
    this.ema = new Ema(this.opts.smoothing);
    this.s = this.initial();
  }

  private initial(): RepState {
    return {
      exercise: this.def.id,
      phase: "idle",
      reps: 0,
      goodReps: 0,
      partialReps: 0,
      angle: null,
      side: "left",
      feedback: FB.ready(this.def),
      lastRep: null,
      history: [],
      faultCounts: {},
    };
  }

  /** Update the image aspect ratio (e.g. once the camera reports its resolution). */
  setAspect(aspect: number): void {
    if (aspect > 0 && Number.isFinite(aspect)) this.opts.aspect = aspect;
  }

  reset(): void {
    this.ema.reset();
    this.s = this.initial();
    this.repMin = Infinity;
    this.repFaults.clear();
    this.faultStreak = {};
  }

  get state(): RepState {
    return this.s;
  }

  /** Process one frame. `t` is a monotonically increasing time in seconds. */
  update(input: readonly Landmark[] | null | undefined, t: number): RepState {
    const d = this.def;
    if (!input || input.length < 33) return this.patch({ feedback: FB.frame });
    const a = this.opts.aspect;
    const lms = a === 1 ? input : input.map((l) => ({ ...l, x: l.x * a }));

    const side = pickSide(lms, d.joints);
    const vis = meanVisibility(lms, d.joints.map((j) => sideIndex(side, j)));
    if (vis < this.opts.minVisibility) return this.patch({ side, feedback: FB.frame });

    const raw = d.angle(lms, side);
    if (Number.isNaN(raw)) return this.patch({ side });
    const angle = this.ema.next(raw);

    const ready = d.readyCheck ? !d.readyCheck.test(lms, side) : true;
    const { upThreshold: UP, downThreshold: DOWN } = d;

    let { phase, feedback } = this.s;
    const next: Partial<RepState> = { side, angle };

    // Form checks only matter while the user is actively moving through a rep.
    if (phase === "down" || phase === "bottom") {
      this.repMin = Math.min(this.repMin, angle);
      for (const fc of d.formChecks) {
        if (fc.test(lms, side)) {
          this.faultStreak[fc.id] = (this.faultStreak[fc.id] ?? 0) + 1;
          if (this.faultStreak[fc.id] >= this.opts.faultFrames) {
            this.repFaults.add(fc.id);
            feedback = { id: fc.id, message: fc.message, level: "warn" };
          }
        } else {
          this.faultStreak[fc.id] = 0;
        }
      }
    }

    switch (phase) {
      case "idle":
        if (!ready) {
          feedback = FB.ready(d);
        } else if (angle >= UP) {
          phase = "up";
          feedback = FB.go;
        } else {
          feedback = FB.ready(d);
        }
        break;

      case "up":
        if (!ready) {
          phase = "idle";
          feedback = FB.ready(d);
        } else if (angle < UP - this.opts.startMargin) {
          phase = "down";
          this.repStart = t;
          this.repMin = angle;
          this.repFaults.clear();
          this.faultStreak = {};
        }
        break;

      case "down":
        if (angle <= DOWN) {
          phase = "bottom";
          if (feedback.level !== "warn") feedback = FB.up(d);
        } else if (angle >= UP) {
          // Came back up without reaching full range → partial rep.
          phase = "up";
          next.partialReps = this.s.partialReps + 1;
          feedback = { id: "depth", message: d.depthCue, level: "warn" };
        }
        break;

      case "bottom":
        if (angle >= UP) {
          const duration = t - this.repStart;
          phase = "up";
          if (duration >= this.opts.minRepSeconds) {
            const faults = [...this.repFaults];
            const reps = this.s.reps + 1;
            const ev: RepEvent = {
              n: reps,
              minAngle: Math.round(this.repMin),
              duration: Math.round(duration * 100) / 100,
              faults,
            };
            const faultCounts = { ...this.s.faultCounts };
            for (const f of faults) faultCounts[f] = (faultCounts[f] ?? 0) + 1;
            next.reps = reps;
            next.goodReps = this.s.goodReps + (faults.length === 0 ? 1 : 0);
            next.lastRep = ev;
            next.history = [...this.s.history, ev];
            next.faultCounts = faultCounts;
            feedback =
              faults.length === 0
                ? FB.good
                : {
                    id: faults[0],
                    message: d.formChecks.find((f) => f.id === faults[0])?.message ?? "Watch your form",
                    level: "warn",
                  };
          }
        }
        break;
    }

    next.phase = phase;
    next.feedback = feedback;
    return this.patch(next);
  }

  private patch(p: Partial<RepState>): RepState {
    this.s = { ...this.s, ...p };
    return this.s;
  }
}

/** Fraction (0..1) of range of motion completed for the current angle, for gauges. */
export function rangeProgress(def: ExerciseDef, angle: number | null): number {
  if (angle === null || Number.isNaN(angle)) return 0;
  const v = (def.upThreshold - angle) / (def.upThreshold - def.downThreshold);
  return Math.min(1, Math.max(0, v));
}

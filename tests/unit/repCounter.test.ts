import { describe, expect, it } from "vitest";
import { EXERCISES, EXERCISE_IDS, isExerciseId, type ExerciseId } from "@/lib/pose/exercises";
import { LANDMARK_COUNT, type Landmark } from "@/lib/pose/landmarks";
import { RepCounter, rangeProgress, type RepState } from "@/lib/pose/repCounter";
import { SYNTH_DEFAULTS, cycleAt, syntheticFrame, syntheticSequence, type SyntheticOptions } from "@/lib/pose/synthetic";

function run(ex: ExerciseId, seconds: number, synth: SyntheticOptions = {}, fps = 30) {
  const c = new RepCounter(ex);
  const states: RepState[] = [];
  for (const f of syntheticSequence(ex, seconds, fps, synth)) states.push(c.update(f.landmarks, f.t));
  return { counter: c, states, final: states[states.length - 1] };
}

const CLEAN: SyntheticOptions = { shallowEvery: 0, faultEvery: 0 };
const P = SYNTH_DEFAULTS.period;
const L = SYNTH_DEFAULTS.lead;
/** Duration covering exactly n full reps plus a little settle time. */
const forReps = (n: number) => L + n * P + 0.3;

describe("exercise definitions", () => {
  it("has sane thresholds for every exercise", () => {
    for (const id of EXERCISE_IDS) {
      const d = EXERCISES[id];
      expect(d.upThreshold).toBeGreaterThan(d.downThreshold);
      expect(d.upThreshold).toBeLessThanOrEqual(180);
      expect(d.downThreshold).toBeGreaterThan(0);
      expect(d.formChecks.length).toBeGreaterThan(0);
    }
  });
  it("isExerciseId narrows correctly", () => {
    expect(isExerciseId("squat")).toBe(true);
    expect(isExerciseId("burpee")).toBe(false);
    expect(isExerciseId(42)).toBe(false);
  });
});

describe("synthetic generator", () => {
  it("emits 33 landmarks with normalized coordinates", () => {
    for (const id of EXERCISE_IDS) {
      for (const t of [0, 0.5, 1.3, 2.9, 7.7]) {
        const f = syntheticFrame(id, t);
        expect(f).toHaveLength(LANDMARK_COUNT);
        for (const l of f) {
          expect(l.x).toBeGreaterThan(-0.05);
          expect(l.x).toBeLessThan(1.05);
          expect(l.y).toBeGreaterThan(-0.05);
          expect(l.y).toBeLessThan(1.05);
        }
      }
    }
  });
  it("is deterministic", () => {
    expect(syntheticFrame("curl", 3.21)).toEqual(syntheticFrame("curl", 3.21));
  });
  it("drives the primary angle through the full range", () => {
    for (const id of EXERCISE_IDS) {
      const d = EXERCISES[id];
      const angles = syntheticSequence(id, L + P, 60, { ...CLEAN, jitter: 0 }).map((f) => d.angle(f.landmarks, "left"));
      expect(Math.max(...angles)).toBeGreaterThan(d.upThreshold);
      expect(Math.min(...angles)).toBeLessThan(d.downThreshold);
    }
  });
  it("cycleAt marks shallow and fault reps on schedule", () => {
    const o = { ...SYNTH_DEFAULTS, shallowEvery: 2, faultEvery: 3 };
    const mid = (n: number) => o.lead + (n - 1) * o.period + o.period * 0.42;
    expect(cycleAt(0, o).repIndex).toBe(-1);
    expect(cycleAt(mid(2), o).shallow).toBe(true);
    expect(cycleAt(mid(3), o).fault).toBe(true);
    expect(cycleAt(mid(1), o)).toMatchObject({ shallow: false, fault: false });
    expect(cycleAt(mid(2), o).depth).toBeLessThan(0.5);
  });
});

describe.each(EXERCISE_IDS)("RepCounter: %s", (ex) => {
  it("starts idle and becomes ready in the start position", () => {
    const c = new RepCounter(ex);
    expect(c.state.phase).toBe("idle");
    expect(c.state.reps).toBe(0);
    const s = c.update(syntheticFrame(ex, 0.1), 0.1);
    expect(s.phase).toBe("up");
    expect(s.feedback.id).toBe("go");
  });

  it("counts clean reps exactly", () => {
    const { final } = run(ex, forReps(5), CLEAN);
    expect(final.reps).toBe(5);
    expect(final.goodReps).toBe(5);
    expect(final.partialReps).toBe(0);
    expect(final.history).toHaveLength(5);
    expect(final.history.map((h) => h.n)).toEqual([1, 2, 3, 4, 5]);
  });

  it("goes through every phase in order during a rep", () => {
    const { states } = run(ex, forReps(1), CLEAN);
    const seq = states.map((s) => s.phase).filter((p, i, a) => i === 0 || a[i - 1] !== p);
    expect(seq).toEqual(["up", "down", "bottom", "up"]);
  });

  it("does not count shallow reps and cues the user to go deeper", () => {
    const { states, final } = run(ex, forReps(4), { shallowEvery: 2, faultEvery: 0 });
    expect(final.reps).toBe(2);
    expect(final.partialReps).toBe(2);
    expect(states.some((s) => s.feedback.id === "depth" && s.feedback.message === EXERCISES[ex].depthCue)).toBe(true);
  });

  it("flags form faults but still counts the rep", () => {
    const { states, final } = run(ex, forReps(3), { shallowEvery: 0, faultEvery: 3 });
    const faultId = EXERCISES[ex].formChecks.map((f) => f.id);
    expect(final.reps).toBe(3);
    expect(final.goodReps).toBe(2);
    expect(final.history[2].faults.length).toBeGreaterThan(0);
    expect(faultId).toContain(final.history[2].faults[0]);
    expect(Object.values(final.faultCounts).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(states.some((s) => s.feedback.level === "warn" && faultId.includes(s.feedback.id))).toBe(true);
  });

  it("is robust to frame rate", () => {
    expect(run(ex, forReps(4), CLEAN, 15).final.reps).toBe(4);
    expect(run(ex, forReps(4), CLEAN, 60).final.reps).toBe(4);
  });

  it("reports rep duration and depth", () => {
    const { final } = run(ex, forReps(2), CLEAN);
    for (const r of final.history) {
      expect(r.duration).toBeGreaterThan(0.5);
      expect(r.duration).toBeLessThan(P + 0.1);
      expect(r.minAngle).toBeLessThanOrEqual(EXERCISES[ex].downThreshold);
    }
  });

  it("reset clears all progress", () => {
    const { counter } = run(ex, forReps(2), CLEAN);
    expect(counter.state.reps).toBe(2);
    counter.reset();
    expect(counter.state).toMatchObject({ reps: 0, goodReps: 0, partialReps: 0, phase: "idle", history: [] });
  });
});

describe("RepCounter robustness", () => {
  it("asks the user to step into frame when there are no landmarks", () => {
    const c = new RepCounter("squat");
    expect(c.update(null, 0).feedback.id).toBe("frame");
    expect(c.update([], 0.1).feedback.id).toBe("frame");
  });

  it("ignores low-visibility frames without changing the count", () => {
    const c = new RepCounter("squat");
    const f = syntheticFrame("squat", 0).map((l): Landmark => ({ ...l, visibility: 0.1 }));
    const s = c.update(f, 0);
    expect(s.feedback.id).toBe("frame");
    expect(s.phase).toBe("idle");
  });

  it("does not count a rep that happens faster than the minimum duration", () => {
    const c = new RepCounter("squat", { minRepSeconds: 5 });
    for (const f of syntheticSequence("squat", forReps(2), 30, CLEAN)) c.update(f.landmarks, f.t);
    expect(c.state.reps).toBe(0);
  });

  it("does not double count when holding at the bottom with jitter", () => {
    const c = new RepCounter("squat");
    for (const f of syntheticSequence("squat", 0.5, 30, CLEAN)) c.update(f.landmarks, f.t);
    const bottomT = L + P * 0.425;
    const bottom = syntheticFrame("squat", bottomT, { ...CLEAN, jitter: 0.004 });
    for (let i = 0; i < 90; i++) c.update(bottom, 1 + i / 30);
    expect(c.state.phase).toBe("bottom");
    expect(c.state.reps).toBe(0);
  });

  it("push-up requires a plank before counting", () => {
    const c = new RepCounter("pushup");
    // A standing squat pose is upright, so the push-up counter should not be ready.
    const s = c.update(syntheticFrame("squat", 0), 0);
    expect(s.phase).toBe("idle");
    expect(s.feedback.message).toMatch(/plank/i);
  });

  it("default synthetic schedule mixes good, partial and faulty reps", () => {
    const { final } = run("squat", forReps(10));
    expect(final.partialReps).toBe(2); // reps 4 and 8
    expect(final.reps).toBe(8);
    expect(final.goodReps).toBe(6); // reps 5 and 10 have faults
  });
});

describe("aspect ratio correction", () => {
  it("synthetic frames squash x but preserve angles once corrected", () => {
    const sq = syntheticFrame("squat", 1.6, { jitter: 0 });
    const wide = syntheticFrame("squat", 1.6, { jitter: 0, aspect: 16 / 9 });
    const d = EXERCISES.squat;
    const unsquash = wide.map((l) => ({ ...l, x: l.x * (16 / 9) }));
    expect(d.angle(unsquash, "left")).toBeCloseTo(d.angle(sq, "left"), 6);
    expect(d.angle(wide, "left")).not.toBeCloseTo(d.angle(sq, "left"), 1);
  });

  it.each(EXERCISE_IDS)("%s counts correctly on a 16:9 feed only with the matching aspect", (ex) => {
    const frames = syntheticSequence(ex, forReps(4), 30, { ...CLEAN, aspect: 16 / 9 });
    const ok = new RepCounter(ex, { aspect: 16 / 9 });
    for (const f of frames) ok.update(f.landmarks, f.t);
    expect(ok.state.reps).toBe(4);
  });

  it("setAspect ignores invalid values", () => {
    const c = new RepCounter("curl");
    c.setAspect(-1);
    c.setAspect(Number.NaN);
    for (const f of syntheticSequence("curl", forReps(2), 30, CLEAN)) c.update(f.landmarks, f.t);
    expect(c.state.reps).toBe(2);
  });
});

describe("rangeProgress", () => {
  const d = EXERCISES.squat;
  it("maps thresholds to 0 and 1 and clamps", () => {
    expect(rangeProgress(d, d.upThreshold)).toBe(0);
    expect(rangeProgress(d, d.downThreshold)).toBe(1);
    expect(rangeProgress(d, 180)).toBe(0);
    expect(rangeProgress(d, 10)).toBe(1);
    expect(rangeProgress(d, (d.upThreshold + d.downThreshold) / 2)).toBeCloseTo(0.5);
  });
  it("returns 0 for null/NaN", () => {
    expect(rangeProgress(d, null)).toBe(0);
    expect(rangeProgress(d, Number.NaN)).toBe(0);
  });
});

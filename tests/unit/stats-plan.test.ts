import { describe, expect, it } from "vitest";
import { generateDemoPlan, isWeeklyPlanShape, parsePlanRequest, trainingDays } from "@/lib/plan";
import { computeStreaks, computeTotals, dailyReps, dayKey, formatDuration, visibleHistory, type WorkoutSession } from "@/lib/stats";

const NOW = new Date("2026-11-21T15:00:00");
const daysAgo = (n: number, hour = 9) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const sess = (startedAt: string, over: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: startedAt,
  exercise: "squat",
  startedAt,
  durationSec: 60,
  reps: 10,
  goodReps: 8,
  partialReps: 1,
  kcal: 3.2,
  source: "demo",
  faultCounts: {},
  ...over,
});

describe("computeStreaks", () => {
  it("is zero with no sessions", () => {
    expect(computeStreaks([], NOW)).toEqual({ current: 0, longest: 0, activeToday: false });
  });
  it("counts consecutive days ending today", () => {
    const s = [sess(daysAgo(0)), sess(daysAgo(1)), sess(daysAgo(2)), sess(daysAgo(4))];
    expect(computeStreaks(s, NOW)).toEqual({ current: 3, longest: 3, activeToday: true });
  });
  it("keeps the streak alive if the last session was yesterday", () => {
    const s = [sess(daysAgo(1)), sess(daysAgo(2))];
    expect(computeStreaks(s, NOW)).toMatchObject({ current: 2, activeToday: false });
  });
  it("breaks the streak after a missed day", () => {
    const s = [sess(daysAgo(2)), sess(daysAgo(3))];
    expect(computeStreaks(s, NOW).current).toBe(0);
    expect(computeStreaks(s, NOW).longest).toBe(2);
  });
  it("counts multiple sessions on one day once and finds the longest run", () => {
    const s = [sess(daysAgo(0, 8)), sess(daysAgo(0, 20)), sess(daysAgo(10)), sess(daysAgo(11)), sess(daysAgo(12)), sess(daysAgo(13))];
    expect(computeStreaks(s, NOW)).toEqual({ current: 1, longest: 4, activeToday: true });
  });
});

describe("computeTotals / dailyReps / history", () => {
  const s = [sess(daysAgo(0)), sess(daysAgo(0), { exercise: "pushup", reps: 5, goodReps: 5, durationSec: 30 }), sess(daysAgo(9))];
  it("sums totals and form score", () => {
    const t = computeTotals(s);
    expect(t.sessions).toBe(3);
    expect(t.reps).toBe(25);
    expect(t.goodReps).toBe(21);
    expect(t.formScore).toBe(84);
    expect(t.minutes).toBe(2.5);
    expect(t.byExercise).toEqual({ squat: 20, pushup: 5, curl: 0 });
  });
  it("form score is 0 with no reps", () => {
    expect(computeTotals([]).formScore).toBe(0);
  });
  it("buckets reps per day oldest first", () => {
    const d = dailyReps(s, 7, NOW);
    expect(d).toHaveLength(7);
    expect(d[6].day).toBe(dayKey(NOW));
    expect(d[6].reps).toBe(15);
    expect(d.slice(0, 6).every((x) => x.reps === 0)).toBe(true);
  });
  it("free tier hides sessions older than 7 days, pro shows all, newest first", () => {
    expect(visibleHistory(s, false, NOW)).toHaveLength(2);
    const all = visibleHistory(s, true, NOW);
    expect(all).toHaveLength(3);
    expect(all[0].startedAt >= all[2].startedAt).toBe(true);
  });
  it("formats durations", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(65.9)).toBe("01:05");
    expect(formatDuration(-3)).toBe("00:00");
  });
});

describe("plan request parsing", () => {
  const good = { goal: "build-muscle", level: "beginner", daysPerWeek: 3, minutesPerSession: 30 };
  it("accepts a valid request and trims notes", () => {
    const r = parsePlanRequest({ ...good, notes: "x".repeat(900) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.notes).toHaveLength(500);
  });
  it.each([
    [null, "Body"],
    [{ ...good, goal: "fly" }, "goal"],
    [{ ...good, level: "god" }, "level"],
    [{ ...good, daysPerWeek: 0 }, "daysPerWeek"],
    [{ ...good, daysPerWeek: 2.5 }, "daysPerWeek"],
    [{ ...good, minutesPerSession: 500 }, "minutesPerSession"],
  ])("rejects %j", (body, field) => {
    const r = parsePlanRequest(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(field);
  });
});

describe("demo plan generator", () => {
  it.each([1, 2, 3, 4, 5, 6, 7])("schedules %i training days", (n) => {
    expect(trainingDays(n)).toHaveLength(n);
    const plan = generateDemoPlan({ goal: "general-fitness", level: "intermediate", daysPerWeek: n, minutesPerSession: 30 }, NOW);
    expect(plan.days).toHaveLength(7);
    expect(plan.days.filter((d) => !d.rest)).toHaveLength(n);
    expect(isWeeklyPlanShape(plan)).toBe(true);
    expect(plan.source).toBe("demo");
  });
  it("scales sets with level and tags trackable moves", () => {
    const base = { goal: "build-muscle" as const, daysPerWeek: 3, minutesPerSession: 45 };
    const b = generateDemoPlan({ ...base, level: "beginner" }, NOW);
    const a = generateDemoPlan({ ...base, level: "advanced" }, NOW);
    const firstB = b.days.find((d) => !d.rest)!.exercises[0];
    const firstA = a.days.find((d) => !d.rest)!.exercises[0];
    expect(firstA.sets).toBe(firstB.sets + 2);
    expect(b.days.flatMap((d) => d.exercises).some((e) => e.trackable)).toBe(true);
  });
  it("isWeeklyPlanShape rejects malformed plans", () => {
    expect(isWeeklyPlanShape(null)).toBe(false);
    expect(isWeeklyPlanShape({ title: "x", summary: "y", days: [], tips: [] })).toBe(false);
    const p = generateDemoPlan({ goal: "endurance", level: "beginner", daysPerWeek: 3, minutesPerSession: 20 }, NOW);
    const broken = { ...p, days: p.days.map((d, i) => (i === 0 ? { ...d, rest: "no" } : d)) };
    expect(isWeeklyPlanShape(broken)).toBe(false);
  });
});

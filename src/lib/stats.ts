import type { ExerciseId } from "./pose/exercises";

export interface WorkoutSession {
  id: string;
  exercise: ExerciseId;
  /** ISO timestamp of when the session started. */
  startedAt: string;
  durationSec: number;
  reps: number;
  goodReps: number;
  partialReps: number;
  kcal: number;
  source: "camera" | "demo";
  faultCounts: Record<string, number>;
}

/** Local calendar day key (YYYY-MM-DD) for a date. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export interface Streaks {
  /** Consecutive active days ending today (or yesterday, if today has no session yet). */
  current: number;
  longest: number;
  activeToday: boolean;
}

export function computeStreaks(sessions: readonly Pick<WorkoutSession, "startedAt">[], now = new Date()): Streaks {
  const days = new Set(sessions.map((s) => dayKey(new Date(s.startedAt))));
  if (days.size === 0) return { current: 0, longest: 0, activeToday: false };

  const activeToday = days.has(dayKey(now));
  let cursor = activeToday ? now : addDays(now, -1);
  let current = 0;
  while (days.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...days].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T12:00:00`);
    const cur = new Date(`${sorted[i]}T12:00:00`);
    if (dayKey(addDays(prev, 1)) === dayKey(cur)) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  return { current, longest: Math.max(longest, current), activeToday };
}

export interface Totals {
  sessions: number;
  reps: number;
  goodReps: number;
  minutes: number;
  kcal: number;
  /** 0..100, share of counted reps with no form faults. */
  formScore: number;
  byExercise: Record<ExerciseId, number>;
}

export function computeTotals(sessions: readonly WorkoutSession[]): Totals {
  const byExercise: Record<ExerciseId, number> = { squat: 0, pushup: 0, curl: 0 };
  let reps = 0;
  let good = 0;
  let sec = 0;
  let kcal = 0;
  for (const s of sessions) {
    reps += s.reps;
    good += s.goodReps;
    sec += s.durationSec;
    kcal += s.kcal;
    byExercise[s.exercise] = (byExercise[s.exercise] ?? 0) + s.reps;
  }
  return {
    sessions: sessions.length,
    reps,
    goodReps: good,
    minutes: Math.round(sec / 6) / 10,
    kcal: Math.round(kcal * 10) / 10,
    formScore: reps === 0 ? 0 : Math.round((good / reps) * 100),
    byExercise,
  };
}

/** Reps per day for the last `n` days (oldest first), for the activity chart. */
export function dailyReps(sessions: readonly WorkoutSession[], n = 7, now = new Date()): Array<{ day: string; label: string; reps: number }> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    const k = dayKey(new Date(s.startedAt));
    map.set(k, (map.get(k) ?? 0) + s.reps);
  }
  const out: Array<{ day: string; label: string; reps: number }> = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = addDays(now, -i);
    const k = dayKey(d);
    out.push({ day: k, label: d.toLocaleDateString("en-US", { weekday: "short" }), reps: map.get(k) ?? 0 });
  }
  return out;
}

/** Free tier keeps 7 days of history; Pro keeps everything. */
export function visibleHistory(sessions: readonly WorkoutSession[], pro: boolean, now = new Date()): WorkoutSession[] {
  const sorted = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (pro) return sorted;
  const cutoff = addDays(now, -7).getTime();
  return sorted.filter((s) => new Date(s.startedAt).getTime() >= cutoff);
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

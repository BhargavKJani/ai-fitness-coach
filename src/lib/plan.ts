export type Goal = "lose-weight" | "build-muscle" | "endurance" | "general-fitness";
export type Level = "beginner" | "intermediate" | "advanced";

export interface PlanRequest {
  goal: Goal;
  level: Level;
  daysPerWeek: number;
  minutesPerSession: number;
  notes?: string;
}

export interface PlanExercise {
  name: string;
  sets: number;
  reps: string;
  /** Matches an exercise the camera can track, when applicable. */
  trackable?: "squat" | "pushup" | "curl";
}

export interface PlanDay {
  day: string;
  focus: string;
  rest: boolean;
  exercises: PlanExercise[];
}

export interface WeeklyPlan {
  title: string;
  summary: string;
  days: PlanDay[];
  tips: string[];
  source: "claude" | "demo";
  createdAt: string;
}

export const GOALS: Record<Goal, string> = {
  "lose-weight": "Lose weight",
  "build-muscle": "Build muscle",
  endurance: "Improve endurance",
  "general-fitness": "General fitness",
};

export const LEVELS: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validate and normalise an untrusted plan request body. */
export function parsePlanRequest(body: unknown): ParseResult<PlanRequest> {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;
  if (typeof b.goal !== "string" || !(b.goal in GOALS)) return { ok: false, error: "Invalid goal" };
  if (typeof b.level !== "string" || !(b.level in LEVELS)) return { ok: false, error: "Invalid level" };
  const days = Number(b.daysPerWeek);
  if (!Number.isInteger(days) || days < 1 || days > 7) return { ok: false, error: "daysPerWeek must be 1–7" };
  const mins = Number(b.minutesPerSession);
  if (!Number.isFinite(mins) || mins < 10 || mins > 120) return { ok: false, error: "minutesPerSession must be 10–120" };
  const notes = typeof b.notes === "string" ? b.notes.slice(0, 500) : undefined;
  return {
    ok: true,
    value: { goal: b.goal as Goal, level: b.level as Level, daysPerWeek: days, minutesPerSession: Math.round(mins), notes },
  };
}

/** Which weekdays to train for a given frequency (spread out for recovery). */
export function trainingDays(daysPerWeek: number): number[] {
  const patterns: Record<number, number[]> = {
    1: [2],
    2: [1, 4],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return patterns[Math.min(7, Math.max(1, Math.round(daysPerWeek)))];
}

const LIBRARY: Record<Goal, Array<{ focus: string; exercises: PlanExercise[] }>> = {
  "build-muscle": [
    { focus: "Lower body strength", exercises: [{ name: "Squats", sets: 4, reps: "10–12", trackable: "squat" }, { name: "Reverse lunges", sets: 3, reps: "10/leg" }, { name: "Glute bridges", sets: 3, reps: "15" }] },
    { focus: "Push day", exercises: [{ name: "Push-ups", sets: 4, reps: "8–15", trackable: "pushup" }, { name: "Pike push-ups", sets: 3, reps: "8" }, { name: "Bench dips", sets: 3, reps: "12" }] },
    { focus: "Pull & arms", exercises: [{ name: "Bicep curls", sets: 4, reps: "10–12", trackable: "curl" }, { name: "Bent-over rows", sets: 4, reps: "10" }, { name: "Hammer curls", sets: 3, reps: "12" }] },
  ],
  "lose-weight": [
    { focus: "Full-body circuit", exercises: [{ name: "Squats", sets: 3, reps: "20", trackable: "squat" }, { name: "Push-ups", sets: 3, reps: "10", trackable: "pushup" }, { name: "Mountain climbers", sets: 3, reps: "30s" }] },
    { focus: "HIIT cardio", exercises: [{ name: "Jumping jacks", sets: 4, reps: "40s" }, { name: "Squats", sets: 4, reps: "15", trackable: "squat" }, { name: "High knees", sets: 4, reps: "30s" }] },
    { focus: "Metabolic strength", exercises: [{ name: "Bicep curls", sets: 3, reps: "15", trackable: "curl" }, { name: "Push-ups", sets: 3, reps: "12", trackable: "pushup" }, { name: "Plank", sets: 3, reps: "45s" }] },
  ],
  endurance: [
    { focus: "High-rep legs", exercises: [{ name: "Squats", sets: 5, reps: "25", trackable: "squat" }, { name: "Wall sit", sets: 3, reps: "60s" }] },
    { focus: "Upper-body endurance", exercises: [{ name: "Push-ups", sets: 5, reps: "AMRAP", trackable: "pushup" }, { name: "Bicep curls", sets: 4, reps: "20", trackable: "curl" }] },
    { focus: "Steady cardio", exercises: [{ name: "Brisk walk or jog", sets: 1, reps: "30 min" }, { name: "Plank", sets: 3, reps: "60s" }] },
  ],
  "general-fitness": [
    { focus: "Full body A", exercises: [{ name: "Squats", sets: 3, reps: "12", trackable: "squat" }, { name: "Push-ups", sets: 3, reps: "10", trackable: "pushup" }, { name: "Plank", sets: 3, reps: "30s" }] },
    { focus: "Mobility & core", exercises: [{ name: "Cat-cow", sets: 2, reps: "10" }, { name: "Dead bugs", sets: 3, reps: "12" }, { name: "Hip openers", sets: 2, reps: "60s" }] },
    { focus: "Full body B", exercises: [{ name: "Bicep curls", sets: 3, reps: "12", trackable: "curl" }, { name: "Squats", sets: 3, reps: "15", trackable: "squat" }, { name: "Side plank", sets: 2, reps: "30s/side" }] },
  ],
};

const LEVEL_SET_DELTA: Record<Level, number> = { beginner: -1, intermediate: 0, advanced: 1 };

/** Deterministic, rule-based plan used in demo mode (no API key) or as a fallback. */
export function generateDemoPlan(req: PlanRequest, now = new Date()): WeeklyPlan {
  const train = new Set(trainingDays(req.daysPerWeek));
  const blocks = LIBRARY[req.goal];
  let k = 0;
  const days: PlanDay[] = WEEKDAYS.map((day, i) => {
    if (!train.has(i)) return { day, focus: "Rest & recovery", rest: true, exercises: [] };
    const block = blocks[k++ % blocks.length];
    return {
      day,
      focus: block.focus,
      rest: false,
      exercises: block.exercises.map((e) => ({ ...e, sets: Math.max(1, e.sets + LEVEL_SET_DELTA[req.level]) })),
    };
  });
  return {
    title: `${GOALS[req.goal]} · ${req.daysPerWeek}-day plan`,
    summary: `A ${LEVELS[req.level].toLowerCase()} ${req.daysPerWeek}-day week of ~${req.minutesPerSession}-minute sessions focused on ${GOALS[req.goal].toLowerCase()}. Camera-trackable moves are tagged so you can log them with live rep counting.`,
    days,
    tips: [
      "Warm up for 5 minutes before every session.",
      req.goal === "lose-weight" ? "Pair training with a modest calorie deficit and 8k+ daily steps." : "Eat ~1.6 g protein per kg of body weight to support recovery.",
      "Stop any exercise that causes sharp pain and consult a professional.",
    ],
    source: "demo",
    createdAt: now.toISOString(),
  };
}

/** Validate a plan object (e.g. parsed from model output). */
export function isWeeklyPlanShape(x: unknown): x is Omit<WeeklyPlan, "source" | "createdAt"> {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  if (typeof p.title !== "string" || typeof p.summary !== "string") return false;
  if (!Array.isArray(p.days) || p.days.length !== 7 || !Array.isArray(p.tips)) return false;
  return p.days.every((d) => {
    if (!d || typeof d !== "object") return false;
    const day = d as Record<string, unknown>;
    return (
      typeof day.day === "string" &&
      typeof day.focus === "string" &&
      typeof day.rest === "boolean" &&
      Array.isArray(day.exercises) &&
      day.exercises.every(
        (e) =>
          !!e &&
          typeof e === "object" &&
          typeof (e as PlanExercise).name === "string" &&
          typeof (e as PlanExercise).sets === "number" &&
          typeof (e as PlanExercise).reps === "string",
      )
    );
  });
}

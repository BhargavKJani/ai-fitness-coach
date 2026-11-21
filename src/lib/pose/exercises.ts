import { angleFromVertical, jointAngle, pickSide, sideIndex, type Joint, type Side } from "./angles";
import type { Landmark } from "./landmarks";

export type ExerciseId = "squat" | "pushup" | "curl";

export interface FormCheck {
  id: string;
  message: string;
  /** Returns true when the form fault is present in this frame. */
  test: (lms: readonly Landmark[], side: Side) => boolean;
}

export interface ExerciseDef {
  id: ExerciseId;
  name: string;
  emoji: string;
  description: string;
  /** Joints whose visibility decides which side to track. */
  joints: readonly Joint[];
  /** Primary joint angle driving the rep state machine. */
  angle: (lms: readonly Landmark[], side: Side) => number;
  /** Angle above which the joint counts as extended (start / finish of a rep). */
  upThreshold: number;
  /** Angle below which the joint counts as fully flexed (bottom of a rep). */
  downThreshold: number;
  /** Cue shown when a rep is started but does not reach full range. */
  depthCue: string;
  /** Optional check that the user is in a valid start posture. */
  readyCheck?: { message: string; test: (lms: readonly Landmark[], side: Side) => boolean };
  formChecks: readonly FormCheck[];
  /** Short coaching tips shown in the UI. */
  tips: readonly string[];
  /** Approximate kcal burned per rep for a 70 kg adult (rough MET-derived estimate). */
  kcalPerRep: number;
}

const p = (lms: readonly Landmark[], side: Side, j: Joint) => lms[sideIndex(side, j)];

export const EXERCISES: Record<ExerciseId, ExerciseDef> = {
  squat: {
    id: "squat",
    name: "Squat",
    emoji: "🦵",
    description: "Side-on to the camera. Knee angle drives the count.",
    joints: ["hip", "knee", "ankle", "shoulder"],
    angle: (l, s) => jointAngle(p(l, s, "hip"), p(l, s, "knee"), p(l, s, "ankle")),
    upThreshold: 160,
    downThreshold: 100,
    depthCue: "Go lower — hips to knee height",
    formChecks: [
      {
        id: "chest-up",
        message: "Keep your chest up",
        test: (l, s) => angleFromVertical(p(l, s, "hip"), p(l, s, "shoulder")) > 50,
      },
    ],
    tips: ["Feet shoulder-width apart", "Push knees out over toes", "Drive up through your heels"],
    kcalPerRep: 0.32,
  },
  pushup: {
    id: "pushup",
    name: "Push-up",
    emoji: "💪",
    description: "Side-on, full body in frame. Elbow angle drives the count.",
    joints: ["shoulder", "elbow", "wrist", "hip", "ankle"],
    angle: (l, s) => jointAngle(p(l, s, "shoulder"), p(l, s, "elbow"), p(l, s, "wrist")),
    upThreshold: 155,
    downThreshold: 95,
    depthCue: "Go lower — chest toward the floor",
    readyCheck: {
      message: "Get into a plank position",
      // Not ready while the torso is still close to upright.
      test: (l, s) => angleFromVertical(p(l, s, "hip"), p(l, s, "shoulder")) < 50,
    },
    formChecks: [
      {
        id: "straight-back",
        message: "Keep your back straight",
        test: (l, s) => jointAngle(p(l, s, "shoulder"), p(l, s, "hip"), p(l, s, "ankle")) < 155,
      },
    ],
    tips: ["Hands under shoulders", "Brace your core", "Elbows ~45° from your body"],
    kcalPerRep: 0.45,
  },
  curl: {
    id: "curl",
    name: "Bicep Curl",
    emoji: "🏋️",
    description: "Side-on or front-facing. Elbow angle drives the count.",
    joints: ["shoulder", "elbow", "wrist", "hip"],
    angle: (l, s) => jointAngle(p(l, s, "shoulder"), p(l, s, "elbow"), p(l, s, "wrist")),
    upThreshold: 150,
    downThreshold: 55,
    depthCue: "Curl all the way up",
    formChecks: [
      {
        id: "elbow-tucked",
        message: "Keep your elbow tucked",
        test: (l, s) => jointAngle(p(l, s, "hip"), p(l, s, "shoulder"), p(l, s, "elbow")) > 35,
      },
      {
        id: "no-swing",
        message: "Don't swing your body",
        test: (l, s) => angleFromVertical(p(l, s, "hip"), p(l, s, "shoulder")) > 18,
      },
    ],
    tips: ["Pin elbows to your sides", "Control the lowering phase", "Squeeze at the top"],
    kcalPerRep: 0.18,
  },
};

export const EXERCISE_IDS = Object.keys(EXERCISES) as ExerciseId[];

export function isExerciseId(x: unknown): x is ExerciseId {
  return typeof x === "string" && x in EXERCISES;
}

export { pickSide };

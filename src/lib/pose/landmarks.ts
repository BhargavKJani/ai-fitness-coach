/** A single pose landmark in normalized image coordinates (0..1), as produced by MediaPipe. */
export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/** MediaPipe Pose Landmarker indices (33-point BlazePose topology). */
export const LM = {
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT: 31,
  RIGHT_FOOT: 32,
} as const;

export const LANDMARK_COUNT = 33;

/** Skeleton edges used for the overlay. */
export const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.LEFT_ANKLE, LM.LEFT_HEEL],
  [LM.LEFT_HEEL, LM.LEFT_FOOT],
  [LM.LEFT_ANKLE, LM.LEFT_FOOT],
  [LM.RIGHT_ANKLE, LM.RIGHT_HEEL],
  [LM.RIGHT_HEEL, LM.RIGHT_FOOT],
  [LM.RIGHT_ANKLE, LM.RIGHT_FOOT],
  [LM.NOSE, LM.LEFT_EYE],
  [LM.NOSE, LM.RIGHT_EYE],
  [LM.LEFT_EYE, LM.LEFT_EAR],
  [LM.RIGHT_EYE, LM.RIGHT_EAR],
];

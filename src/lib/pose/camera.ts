"use client";

import type { Landmark } from "./landmarks";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export interface PoseTracker {
  detect(video: HTMLVideoElement, timestampMs: number): Landmark[] | null;
  close(): void;
}

/** Load MediaPipe Pose Landmarker (lazy, client-only). Tries GPU first, then CPU. */
export async function createPoseTracker(): Promise<PoseTracker> {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
  const make = (delegate: "GPU" | "CPU") =>
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  let landmarker;
  try {
    landmarker = await make("GPU");
  } catch {
    landmarker = await make("CPU");
  }
  let lastTs = -1;
  return {
    detect(video, ts) {
      if (video.readyState < 2) return null;
      const t = Math.max(ts, lastTs + 1); // timestamps must strictly increase
      lastTs = t;
      const res = landmarker.detectForVideo(video, t);
      return (res.landmarks?.[0] as Landmark[] | undefined) ?? null;
    },
    close() {
      landmarker.close();
    },
  };
}

export async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera API not available in this browser");
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return stream;
}

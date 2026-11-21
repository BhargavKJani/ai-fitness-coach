"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPoseTracker, openCamera, type PoseTracker } from "@/lib/pose/camera";
import { drawDemoBackdrop, drawSkeleton } from "@/lib/pose/draw";
import { EXERCISES, EXERCISE_IDS, isExerciseId, type ExerciseId } from "@/lib/pose/exercises";
import { RepCounter, rangeProgress, type Feedback, type Phase } from "@/lib/pose/repCounter";
import { syntheticFrame } from "@/lib/pose/synthetic";
import { formatDuration, type WorkoutSession } from "@/lib/stats";
import { newId, store } from "@/lib/storage";
import { usePro } from "@/lib/useStore";

type Source = "camera" | "demo";
type Stage = "setup" | "loading" | "running" | "summary";

interface Hud {
  reps: number;
  goodReps: number;
  partialReps: number;
  angle: number | null;
  phase: Phase;
  feedback: Feedback;
  elapsed: number;
}

const noop = () => () => {};
const getSearch = () => window.location.search;
function useQuery(): URLSearchParams {
  return new URLSearchParams(useSyncExternalStore(noop, getSearch, () => ""));
}

const ANGLE_JOINT = { squat: "knee", pushup: "elbow", curl: "elbow" } as const;
const DEMO_ASPECT = 4 / 3;

export function WorkoutStudio() {
  const query = useQuery();
  const pro = usePro();
  const [exerciseChoice, setExercise] = useState<ExerciseId | null>(null);
  const [sourceChoice, setSource] = useState<Source | null>(null);
  const exercise: ExerciseId = exerciseChoice ?? (isExerciseId(query.get("exercise")) ? (query.get("exercise") as ExerciseId) : "squat");
  const source: Source = sourceChoice ?? (query.get("demo") === "1" ? "demo" : "camera");
  const speed = Math.min(4, Math.max(0.25, Number(query.get("speed")) || 1));

  const [stage, setStage] = useState<Stage>("setup");
  const [activeSource, setActiveSource] = useState<Source>("demo");
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [aspect, setAspect] = useState(4 / 3);
  const [hud, setHud] = useState<Hud | null>(null);
  const [summary, setSummary] = useState<WorkoutSession | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const counterRef = useRef<RepCounter | null>(null);
  const trackerRef = useRef<PoseTracker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const clock = useRef({ active: 0, last: 0, paused: false, hudAt: 0, startedAt: "" });

  const def = EXERCISES[exercise];

  const stopMedia = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackerRef.current?.close();
    trackerRef.current = null;
  }, []);

  useEffect(() => stopMedia, [stopMedia]);

  const loop = useCallback(
    (src: Source, ex: ExerciseId) => {
      const frame = (now: number) => {
        const c = clock.current;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        const counter = counterRef.current;
        if (!canvas || !ctx || !counter) return;
        const dt = c.last ? (now - c.last) / 1000 : 0;
        c.last = now;
        if (!c.paused) c.active += dt * (src === "demo" ? speed : 1);

        let lms = null;
        if (src === "demo") {
          lms = syntheticFrame(ex, c.active, { aspect: DEMO_ASPECT });
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const w = Math.round(canvas.clientWidth * dpr);
          const h = Math.round(canvas.clientHeight * dpr);
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          drawDemoBackdrop(ctx, c.active);
        } else {
          const video = videoRef.current;
          if (video && trackerRef.current) {
            if (video.videoWidth && canvas.width !== video.videoWidth) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            lms = trackerRef.current.detect(video, now);
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        const s = c.paused ? counter.state : counter.update(lms, c.active);
        if (lms) {
          drawSkeleton(ctx, lms, {
            mirror: src === "camera",
            highlight: { side: s.side, joints: EXERCISES[ex].joints },
            warn: s.feedback.level === "warn",
            angle: s.angle,
            angleJoint: ANGLE_JOINT[ex],
          });
        }
        if (now - c.hudAt > 80) {
          c.hudAt = now;
          setHud({
            reps: s.reps,
            goodReps: s.goodReps,
            partialReps: s.partialReps,
            angle: s.angle,
            phase: s.phase,
            feedback: s.feedback,
            elapsed: c.active,
          });
        }
        rafRef.current = requestAnimationFrame(frame);
      };
      rafRef.current = requestAnimationFrame(frame);
    },
    [speed],
  );

  async function start() {
    setNotice(null);
    setSummary(null);
    setStage("loading");
    counterRef.current = new RepCounter(exercise);
    clock.current = { active: 0, last: 0, paused: false, hudAt: 0, startedAt: new Date().toISOString() };
    setPaused(false);
    let src: Source = source;
    if (src === "camera") {
      try {
        const video = videoRef.current!;
        const [stream, tracker] = await Promise.all([openCamera(video), createPoseTracker()]);
        streamRef.current = stream;
        trackerRef.current = tracker;
        if (video.videoWidth) {
          setAspect(video.videoWidth / video.videoHeight);
          counterRef.current.setAspect(video.videoWidth / video.videoHeight);
        }
      } catch (e) {
        stopMedia();
        src = "demo";
        setNotice(
          `Camera unavailable (${e instanceof Error ? e.message : "permission denied"}). Running demo mode with a synthetic athlete instead.`,
        );
      }
    }
    if (src === "demo") {
      setAspect(DEMO_ASPECT);
      counterRef.current.setAspect(DEMO_ASPECT);
    }
    setActiveSource(src);
    setStage("running");
    loop(src, exercise);
  }

  function togglePause() {
    clock.current.paused = !clock.current.paused;
    setPaused(clock.current.paused);
  }

  function reset() {
    counterRef.current?.reset();
    clock.current.active = 0;
  }

  function finish() {
    stopMedia();
    const s = counterRef.current?.state;
    const c = clock.current;
    const session: WorkoutSession = {
      id: newId(),
      exercise,
      startedAt: c.startedAt,
      durationSec: Math.round(c.active),
      reps: s?.reps ?? 0,
      goodReps: s?.goodReps ?? 0,
      partialReps: s?.partialReps ?? 0,
      kcal: Math.round((s?.reps ?? 0) * def.kcalPerRep * 10) / 10,
      source: activeSource,
      faultCounts: s?.faultCounts ?? {},
    };
    if (session.reps > 0 || session.durationSec >= 5) store.addSession(session);
    setSummary(session);
    setStage("summary");
  }

  const running = stage === "running" || stage === "loading";
  const progress = rangeProgress(def, hud?.angle ?? null);
  const fb = hud?.feedback;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Workout <span className="neon-text">Studio</span>
          </h1>
          <p className="mt-1 text-slate-400">Real-time rep counting & form coaching.</p>
        </div>
        {running && (
          <span className="chip" data-testid="mode-chip">
            {activeSource === "camera" ? "📷 Camera" : "🧪 Demo mode"} · {def.name}
          </span>
        )}
      </div>

      {notice && (
        <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="status">
          {notice}
        </div>
      )}

      {stage === "setup" && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="glass p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">1 · Choose exercise</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {EXERCISE_IDS.map((id) => {
                const e = EXERCISES[id];
                const active = id === exercise;
                return (
                  <button
                    key={id}
                    data-testid={`exercise-${id}`}
                    aria-pressed={active}
                    onClick={() => setExercise(id)}
                    className={`rounded-2xl border p-5 text-left transition ${
                      active
                        ? "border-cyan-300/60 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.2)]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    }`}
                  >
                    <div className="text-3xl">{e.emoji}</div>
                    <div className="mt-3 font-semibold text-white">{e.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{e.description}</div>
                  </button>
                );
              })}
            </div>

            <h2 className="mt-8 text-sm font-semibold uppercase tracking-widest text-slate-400">2 · Input</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["camera", "📷 Webcam", "MediaPipe pose tracking, on-device"],
                  ["demo", "🧪 Demo mode", "Synthetic athlete — no camera needed"],
                ] as const
              ).map(([id, label, sub]) => (
                <button
                  key={id}
                  data-testid={`source-${id}`}
                  aria-pressed={source === id}
                  onClick={() => setSource(id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    source === id ? "border-fuchsia-300/60 bg-fuchsia-400/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  }`}
                >
                  <div className="font-semibold text-white">{label}</div>
                  <div className="text-xs text-slate-400">{sub}</div>
                </button>
              ))}
            </div>

            <button className="btn-primary mt-8 w-full !py-3.5 text-base" onClick={start} data-testid="start-btn">
              Start {def.name.toLowerCase()} session →
            </button>
          </div>

          <aside className="glass p-6">
            <h3 className="font-semibold">Form tips · {def.name}</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {def.tips.map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="text-cyan-300">◆</span> {t}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-400">
              <p className="font-medium text-slate-300">Camera setup</p>
              <p className="mt-1">
                Place your device ~2–3 m away at hip height, side-on, with your whole body in frame and good lighting.
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* Stage stays mounted during setup so the <video> ref exists when starting. */}
      <div className={stage === "running" || stage === "loading" ? "mt-8 grid gap-6 lg:grid-cols-[1fr_300px]" : "hidden"}>
        <div className="glass-strong relative w-full overflow-hidden" style={{ aspectRatio: aspect }}>
          <video
            ref={videoRef}
            className={`absolute inset-0 h-full w-full -scale-x-100 object-cover ${activeSource === "camera" ? "" : "hidden"}`}
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" data-testid="pose-canvas" />
          {stage === "loading" && (
            <div className="absolute inset-0 grid place-items-center bg-slate-950/70 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                Loading pose model…
              </div>
            </div>
          )}
          {fb && (
            <div
              data-testid="feedback"
              data-level={fb.level}
              className={`absolute bottom-4 left-1/2 max-w-[90%] -translate-x-1/2 rounded-full border px-5 py-2 text-center text-sm font-semibold backdrop-blur transition ${
                fb.level === "warn"
                  ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                  : fb.level === "good"
                    ? "border-lime-300/50 bg-lime-400/15 text-lime-100"
                    : "border-cyan-300/30 bg-cyan-400/10 text-cyan-50"
              }`}
            >
              {fb.message}
            </div>
          )}
          {paused && (
            <div className="absolute inset-0 grid place-items-center bg-slate-950/60 text-2xl font-bold tracking-widest">PAUSED</div>
          )}
        </div>

        <div className="space-y-4">
          <div className="glass p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-400">Reps</div>
                <div key={hud?.reps} className="animate-pop font-mono text-6xl font-black text-cyan-300" data-testid="rep-count">
                  {hud?.reps ?? 0}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-widest text-slate-400">Time</div>
                <div className="font-mono text-2xl font-bold" data-testid="timer">
                  {formatDuration(hud?.elapsed ?? 0)}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <Stat label="Clean" value={hud?.goodReps ?? 0} tone="text-lime-300" />
              <Stat label="Partial" value={hud?.partialReps ?? 0} tone="text-amber-300" />
              <Stat label="Angle" value={hud?.angle != null ? `${Math.round(hud.angle)}°` : "—"} tone="text-fuchsia-300" />
            </div>
          </div>

          <div className="glass p-5">
            <div className="flex justify-between text-xs uppercase tracking-widest text-slate-400">
              <span>Range of motion</span>
              <span data-testid="phase">{hud?.phase ?? "idle"}</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-lime-300 transition-[width] duration-100"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-slate-500">
              <span>{def.upThreshold}° top</span>
              <span>{def.downThreshold}° full depth</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button className="btn-ghost !px-2" onClick={togglePause} disabled={stage !== "running"}>
              {paused ? "Resume" : "Pause"}
            </button>
            <button className="btn-ghost !px-2" onClick={reset} disabled={stage !== "running"}>
              Reset
            </button>
            <button className="btn-primary !px-2" onClick={finish} disabled={stage !== "running"} data-testid="finish-btn">
              Finish
            </button>
          </div>
        </div>
      </div>

      {stage === "summary" && summary && (
        <SessionSummary session={summary} pro={pro} onAgain={() => setStage("setup")} />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 px-2 py-2.5">
      <div className={`font-mono text-lg font-bold ${tone}`}>{value}</div>
      <div className="text-slate-500">{label}</div>
    </div>
  );
}

function SessionSummary({ session, pro, onAgain }: { session: WorkoutSession; pro: boolean; onAgain: () => void }) {
  const def = EXERCISES[session.exercise];
  const score = session.reps ? Math.round((session.goodReps / session.reps) * 100) : 0;
  const faults = Object.entries(session.faultCounts);
  return (
    <div className="mt-8 animate-fade-up" data-testid="summary">
      <div className="glass-strong relative overflow-hidden p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <p className="chip">Session complete · {session.source === "demo" ? "demo" : "camera"}</p>
        <h2 className="mt-4 text-3xl font-black">
          {def.emoji} {session.reps} {def.name.toLowerCase()}s <span className="neon-text">crushed.</span>
        </h2>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Big label="Reps" value={session.reps} testId="summary-reps" />
          <Big label="Clean reps" value={session.goodReps} />
          <Big label="Form score" value={`${score}%`} />
          <Big label="Duration" value={formatDuration(session.durationSec)} />
          <Big label="Est. kcal" value={session.kcal} />
        </div>
        <div className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Form breakdown</h3>
          <div className={`mt-3 space-y-2 ${pro ? "" : "pointer-events-none select-none blur-sm"}`}>
            {faults.length === 0 && session.partialReps === 0 ? (
              <p className="text-sm text-lime-300">No form faults detected. Perfect session!</p>
            ) : (
              <>
                {session.partialReps > 0 && (
                  <FaultRow label={def.depthCue} count={session.partialReps} note="partial reps (not counted)" />
                )}
                {faults.map(([id, n]) => (
                  <FaultRow key={id} label={def.formChecks.find((f) => f.id === id)?.message ?? id} count={n} note="reps flagged" />
                ))}
              </>
            )}
          </div>
          {!pro && (
            <p className="mt-3 text-sm text-slate-400">
              🔒 Detailed form breakdown is a Pro feature.{" "}
              <Link href="/pricing" className="text-cyan-300 underline">
                Unlock Pro
              </Link>
            </p>
          )}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={onAgain} data-testid="again-btn">
            New session
          </button>
          <Link href="/dashboard" className="btn-ghost" data-testid="to-dashboard">
            View dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Big({ label, value, testId }: { label: string; value: string | number; testId?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="font-mono text-3xl font-black text-white" data-testid={testId}>
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}

function FaultRow({ label, count, note }: { label: string; count: number; note: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-amber-400/20 bg-amber-500/5 px-4 py-2.5 text-sm">
      <span className="text-amber-100">⚠ {label}</span>
      <span className="font-mono text-amber-300">
        {count} <span className="text-xs text-slate-500">{note}</span>
      </span>
    </div>
  );
}

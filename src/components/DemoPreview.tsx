"use client";

import { useEffect, useRef, useState } from "react";
import { drawDemoBackdrop, drawSkeleton } from "@/lib/pose/draw";
import { EXERCISES, type ExerciseId } from "@/lib/pose/exercises";
import { RepCounter } from "@/lib/pose/repCounter";
import { syntheticFrame } from "@/lib/pose/synthetic";

/** Self-running hero animation: synthetic athlete + the real rep counter. */
export function DemoPreview({ exercise = "squat" }: { exercise?: ExerciseId }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState({ reps: 0, msg: "", warn: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const counter = new RepCounter(exercise, { aspect: 4 / 3 });
    const def = EXERCISES[exercise];
    const t0 = performance.now();
    let raf = 0;
    let lastHud = "";
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth * dpr;
      const h = canvas.clientHeight * dpr;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const lms = syntheticFrame(exercise, t % 60, { aspect: 4 / 3 });
      if (t % 60 < 0.05) counter.reset();
      const s = counter.update(lms, t % 60);
      drawDemoBackdrop(ctx, t);
      drawSkeleton(ctx, lms, {
        highlight: { side: s.side, joints: def.joints },
        warn: s.feedback.level === "warn",
        angle: s.angle,
        angleJoint: exercise === "squat" ? "knee" : "elbow",
      });
      const key = `${s.reps}|${s.feedback.message}`;
      if (key !== lastHud) {
        lastHud = key;
        setHud({ reps: s.reps, msg: s.feedback.message, warn: s.feedback.level === "warn" });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [exercise]);

  return (
    <div className="glass-strong relative aspect-[4/3] w-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <span className="chip !border-red-400/30 !bg-red-500/10 !text-red-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> LIVE DEMO
        </span>
        <span className="chip">{EXERCISES[exercise].name}</span>
      </div>
      <div className="absolute right-4 top-4 text-right">
        <div className="text-xs uppercase tracking-widest text-slate-400">Reps</div>
        <div key={hud.reps} className="animate-pop font-mono text-4xl font-black text-cyan-300">
          {hud.reps}
        </div>
      </div>
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur ${
          hud.warn ? "border-amber-400/40 bg-amber-500/15 text-amber-200" : "border-cyan-300/30 bg-cyan-400/10 text-cyan-100"
        }`}
      >
        {hud.msg}
      </div>
    </div>
  );
}

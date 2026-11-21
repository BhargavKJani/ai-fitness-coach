"use client";

import Link from "next/link";
import { EXERCISES, EXERCISE_IDS } from "@/lib/pose/exercises";
import { computeStreaks, computeTotals, dailyReps, formatDuration, visibleHistory, type WorkoutSession } from "@/lib/stats";
import { newId, store } from "@/lib/storage";
import { useHydrated, usePro, useSessions } from "@/lib/useStore";

/** Seed a realistic two-week history so the dashboard can be explored instantly. */
function seedDemoHistory() {
  const now = new Date();
  const out: WorkoutSession[] = [];
  for (let d = 13; d >= 0; d--) {
    if ([10, 6].includes(d)) continue; // a couple of rest days
    const ex = EXERCISE_IDS[d % 3];
    const day = new Date(now);
    day.setDate(day.getDate() - d);
    day.setHours(7 + (d % 4) * 3, 15, 0, 0);
    const reps = 10 + ((d * 11) % 17);
    const good = reps - (d % 4);
    out.push({
      id: newId(),
      exercise: ex,
      startedAt: day.toISOString(),
      durationSec: 90 + reps * 4,
      reps,
      goodReps: good,
      partialReps: d % 3,
      kcal: Math.round(reps * EXERCISES[ex].kcalPerRep * 10) / 10,
      source: "demo",
      faultCounts: good < reps ? { [EXERCISES[ex].formChecks[0].id]: reps - good } : {},
    });
  }
  for (const s of out) store.addSession(s);
}

export function Dashboard() {
  const hydrated = useHydrated();
  // Stats depend on the current date and on localStorage, so render them on the client only.
  if (!hydrated) return <div className="glass h-96 animate-pulse" aria-busy="true" />;
  return <DashboardInner />;
}

function DashboardInner() {
  const hydrated = true;
  const sessions = useSessions();
  const pro = usePro();
  const totals = computeTotals(sessions);
  const streaks = computeStreaks(sessions);
  const week = dailyReps(sessions, 7);
  const maxDay = Math.max(1, ...week.map((d) => d.reps));
  const history = visibleHistory(sessions, pro);
  const hidden = sessions.length - history.length;
  const exMax = Math.max(1, ...Object.values(totals.byExercise));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Your <span className="neon-text">progress</span>
          </h1>
          <p className="mt-1 text-slate-400">Stats, streaks and history — stored privately in this browser.</p>
        </div>
        <div className="flex gap-2">
          {hydrated && sessions.length === 0 && (
            <button className="btn-ghost" onClick={seedDemoHistory} data-testid="seed-btn">
              Load sample data
            </button>
          )}
          {sessions.length > 0 && (
            <button
              className="btn-ghost"
              onClick={() => {
                if (confirm("Delete all workout history from this browser?")) store.clearSessions();
              }}
            >
              Clear
            </button>
          )}
          <Link href="/workout" className="btn-primary">
            New workout
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Current streak" value={`${streaks.current} 🔥`} sub={`Longest: ${streaks.longest} days`} testId="kpi-streak" />
        <Kpi label="Total reps" value={totals.reps} sub={`${totals.sessions} sessions`} testId="kpi-reps" />
        <Kpi label="Form score" value={`${totals.formScore}%`} sub={`${totals.goodReps} clean reps`} />
        <Kpi label="Active time" value={`${totals.minutes}m`} sub={`~${totals.kcal} kcal`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="glass p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Last 7 days</h2>
            <span className="text-xs text-slate-500">{streaks.activeToday ? "✓ Trained today" : "Not trained today yet"}</span>
          </div>
          <div className="mt-6 flex h-48 gap-3" role="img" aria-label="Reps per day over the last 7 days">
            {week.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                <span className="font-mono text-xs text-slate-400">{d.reps || ""}</span>
                <div className="relative w-full flex-1">
                  <div
                    className="absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-violet-500/60 via-fuchsia-400/70 to-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.25)] transition-all duration-700"
                    style={{ height: `${(d.reps / maxDay) * 100}%`, minHeight: d.reps ? 6 : 2, opacity: d.reps ? 1 : 0.25 }}
                  />
                </div>
                <span className="text-xs text-slate-500">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-6">
          <h2 className="font-semibold">By exercise</h2>
          <div className="mt-5 space-y-4">
            {EXERCISE_IDS.map((id) => (
              <div key={id}>
                <div className="flex justify-between text-sm">
                  <span>
                    {EXERCISES[id].emoji} {EXERCISES[id].name}
                  </span>
                  <span className="font-mono text-slate-400">{totals.byExercise[id]}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400"
                    style={{ width: `${(totals.byExercise[id] / exMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass mt-6 overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-3">
          <h2 className="font-semibold">History</h2>
          <span className="chip">{pro ? "Pro · unlimited history" : "Free · last 7 days"}</span>
        </div>
        {history.length === 0 ? (
          <p className="px-6 pb-8 text-sm text-slate-400" data-testid="history-empty">
            No workouts yet. <Link href="/workout" className="text-cyan-300 underline">Start your first session</Link> or load sample data.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm" data-testid="history-table">
              <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Exercise</th>
                  <th className="px-3 py-3 font-medium">Reps</th>
                  <th className="px-3 py-3 font-medium">Form</th>
                  <th className="px-3 py-3 font-medium">Time</th>
                  <th className="px-6 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => (
                  <tr key={s.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="px-6 py-3 text-slate-300">
                      {new Date(s.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-3">
                      {EXERCISES[s.exercise].emoji} {EXERCISES[s.exercise].name}
                    </td>
                    <td className="px-3 py-3 font-mono">{s.reps}</td>
                    <td className="px-3 py-3 font-mono">{s.reps ? Math.round((s.goodReps / s.reps) * 100) : 0}%</td>
                    <td className="px-3 py-3 font-mono">{formatDuration(s.durationSec)}</td>
                    <td className="px-6 py-3 text-slate-400">{s.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hidden > 0 && (
          <p className="border-t border-white/5 px-6 py-4 text-sm text-slate-400">
            🔒 {hidden} older session{hidden > 1 ? "s" : ""} hidden on the Free plan.{" "}
            <Link href="/pricing" className="text-cyan-300 underline">Upgrade to Pro</Link> for unlimited history.
          </p>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, testId }: { label: string; value: string | number; sub: string; testId?: string }) {
  return (
    <div className="glass p-5 transition hover:border-cyan-300/30">
      <div className="text-xs uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-2 font-mono text-3xl font-black text-white" data-testid={testId}>
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

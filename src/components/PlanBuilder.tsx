"use client";

import Link from "next/link";
import { useState } from "react";
import { GOALS, LEVELS, type Goal, type Level, type WeeklyPlan } from "@/lib/plan";
import { store } from "@/lib/storage";
import { usePro, useSavedPlan } from "@/lib/useStore";

const FREE_PLANS_PER_WEEK = 1;
const WEEK_MS = 7 * 24 * 3600 * 1000;

export function PlanBuilder() {
  const saved = useSavedPlan();
  const pro = usePro();
  const [goal, setGoal] = useState<Goal>("build-muscle");
  const [level, setLevel] = useState<Level>("beginner");
  const [days, setDays] = useState(3);
  const [minutes, setMinutes] = useState(30);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const plan = saved;
  const [now] = useState(() => (typeof window === "undefined" ? 0 : Date.now()));
  const unlockAt = saved ? new Date(saved.createdAt).getTime() + WEEK_MS : 0;
  const lockedUntil = !pro && saved && saved.source === "claude" && now < unlockAt ? new Date(unlockAt) : null;

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (lockedUntil) return;
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, level, daysPerWeek: days, minutesPerSession: minutes, notes }),
      });
      const data = (await res.json()) as { plan?: WeeklyPlan; warning?: string; error?: string };
      if (!res.ok || !data.plan) throw new Error(data.error ?? `Request failed (${res.status})`);
      store.savePlan(data.plan);
      if (data.warning) setWarning(data.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
        AI <span className="neon-text">weekly plan</span>
      </h1>
      <p className="mt-1 text-slate-400">Tell your coach what you want. Claude builds your week around moves the camera can track.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={generate} className="glass h-fit space-y-5 p-6" data-testid="plan-form">
          <Field label="Goal" group>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(GOALS) as Goal[]).map((g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => setGoal(g)}
                  aria-pressed={goal === g}
                  className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                    goal === g ? "border-cyan-300/60 bg-cyan-400/10 text-white" : "border-white/10 text-slate-400 hover:border-white/25"
                  }`}
                >
                  {GOALS[g]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Experience">
            <select className="input" value={level} onChange={(e) => setLevel(e.target.value as Level)} aria-label="Experience">
              {(Object.keys(LEVELS) as Level[]).map((l) => (
                <option key={l} value={l}>
                  {LEVELS[l]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Days per week · ${days}`}>
            <input
              type="range"
              min={1}
              max={7}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full accent-cyan-400"
              aria-label="Days per week"
            />
          </Field>
          <Field label={`Minutes per session · ${minutes}`}>
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-full accent-fuchsia-400"
              aria-label="Minutes per session"
            />
          </Field>
          <Field label="Notes (optional)">
            <textarea
              className="input min-h-20"
              placeholder="e.g. only dumbbells at home, sore left knee"
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <button className="btn-primary w-full !py-3" disabled={loading || !!lockedUntil} data-testid="generate-btn">
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" /> Building your week…
              </>
            ) : plan ? (
              "Regenerate plan ✨"
            ) : (
              "Generate my plan ✨"
            )}
          </button>
          {lockedUntil && (
            <p className="text-xs text-slate-400">
              Free plan: {FREE_PLANS_PER_WEEK} AI plan per week. Next one unlocks{" "}
              {lockedUntil.toLocaleDateString("en-US", { weekday: "long" })}.{" "}
              <Link href="/pricing" className="text-cyan-300 underline">
                Go Pro
              </Link>{" "}
              for unlimited plans.
            </p>
          )}
          {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
        </form>

        <div>
          {!plan && !loading && (
            <div className="glass grid h-full min-h-80 place-items-center p-10 text-center">
              <div>
                <div className="text-5xl">🗓️</div>
                <p className="mt-4 text-slate-400">Your personalised 7-day plan will appear here.</p>
              </div>
            </div>
          )}
          {loading && !plan && (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass h-36 animate-pulse" />
              ))}
            </div>
          )}
          {plan && <PlanView plan={plan} warning={warning} />}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, group }: { label: string; children: React.ReactNode; group?: boolean }) {
  if (group) {
    return (
      <div role="group" aria-label={label}>
        <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</span>
        {children}
      </div>
    );
  }
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function PlanView({ plan, warning }: { plan: WeeklyPlan; warning: string | null }) {
  return (
    <div className="animate-fade-up" data-testid="plan-result">
      <div className="glass-strong p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip" data-testid="plan-source">
            {plan.source === "claude" ? "✨ Generated by Claude" : "🧪 Demo plan (no API key)"}
          </span>
          <span className="chip">{new Date(plan.createdAt).toLocaleDateString()}</span>
        </div>
        <h2 className="mt-4 text-2xl font-bold" data-testid="plan-title">{plan.title}</h2>
        <p className="mt-2 text-slate-400">{plan.summary}</p>
        {warning && <p className="mt-3 text-sm text-amber-300">{warning}</p>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {plan.days.map((d) => (
          <div key={d.day} className={`glass p-5 ${d.rest ? "opacity-60" : ""}`} data-testid="plan-day">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{d.day}</span>
              {d.rest && <span className="chip !py-0.5">Rest</span>}
            </div>
            <h3 className="mt-1 font-semibold text-white">{d.focus}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {d.exercises.map((e) => (
                <li key={e.name} className="flex items-center justify-between gap-2">
                  <span className="text-slate-300">
                    {e.name}
                    {e.trackable && (
                      <Link
                        href={`/workout?exercise=${e.trackable}`}
                        className="ml-2 rounded-md bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-400/20"
                        title="Track this with the camera"
                      >
                        📷 TRACK
                      </Link>
                    )}
                  </span>
                  <span className="whitespace-nowrap font-mono text-xs text-slate-400">
                    {e.sets}×{e.reps}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="glass mt-4 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Coach tips</h3>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
          {plan.tips.map((t) => (
            <li key={t}>• {t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

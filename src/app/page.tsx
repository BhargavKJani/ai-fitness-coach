import Link from "next/link";
import { DemoPreview } from "@/components/DemoPreview";
import { Pricing } from "@/components/Pricing";

const FEATURES = [
  { icon: "🎯", title: "Rep counting that's honest", body: "Joint-angle state machines only count full range-of-motion reps. Half reps get flagged, not counted." },
  { icon: "🧠", title: "Live form coaching", body: "Instant cues like “Go lower”, “Keep your back straight” and “Keep your elbow tucked” as you move." },
  { icon: "🦴", title: "Neon skeleton overlay", body: "33-point MediaPipe pose tracking drawn over your camera feed, with the active joints highlighted." },
  { icon: "🔒", title: "Private by design", body: "Pose detection runs fully in your browser via WebAssembly. Your video never leaves your device." },
  { icon: "📈", title: "Streaks, stats & history", body: "Timer, calories, form score, daily streaks and a history dashboard to keep you coming back." },
  { icon: "✨", title: "AI weekly plans", body: "Tell Claude your goal, level and schedule — get a 7-day plan with camera-trackable moves tagged." },
];

const STEPS = [
  { n: "01", title: "Pick an exercise", body: "Squats, push-ups or bicep curls." },
  { n: "02", title: "Step in front of the camera", body: "Side-on works best. No camera? Use demo mode." },
  { n: "03", title: "Move — we count & coach", body: "Get rep counts, form cues and a session summary." },
];

export default function Home() {
  return (
    <div className="overflow-x-hidden">
      {/* Hero */}
      <section className="relative">
        <div className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="pointer-events-none absolute left-1/4 top-10 h-72 w-72 animate-pulse-glow rounded-full bg-fuchsia-500/30" />
        <div className="pointer-events-none absolute right-10 top-40 h-72 w-72 animate-pulse-glow rounded-full bg-cyan-400/25 [animation-delay:1.2s]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-16 md:grid-cols-2 md:pt-24">
          <div className="animate-fade-up">
            <span className="chip">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-300" /> Computer vision · Powered by Claude
            </span>
            <h1 className="mt-6 text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              Your AI coach that <span className="neon-text">sees every rep.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-slate-400">
              PulseForm turns your webcam into a personal trainer. Real-time pose tracking counts your squats, push-ups
              and curls, corrects your form as you move, and builds your week with AI.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/workout" className="btn-primary !px-6 !py-3 text-base" data-testid="hero-cta">
                Start a free workout →
              </Link>
              <Link href="/workout?demo=1" className="btn-ghost !px-6 !py-3 text-base">
                Try demo mode
              </Link>
            </div>
            <div className="mt-10 flex gap-8 text-sm">
              {[
                ["33", "tracked landmarks"],
                ["30 fps", "in-browser"],
                ["0", "videos uploaded"],
              ].map(([k, v]) => (
                <div key={v}>
                  <div className="font-mono text-2xl font-bold text-white">{k}</div>
                  <div className="text-slate-500">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="animate-float">
            <DemoPreview />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">
          Built like a <span className="neon-text">pro trainer</span>, priced like an app
        </h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="glass group p-6 transition hover:-translate-y-1 hover:border-cyan-300/30"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="text-3xl transition group-hover:scale-110">{f.icon}</div>
              <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="glass grid gap-8 p-8 md:grid-cols-3 md:p-12">
          {STEPS.map((s) => (
            <div key={s.n}>
              <div className="font-mono text-sm text-fuchsia-300">{s.n}</div>
              <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">Simple pricing</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-400">
          Start free forever. Upgrade when you want unlimited history, analytics and AI coaching.
        </p>
        <div className="mt-10">
          <Pricing />
        </div>
      </section>
    </div>
  );
}

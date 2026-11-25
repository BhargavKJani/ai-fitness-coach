"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "./AccountProvider";
import { BillingPricing } from "./BillingPricing";
import { store } from "@/lib/storage";
import { usePro } from "@/lib/useStore";

const TIERS = [
  {
    id: "free",
    name: "Free",
    monthly: 0,
    yearly: 0,
    blurb: "Everything you need to start moving.",
    features: [
      "Live rep counting for 3 exercises",
      "Real-time form cues & skeleton overlay",
      "Workout timer, streaks & stats",
      "7-day workout history",
      "1 AI weekly plan per week",
    ],
    cta: "Start free",
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 9.99,
    yearly: 79,
    blurb: "For athletes who want every rep to count.",
    features: [
      "Everything in Free",
      "Unlimited history & progress analytics",
      "Unlimited AI plans, re-generated weekly",
      "Form-fault breakdown per session",
      "Export your data (CSV)",
      "Priority access to new exercises",
    ],
    cta: "Go Pro",
    highlight: true,
  },
] as const;

export function Pricing() {
  const [yearly, setYearly] = useState(false);
  const pro = usePro();
  const { billing } = useAccount();
  // Real UPI plans when Razorpay + Supabase are configured; otherwise the original preview plans.
  if (billing) return <BillingPricing compact />;

  return (
    <div>
      <div className="mb-10 flex items-center justify-center gap-3 text-sm">
        <span className={yearly ? "text-slate-500" : "text-white"}>Monthly</span>
        <button
          role="switch"
          aria-checked={yearly}
          aria-label="Toggle yearly billing"
          onClick={() => setYearly((y) => !y)}
          className="relative h-7 w-12 rounded-full border border-white/15 bg-white/10 transition"
        >
          <span
            className={`absolute top-0.5 h-5.5 w-5.5 rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 transition-all ${
              yearly ? "left-[1.45rem]" : "left-0.5"
            }`}
          />
        </button>
        <span className={yearly ? "text-white" : "text-slate-500"}>
          Yearly <span className="chip ml-1 !py-0.5 text-lime-300">save 34%</span>
        </span>
      </div>

      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        {TIERS.map((t) => {
          const price = yearly ? t.yearly : t.monthly;
          const isHighlight = "highlight" in t && t.highlight;
          return (
            <div
              key={t.id}
              data-testid={`tier-${t.id}`}
              className={`relative p-8 ${isHighlight ? "glass-strong ring-1 ring-fuchsia-400/40" : "glass"}`}
            >
              {isHighlight && (
                <>
                  <div className="pointer-events-none absolute -inset-px -z-10 rounded-2xl bg-gradient-to-br from-cyan-400/30 via-fuchsia-500/20 to-violet-500/30 blur-xl" />
                  <span className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-3 py-1 text-xs font-bold text-slate-950">
                    MOST POPULAR
                  </span>
                </>
              )}
              <h3 className="text-xl font-bold">{t.name}</h3>
              <p className="mt-1 text-sm text-slate-400">{t.blurb}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-black tracking-tight">${price === 0 ? "0" : price}</span>
                <span className="text-slate-400">/{yearly ? "year" : "month"}</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <svg className="mt-0.5 h-4 w-4 flex-none text-cyan-300" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" />
                    </svg>
                    <span className="text-slate-300">{f}</span>
                  </li>
                ))}
              </ul>
              {t.id === "free" ? (
                <Link href="/workout" className="btn-ghost mt-8 w-full">
                  {t.cta}
                </Link>
              ) : (
                <button className="btn-primary mt-8 w-full" onClick={() => store.setPro(!pro)} data-testid="pro-toggle">
                  {pro ? "Pro active ✓ (demo) — click to downgrade" : `${t.cta} — activate demo`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-slate-500">
        MVP note: checkout is simulated. &ldquo;Go Pro&rdquo; unlocks Pro features locally so you can try them — wire up Stripe
        Checkout to sell it for real.
      </p>
    </div>
  );
}

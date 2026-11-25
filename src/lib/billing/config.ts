/**
 * Plans and prices for this app. The same billing module is shared by all of Bhargav's apps;
 * only this file changes between them.
 */

export const APP_ID = "pulseform";
export const APP_NAME = "PulseForm";
/** What one AI "use" is called in this app. */
export const USE_NAME = { one: "AI plan", many: "AI plans" };

export type PaidPlanId = "day" | "month";
export type PlanId = "free" | PaidPlanId;

export interface PaidPlan {
  id: PaidPlanId;
  name: string;
  /** Price in paise (₹1 = 100 paise), as Razorpay expects. */
  amount: number;
  /** How long the plan lasts once paid. */
  durationLabel: string;
  /** Most AI uses allowed while the plan is active. */
  limit: number;
}

export const FREE_LIMIT = 3;

export const PAID_PLANS: Record<PaidPlanId, PaidPlan> = {
  day: { id: "day", name: "Day pass", amount: 900, durationLabel: "24 hours", limit: 5 },
  month: { id: "month", name: "Monthly", amount: 4900, durationLabel: "30 days", limit: 30 },
};

/** Most AI calls one use may make. */
export const MAX_CALLS_PER_USE = 1;

/** Accent colours for the pricing page and checkout. */
export const THEME = { accent: "#22d3ee", accent2: "#e879f9" };

/** Copy for the pricing page. */
export const PRICING_COPY = {
  "chip": "Pay by UPI · no auto-renewal",
  "title": "A personal coach for",
  "titleAccent": "less than a protein bar",
  "sub": "Rep counting and form checks are free forever. Pay once by UPI when you want AI plans and full form reports. Nothing renews.",
  "free": "Count reps and fix your form",
  "day": "Plan a new routine today",
  "month": "Train with a plan all month"
};

export const PLAN_FEATURES: Record<PlanId, string[]> = {
  free: [
    "Rep counting and live form checks",
    "Squats, push-ups and curls",
    "3 AI weekly plans by Claude",
    "Last 7 days of workout history",
  ],
  day: [
    "Up to 5 AI weekly plans in 24 hours",
    "Full form report after every workout",
    "Unlimited workout history",
    "Everything in Free",
  ],
  month: [
    "Up to 30 AI weekly plans in 30 days",
    "Full form report after every workout",
    "Unlimited workout history",
    "Best for building a daily habit",
  ],
};

export function isPaidPlan(v: unknown): v is PaidPlanId {
  return v === "day" || v === "month";
}

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

/** Billing is on only when every key it needs is set. Without them the app stays in free demo mode. */
export function billingEnabled(): boolean {
  return [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.RAZORPAY_KEY_ID,
    process.env.RAZORPAY_KEY_SECRET,
  ].every((v) => Boolean(v?.trim()));
}

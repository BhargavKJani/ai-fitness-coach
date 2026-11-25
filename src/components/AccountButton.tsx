"use client";

import Link from "next/link";
import { PAID_PLANS, USE_NAME, type PaidPlanId } from "@/lib/billing/config";
import { useAccount } from "./AccountProvider";

/** Sign-in button or plan badge for the header. Renders nothing until payments are configured. */
export function AccountButton() {
  const acc = useAccount();
  if (!acc.billing) return null;
  if (!acc.account) {
    return (
      <button
        onClick={() => void acc.signIn()}
        data-testid="sign-in"
        className="rounded-xl border border-white/15 px-3 py-2 text-sm font-medium text-white/85 transition hover:bg-white/5"
      >
        Sign in<span className="hidden sm:inline">&nbsp;with Google</span>
      </button>
    );
  }
  const a = acc.account;
  return (
    <span className="flex items-center gap-2">
      <Link
        href="/pricing"
        data-testid="plan-badge"
        title={acc.email ?? undefined}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${a.paid ? "border-amber-300/40 bg-amber-300/10 text-amber-200" : "border-white/15 text-white/75"}`}
      >
        {a.paid ? `★ ${PAID_PLANS[a.plan as PaidPlanId].name} · ${a.left} left` : `Free · ${a.left} ${a.left === 1 ? USE_NAME.one : USE_NAME.many} left`}
      </Link>
      <button onClick={() => void acc.signOut()} className="hidden text-xs text-white/50 hover:text-white md:inline">
        Sign out
      </button>
    </span>
  );
}

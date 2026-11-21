"use client";

import type { WeeklyPlan } from "./plan";
import type { WorkoutSession } from "./stats";

const KEYS = {
  sessions: "afc.sessions.v1",
  plan: "afc.plan.v1",
  pro: "afc.pro.v1",
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("afc-storage"));
  } catch {
    /* storage unavailable (private mode) — keep running in memory */
  }
}

export const store = {
  sessions: (): WorkoutSession[] => read<WorkoutSession[]>(KEYS.sessions, []),
  addSession(s: WorkoutSession): void {
    write(KEYS.sessions, [...store.sessions(), s]);
  },
  clearSessions(): void {
    write(KEYS.sessions, []);
  },
  plan: (): WeeklyPlan | null => read<WeeklyPlan | null>(KEYS.plan, null),
  savePlan(p: WeeklyPlan): void {
    write(KEYS.plan, p);
  },
  isPro: (): boolean => read<boolean>(KEYS.pro, false),
  setPro(v: boolean): void {
    write(KEYS.pro, v);
  },
};

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

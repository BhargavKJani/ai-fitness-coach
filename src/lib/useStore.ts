"use client";

import { useSyncExternalStore } from "react";
import type { WeeklyPlan } from "./plan";
import type { WorkoutSession } from "./stats";
import { store } from "./storage";
import { useAccount } from "@/components/AccountProvider";

function subscribe(cb: () => void) {
  window.addEventListener("afc-storage", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("afc-storage", cb);
    window.removeEventListener("storage", cb);
  };
}

/** Memoise snapshots by their serialised form so useSyncExternalStore sees stable references. */
function cached<T>(get: () => T): () => T {
  let lastKey: string | undefined;
  let last: T;
  return () => {
    const v = get();
    const key = JSON.stringify(v);
    if (key !== lastKey) {
      lastKey = key;
      last = v;
    }
    return last;
  };
}

const EMPTY: WorkoutSession[] = [];
const getSessions = cached(store.sessions);
const getPlan = cached(store.plan);

export function useSessions(): WorkoutSession[] {
  return useSyncExternalStore(subscribe, getSessions, () => EMPTY);
}

/** Pro features: a paid Day pass or Monthly plan when payments are on; otherwise the local demo toggle. */
export function usePro(): boolean {
  const local = useSyncExternalStore(subscribe, store.isPro, () => false);
  const acc = useAccount();
  return acc.billing ? !!acc.account?.paid : local;
}

export function useSavedPlan(): WeeklyPlan | null {
  return useSyncExternalStore(subscribe, getPlan, () => null);
}

/** True after hydration; lets client-only UI avoid SSR mismatches. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

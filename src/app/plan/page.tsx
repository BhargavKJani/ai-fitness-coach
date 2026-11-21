import type { Metadata } from "next";
import { PlanBuilder } from "@/components/PlanBuilder";

export const metadata: Metadata = { title: "AI Weekly Plan" };

export default function PlanPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PlanBuilder />
    </div>
  );
}

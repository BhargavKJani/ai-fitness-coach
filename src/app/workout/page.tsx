import type { Metadata } from "next";
import { WorkoutStudio } from "@/components/workout/WorkoutStudio";

export const metadata: Metadata = { title: "Workout" };

export default function WorkoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <WorkoutStudio />
    </div>
  );
}

import type { Metadata } from "next";
import { Pricing } from "@/components/Pricing";

export const metadata: Metadata = { title: "Pricing" };

const FAQ = [
  ["Do you upload my camera feed?", "No. Pose detection runs on-device with MediaPipe in WebAssembly. Only your rep counts and stats are saved, in your browser."],
  ["What equipment do I need?", "A laptop or phone camera. A pair of dumbbells helps for curls, but bodyweight works too."],
  ["Can I cancel anytime?", "Yes. Pro is billed monthly or yearly and can be cancelled at any time; you keep Pro until the end of the period."],
  ["Is the AI plan medical advice?", "No. Plans are general fitness guidance. Talk to a professional if you have injuries or health conditions."],
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-center text-4xl font-black sm:text-5xl">
        Train smarter. <span className="neon-text">Pay less than a PT session.</span>
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-center text-slate-400">
        One personal-training session costs ~$60. PulseForm Pro coaches every rep, every day, for $9.99/month.
      </p>
      <div className="mt-12">
        <Pricing />
      </div>
      <div className="mx-auto mt-20 max-w-3xl">
        <h2 className="text-2xl font-bold">FAQ</h2>
        <div className="mt-6 space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="glass group p-5">
              <summary className="cursor-pointer list-none font-medium text-white marker:hidden">
                <span className="mr-2 inline-block text-cyan-300 transition group-open:rotate-45">+</span>
                {q}
              </summary>
              <p className="mt-3 text-sm text-slate-400">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

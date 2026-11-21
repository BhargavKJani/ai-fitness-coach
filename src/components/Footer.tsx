import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/5">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row">
        <p>© 2026 PulseForm · AI Fitness Coach. Video never leaves your device.</p>
        <div className="flex gap-5">
          <Link href="/pricing" className="hover:text-slate-300">Pricing</Link>
          <Link href="/plan" className="hover:text-slate-300">AI Plan</Link>
          <a href="https://github.com/BhargavKJani/ai-fitness-coach" className="hover:text-slate-300">GitHub</a>
        </div>
      </div>
    </footer>
  );
}

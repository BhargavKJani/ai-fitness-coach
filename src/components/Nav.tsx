"use client";

import Link from "next/link";
import { AccountButton } from "./AccountButton";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/workout", label: "Workout" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/plan", label: "AI Plan" },
  { href: "/pricing", label: "Pricing" },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/60 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Logo />
          <span className="text-lg font-bold tracking-tight">
            Pulse<span className="neon-text">Form</span>
          </span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                path === l.href ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <span className="ml-3"><AccountButton /></span>
          <Link href="/workout" className="btn-primary ml-3 !py-2">
            Start training
          </Link>
        </div>
        <button
          className="btn-ghost !px-3 !py-2 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>
      {open && (
        <div className="border-t border-white/5 px-4 pb-4 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-3 text-sm text-slate-300 hover:bg-white/5"
            >
              {l.label}
            </Link>
          ))}
          <div className="px-3 pt-2"><AccountButton /></div>
        </div>
      )}
    </header>
  );
}

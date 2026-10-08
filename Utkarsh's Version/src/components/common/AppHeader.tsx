"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SafetyBanner } from "./SafetyBanner";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Search } from "lucide-react";
import { OPEN_PALETTE } from "./CommandPalette";

export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="7" fill="#1b43a3" />
      <path d="M6 17h5l2.2-5 3.6 9 2.4-6.5 1.4 2.5H26" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV = [
  { href: "/", label: "Stations", match: (p: string) => p === "/" || p.startsWith("/station") || p.startsWith("/results") },
  { href: "/coach", label: "Coach", match: (p: string) => p.startsWith("/coach") },
];

/** Global top bar: brand, primary navigation and the safety notice. */
export function AppHeader() {
  const pathname = usePathname() ?? "/";
  const gate = pathname.startsWith("/gate");
  // the station scrolls under 3D clicks (BP panel, tool trays): a sticky bar there would cover the exam view
  const station = pathname.startsWith("/station");
  return (
    <header className={`${station ? "relative" : "sticky top-0"} z-40 h-12 border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75`}>
      <div className="mx-auto flex h-full max-w-[1500px] items-center gap-3 px-4 sm:gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-[15px] font-semibold tracking-tight whitespace-nowrap text-slate-900">
          <LogoMark />
          <span>
            OSCE <span className="font-normal text-slate-500">Simulator</span>
          </span>
        </Link>
        {!gate && (
          <nav aria-label="Primary" className="hidden h-full items-stretch gap-1 sm:flex">
            {NAV.map((n) => {
              const active = n.match(pathname);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center px-2.5 text-sm font-medium transition-colors ${active ? "text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
                >
                  {n.label}
                  {active && <span aria-hidden className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-cyan-700" />}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3">
          {!gate && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE))}
              className="hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 py-1 pr-1.5 pl-2.5 text-xs text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 md:flex"
            >
              <Search aria-hidden className="size-3.5" />
              Search
              <kbd className="ml-3 rounded border border-slate-200 bg-white px-1 font-mono text-[10px] text-slate-400">⌘K</kbd>
            </button>
          )}
          <SafetyBanner />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

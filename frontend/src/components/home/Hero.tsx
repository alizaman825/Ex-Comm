"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ArrowDownRight, TrendingUp } from "lucide-react";
import { SearchBar } from "@/components/layout/SearchBar";
import { PlatformDot } from "@/components/product/badges";
import { useTrendingSearches } from "@/lib/hooks";

const FALLBACK = ["iphone 16", "samsung galaxy a55", "airpods pro", "air fryer", "macbook air"];

function TrendingChips() {
  const { data, isLoading } = useTrendingSearches(6);
  const queries = data?.trending.length ? data.trending.map((t) => t.query) : FALLBACK;
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Popular searches">
      <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <TrendingUp className="h-4 w-4 text-brand-600" aria-hidden /> Popular:
      </span>
      {isLoading
        ? Array.from({ length: 4 }, (_, i) => <span key={i} className="skeleton h-9 w-24 rounded-full" aria-hidden />)
        : queries.map((q) => (
            <Link key={q} href={`/search?q=${encodeURIComponent(q)}`} className="chip">
              {q}
            </Link>
          ))}
    </div>
  );
}

/** Static illustration of a price comparison (not live data), sits beside the search box. */
function ExampleCard() {
  const rows = [
    { platform: "priceoye" as const, label: "PriceOye", price: "Rs 117,999", best: true },
    { platform: "daraz" as const, label: "Daraz", price: "Rs 121,500", best: false },
    { platform: "aliexpress" as const, label: "AliExpress", price: "Rs 126,400", best: false },
  ];
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-brand-200/60 via-brand-100/40 to-transparent blur-2xl" />
      <div className="card rotate-1 p-5 shadow-lift transition duration-500 hover:rotate-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Example</p>
            <p className="mt-1 text-base font-semibold text-ink">Samsung Galaxy A55 5G</p>
            <p className="text-xs text-slate-500">8GB · 256GB</p>
          </div>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            <ArrowDownRight className="h-3.5 w-3.5" /> 6.2% this week
          </span>
        </div>
        <svg viewBox="0 0 300 80" className="mt-4 h-20 w-full" fill="none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6366f1" stopOpacity="0.25" />
              <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 22 C30 18 45 30 70 26 S110 12 140 28 S190 48 220 44 S270 58 300 62 V80 H0 Z" fill="url(#spark)" />
          <path d="M0 22 C30 18 45 30 70 26 S110 12 140 28 S190 48 220 44 S270 58 300 62" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="300" cy="62" r="4.5" fill="#4f46e5" />
        </svg>
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm ${r.best ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-slate-50"}`}>
              <span className="flex items-center gap-2.5 font-medium text-slate-700">
                <PlatformDot platform={r.platform} />
                {r.label}
                {r.best && <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Lowest</span>}
              </span>
              <span className={`tabular-nums ${r.best ? "font-bold text-emerald-700" : "font-medium text-slate-600"}`}>{r.price}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-surface via-surface to-brand-50/60">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-100/70 blur-3xl" aria-hidden />
      <div className="container relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:py-24">
        <div className="animate-fade-up">
          <span className="badge-brand mb-5">Daraz · PriceOye · AliExpress</span>
          <h1 className="t-display max-w-2xl text-balance !text-[2.5rem] sm:!text-[3.25rem]">
            Find the best price, <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">across every store.</span>
          </h1>
          <p className="t-lead mt-5 max-w-xl">Search once. Compare prices side by side, see how they have moved over time, and get alerted when a product drops to the price you want.</p>
          <div className="mt-8 max-w-2xl">
            <Suspense fallback={<div className="h-14 rounded-2xl border border-slate-200 bg-surface" />}>
              <SearchBar size="lg" />
            </Suspense>
          </div>
          <TrendingChips />
        </div>
        <ExampleCard />
      </div>
    </section>
  );
}

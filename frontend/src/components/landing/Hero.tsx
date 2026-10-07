"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import clsx from "clsx";
import { TrendingUp } from "lucide-react";
import { SearchBar } from "@/components/layout/SearchBar";
import { useTrendingSearches } from "@/lib/hooks";
import { formatPrice } from "@/lib/format";
import { useCaps } from "@/lib/motion";
import type { ProductCard } from "@/lib/types";
import { StaticTag } from "./bits";
import { useShowcase } from "./showcase";

const PriceTag3D = dynamic(() => import("./PriceTag3D"), { ssr: false });

const FALLBACK = ["iphone 16", "samsung galaxy a55", "airpods pro", "air fryer", "macbook air"];

function TrendingChips() {
  const { data, isLoading } = useTrendingSearches(6);
  const queries = data?.trending.length ? data.trending.map((t) => t.query) : FALLBACK;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Popular searches">
      <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500">
        <TrendingUp className="h-4 w-4" aria-hidden /> Popular:
      </span>
      {isLoading
        ? Array.from({ length: 4 }, (_, i) => <span key={i} className="skeleton h-9 w-24 !rounded-full" aria-hidden />)
        : queries.map((q) => (
            <Link key={q} href={`/search?q=${encodeURIComponent(q)}`} className="chip">
              {q}
            </Link>
          ))}
    </div>
  );
}

/** Where each floating product sits (phone and desktop), keyed by category; depth = parallax speed (bigger moves more). */
const SLOTS: Record<string, { depth: number; cls: string; delay: string }> = {
  mobiles: { depth: 0.9, cls: "left-[3%] top-[-2%] w-[6.5rem] sm:left-[14%] sm:top-[-3%] sm:w-[9.5rem] lg:w-[12rem]", delay: "0s" },
  fashion: { depth: 1.1, cls: "left-[-2%] bottom-[3%] w-[7rem] sm:left-[1%] sm:bottom-[0%] sm:w-[10rem] lg:w-[13rem]", delay: "-3s" },
  audio: { depth: 0.5, cls: "right-[22%] top-[-5%] w-[6rem] sm:right-auto sm:left-[40%] sm:top-[-9%] sm:w-[8.5rem] lg:w-[10.5rem]", delay: "-1.6s" },
  watches: { depth: 0.7, cls: "right-[0%] bottom-[2%] w-[6rem] sm:right-[34%] sm:bottom-[-2%] sm:w-[8rem] lg:w-[9.5rem]", delay: "-4.4s" },
  laptops: { depth: 0.4, cls: "hidden sm:block sm:left-[27%] sm:bottom-[-8%] sm:w-[10rem] lg:w-[12.5rem]", delay: "-2.2s" },
  "home-appliances": { depth: 1.3, cls: "right-[2%] top-[-2%] w-[5.5rem] sm:right-[30%] sm:top-[-6%] sm:w-[8rem] lg:w-[9.5rem]", delay: "-5s" },
};

function Floater({ product, slot }: { product: ProductCard; slot: (typeof SLOTS)[string] }) {
  const [broken, setBroken] = useState(false);
  if (broken || !product.image) return null; // never show a placeholder here
  return (
    <div data-float data-depth={slot.depth} className={clsx("multiply absolute z-10", slot.cls)}>
      <div className="animate-float" style={{ animationDelay: slot.delay }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={product.title} referrerPolicy="no-referrer" decoding="async" onError={() => setBroken(true)} className="aspect-square w-full rounded-[2rem] object-contain" />
      </div>
    </div>
  );
}

function TagStage({ high, low, heroRef }: { high: number; low: number; heroRef: React.RefObject<HTMLElement | null> }) {
  const caps = useCaps();
  const [active, setActive] = useState(true);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [heroRef]);

  return (
    <div className="relative aspect-[3/4] w-full">
      {/* the static tag is the loading state and the fallback; the 3D tag draws over it once ready */}
      <div className={clsx("absolute inset-0 flex items-center", caps?.webgl && "opacity-0")} aria-hidden={caps?.webgl || undefined}>
        <StaticTag price={formatPrice(low)} />
      </div>
      {caps?.webgl && (
        <Suspense fallback={null}>
          <div className="absolute inset-[-12%]" data-tag-canvas>
            <PriceTag3D high={high} low={low} active={active} />
          </div>
        </Suspense>
      )}
    </div>
  );
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const showcase = useShowcase();
  const tag = showcase?.tag ?? { high: 129_999, low: 117_999 };

  return (
    <section ref={ref} data-hero className="relative flex min-h-[calc(100svh-4.5rem)] flex-col items-center overflow-x-clip px-4 pb-14 pt-4 sm:pt-8">
      <div className="relative mx-auto flex w-full max-w-[84rem] flex-1 items-center justify-center py-10 sm:py-16">
        <h1 className="t-hero relative z-0 text-center lg:text-left lg:self-center lg:mr-auto">
          <span className="block">Find the</span> <span className="block"><span className="swash">best price.</span></span>
        </h1>

        <div className="pointer-events-none absolute right-[50%] top-[58%] z-20 w-[9.5rem] translate-x-1/2 sm:top-1/2 sm:w-[16rem] lg:right-[3%] lg:w-[21rem] lg:translate-x-0 lg:-translate-y-1/2 xl:right-[6%]" data-tag>
          <TagStage high={tag.high} low={tag.low} heroRef={ref} />
        </div>

        {showcase?.floaters.map((p) => (SLOTS[p.category ?? ""] ? <Floater key={p.id} product={p} slot={SLOTS[p.category ?? ""]} /> : null))}
      </div>

      <div className="relative z-30 w-full max-w-2xl animate-fade-up" style={{ animationDelay: "0.25s" }}>
        <Suspense fallback={<div className="h-16 rounded-full bg-surface shadow-card" />}>
          <SearchBar size="lg" />
        </Suspense>
        <TrendingChips />
      </div>
    </section>
  );
}

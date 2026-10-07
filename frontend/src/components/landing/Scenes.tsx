"use client";

import { Bell, TrendingDown, Sparkles } from "lucide-react";
import { PlatformDot } from "@/components/product/badges";
import { CategoryTile, ProductImage } from "@/components/product/ProductImage";
import { PLATFORM_LABEL, formatPrice } from "@/lib/format";
import type { Platform } from "@/lib/types";
import { GiantWord } from "./bits";
import { useShowcase } from "./showcase";

const STORES: Platform[] = ["daraz", "priceoye", "aliexpress"];
const FALLBACK_PRICES: Record<Platform, number> = { daraz: 121_500, priceoye: 117_999, aliexpress: 126_400 };

const kicker = "mb-4 inline-flex rounded-full bg-surface/70 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-slate-700 backdrop-blur";

/** Section 2 (peach): one product, three store price cards that slide in and line up, the lowest lit green. */
export function CompareScene() {
  const showcase = useShowcase();
  const product = showcase?.compare ?? null;
  const prices = Object.fromEntries(STORES.map((s) => [s, product?.offers.find((o) => o.platform === s)?.price ?? FALLBACK_PRICES[s]])) as Record<Platform, number>;
  // The AliExpress supplier price is shown but never counts as the lowest retail price.
  const retail = STORES.filter((s) => s !== "aliexpress");
  const best = retail.reduce((a, b) => (prices[b] < prices[a] ? b : a));

  return (
    <section data-scene="compare" className="scene relative z-[1] -mt-10 rounded-t-[3rem] bg-peach" aria-labelledby="scene-compare">
      <div className="scene-inner relative flex flex-col items-center justify-center overflow-x-clip rounded-t-[3rem] bg-peach px-4">
        <GiantWord>COMPARE</GiantWord>
        <div className="relative w-full max-w-4xl text-center">
          <p className={kicker} data-reveal>
            Compare
          </p>
          <h2 id="scene-compare" className="t-display" data-reveal>
            Every store, <span className="swash">one screen.</span>
          </h2>
          <div data-cmp-product className="multiply mx-auto mt-6 aspect-square w-[min(46vw,15rem)] sm:w-[min(34vw,17rem)]">
            {product ? (
              <ProductImage src={product.image} alt={product.title} category={product.category} className="h-full w-full rounded-[2rem] object-contain" />
            ) : (
              <CategoryTile category="mobiles" label="Phone" className="h-full w-full rounded-[2rem]" />
            )}
          </div>
          <p className="mt-2 min-h-[1.5rem] truncate text-sm font-semibold text-slate-700">{product?.title ?? "Samsung Galaxy A55 5G"}</p>
          <div className="mx-auto mt-5 grid max-w-3xl grid-cols-3 gap-2 sm:gap-5">
            {STORES.map((s, i) => {
              const isBest = s === best;
              return (
                <div key={s} data-cmp-card data-from={i === 1 ? 1 : i === 0 ? -1 : 0} className="relative rounded-2xl bg-surface p-3 text-left shadow-card sm:rounded-3xl sm:p-5" {...(isBest ? { "data-cmp-best": true } : {})}>
                  {isBest && <span data-cmp-ring aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] bg-emerald-50 ring-2 ring-emerald-500" />}
                  <div className="relative">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 sm:text-sm">
                      <PlatformDot platform={s} className="!h-2 !w-2 sm:!h-2.5 sm:!w-2.5" />
                      {PLATFORM_LABEL[s]}
                    </p>
                    <p className="mt-1.5 font-display text-[0.95rem] font-extrabold tabular-nums tracking-tight text-ink sm:mt-3 sm:text-3xl">{formatPrice(prices[s])}</p>
                    <p className="mt-1 h-4 text-[10px] font-semibold text-slate-500 sm:text-xs">
                      {s === "aliexpress" ? "supplier, saved" : isBest ? <span data-cmp-badge className="badge-best !px-2 !py-0.5 !text-[10px]">Lowest</span> : " "}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

const CHART = "M0 40 C40 32 70 70 120 60 S190 20 240 54 S320 110 370 96 S450 150 500 140 S560 176 600 190";

/** Section 3 (mint): the price chart draws as you scroll, then a green drop badge pops in and an alert is sent. */
export function TrackScene() {
  return (
    <section data-scene="track" className="scene relative z-[2] -mt-10 rounded-t-[3rem] bg-mint" aria-labelledby="scene-track">
      <div className="scene-inner relative flex flex-col items-center justify-center overflow-x-clip rounded-t-[3rem] bg-mint px-4">
        <GiantWord>TRACK</GiantWord>
        <div className="relative w-full max-w-3xl text-center">
          <p className={kicker} data-reveal>
            Track
          </p>
          <h2 id="scene-track" className="t-display" data-reveal>
            Watch it fall. <span className="swash">Get told.</span>
          </h2>
          <div className="relative mx-auto mt-10 rounded-[2rem] bg-surface p-5 shadow-float sm:p-8">
            <div className="flex items-end justify-between text-left">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Price, last 90 days</p>
                <p className="font-display text-2xl font-extrabold tabular-nums text-ink sm:text-4xl">Rs 117,999</p>
              </div>
              <p className="text-xs text-slate-500">Illustration</p>
            </div>
            <svg viewBox="0 0 600 220" className="mt-4 h-40 w-full sm:h-56" fill="none" preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="trackFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#0FA968" stopOpacity="0.28" />
                  <stop offset="1" stopColor="#0FA968" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[50, 110, 170].map((y) => (
                <line key={y} x1="0" x2="600" y1={y} y2={y} className="stroke-slate-200" strokeDasharray="4 6" />
              ))}
              <path data-track-area d={`${CHART} V220 H0 Z`} fill="url(#trackFill)" />
              <path data-track-line d={CHART} stroke="#0FA968" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <span data-track-dot aria-hidden className="absolute bottom-[3.4rem] right-[1.6rem] h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-emerald-500/25 sm:bottom-[4.2rem] sm:right-[2.2rem]" />
            <div data-track-badge className="badge-best absolute -right-2 -top-4 !px-4 !py-2 !text-base shadow-lift sm:-right-5 sm:!text-xl">
              <TrendingDown className="h-5 w-5" aria-hidden /> -12%
            </div>
            <div data-track-alert className="absolute -bottom-6 left-3 flex items-center gap-3 rounded-full bg-brand-600 py-2.5 pl-3 pr-5 text-left text-onbrand shadow-lift sm:-left-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-highlight text-onyellow">
                <Bell className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-xs font-bold leading-tight sm:text-sm">
                Alert sent
                <span className="block font-medium opacity-70">Your target price was reached</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Section 5 (lilac): "SELL SMARTER" teaser with a margin number that counts up beside a mini profit card. */
export function SellScene() {
  return (
    <section data-scene="sell" className="relative z-[4] -mt-10 overflow-x-clip rounded-t-[3rem] bg-lilac py-24 sm:py-36" aria-labelledby="scene-sell">
      <GiantWord className="!top-[46%]">SELL SMARTER</GiantWord>
      <div className="container relative z-10 text-center">
        <p className={kicker} data-reveal>
          For sellers
        </p>
        <h2 id="scene-sell" className="t-display mx-auto max-w-3xl" data-reveal>
          Know your margin <span className="swash">before you buy.</span>
        </h2>
        <div className="mx-auto mt-12 grid max-w-3xl items-center gap-6 sm:grid-cols-[1fr_1.1fr]">
          <div data-reveal>
            <p className="font-display text-[5.5rem] font-extrabold leading-none tracking-tighter text-emerald-700 sm:text-[8rem]">
              <span data-count data-to="31">
                31
              </span>
              <span className="text-[0.55em]">%</span>
            </p>
            <p className="mt-1 text-sm font-bold uppercase tracking-wider text-slate-600">Estimated margin</p>
          </div>
          <div data-sell-card className="rounded-[2rem] bg-surface p-6 text-left shadow-float">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Sparkles className="h-4 w-4" aria-hidden /> Example profit
            </p>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Supplier price (saved)</dt>
                <dd className="font-semibold tabular-nums text-ink">Rs 8,400</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Shipping and fees</dt>
                <dd className="font-semibold tabular-nums text-ink">Rs 1,900</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Local retail price</dt>
                <dd className="font-semibold tabular-nums text-ink">Rs 14,999</dd>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <dt className="font-bold text-ink">Profit per unit</dt>
                <dd className="rounded-full bg-emerald-50 px-3 py-1 font-display text-lg font-extrabold tabular-nums text-emerald-700">Rs 4,699</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { Hero } from "@/components/landing/Hero";
import { CompareScene, SellScene, TrackScene } from "@/components/landing/Scenes";
import { LandingEffects } from "@/components/landing/Landing";
import { GiantWord } from "@/components/landing/bits";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { ProductRail } from "@/components/home/ProductRail";
import { SearchBar } from "@/components/layout/SearchBar";
import { Suspense } from "react";

export default function HomePage() {
  return (
    <>
      <LandingEffects />
      <Hero />
      <CompareScene />
      <TrackScene />

      {/* Section 4 (sky): categories rise in */}
      <section className="relative z-[3] -mt-10 rounded-t-[3rem] bg-sky py-24 sm:py-32" aria-labelledby="home-categories">
        <div className="container">
          <div className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-4 inline-flex rounded-full bg-surface/70 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-slate-700 backdrop-blur">Browse</p>
              <h2 id="home-categories" className="t-display">
                Shop by <span className="swash">category</span>
              </h2>
            </div>
            <Link href="/categories" className="btn-secondary">
              All categories
            </Link>
          </div>
          <CategoryGrid compact />
        </div>
      </section>

      <SellScene />

      {/* Section 6 (butter): biggest drops carousel, trending, and the closing search */}
      <section className="relative z-[5] -mt-10 overflow-x-clip rounded-t-[3rem] bg-butter pb-24 pt-16 sm:pb-36 sm:pt-24" aria-label="Deals and trending">
        <ProductRail title="Biggest price drops this week" description="Products whose lowest price fell the most over the last 7 days." endpoint="/products/drops" limit={4} href="/categories" linkLabel="Browse all products" />
        <ProductRail title="Trending now" description="What shoppers are comparing most." endpoint="/products/trending" limit={4} />

        <div className="container relative mt-20 text-center sm:mt-32">
          <GiantWord className="!top-[40%]">FIND IT</GiantWord>
          <div className="relative z-10">
            <h2 className="t-display mx-auto max-w-3xl">
              Do not wait for a sale. <span className="swash">Let the price come to you.</span>
            </h2>
            <div className="mx-auto mt-10 max-w-2xl">
              <Suspense fallback={<div className="h-16 rounded-full bg-surface shadow-card" />}>
                <SearchBar size="lg" label="Find a product" buttonLabel="Search" />
              </Suspense>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="btn-primary btn-lg">
                Create a free account
              </Link>
              <Link href="/categories" className="btn-secondary btn-lg">
                Browse products
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

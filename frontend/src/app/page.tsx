import Link from "next/link";
import { BellRing, LineChart, Search, Scale } from "lucide-react";
import { Hero } from "@/components/home/Hero";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { ProductRail } from "@/components/home/ProductRail";

const STEPS = [
  { icon: Search, title: "Search once", text: "Type a product name. We check Daraz and PriceOye live and include saved AliExpress supplier prices." },
  { icon: Scale, title: "Compare side by side", text: "See every store's price, rating and stock for the same product, with the lowest price highlighted." },
  { icon: LineChart, title: "Watch the price", text: "A price history chart shows whether today's price is a real deal or just a number." },
];

export default function HomePage() {
  return (
    <>
      <Hero />

      <section className="section" aria-labelledby="home-categories">
        <div className="container">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 id="home-categories" className="t-h2">
                Shop by category
              </h2>
              <p className="mt-1 text-sm text-slate-500">Six categories, each with products compared across stores.</p>
            </div>
            <Link href="/categories" className="hidden text-sm font-semibold text-brand-600 hover:underline sm:block">
              All categories
            </Link>
          </div>
          <CategoryGrid compact />
        </div>
      </section>

      <div className="border-y border-slate-200/70 bg-surface">
        <ProductRail title="Biggest price drops this week" description="Products whose lowest price fell the most over the last 7 days." endpoint="/products/drops" limit={4} />
      </div>
      <ProductRail title="Trending now" description="What shoppers are comparing most." endpoint="/products/trending" limit={4} href="/categories" linkLabel="Browse all products" />

      <section className="section border-t border-slate-200/70 bg-surface" aria-labelledby="how-it-works">
        <div className="container">
          <h2 id="how-it-works" className="t-h2 text-center">
            How Ex-Comm works
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative rounded-card border border-slate-200 bg-slate-50/60 p-6">
                <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-bold text-white">Step {i + 1}</span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-brand-600 shadow-card">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 t-h3">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="home-cta">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 px-6 py-12 text-center sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
            <BellRing className="relative mx-auto h-9 w-9 text-brand-200" aria-hidden />
            <h2 id="home-cta" className="relative mt-4 text-3xl font-bold tracking-tight !text-white">
              Do not wait for a sale. Let the price come to you.
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-brand-100">Set a target price on any product and get a notification the moment it is reached.</p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="btn-lg inline-flex items-center justify-center rounded-lg bg-surface px-6 py-3 text-base font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50">
                Create a free account
              </Link>
              <Link href="/categories" className="btn-lg inline-flex items-center justify-center rounded-lg border border-white/30 px-6 py-3 text-base font-semibold text-white transition hover:bg-surface/10">
                Browse products
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

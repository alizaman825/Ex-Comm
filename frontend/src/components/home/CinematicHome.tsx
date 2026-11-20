"use client";

import Link from "next/link";
import useSWR from "swr";
import clsx from "clsx";
import { fetcher } from "@/lib/api";
import { useCategories } from "@/lib/hooks";
import { ArrowRight } from "lucide-react";
import { PLATFORM_LABEL, formatPrice } from "@/lib/format";
import type { ProductCard as ProductCardData } from "@/lib/types";
import { CategoryIcon, ProductImage } from "@/components/product/ProductImage";
import { CineSearchBar } from "./CineSearchBar";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * The home page — a literal port of the approved concept board (Main.dc.html for mobile,
 * Main-Desktop.dc.html for desktop; they are two different boards, not a reflow of one, so the
 * mobile and desktop JSX blocks below differ in more than just column count: desktop has a hero
 * visual and no "03 — Trending searches" section at all, mobile has neither but adds category
 * chips). The one deliberate change from the board everywhere a product photo appears: no glass
 * bubble/circle behind it — a plain photo, per the project owner's standing rule.
 */

function useDrops(limit: number) {
  return useSWR<{ products: ProductCardData[] }>(["/products/drops", { limit }], fetcher, { revalidateOnFocus: false });
}
function useTrending(limit: number) {
  return useSWR<{ products: ProductCardData[] }>(["/products/trending", { limit }], fetcher, { revalidateOnFocus: false });
}

function lowestOffer(p: ProductCardData) {
  const retail = p.offers.filter((o) => o.role !== "supplier");
  return retail[0] ?? p.offers[0] ?? null;
}

function badgeFor(p: ProductCardData) {
  const low = lowestOffer(p);
  if (low?.dataSource === "saved") return { text: "Saved", cls: "bg-[#e0e7ff]/95 text-[#2e2a70]" };
  if (p.priceChange7d <= -1) return { text: `${Math.round(p.priceChange7d)}%`, cls: "bg-[#fcd34d]/95 text-[#3f2d05]" };
  return { text: "Lowest", cls: "bg-emerald-400/90 text-[#06281c]" };
}

/* ---------------------------------------------------------------- Hero ---------------------------------------------------------------- */

function HeroVisual({ product }: { product: ProductCardData | undefined }) {
  if (!product) return <div className="hidden aspect-square w-[22rem] shrink-0 lg:block" aria-hidden />;
  const low = lowestOffer(product);
  return (
    <div className="relative hidden aspect-square w-[22rem] shrink-0 items-center justify-center lg:flex">
      <ProductImage src={product.image} alt={product.title} category={product.category} className="h-[85%] w-[85%] drop-shadow-[0_30px_50px_rgba(0,0,0,0.4)]" />
      <span className="absolute left-2 top-6 rounded-full bg-emerald-400/90 px-3 py-1.5 text-[11px] font-extrabold text-[#06281c]">Lowest price</span>
      {low && (
        <span className="absolute bottom-6 right-2 rounded-full bg-[#fcd34d]/95 px-3 py-1.5 text-[11px] font-extrabold text-[#3f2d05]">
          {product.priceChange7d <= -1 ? `${Math.round(product.priceChange7d)}% today` : "Checked today"}
        </span>
      )}
    </div>
  );
}

function Hero() {
  const { data } = useDrops(1);
  const top = data?.products[0];

  return (
    <section className="relative overflow-x-clip px-5 pb-10 pt-8 sm:px-6 lg:px-10 lg:pb-16 lg:pt-6">
      <div className="mx-auto flex max-w-[85rem] items-center gap-16">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-end gap-2.5 sm:mb-2 sm:gap-3.5">
            <span className="t-numeral select-none text-[4rem] leading-[0.78] text-white/90 sm:text-[4.5rem] lg:text-[6rem]">01</span>
            <span className="spec-label pb-2 text-[9.5px] leading-tight text-white/60 sm:pb-2.5 sm:text-[10.5px] lg:pb-3.5">
              Today&apos;s best drop
              <br className="lg:hidden" /> {"  "}across 3 stores
            </span>
          </div>
          <h1
            className="mb-3.5 text-[2.5rem] leading-[0.92] tracking-[0.01em] text-white sm:mb-4 sm:text-[2.75rem] lg:text-[4.25rem]"
            style={{ fontFamily: '"Bebas Neue", var(--font-display), sans-serif', textShadow: "0 6px 24px rgba(0,0,0,0.4)" }}
          >
            LOWEST PRICE.
            <br />
            EVERY STORE.
          </h1>
          <p className="mb-6 hidden max-w-[26rem] text-[14.5px] text-white/70 lg:block">
            Daraz, PriceOye and more, compared live — plus AliExpress as a checked, saved reference.
          </p>

          <div className="max-w-[29rem]">
            <CineSearchBar />
          </div>

          <CategoryChips />
        </div>

        <HeroVisual product={top} />
      </div>
    </section>
  );
}

const CHIP_FALLBACK = [
  { slug: "mobiles", name: "Mobiles" },
  { slug: "electronics", name: "Electronics" },
  { slug: "fashion", name: "Fashion" },
  { slug: "beauty", name: "Beauty" },
];

function CategoryChips() {
  const { data } = useCategories();
  const cats = data?.categories?.length ? data.categories.slice(0, 4) : CHIP_FALLBACK;
  return (
    <div className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
      <Link href="/categories" className="shrink-0 whitespace-nowrap rounded-full bg-white px-3.5 py-1.5 text-[11.5px] font-bold text-[#0b0812]">
        All
      </Link>
      {cats.map((c) => (
        <Link
          key={c.slug}
          href={`/search?category=${c.slug}`}
          className="shrink-0 whitespace-nowrap rounded-full border border-white/25 bg-white/[0.12] px-3.5 py-1.5 text-[11.5px] font-semibold text-white"
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}

/* --------------------------------------------------------- 02: biggest drops --------------------------------------------------------- */

function DropCard({ product }: { product: ProductCardData }) {
  const low = lowestOffer(product);
  const badge = badgeFor(product);
  return (
    <Link
      href={`/products/${product.id}`}
      data-testid="product-card"
      className="block w-[9.4rem] shrink-0 rounded-[1.25rem] border border-white/20 bg-white/10 p-3.5 shadow-[0_1px_0_rgba(255,255,255,0.3)_inset] backdrop-blur-xl transition hover:bg-white/[0.16] sm:w-auto"
    >
      <div data-tilt className="relative mb-3 flex h-[7.5rem] items-center justify-center">
        <ProductImage src={product.image} alt={product.title} category={product.category} className="h-full w-full" />
        <span className={clsx("absolute bottom-1 left-1 rounded-full px-2 py-[3px] text-[9.5px] font-extrabold", badge.cls)}>{badge.text}</span>
      </div>
      <p className="mb-1 line-clamp-1 text-[12px] font-bold text-white">{product.title}</p>
      <p className="spec-label mb-1 text-[9.5px] text-white/60">
        {low ? PLATFORM_LABEL[low.platform] : "—"} · {low?.dataSource === "saved" ? "saved" : "lowest"}
      </p>
      <p className="t-price text-[13px] font-extrabold">{formatPrice(product.minPrice)}</p>
    </Link>
  );
}

function DropsSection() {
  const { data, isLoading } = useDrops(4);
  const products = data?.products ?? [];
  return (
    <section className="px-5 pb-6 pt-1 sm:px-6 lg:px-10 lg:pb-14">
      <div className="mx-auto max-w-[85rem]">
        <SectionHeading number="02">Biggest price drops today</SectionHeading>
        <div className="-mx-5 flex gap-3.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:gap-[18px] lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          {isLoading && !data
            ? Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-[13.5rem] w-[9.4rem] shrink-0 !rounded-[1.25rem] sm:w-auto" aria-hidden />)
            : products.map((p) => <DropCard key={p.id} product={p} />)}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------- 03: shop by category ----------------------------------------------------- */

function CategoryTile({ slug, name, productCount }: { slug: string; name: string; productCount: number }) {
  return (
    <Link
      href={`/search?category=${slug}`}
      data-testid="home-category-tile"
      className="flex flex-col items-center gap-2.5 rounded-[1.25rem] border border-white/20 bg-white/10 p-4 text-center backdrop-blur-xl transition hover:bg-white/[0.16] sm:p-5"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/15 sm:h-14 sm:w-14">
        <CategoryIcon slug={slug} className="h-6 w-6 sm:h-7 sm:w-7" />
      </span>
      <span className="line-clamp-1 text-[12.5px] font-bold text-white">{name}</span>
      <span className="spec-label text-[9px] text-white/50">{productCount} products</span>
    </Link>
  );
}

function CategoriesSection() {
  const { data, isLoading } = useCategories();
  const categories = data?.categories ?? [];
  return (
    <section className="px-5 pb-8 pt-1 sm:px-6 lg:px-10 lg:pb-14">
      <div className="mx-auto max-w-[85rem]">
        <SectionHeading
          number="03"
          action={
            <Link href="/categories" className="spec-label shrink-0 text-[9.5px] text-white/60 hover:text-white">
              All categories →
            </Link>
          }
        >
          Shop by category
        </SectionHeading>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
          {isLoading && !data
            ? Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-[7.5rem] !rounded-[1.25rem]" aria-hidden />)
            : categories.map((c) => <CategoryTile key={c.slug} slug={c.slug} name={c.name} productCount={c.productCount} />)}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- 04: trending searches ------------------------------------------------------- */

function TrendingTile({ product }: { product: ProductCardData }) {
  const badge = badgeFor(product);
  return (
    <Link href={`/products/${product.id}`} className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur-xl transition hover:bg-white/[0.16]">
      <div className="mb-2 flex h-14 items-center justify-center lg:h-20">
        <ProductImage src={product.image} alt={product.title} category={product.category} className="h-full w-full" />
      </div>
      <p className="mb-1 line-clamp-1 text-[11px] font-semibold text-white">{product.title}</p>
      <span className={clsx("text-[9.5px] font-bold", badge.text === "Lowest" ? "text-emerald-300" : badge.text === "Saved" ? "text-indigo-200" : "text-rose-300")}>{badge.text}</span>
    </Link>
  );
}

function TrendingSection() {
  const { data, isLoading } = useTrending(8);
  const products = data?.products ?? [];
  return (
    <section className="px-5 pb-6 pt-1 sm:px-6 lg:px-10 lg:pb-14">
      <div className="mx-auto max-w-[85rem]">
        <SectionHeading number="04">Trending searches</SectionHeading>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
          {isLoading && !data
            ? Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-28 !rounded-2xl lg:h-36" aria-hidden />)
            : products.slice(0, 8).map((p) => <TrendingTile key={p.id} product={p} />)}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------- 05: best deals preview ----------------------------------------------------- */

function BestDealsPreview() {
  const { data, isLoading } = useDrops(8);
  const products = data?.products ?? [];
  return (
    <section className="px-5 pb-8 pt-1 sm:px-6 lg:px-10 lg:pb-16">
      <div className="mx-auto max-w-[85rem]">
        <SectionHeading
          number="05"
          action={
            <Link href="/best-deals" className="spec-label shrink-0 text-[9.5px] text-white/60 hover:text-white">
              Browse best deals →
            </Link>
          }
        >
          Best deals preview
        </SectionHeading>
        <div className="-mx-5 flex gap-3.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:gap-[18px] lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          {isLoading && !data
            ? Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-[13.5rem] w-[9.4rem] shrink-0 !rounded-[1.25rem] sm:w-auto" aria-hidden />)
            : products.slice(0, 4).map((p) => <DropCard key={p.id} product={p} />)}
        </div>
        <div className="mt-4 flex justify-center lg:mt-6">
          <Link href="/best-deals" className="btn-secondary btn-sm">
            Browse best deals <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- bottom bars --------------------------------------------------------------- */

function BottomBars() {
  return (
    <>
      {/* desktop: "Track any price drop" (Main-Desktop.dc.html) */}
      <section className="hidden px-10 pb-16 lg:block">
        <div className="mx-auto flex max-w-[85rem] items-center justify-between rounded-[1.25rem] border border-white/20 bg-white/10 px-[30px] py-5 shadow-[0_1px_0_rgba(255,255,255,0.3)_inset] backdrop-blur-xl">
          <div>
            <p className="mb-0.5 text-[15px] font-bold text-white">Track any price drop</p>
            <p className="spec-label text-white/60">Get notified the moment it falls</p>
          </div>
          <Link href="/alerts" className="flex items-center gap-2.5 rounded-full border border-white/30 bg-white/[0.14] py-2.5 pl-5 pr-2.5">
            <span className="text-[12.5px] font-bold text-white">Enable alerts</span>
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white text-[#0b0812]">
              <ArrowRight className="h-3.5 w-3.5" aria-hidden strokeWidth={2.6} />
            </span>
          </Link>
        </div>
      </section>

      {/* mobile: "See every price drop" (Main.dc.html) */}
      <section className="px-4 pb-8 lg:hidden">
        <Link
          href="/categories"
          className="flex items-center justify-between gap-3 rounded-full border border-white/30 bg-white/[0.14] py-3 pl-5 pr-3 shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_16px_36px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
        >
          <div>
            <p className="text-[12px] font-bold text-white">See every price drop</p>
            <p className="spec-label text-white/60">Updated live</p>
          </div>
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white text-[#0b0812]">
            <ArrowRight className="h-4 w-4" aria-hidden strokeWidth={2.6} />
          </span>
        </Link>
      </section>
    </>
  );
}

export function CinematicHome() {
  return (
    <>
      <Hero />
      <DropsSection />
      <CategoriesSection />
      <TrendingSection />
      <BestDealsPreview />
      <BottomBars />
    </>
  );
}

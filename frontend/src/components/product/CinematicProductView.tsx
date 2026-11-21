"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, PackageSearch, Scale, Crown, ArrowRight } from "lucide-react";
import { ApiError, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/hooks";
import { PLATFORM_LABEL, currentPath, formatPrice } from "@/lib/format";
import type { Platform, ProductCard as ProductCardData, ProductDetail } from "@/lib/types";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { useCompare } from "@/components/compare/CompareProvider";
import { OfferTable } from "./OfferTable";
import { ReportProblem } from "./ReportProblem";
import { PriceChart } from "./PriceChart";
import { AlertDialog } from "./AlertDialog";
import { PriceChange, Rating } from "./badges";
import { ProductImage } from "./ProductImage";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";
import { WishlistButton } from "./WishlistButton";

/**
 * The product-detail page — a literal port of the approved concept board (Product.dc.html for
 * mobile, Product-Desktop.dc.html for desktop). Both boards are one continuous scroll covering the
 * product hero, the "02 — Compare across stores" section and the "03 — Price history" section — there
 * is no separate "compare" state on this board; the multi-product /compare route is its own page
 * (CinematicCompareView).
 *
 * The one deliberate change from the board: the board draws a circular glass "bubble" behind the
 * product photo, with small floating glass dots around it. Per the project owner's standing rule (no
 * circle/frame/panel behind a product image, anywhere, overriding the board itself), that bubble and
 * its floating dots are dropped entirely — the two status badges ("Lowest price" / "-N% today") float
 * directly over a plain photo instead, exactly like the home page's hero visual.
 */

function useSimilar(id: string) {
  return useSWR<{ products: ProductCardData[] }>([`/products/${id}/similar`], fetcher, { revalidateOnFocus: false });
}

function ProductSkeleton() {
  return (
    <div className="page" role="status" aria-label="Loading product">
      <Skeleton className="h-10 w-full max-w-sm rounded-full" />
      <div className="mt-8 flex flex-col items-center gap-6 lg:flex-row-reverse lg:items-start lg:gap-16">
        <Skeleton className="aspect-square w-full max-w-[22rem] rounded-full" />
        <div className="w-full space-y-4">
          <Skeleton className="h-10 w-4/5" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>
      <Skeleton className="mt-10 h-48 w-full rounded-2xl" />
      <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
    </div>
  );
}

/* ------------------------------------------------------- context bar: back / title / save ------------------------------------------------------- */

function ContextBar({ product, lowestPrice }: { product: ProductDetail; lowestPrice: number }) {
  return (
    // Hidden below lg: this sticky bar duplicated the site's own fixed header as a second top bar on
    // a phone screen (B5). Its back/wishlist actions are still reachable on mobile via the breadcrumb
    // and the full Wishlist button lower in the hero.
    <div className="glass-panel sticky top-[4.75rem] z-20 mb-6 hidden items-center justify-between gap-3 rounded-full px-2 py-2 sm:px-3 lg:flex">
      <Link
        href="/categories"
        aria-label="Back to results"
        className="flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-white/[0.14] text-white sm:w-auto sm:px-4"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden strokeWidth={2.4} />
        <span className="hidden text-[12.5px] font-semibold sm:inline">Back to results</span>
      </Link>
      <p className="min-w-0 flex-1 truncate text-center text-[12.5px] font-bold text-white sm:hidden">{product.title}</p>
      <span className="nav-wordmark hidden text-[18px] text-white sm:inline">EX·COMM</span>
      <div className="flex shrink-0 items-center gap-2">
        <span className="spec-label hidden text-xs sm:inline">{formatPrice(lowestPrice)}</span>
        <WishlistButton productId={product.id} title={product.title} variant="icon" className="!h-9 !w-9 !bg-white !text-[#0b0812] hover:!scale-105" />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- breadcrumb ----------------------------------------------------------------- */

function Breadcrumb({ product, categoryName }: { product: ProductDetail; categoryName?: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 px-2 text-[12px] text-white/50">
      <Link href="/" className="hover:text-white">
        Home
      </Link>
      {product.category && (
        <>
          <ChevronRight className="h-3 w-3" aria-hidden />
          <Link href={`/search?category=${product.category}`} className="hover:text-white">
            {categoryName ?? product.category}
          </Link>
        </>
      )}
      <ChevronRight className="h-3 w-3" aria-hidden />
      <span className="truncate font-medium text-white/75" aria-current="page">
        {product.title}
      </span>
    </nav>
  );
}

/* --------------------------------------------------------------------- hero --------------------------------------------------------------------- */

function HeroVisual({ product }: { product: ProductDetail }) {
  return (
    <div className="relative flex h-[14rem] w-full max-w-[16rem] shrink-0 items-center justify-center sm:h-[18rem] sm:max-w-[18rem] lg:h-[22rem] lg:w-[22rem] lg:max-w-none">
      <div data-tilt className="relative flex h-full w-full items-center justify-center">
        <ProductImage src={product.image} alt={product.title} category={product.category} className="h-[85%] w-[85%] drop-shadow-[0_30px_50px_rgba(0,0,0,0.4)]" />
      </div>
      <span className="absolute left-2 top-4 rounded-full bg-emerald-400/90 px-3 py-1.5 text-xs font-extrabold text-[#06281c] sm:left-4">Lowest price</span>
      {product.priceChange7d <= -1 && (
        <span className="absolute bottom-4 right-2 rounded-full bg-[#fcd34d]/95 px-3 py-1.5 text-xs font-extrabold text-[#3f2d05] sm:right-4">
          {Math.round(product.priceChange7d)}% this week
        </span>
      )}
    </div>
  );
}

function SpecGrid({ product, categoryName, storeCount }: { product: ProductDetail; categoryName?: string; storeCount: number }) {
  const cells: { label: string; value: string }[] = [
    { label: "Brand", value: product.brand ?? "Unbranded" },
    { label: "Category", value: categoryName ?? product.category ?? "—" },
    { label: "Rating", value: product.rating ? `${product.rating.toFixed(1)} / 5` : "No ratings yet" },
    { label: "Stores", value: `${storeCount} tracked` },
  ];
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4">
      {cells.map((c) => (
        <div key={c.label}>
          <div className="ec-spec spec-label">{c.label}</div>
          <div className="mt-0.5 text-[13px] font-semibold text-white">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function Hero({
  product,
  categoryName,
  cheapest,
  onAlert,
}: {
  product: ProductDetail;
  categoryName?: string;
  cheapest: { price: number; platform: Platform; url: string; dataSource: string };
  onAlert: () => void;
}) {
  const storeCount = product.platforms.length;
  return (
    <section className="relative overflow-x-clip px-1 pb-10 pt-2 sm:px-2 lg:px-4 lg:pb-14">
      <div className="mx-auto flex max-w-[85rem] flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
        <div className="min-w-0 flex-1 text-center lg:text-left">
          <div className="mb-1.5 flex items-end justify-center gap-2.5 sm:gap-3.5 lg:justify-start">
            <span className="t-numeral select-none text-[3.5rem] leading-[0.78] text-white/90 sm:text-[4.5rem] lg:text-[5.5rem]">01</span>
            <span className="spec-label pb-1.5 text-left text-xs leading-tight text-white/60 sm:pb-2.5 sm:text-xs lg:pb-3">
              Lowest across
              <br />
              {storeCount} {storeCount === 1 ? "store" : "stores"} tracked
            </span>
          </div>

          <h1
            className="mb-3 uppercase text-[1.9rem] leading-[0.95] tracking-[0.01em] text-white sm:text-[2.5rem] lg:text-[3rem]"
            style={{ fontFamily: '"Bebas Neue", var(--font-display), sans-serif', textShadow: "0 6px 24px rgba(0,0,0,0.4)" }}
          >
            {product.title}
          </h1>

          <div className="mb-5 flex flex-wrap items-baseline justify-center gap-2.5 lg:justify-start">
            <span className="text-[1.6rem] font-extrabold text-[#6ee7b7] sm:text-[1.9rem]" data-testid="lowest-price">
              {formatPrice(cheapest.price)}
            </span>
            {product.maxPrice > cheapest.price && <span className="text-[14px] text-white/55 line-through">{formatPrice(product.maxPrice).replace("Rs ", "")}</span>}
            <PriceChange percent={product.priceChange7d} className="!bg-transparent !px-0 !text-[#fda4af]" />
            <span className="mx-1 hidden text-white/30 sm:inline">|</span>
            <Rating value={product.rating} count={product.reviewCount} className="!text-white/70" />
          </div>

          {/* On mobile, show the product photo right after the price (not after the spec grid/buy
              buttons) so it's visible without scrolling at a 390x844 viewport - the lg+ layout
              already puts the same photo in its own column via the HeroVisual sibling below. */}
          <div className="mb-5 flex justify-center lg:hidden">
            <HeroVisual product={product} />
          </div>

          <SpecGrid product={product} categoryName={categoryName} storeCount={storeCount} />

          <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            {/* Hidden below lg: the fixed BuyBar at the bottom of the page already gives mobile/tablet
                a "Buy at {store}" button, and showing both duplicated it on a 390px screen. */}
            <a
              href={cheapest.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2.5 rounded-full bg-white/[0.14] py-2.5 pl-5 pr-2.5 text-[13px] font-bold text-white lg:flex"
            >
              {cheapest.dataSource === "saved" ? "View at" : "Buy at"} {PLATFORM_LABEL[cheapest.platform]} · {formatPrice(cheapest.price)}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#0b0812]">
                <ArrowRight className="h-3.5 w-3.5" aria-hidden strokeWidth={2.6} />
              </span>
            </a>
            <button type="button" onClick={onAlert} className="rounded-full border border-white/20 bg-white/[0.08] px-5 py-3 text-[13px] font-semibold text-white">
              Set price alert
            </button>
          </div>
        </div>

        <div className="hidden lg:block">
          <HeroVisual product={product} />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- similar products -------------------------------------------------------------- */

function SimilarProducts({ id }: { id: string }) {
  const { data, error, isLoading } = useSimilar(id);
  if (error || (data && data.products.length === 0)) return null; // optional section: hide quietly
  return (
    <section className="rail-panel mt-8" aria-labelledby="similar-heading">
      <span className="t-numeral" aria-hidden>
        04
      </span>
      <h2 id="similar-heading" className="spec-label mb-1 text-xs">
        Compare with similar products
      </h2>
      <p className="mb-5 text-[13px] text-white/60">Not the same item? Add these to the compare tray to see them side by side.</p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !data ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />) : data.products.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- bottom bar ---------------------------------------------------------------- */

function BuyBar({ cheapest, platform, dataSource }: { cheapest: number; platform: Platform; dataSource: string }) {
  return (
    <div className="cta-bar fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-full px-5 py-3 lg:hidden" data-testid="buy-bar">
      <div className="min-w-0">
        <p className="truncate text-[12px] font-bold text-white">
          {dataSource === "saved" ? "View at" : "Buy at"} {PLATFORM_LABEL[platform]}
        </p>
        <p className="spec-label text-xs">{formatPrice(cheapest)} · lowest</p>
      </div>
      <span className="btn-round-arrow !h-9 !w-9">
        <ArrowRight className="h-4 w-4" aria-hidden strokeWidth={2.6} />
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------------- page ---------------------------------------------------------------------- */

export function CinematicProductView({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const compare = useCompare();
  const { data: cats } = useCategories();
  const [alertOpen, setAlertOpen] = useState(false);
  // The user id is part of the key so wishlist/alert state reloads after logging in or out.
  const { data, error, isLoading, mutate } = useSWR<{ product: ProductDetail }>([`/products/${id}`, undefined, user?.id ?? null], fetcher as never, { revalidateOnFocus: false, shouldRetryOnError: false });
  const product = data?.product;

  useEffect(() => {
    if (product) document.title = `${product.title} | Ex-Comm`;
  }, [product]);

  const view = useMemo(() => {
    if (!product) return null;
    const retail = product.listings.filter((l) => l.role !== "supplier");
    const pool = retail.filter((l) => l.inStock);
    const cheapest = (pool.length ? pool : retail.length ? retail : product.listings).reduce((a, b) => (b.price < a.price ? b : a));
    const hasSaved = product.listings.some((l) => l.dataSource === "saved");
    const platforms = [...new Set(product.listings.map((l) => l.platform))] as Platform[];
    // PLAN.md item 5: one primary savings figure, from offers checked recently enough to trust - never
    // a stale/failed-check price, and never a second, differently-worded "save" number alongside it.
    const trustedRetail = [...retail.filter((l) => l.inStock && l.status === "checked_recently")].sort((a, b) => a.price - b.price);
    const savings = trustedRetail.length > 1 && trustedRetail[1].price > trustedRetail[0].price
      ? { store: trustedRetail[0].platform, amount: trustedRetail[1].price - trustedRetail[0].price }
      : null;
    return { cheapest, hasSaved, platforms, savings };
  }, [product]);

  if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
    return (
      <div className="page">
        <EmptyState icon={PackageSearch} title="Product not found" description="This product may have been removed, or the link is wrong." action={<Link href="/categories" className="btn-primary">Browse categories</Link>} />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="page">
        <ErrorState title="We could not load this product" onRetry={() => mutate()} />
      </div>
    );
  }
  if (isLoading || !product || !view) return <ProductSkeleton />;

  const categoryName = cats?.categories.find((c) => c.slug === product.category)?.name;
  const { cheapest } = view;

  function openAlert() {
    if (!user) {
      toast.info("Log in to set a price alert.");
      router.push(`/login?next=${encodeURIComponent(currentPath())}`);
      return;
    }
    setAlertOpen(true);
  }

  return (
    <div className="page pb-24 lg:pb-12">
      <ContextBar product={product} lowestPrice={cheapest.price} />
      <Breadcrumb product={product} categoryName={categoryName} />

      <Hero product={product} categoryName={categoryName} cheapest={cheapest} onAlert={openAlert} />

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 lg:justify-start lg:px-4">
        <WishlistButton productId={product.id} title={product.title} variant="full" className="btn-sm" />
        <button type="button" onClick={() => compare.toggle(product.id)} aria-pressed={compare.has(product.id)} className="btn-secondary btn-sm">
          <Scale className="h-4 w-4" aria-hidden /> {compare.has(product.id) ? "Added to compare" : "Add to compare"}
        </button>
        <Link href={`/compare?ids=${product.id}`} className="rounded-full border border-white/20 bg-white/[0.06] px-5 py-2.5 text-[13px] font-semibold text-white">
          Compare stores in a table
        </Link>
      </div>

      {view.savings && (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-emerald-300 lg:justify-start">
          <Crown className="h-3.5 w-3.5" aria-hidden /> Cheapest at {PLATFORM_LABEL[view.savings.store]}, {formatPrice(view.savings.amount)} less than the next store.
        </p>
      )}

      <div className="mt-10 flex flex-col gap-6">
        <OfferTable listings={product.listings} />
        <PriceChart productId={product.id} hasSavedData={view.hasSaved} />
        <div className="flex justify-center lg:justify-start">
          <ReportProblem productId={product.id} title={product.title} />
        </div>
      </div>

      <SimilarProducts id={product.id} />

      {alertOpen && (
        <AlertDialog open onClose={() => setAlertOpen(false)} productId={product.id} title={product.title} currentPrice={cheapest.price} platforms={view.platforms} onSaved={() => mutate()} />
      )}

      <BuyBar cheapest={cheapest.price} platform={cheapest.platform} dataSource={cheapest.dataSource} />
    </div>
  );
}

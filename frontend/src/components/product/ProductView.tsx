"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { BellRing, ChevronRight, ExternalLink, PackageSearch, Scale , Crown} from "lucide-react";
import { ApiError, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/hooks";
import { PLATFORM_LABEL, currentPath, formatPrice } from "@/lib/format";
import type { Platform, ProductCard as ProductCardData, ProductDetail } from "@/lib/types";
import { Button, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { useCompare } from "@/components/compare/CompareProvider";
import { OfferTable } from "./OfferTable";
import { PriceChart } from "./PriceChart";
import { AlertDialog } from "./AlertDialog";
import { PriceChange, Rating } from "./badges";
import { ProductImage, categoryTint } from "./ProductImage";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";
import { WishlistButton } from "./WishlistButton";

function ProductSkeleton() {
  return (
    <div className="page" role="status" aria-label="Loading product">
      <Skeleton className="h-4 w-64" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Skeleton className="aspect-square w-full rounded-card" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-6 h-32 w-full rounded-card" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <Skeleton className="mt-10 h-64 w-full rounded-card" />
    </div>
  );
}

function SimilarProducts({ id }: { id: string }) {
  const { data, error, isLoading } = useSWR<{ products: ProductCardData[] }>([`/products/${id}/similar`], fetcher, { revalidateOnFocus: false });
  if (error || (data && data.products.length === 0)) return null; // optional section: hide quietly
  return (
    <section className="mt-12" aria-labelledby="similar-heading">
      <h2 id="similar-heading" className="t-h2">
        Compare with similar products
      </h2>
      <p className="mt-1 text-sm text-slate-500">Not the same item? Add these to the compare tray to see them side by side.</p>
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !data ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />) : data.products.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

export function ProductView({ id }: { id: string }) {
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
    const highest = Math.max(...retail.map((l) => l.price), cheapest.price);
    return { cheapest, spread: highest - cheapest.price, hasSaved: product.listings.some((l) => l.dataSource === "saved"), platforms: [...new Set(product.listings.map((l) => l.platform))] as Platform[] };
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
    <div className="page">
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
        <Link href="/" className="hover:text-brand-700">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        {product.category && (
          <>
            <Link href={`/search?category=${product.category}`} className="hover:text-brand-700">
              {categoryName ?? product.category}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </>
        )}
        <span className="truncate font-medium text-slate-700" aria-current="page">
          {product.title}
        </span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
        <div className="card self-start p-3 lg:sticky lg:top-24">
          <div className={clsx("overflow-hidden rounded-[1.25rem]", categoryTint(product.category))}>
            <ProductImage src={product.image ?? cheapest.image} alt={product.title} category={product.category} className="aspect-square w-full animate-fade-in p-8 sm:p-14" />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{product.brand ?? categoryName}</p>
          <h1 className="t-h1 mt-1.5">{product.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Rating value={product.rating} count={product.reviewCount} />
            <span className="text-slate-300" aria-hidden>
              |
            </span>
            <span className="text-sm text-slate-500">
              Available at {product.platforms.length} {product.platforms.length === 1 ? "store" : "stores"}
            </span>
            {(product.activeAlerts ?? 0) > 0 && (
              <span className="badge-brand">
                <BellRing className="h-3 w-3" aria-hidden /> {product.activeAlerts} active {product.activeAlerts === 1 ? "alert" : "alerts"}
              </span>
            )}
          </div>

          <div className="card mt-6 animate-fade-up p-5 sm:p-7" data-testid="price-box">
            <p className="text-sm font-semibold text-slate-600">Lowest price</p>
            <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="animate-fade-up font-display text-[clamp(2.5rem,2rem+3vw,4rem)] font-extrabold leading-none tracking-tight tabular-nums text-ink" data-testid="lowest-price">
                {formatPrice(cheapest.price)}
              </span>
              <span className="pb-1 text-sm text-slate-600">
                on <strong className="text-ink">{PLATFORM_LABEL[cheapest.platform]}</strong>
              </span>
              <PriceChange percent={product.priceChange7d} label=" this week" className="mb-1" />
            </div>
            {view.spread > 0 && <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700"><Crown className="h-3.5 w-3.5" aria-hidden />You save up to {formatPrice(view.spread)} compared with the most expensive store.</p>}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a href={cheapest.url} target="_blank" rel="noopener noreferrer" className="btn-primary btn-lg flex-1">
                {cheapest.dataSource === "saved" ? "View on" : "Go to"} {PLATFORM_LABEL[cheapest.platform]} <ExternalLink className="h-4 w-4" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <WishlistButton productId={product.id} title={product.title} variant="full" className="btn-sm" />
              <button type="button" onClick={() => compare.toggle(product.id)} aria-pressed={compare.has(product.id)} className="btn-secondary btn-sm">
                <Scale className="h-4 w-4" aria-hidden /> {compare.has(product.id) ? "Added to compare" : "Add to compare"}
              </button>
              <Link href={`/compare?ids=${product.id}`} className="btn-ghost btn-sm">
                Compare stores
              </Link>
            </div>
          </div>

          <div className="sticky top-[5.25rem] z-20 mt-4 flex items-center justify-between gap-3 rounded-full bg-surface/85 py-2 pl-5 pr-2 shadow-card backdrop-blur-xl" data-testid="alert-bar">
            <p className="min-w-0 truncate text-sm font-semibold text-slate-700">
              <span className="hidden sm:inline">Waiting for a better price? </span>
              <span className="tabular-nums text-ink">{formatPrice(cheapest.price)}</span> now
            </p>
            <Button size="md" onClick={openAlert}>
              <BellRing className="h-4 w-4" aria-hidden /> Set price alert
            </Button>
          </div>

          <div className="mt-6">
            <OfferTable listings={product.listings} />
          </div>
        </div>
      </div>

      <div className="mt-12 space-y-8">
        <PriceChart productId={product.id} hasSavedData={view.hasSaved} />
      </div>

      <SimilarProducts id={product.id} />

      {alertOpen && (
        <AlertDialog open onClose={() => setAlertOpen(false)} productId={product.id} title={product.title} currentPrice={cheapest.price} platforms={view.platforms} onSaved={() => mutate()} />
      )}
    </div>
  );
}

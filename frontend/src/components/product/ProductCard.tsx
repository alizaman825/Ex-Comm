"use client";

import Link from "next/link";
import clsx from "clsx";
import { ArrowDownRight, Check, Crown, Plus } from "lucide-react";
import { PLATFORM_LABEL, formatPrice, timeAgo } from "@/lib/format";
import type { ProductCard as ProductCardData } from "@/lib/types";
import { useCompare } from "@/components/compare/CompareProvider";
import { PlatformDot, Rating } from "./badges";
import { ProductImage, categoryTint } from "./ProductImage";
import { WishlistButton } from "./WishlistButton";

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const compare = useCompare();
  const selected = compare.has(product.id);
  // Retail stores come first; the AliExpress supplier price is listed but never counts as "cheapest".
  const retail = product.offers.filter((o) => o.role !== "supplier");
  const offers = [...retail, ...product.offers.filter((o) => o.role === "supplier")].slice(0, 3);
  // "Best price" / "save Rs X" only ever compares offers checked recently enough to trust (PLAN.md item
  // 5) - a stale or failed-check price must never be the one a badge calls cheapest.
  const trustedRetail = retail.filter((o) => o.status === "checked_recently");
  const lowest = trustedRetail[0];
  const spread = trustedRetail.length > 1 ? trustedRetail[trustedRetail.length - 1].price - trustedRetail[0].price : 0;

  return (
    <article className="card card-hover product-card-cine group relative flex h-full flex-col overflow-hidden" data-testid="product-card">
      <div data-tilt className={clsx("product-media relative m-2 aspect-[5/4] overflow-hidden rounded-[1.1rem]", categoryTint(product.category))}>
        <ProductImage
          src={product.image}
          alt={product.title}
          category={product.category}
          className={clsx("h-full w-full p-6 transition duration-500 ease-soft group-hover:scale-[1.07]", priority && "")}
        />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {lowest && spread > 0 && (
            <span className="badge-best tag-pill tag-pill-best shadow-sm">
              <Crown className="h-3 w-3" aria-hidden /> Best price
            </span>
          )}
          {product.priceChange7d <= -1 && (
            <span className="badge-deal tag-pill tag-pill-drop shadow-sm">
              <ArrowDownRight className="h-3 w-3" aria-hidden />-{Math.abs(product.priceChange7d).toFixed(1)}%<span className="sr-only"> price drop this week</span>
            </span>
          )}
        </div>
        <WishlistButton productId={product.id} title={product.title} className="absolute right-3 top-3 z-10" />
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-2">
        <p className="spec-label truncate text-[11px] font-bold uppercase tracking-wider text-slate-500">{product.brand ?? product.category ?? "Product"}</p>
        <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] font-display text-[15px] font-bold leading-5 text-ink">
          <Link href={`/products/${product.id}`} className="outline-none after:absolute after:inset-0 after:z-0 focus-visible:after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-brand-500">
            {product.title}
          </Link>
        </h3>
        <Rating value={product.rating} count={product.reviewCount} className="mt-2" />
        {retail.length === 1 && product.offers.length === 1 && <p className="mt-1.5 text-xs font-medium text-slate-500">Only on {PLATFORM_LABEL[retail[0].platform]}</p>}

        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="t-price text-[1.7rem] leading-none">{formatPrice(product.minPrice)}</span>
          {spread > 0 && <span className="text-xs text-slate-500">up to {formatPrice(product.maxPrice)}</span>}
        </div>
        {lowest && spread > 0 && (
          <p className="mt-0.5 text-xs font-medium text-emerald-700">
            Cheapest on {PLATFORM_LABEL[lowest.platform]}, save {formatPrice(spread)}
          </p>
        )}

        <ul className="mt-3 space-y-1.5 rounded-2xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/10 backdrop-blur-sm" aria-label="Prices by store">
          {offers.map((o) => (
            <li key={o.listingId} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-white/70">
                <PlatformDot platform={o.platform} />
                <span className="truncate">{PLATFORM_LABEL[o.platform]}</span>
                {o.role === "supplier" && <span className="shrink-0 rounded bg-white/10 px-1 py-px text-[10px] font-medium text-white/65">supplier</span>}
                {o.condition !== "unknown" && o.condition !== "new" && (
                  <span className="shrink-0 rounded bg-[rgb(255_216_77/0.18)] px-1 py-px text-[10px] font-medium text-amber-300">{o.condition}</span>
                )}
                {o.dataSource === "saved" && <span className="shrink-0 rounded bg-[rgb(255_216_77/0.18)] px-1 py-px text-[10px] font-medium text-amber-300">saved</span>}
                {!o.inStock && (
                  <span className="shrink-0 whitespace-nowrap rounded bg-white/10 px-1 py-px text-[10px] font-medium text-white/55">out of stock{o.lastScrapedAt ? ` · checked ${timeAgo(o.lastScrapedAt)}` : ""}</span>
                )}
              </span>
              <span className={clsx("shrink-0 whitespace-nowrap tabular-nums", o === lowest && spread > 0 ? "font-semibold text-emerald-300" : "text-white/70")}>{formatPrice(o.price)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-4">
          <button
            type="button"
            onClick={() => compare.toggle(product.id)}
            aria-pressed={selected}
            className={clsx("relative z-10 w-full !py-2.5 !text-xs !font-bold", selected ? "btn-primary" : "btn-secondary")}
          >
            {selected ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
            {selected ? "Added to compare" : "Add to compare"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="card flex flex-col overflow-hidden" aria-hidden data-testid="product-skeleton">
      <div className="skeleton m-2 aspect-[5/4] !rounded-[1.1rem]" />
      <div className="space-y-3 px-5 pb-5 pt-2">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-6 w-28" />
        <div className="space-y-2 rounded-2xl border border-white/[0.14] bg-white/[0.06] p-3">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-full" />
        </div>
        <div className="skeleton h-9 w-full !rounded-full" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

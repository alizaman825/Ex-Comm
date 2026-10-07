"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, Heart, Trash2 } from "lucide-react";
import { PLATFORM_LABEL, formatPercent, formatPrice, timeAgo } from "@/lib/format";
import { useWishlist } from "@/lib/wishlist";
import type { WishlistItem } from "@/lib/types";
import { EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { PriceChange, Rating } from "@/components/product/badges";
import { ProductImage } from "@/components/product/ProductImage";

type Sort = "recent" | "drop" | "price";
const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Recently saved" },
  { value: "drop", label: "Biggest drop since saved" },
  { value: "price", label: "Price: low to high" },
];

export function sortWishlist(items: WishlistItem[], sort: Sort): WishlistItem[] {
  const copy = [...items];
  if (sort === "drop") return copy.sort((a, b) => a.changeSinceAdded - b.changeSinceAdded);
  if (sort === "price") return copy.sort((a, b) => a.product.minPrice - b.product.minPrice);
  return copy.sort((a, b) => +new Date(b.addedAt) - +new Date(a.addedAt));
}

function WishlistRow({ item, onRemove }: { item: WishlistItem; onRemove: () => void }) {
  const p = item.product;
  const cheapest = p.offers.find((o) => o.role !== "supplier") ?? p.offers[0];
  const saved = item.priceWhenAdded;
  const diff = saved ? p.minPrice - saved : 0;
  return (
    <li className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5" data-testid="wishlist-item">
      <Link href={`/products/${p.id}`} className="block shrink-0 overflow-hidden rounded-2xl border border-slate-100">
        <ProductImage src={p.image} alt="" category={p.category} className="h-28 w-full p-3 sm:w-32" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{p.brand ?? p.category}</p>
        <h2 className="mt-0.5 line-clamp-2 text-base font-semibold leading-snug text-ink">
          <Link href={`/products/${p.id}`} className="hover:text-brand-700">
            {p.title}
          </Link>
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Rating value={p.rating} count={p.reviewCount} />
          <span className="text-xs text-slate-400">Saved {timeAgo(item.addedAt)}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
          <div>
            <p className="t-price text-xl">{formatPrice(p.minPrice)}</p>
            {cheapest && <p className="text-xs text-slate-500">lowest on {PLATFORM_LABEL[cheapest.platform]}</p>}
          </div>
          {saved ? (
            <p className="pb-0.5 text-xs text-slate-500">
              Was {formatPrice(saved)} when saved{" "}
              {Math.abs(item.changeSinceAdded) >= 0.1 && (
                <span className={diff < 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                  ({diff < 0 ? "-" : "+"}
                  {formatPrice(Math.abs(diff))}, {formatPercent(item.changeSinceAdded)})
                </span>
              )}
            </p>
          ) : null}
          <PriceChange percent={p.priceChange7d} label=" this week" />
        </div>
      </div>
      <div className="flex shrink-0 gap-2 sm:flex-col">
        <Link href={`/products/${p.id}`} className="btn-primary btn-sm flex-1">
          <BellRing className="h-3.5 w-3.5" aria-hidden /> View &amp; set alert
        </Link>
        <button type="button" onClick={onRemove} className="btn-secondary btn-sm flex-1 text-rose-600 hover:border-rose-200 hover:bg-rose-50" aria-label={`Remove ${p.title} from wishlist`}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
        </button>
      </div>
    </li>
  );
}

export function WishlistView() {
  const { items, loading, error, reload, toggle } = useWishlist();
  const [sort, setSort] = useState<Sort>("recent");
  const sorted = useMemo(() => sortWishlist(items, sort), [items, sort]);

  return (
    <div className="page max-w-5xl">
      <PageHeader
        title="Your wishlist"
        description="Products you are keeping an eye on. Their prices are re-checked regularly, and you can set an alert on any of them."
        actions={
          items.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="wishlist-sort" className="hidden text-sm text-slate-500 sm:block">
                Sort by
              </label>
              <select id="wishlist-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input w-auto py-2 pr-9">
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )
        }
      />

      {error && !items.length ? (
        <ErrorState title="We could not load your wishlist" onRetry={() => reload()} />
      ) : loading ? (
        <ul className="space-y-4" role="status" aria-label="Loading wishlist">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="card flex gap-4 p-5" aria-hidden>
              <Skeleton className="h-28 w-32 shrink-0" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-7 w-32" />
              </div>
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          description="Tap the heart on any product to save it here and keep track of its price."
          action={
            <>
              <Link href="/search?q=iphone%2016" className="btn-primary">
                Find products
              </Link>
              <Link href="/categories" className="btn-secondary">
                Browse categories
              </Link>
            </>
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500" data-testid="wishlist-count">
            {items.length} {items.length === 1 ? "product" : "products"}
          </p>
          <ul className="space-y-4">
            {sorted.map((item) => (
              <WishlistRow key={item.id} item={item} onRemove={() => toggle(item.product.id, item.product.title)} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

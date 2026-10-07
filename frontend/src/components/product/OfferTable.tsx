import { ExternalLink, PackageX } from "lucide-react";
import clsx from "clsx";
import { PLATFORM_LABEL, formatPrice, formatUsd, timeAgo } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { DataSourceBadge, PlatformDot, Rating } from "./badges";

/** One row per store listing: price, discount, rating, stock, data label and a link to the store. */
export function OfferTable({ listings }: { listings: Listing[] }) {
  const retailInStock = listings.filter((l) => l.role !== "supplier" && l.inStock);
  const lowestId = retailInStock.length ? retailInStock.reduce((a, b) => (b.price < a.price ? b : a)).id : null;
  const ordered = [...listings].sort((a, b) => Number(a.role === "supplier") - Number(b.role === "supplier") || a.price - b.price);

  return (
    <section className="card overflow-hidden" aria-labelledby="offers-heading" data-testid="offer-table">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 id="offers-heading" className="t-h2">
          Compare stores
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">Prices for this product, lowest first. AliExpress is shown as the supplier price for sellers.</p>
      </div>
      <div className="hidden grid-cols-[1.3fr_1.2fr_1fr_0.8fr_1.1fr_auto] gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid" aria-hidden>
        <span>Store</span>
        <span>Price</span>
        <span>Rating</span>
        <span>Stock</span>
        <span>Data</span>
        <span className="w-32" />
      </div>
      <ul className="divide-y divide-slate-100">
        {ordered.map((l) => {
          const isLowest = l.id === lowestId;
          return (
            <li key={l.id} className={clsx("grid gap-x-4 gap-y-3 px-5 py-4 sm:px-6 md:grid-cols-[1.3fr_1.2fr_1fr_0.8fr_1.1fr_auto] md:items-center", isLowest && "bg-emerald-50/60")} data-testid="offer-row" data-platform={l.platform}>
              <div className="flex items-center gap-2.5">
                <PlatformDot platform={l.platform} className="h-3 w-3" />
                <span className="font-semibold text-ink">{PLATFORM_LABEL[l.platform]}</span>
                {isLowest && <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Lowest</span>}
                {l.role === "supplier" && <span className="badge-neutral">Supplier</span>}
              </div>
              <div>
                <p className={clsx("text-lg font-semibold tabular-nums", isLowest ? "text-emerald-700" : "text-ink")}>{formatPrice(l.price)}</p>
                <p className="text-xs text-slate-500">
                  {l.role === "supplier" && l.priceUsd ? <span>{formatUsd(l.priceUsd)} at the saved exchange rate · </span> : null}
                  {l.discountPct > 0 ? (
                    <>
                      <span className="line-through">{formatPrice(l.originalPrice)}</span> <span className="font-medium text-emerald-700">{l.discountPct}% off</span>
                    </>
                  ) : (
                    l.role !== "supplier" && "No discount listed"
                  )}
                </p>
              </div>
              <div>
                <Rating value={l.rating} count={l.reviewCount} />
              </div>
              <div>
                {l.inStock ? (
                  <span className="badge-success">In stock</span>
                ) : (
                  <span className="badge-neutral inline-flex items-center gap-1">
                    <PackageX className="h-3 w-3" aria-hidden /> Out of stock
                  </span>
                )}
              </div>
              <div className="flex flex-col items-start gap-1">
                <DataSourceBadge source={l.dataSource} />
                <span className="text-xs text-slate-400">Updated {timeAgo(l.lastScrapedAt)}</span>
              </div>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className={clsx(isLowest ? "btn-primary" : "btn-secondary", "btn-sm md:w-32")}>
                {l.dataSource === "saved" ? "View on" : "Go to"} {PLATFORM_LABEL[l.platform]} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

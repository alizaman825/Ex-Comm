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
    <section className="card p-3 sm:p-4" aria-labelledby="offers-heading" data-testid="offer-table">
      <div className="px-3 pb-3 pt-2 sm:px-4">
        <h2 id="offers-heading" className="t-h2">
          Compare stores
        </h2>
        <p className="mt-1 text-sm text-slate-600">Prices for this product, lowest first. AliExpress and eBay are shown as supplier prices for sellers.</p>
      </div>
      <ul className="space-y-2.5">
        {ordered.map((l) => {
          const isLowest = l.id === lowestId;
          return (
            <li
              key={l.id}
              className={clsx("rounded-[1.25rem] p-4 transition duration-200 ease-soft sm:p-5", isLowest ? "bg-emerald-50 ring-2 ring-emerald-500/70" : "bg-slate-50 hover:bg-slate-100")}
              data-testid="offer-row"
              data-platform={l.platform}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <PlatformDot platform={l.platform} className="!h-2.5 !w-2.5" />
                    <span className="font-display font-bold text-ink">{PLATFORM_LABEL[l.platform]}</span>
                    {isLowest && <span className="badge-best !px-2 !py-0.5 !text-[10px] uppercase tracking-wide">Lowest</span>}
                    {l.role === "supplier" && <span className="badge-neutral">Supplier</span>}
                  </div>
                  <p className={clsx("mt-2 font-display text-2xl font-extrabold tabular-nums tracking-tight", isLowest ? "text-emerald-700" : "text-ink")}>{formatPrice(l.price)}</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {l.role === "supplier" && l.priceUsd ? <span>{formatUsd(l.priceUsd)} at the saved exchange rate · </span> : null}
                    {l.discountPct > 0 ? (
                      <>
                        <span className="line-through">{formatPrice(l.originalPrice)}</span> <span className="font-semibold text-emerald-700">{l.discountPct}% off</span>
                      </>
                    ) : (
                      l.role !== "supplier" && "No discount listed"
                    )}
                  </p>
                </div>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className={clsx(isLowest ? "btn-primary" : "btn-secondary", "btn-sm !py-2.5")}>
                  {l.dataSource === "saved" ? "View on" : "Go to"} {PLATFORM_LABEL[l.platform]} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <Rating value={l.rating} count={l.reviewCount} />
                {l.inStock ? (
                  <span className="badge-success">In stock</span>
                ) : (
                  <span className="badge-neutral inline-flex items-center gap-1">
                    <PackageX className="h-3 w-3" aria-hidden /> Out of stock
                  </span>
                )}
                <DataSourceBadge source={l.dataSource} />
                <span className="text-xs text-slate-500">Updated {timeAgo(l.lastScrapedAt)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

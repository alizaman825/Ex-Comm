"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, PackageX } from "lucide-react";
import clsx from "clsx";
import { PLATFORM_COLOR, PLATFORM_LABEL, formatPrice, formatUsd } from "@/lib/format";
import type { Listing, Platform } from "@/lib/types";
import { ConditionBadge, Rating, StatusBadge } from "./badges";
import { SectionHeading } from "@/components/ui/SectionHeading";

interface SellerGroup {
  platform: Platform;
  role: "retail" | "supplier";
  /** sorted by price, ascending */
  listings: Listing[];
}

/** Daraz (and in future, other marketplaces) can list the same product from several different sellers;
 * everything else has at most one listing per platform per product. Group so each store is one row
 * unless it has more than one seller, in which case it becomes one expandable row. */
function groupByPlatform(listings: Listing[]): SellerGroup[] {
  const byPlatform = new Map<Platform, Listing[]>();
  for (const l of listings) {
    if (!byPlatform.has(l.platform)) byPlatform.set(l.platform, []);
    byPlatform.get(l.platform)!.push(l);
  }
  return [...byPlatform.entries()]
    .map(([platform, group]) => ({ platform, role: group[0].role, listings: [...group].sort((a, b) => a.price - b.price) }))
    .sort((a, b) => Number(a.role === "supplier") - Number(b.role === "supplier") || a.listings[0].price - b.listings[0].price);
}

/** The board's exact 2-letter store badges (Dz / Po / Ax), tinted with the same platform color used
 * everywhere else in the app (PLATFORM_COLOR). eBay (not on the board) gets the same treatment. */
const BADGE_LETTERS: Record<Platform, string> = { daraz: "Dz", priceoye: "Po", telex: "Tx", aliexpress: "Ax", ebay: "Eb" };

function StoreBadge({ platform }: { platform: Platform }) {
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[12px] font-extrabold text-white"
      style={{ backgroundColor: PLATFORM_COLOR[platform] }}
    >
      {BADGE_LETTERS[platform]}
    </span>
  );
}

/** One row per store, lowest price first; a store with several sellers becomes one expandable row.
 * Ported from the board's "02 — Compare across stores" rows: a glass strip with a store-color badge,
 * name + stock/delivery sub-line, and the price with a "Lowest" / "+N%" / "Check live" tag on the
 * right — a dashed border marks a saved (non-live) reference row, exactly like the board's AliExpress
 * row. */
export function OfferTable({ listings }: { listings: Listing[] }) {
  const retailInStock = listings.filter((l) => l.role !== "supplier" && l.inStock);
  const lowestId = retailInStock.length ? retailInStock.reduce((a, b) => (b.price < a.price ? b : a)).id : null;
  const groups = groupByPlatform(listings);

  return (
    <section className="glass-panel rounded-[1.1rem] p-4 sm:p-5" aria-labelledby="offers-heading" data-testid="offer-table">
      <SectionHeading number="02" className="mb-1">
        <span id="offers-heading">Compare across stores</span>
      </SectionHeading>
      <p className="mb-1 text-[12.5px] text-white/55">
        Prices for this product, lowest first. AliExpress and eBay are shown as supplier prices for sellers; eBay listings can be new, used or refurbished, shown above.
        Shipping cost and cash-on-delivery availability vary by seller and aren&apos;t tracked here — check the store page before ordering. AliExpress/eBay prices exclude
        international shipping and customs duties.
      </p>
      <p className="mb-4 text-[12.5px] text-white/40">
        Prices can change at any time. Confirm the current price on the store before you buy — see how we check prices in our{" "}
        <a href="/methodology" className="underline hover:text-white/60">
          Methodology
        </a>
        .
      </p>
      <ul className="space-y-2.5">
        {groups.map((g) =>
          g.listings.length > 1 ? (
            <SellerGroupRow key={g.platform} group={g} isLowest={g.listings[0].id === lowestId} />
          ) : (
            <OfferRow key={g.listings[0].id} l={g.listings[0]} isLowest={g.listings[0].id === lowestId} />
          )
        )}
      </ul>
    </section>
  );
}

function OfferRow({ l, isLowest }: { l: Listing; isLowest: boolean }) {
  const saved = l.dataSource === "saved" && l.role === "supplier";
  return (
    <li
      className={clsx(
        "rounded-2xl p-3.5 transition duration-200 ease-soft sm:p-4",
        saved ? "border border-dashed border-white/[0.22] bg-white/[0.06]" : isLowest ? "border border-white/30 bg-white/[0.14]" : "border border-white/[0.18] bg-white/[0.08]"
      )}
      data-testid="offer-row"
      data-platform={l.platform}
    >
      <div className="flex flex-wrap items-center gap-3 sm:gap-3.5">
        <StoreBadge platform={l.platform} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-bold text-white">{PLATFORM_LABEL[l.platform]}</span>
            {l.role === "supplier" && <span className="badge-neutral !bg-white/10 !text-white/70">Supplier</span>}
            <ConditionBadge condition={l.condition} label={l.conditionLabel} />
          </div>
          {(l.sellerName || saved) && (
            <p className="ec-spec spec-label mt-0.5">
              {l.sellerName ? `Sold by ${l.sellerName}${l.sellerLocation ? ` · ${l.sellerLocation}` : ""}` : "Saved price · check live"}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={clsx("text-[14px] font-extrabold tabular-nums", isLowest ? "text-[#6ee7b7]" : "text-white")}>
            {l.multiVariant && <span className="mr-1 font-normal text-white/50">from</span>}
            {formatPrice(l.price)}
          </p>
          <span className={clsx("text-[9px] font-bold", isLowest ? "text-[#6ee7b7]" : saved ? "text-indigo-200" : l.discountPct > 0 ? "text-rose-300" : "text-white/40")}>
            {isLowest ? "Lowest" : saved ? "Check live" : l.discountPct > 0 ? `+${l.discountPct}%` : "—"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Rating value={l.rating} count={l.reviewCount} className="!text-white/60" />
          {l.inStock ? (
            <span className="badge-success !bg-emerald-400/15 !text-emerald-300">In stock</span>
          ) : (
            <span className="badge-neutral !bg-white/10 !text-white/60 inline-flex items-center gap-1">
              <PackageX className="h-3 w-3" aria-hidden /> Out of stock
            </span>
          )}
          <StatusBadge status={l.status} lastScrapedAt={l.lastScrapedAt} className="!bg-white/10 !text-white/60" />
        </div>
        {l.discountPct > 0 && (
          <p className="text-[11px] text-white/50">
            <span className="line-through">{formatPrice(l.originalPrice)}</span> <span className="font-semibold text-emerald-300">{l.discountPct}% off</span>
          </p>
        )}
        {l.role === "supplier" && l.priceUsd ? <span className="text-[11px] text-white/50">{formatUsd(l.priceUsd)} at the saved exchange rate</span> : null}
      </div>
      {l.multiVariant && <p className="mt-1.5 text-[11px] text-amber-300">Has several options (size/colour/storage) — the price shown is for the cheapest one.</p>}

      <a
        href={l.url}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx("mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold", isLowest ? "bg-white text-[#0b0812]" : "border border-white/25 bg-white/[0.08] text-white")}
      >
        {l.dataSource === "saved" ? "View on" : "Go to"} {PLATFORM_LABEL[l.platform]} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </li>
  );
}

/** A store with several sellers: one summary row ("4 sellers on Daraz, from Rs X") that expands into
 * one row per seller. */
function SellerGroupRow({ group, isLowest }: { group: SellerGroup; isLowest: boolean }) {
  const [open, setOpen] = useState(false);
  const cheapest = group.listings[0];

  return (
    <li
      className={clsx("rounded-2xl transition duration-200 ease-soft", isLowest ? "border border-white/30 bg-white/[0.14]" : "border border-white/[0.18] bg-white/[0.08]")}
      data-testid="offer-group"
      data-platform={group.platform}
    >
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-3.5 text-left sm:p-4" aria-expanded={open}>
        <StoreBadge platform={group.platform} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-bold text-white">{PLATFORM_LABEL[group.platform]}</span>
            {isLowest && <span className="text-[9px] font-bold text-[#6ee7b7]">Lowest</span>}
            {group.role === "supplier" && <span className="badge-neutral !bg-white/10 !text-white/70">Supplier</span>}
            <span className="text-[11px] text-white/50">{group.listings.length} sellers</span>
          </div>
          <p className={clsx("mt-1 text-[13px] font-extrabold tabular-nums", isLowest ? "text-[#6ee7b7]" : "text-white")}>from {formatPrice(cheapest.price)}</p>
        </div>
        <ChevronDown className={clsx("h-5 w-5 shrink-0 text-white/40 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul className="space-y-2 border-t border-white/10 p-3 pt-3 sm:p-3.5" data-testid="seller-list">
          {group.listings.map((l) => (
            <li key={l.id} className="rounded-xl bg-white/[0.06] p-3" data-testid="seller-row">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-white">{l.sellerName || PLATFORM_LABEL[l.platform]}</p>
                  {l.sellerLocation && <p className="text-[11px] text-white/45">{l.sellerLocation}</p>}
                  <p className="mt-1 text-[13px] font-bold tabular-nums text-white">{formatPrice(l.price)}</p>
                </div>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white">
                  Go to store <ExternalLink className="ml-1 inline h-3 w-3" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <Rating value={l.rating} count={l.reviewCount} className="!text-white/60" />
                {l.inStock ? (
                  <span className="badge-success !bg-emerald-400/15 !text-emerald-300">In stock</span>
                ) : (
                  <span className="badge-neutral !bg-white/10 !text-white/60 inline-flex items-center gap-1">
                    <PackageX className="h-3 w-3" aria-hidden /> Out of stock
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Crown, ExternalLink, Plus, Scale, Star, X } from "lucide-react";
import clsx from "clsx";
import { ApiError, fetcher } from "@/lib/api";
import { PLATFORM_LABEL, formatPrice, timeAgo } from "@/lib/format";
import type { CompareResponse, Listing, Platform, ProductCard as ProductCardData } from "@/lib/types";
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { DataSourceBadge, PlatformDot, PriceChange, Rating } from "@/components/product/badges";
import { ProductImage } from "@/components/product/ProductImage";
import { MAX_COMPARE, useCompare } from "./CompareProvider";

const ID_RE = /^[a-f0-9]{24}$/i;
const PLATFORMS: Platform[] = ["daraz", "priceoye", "aliexpress"];

/** Marks the best value(s) in a row so the table highlights them. */
function bestIndexes(values: (number | null)[], mode: "min" | "max"): Set<number> {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return new Set();
  const best = mode === "min" ? Math.min(...valid) : Math.max(...valid);
  return new Set(values.flatMap((v, i) => (v === best ? [i] : [])));
}

const cheapestRetail = (listings: Listing[]) => {
  const retail = listings.filter((l) => l.role !== "supplier" && l.inStock);
  return retail.length ? retail.reduce((a, b) => (b.price < a.price ? b : a)) : null;
};

function Cell({ best, children, className }: { best?: boolean; children: React.ReactNode; className?: string }) {
  return <td className={clsx("px-4 py-3.5 align-middle", best && "bg-emerald-50/70", className)}>{children}</td>;
}

function RowLabel({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <th scope="row" className="sticky left-0 z-10 w-36 min-w-[9rem] bg-surface px-4 py-3.5 text-left align-middle text-sm font-medium text-slate-600 shadow-[1px_0_0_0_#e2e8f0]">
      {children}
      {sub && <span className="block text-xs font-normal text-slate-400">{sub}</span>}
    </th>
  );
}

function LoadingState({ columns }: { columns: number }) {
  return (
    <div className="card overflow-hidden p-5" role="status" aria-label="Loading comparison">
      <div className="grid gap-4" style={{ gridTemplateColumns: `9rem repeat(${columns}, minmax(0, 1fr))` }}>
        <div />
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
        {Array.from({ length: 5 * (columns + 1) }, (_, i) => (
          <Skeleton key={`r${i}`} className="h-8" />
        ))}
      </div>
    </div>
  );
}

/** One product: its stores become the columns. Stores that do not carry it are still shown, as "not available". */
function StoresTable({ data }: { data: CompareResponse }) {
  const product = data.products[0];
  // One column per store: the cheapest in-stock listing there (or null when the store does not have the product).
  const cols = PLATFORMS.map((platform) => {
    const own = product.listings.filter((l) => l.platform === platform);
    const pool = own.some((l) => l.inStock) ? own.filter((l) => l.inStock) : own;
    return { platform, l: pool.length ? pool.reduce((x, y) => (y.price < x.price ? y : x)) : null };
  }).sort((x, y) => Number(x.l === null) - Number(y.l === null) || Number(x.l?.role === "supplier") - Number(y.l?.role === "supplier") || (x.l?.price ?? 0) - (y.l?.price ?? 0));

  const lowest = bestIndexes(cols.map((c) => (c.l && c.l.role !== "supplier" ? c.l.price : null)), "min");
  const ratings = bestIndexes(cols.map((c) => c.l?.rating ?? null), "max");

  // A row whose cell shows "not available" for stores without the product.
  const row = (label: React.ReactNode, render: (l: Listing, i: number) => React.ReactNode, sub?: string) => (
    <tr>
      <RowLabel sub={sub}>{label}</RowLabel>
      {cols.map((c, i) =>
        c.l ? (
          <Cell key={c.platform} best={lowest.has(i)}>
            {render(c.l, i)}
          </Cell>
        ) : (
          <Cell key={c.platform} className="text-slate-400">
            {label === "Price" ? <span className="text-sm italic">Not available on {PLATFORM_LABEL[c.platform]}</span> : "–"}
          </Cell>
        )
      )}
    </tr>
  );

  return (
    <div className="card overflow-x-auto" data-testid="compare-table" data-mode="platforms">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="sticky left-0 z-10 bg-surface" />
            {cols.map((c, i) => (
              <th key={c.platform} scope="col" className={clsx("px-4 py-5 text-left align-top", lowest.has(i) && "bg-emerald-50/70", !c.l && "bg-slate-50/60")} data-missing={!c.l || undefined}>
                <span className={clsx("flex items-center gap-2 text-base font-semibold", c.l ? "text-ink" : "text-slate-400")}>
                  <PlatformDot platform={c.platform} className={clsx("h-3 w-3", !c.l && "opacity-40")} />
                  {PLATFORM_LABEL[c.platform]}
                </span>
                {lowest.has(i) && (
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-onaccent">
                    <Crown className="h-3 w-3" aria-hidden /> Lowest price
                  </span>
                )}
                {c.l?.role === "supplier" && <span className="badge-neutral mt-1.5">Supplier</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {row("Price", (l, i) => <span className={clsx("text-xl font-semibold tabular-nums", lowest.has(i) ? "text-emerald-700" : "text-ink")}>{formatPrice(l.price)}</span>)}
          {row("Original price", (l) => <span className="tabular-nums text-slate-600">{l.originalPrice && l.originalPrice > l.price ? <span className="line-through">{formatPrice(l.originalPrice)}</span> : "–"}</span>)}
          {row("Discount", (l) => (l.discountPct > 0 ? <span className="badge-success">{l.discountPct}% off</span> : <span className="text-slate-400">–</span>))}
          {row("Rating", (l, i) => (
            <span className="inline-flex items-center gap-1.5">
              <Rating value={l.rating} />
              {ratings.has(i) && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Best</span>}
            </span>
          ))}
          {row("Reviews", (l) => <span className="tabular-nums">{l.reviewCount ? l.reviewCount.toLocaleString("en-PK") : "–"}</span>)}
          {row("Availability", (l) => (l.inStock ? <span className="badge-success">In stock</span> : <span className="badge-neutral">Out of stock</span>))}
          {row(
            "Data",
            (l) => (
              <>
                <DataSourceBadge source={l.dataSource} />
                <span className="mt-1 block text-xs text-slate-400">{timeAgo(l.lastScrapedAt)}</span>
              </>
            ),
            "how recent"
          )}
          {row("Buy", (l, i) => (
            <a href={l.url} target="_blank" rel="noopener noreferrer" className={clsx(lowest.has(i) ? "btn-primary" : "btn-secondary", "btn-sm")}>
              {l.dataSource === "saved" ? "View on" : "Go to"} {PLATFORM_LABEL[l.platform]} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Several products side by side. */
function ProductsTable({ data, onRemove }: { data: CompareResponse; onRemove: (id: string) => void }) {
  const products = data.products;
  const cheapest = products.map((p) => cheapestRetail(p.listings));
  const lowest = bestIndexes(cheapest.map((l) => l?.price ?? null), "min");
  const rating = bestIndexes(products.map((p) => p.rating), "max");
  const drop = bestIndexes(products.map((p) => p.priceChange7d), "min");

  return (
    <div className="card overflow-x-auto" data-testid="compare-table" data-mode="products">
      <table className="w-full border-collapse text-sm" style={{ minWidth: `${160 + products.length * 220}px` }}>
        <thead>
          <tr className="border-b border-slate-100">
            <th className="sticky left-0 z-10 bg-surface" />
            {products.map((p) => (
              <th key={p.id} scope="col" className="px-4 py-5 text-left align-top font-normal">
                <div className="relative">
                  <button type="button" onClick={() => onRemove(p.id)} className="absolute -right-1 -top-1 z-10 rounded-full bg-surface p-1 text-slate-400 shadow-sm ring-1 ring-slate-200 hover:text-rose-600" aria-label={`Remove ${p.title} from comparison`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <Link href={`/products/${p.id}`} className="block">
                    <ProductImage src={p.image} alt={p.title} category={p.category} className="mx-auto h-28 w-full rounded-lg p-2" />
                    <span className="mt-3 line-clamp-2 block text-sm font-semibold leading-5 text-ink hover:text-brand-700">{p.title}</span>
                  </Link>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          <tr>
            <RowLabel sub="in stock, retail">Lowest price</RowLabel>
            {products.map((p, i) => (
              <Cell key={p.id} best={lowest.has(i)}>
                {cheapest[i] ? (
                  <>
                    <span className={clsx("text-xl font-semibold tabular-nums", lowest.has(i) ? "text-emerald-700" : "text-ink")}>{formatPrice(cheapest[i]!.price)}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">on {PLATFORM_LABEL[cheapest[i]!.platform]}</span>
                    {lowest.has(i) && <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-onaccent"><Crown className="h-3 w-3" aria-hidden /> Best price</span>}
                  </>
                ) : (
                  <span className="text-slate-400">Out of stock</span>
                )}
              </Cell>
            ))}
          </tr>
          {PLATFORMS.map((platform) => {
            const prices = products.map((p) => {
              const own = p.listings.filter((l) => l.platform === platform && l.inStock);
              return own.length ? Math.min(...own.map((l) => l.price)) : null;
            });
            if (prices.every((x) => x === null)) return null;
            const best = platform === "aliexpress" ? new Set<number>() : bestIndexes(prices, "min");
            return (
              <tr key={platform}>
                <RowLabel sub={platform === "aliexpress" ? "supplier, saved" : undefined}>
                  <span className="inline-flex items-center gap-2">
                    <PlatformDot platform={platform} />
                    {PLATFORM_LABEL[platform]}
                  </span>
                </RowLabel>
                {prices.map((price, i) => (
                  <Cell key={products[i].id} best={best.has(i)} className="tabular-nums">
                    {price === null ? <span className="text-sm italic text-slate-400">Not available on this store</span> : <span className={clsx(best.has(i) && "font-semibold text-emerald-700")}>{formatPrice(price)}</span>}
                  </Cell>
                ))}
              </tr>
            );
          })}
          <tr>
            <RowLabel>Rating</RowLabel>
            {products.map((p, i) => (
              <Cell key={p.id} best={rating.has(i)}>
                <span className="inline-flex items-center gap-1.5">
                  <Rating value={p.rating} count={p.reviewCount} />
                  {rating.has(i) && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Best rated" />}
                </span>
              </Cell>
            ))}
          </tr>
          <tr>
            <RowLabel>Price, last 7 days</RowLabel>
            {products.map((p, i) => (
              <Cell key={p.id} best={drop.has(i) && p.priceChange7d < -0.5}>
                {Math.abs(p.priceChange7d) < 0.5 ? <span className="text-slate-400">No change</span> : <PriceChange percent={p.priceChange7d} />}
              </Cell>
            ))}
          </tr>
          <tr>
            <RowLabel>Stores</RowLabel>
            {products.map((p) => (
              <Cell key={p.id}>
                <span className="inline-flex flex-wrap gap-1.5">
                  {p.platforms.map((pl) => (
                    <span key={pl} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                      <PlatformDot platform={pl} />
                      {PLATFORM_LABEL[pl]}
                    </span>
                  ))}
                </span>
              </Cell>
            ))}
          </tr>
          <tr>
            <RowLabel>Buy</RowLabel>
            {products.map((p, i) => (
              <Cell key={p.id} best={lowest.has(i)}>
                {cheapest[i] ? (
                  <a href={cheapest[i]!.url} target="_blank" rel="noopener noreferrer" className={clsx(lowest.has(i) ? "btn-primary" : "btn-secondary", "btn-sm")}>
                    {cheapest[i]!.dataSource === "saved" ? "View on" : "Go to"} {PLATFORM_LABEL[cheapest[i]!.platform]} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  <Link href={`/products/${p.id}`} className="btn-secondary btn-sm">
                    View product
                  </Link>
                )}
              </Cell>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Suggestions({ productId, ids, onAdd }: { productId: string; ids: string[]; onAdd: (id: string) => void }) {
  const { data } = useSWR<{ products: ProductCardData[] }>([`/products/${productId}/similar`], fetcher, { revalidateOnFocus: false });
  const items = (data?.products ?? []).filter((p) => !ids.includes(p.id)).slice(0, 4);
  if (!items.length || ids.length >= MAX_COMPARE) return null;
  return (
    <section className="mt-10" aria-labelledby="suggest-heading">
      <h2 id="suggest-heading" className="t-h2">
        Add a similar product
      </h2>
      <p className="mt-1 text-sm text-slate-500">Compare this product with another one, side by side.</p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((p) => (
          <li key={p.id} className="card flex items-center gap-3 p-3">
            <ProductImage src={p.image} alt="" category={p.category} className="h-16 w-16 shrink-0 rounded-lg p-1" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium leading-5 text-ink">{p.title}</p>
              <p className="text-xs text-slate-500">{formatPrice(p.minPrice)}</p>
            </div>
            <button type="button" onClick={() => onAdd(p.id)} className="btn-secondary btn-sm shrink-0" aria-label={`Add ${p.title} to comparison`}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CompareView() {
  const router = useRouter();
  const params = useSearchParams();
  const tray = useCompare();

  const ids = useMemo(() => {
    const raw = (params.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return [...new Set(raw.filter((id) => ID_RE.test(id)))].slice(0, MAX_COMPARE);
  }, [params]);
  const hadBadIds = (params.get("ids") ?? "").split(",").filter(Boolean).length > ids.length;

  const { data, error, isLoading, mutate } = useSWR<CompareResponse>(ids.length ? ["/compare", { ids: ids.join(",") }] : null, fetcher as never, { revalidateOnFocus: false, shouldRetryOnError: false, keepPreviousData: true });

  const setIds = (next: string[]) => router.push(next.length ? `/compare?ids=${next.join(",")}` : "/compare");
  const remove = (id: string) => {
    tray.remove(id);
    setIds(ids.filter((x) => x !== id));
  };
  const add = (id: string) => setIds([...ids, id]);

  const header = (
    <PageHeader
      title="Compare"
      description={ids.length === 1 ? "Every store's price for this product, side by side." : "Products side by side. Green marks the best value in each row."}
      actions={
        ids.length > 0 && (
          <>
            <Link href="/search" className="btn-secondary">
              <Plus className="h-4 w-4" aria-hidden /> Add products
            </Link>
            <Button
              variant="ghost"
              onClick={() => {
                tray.clear();
                router.push("/compare");
              }}
            >
              Clear
            </Button>
          </>
        )
      }
    />
  );

  if (ids.length === 0) {
    const fromTray = tray.ids.length > 0;
    return (
      <div className="page">
        {header}
        <EmptyState
          icon={Scale}
          title={hadBadIds ? "Those comparison links are not valid" : "Nothing to compare yet"}
          description={fromTray ? `You have ${tray.ids.length} product${tray.ids.length > 1 ? "s" : ""} in your compare tray.` : "Use “Add to compare” on search results to pick up to 4 products, or open a product and choose “Compare stores”."}
          action={
            fromTray ? (
              <Link href={`/compare?ids=${tray.ids.join(",")}`} className="btn-primary">
                Compare {tray.ids.length} selected
              </Link>
            ) : (
              <>
                <Link href="/search?q=iphone%2016" className="btn-primary">
                  Try a search
                </Link>
                <Link href="/categories" className="btn-secondary">
                  Browse categories
                </Link>
              </>
            )
          }
        />
      </div>
    );
  }

  // Same measure as the Rating row in the table (review-weighted product rating), so both always agree.
  const rated = (data?.products ?? []).filter((p) => p.rating);
  const topRated = rated.length > 1 ? rated.reduce((a, b) => (b.rating! > a.rating! ? b : a)) : null;

  const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
  return (
    <div className="page">
      {header}
      {notFound ? (
        <EmptyState
          icon={Scale}
          title="Some of these products no longer exist"
          description="The comparison link may be old. Start a new comparison from the search results."
          action={
            <Link href="/search?q=iphone%2016" className="btn-primary" onClick={() => tray.clear()}>
              Start a new comparison
            </Link>
          }
        />
      ) : error && !data ? (
        <ErrorState title="We could not load the comparison" onRetry={() => mutate()} />
      ) : isLoading || !data ? (
        <LoadingState columns={Math.max(ids.length, 2)} />
      ) : (
        <>
          {data.mode === "products" && data.cheapest && (
            <div className="mb-5 flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm text-emerald-900" data-testid="compare-summary">
              <p>
                <strong>Best price:</strong> {data.products.find((p) => p.id === data.cheapest!.productId)?.title} at {formatPrice(data.cheapest.price)} on {PLATFORM_LABEL[data.cheapest.platform]}
              </p>
              {topRated && (
                <p>
                  <strong>Best rated:</strong> {topRated.title} ({topRated.rating!.toFixed(1)} from {topRated.reviewCount.toLocaleString("en-PK")} reviews)
                </p>
              )}
            </div>
          )}
          {data.mode === "platforms" ? (
            <Fragment>
              <div className="mb-5 flex items-center gap-4 rounded-card border border-slate-200 bg-surface p-4">
                <ProductImage src={data.products[0].image} alt="" category={data.products[0].category} className="h-16 w-16 shrink-0 rounded-lg p-1" />
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${data.products[0].id}`} className="line-clamp-2 text-base font-semibold text-ink hover:text-brand-700">
                    {data.products[0].title}
                  </Link>
                  <p className="text-sm text-slate-500">{data.products[0].platforms.length} stores</p>
                </div>
                <button type="button" onClick={() => remove(data.products[0].id)} className="btn-ghost btn-sm shrink-0">
                  Remove
                </button>
              </div>
              <StoresTable data={data} />
            </Fragment>
          ) : (
            <ProductsTable data={data} onRemove={remove} />
          )}
          {data.products.length < MAX_COMPARE && <Suggestions productId={data.products[0].id} ids={ids} onAdd={add} />}
        </>
      )}
    </div>
  );
}

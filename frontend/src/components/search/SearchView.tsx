"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ChevronDown, Loader2, PackageSearch, Search, SlidersHorizontal, TrendingUp } from "lucide-react";
import clsx from "clsx";
import { api, errorMessage, fetcher } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { problemsSentence, storeProblems } from "@/lib/stores";
import { useCategories, useTrendingSearches } from "@/lib/hooks";
import { BACKGROUND_SYNC_PLATFORMS, SHOW_MAX, SHOW_STEP, SORTS, SUPPLIER_PLATFORMS, activeFilterCount, parseSearchParams, toSearchParams, type SearchState, type SortValue } from "@/lib/search";
import { PLATFORM_LABEL } from "@/lib/format";
import type { Platform, SearchResponse } from "@/lib/types";
import { ErrorState, EmptyState } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/Drawer";
import { Pagination } from "@/components/ui/Pagination";
import { ProductCard, ProductGridSkeleton } from "@/components/product/ProductCard";
import { Filters } from "./Filters";
import { SourceBanner, bannerMessage, TONE, kindOf } from "./SourceBanner";
import { AliExpressCheck } from "./AliExpressCheck";
import { EbayCheck } from "./EbayCheck";

const PAGE_SIZE = 12;

export function SearchView() {
  const router = useRouter();
  const params = useSearchParams();
  const state = useMemo(() => parseSearchParams(new URLSearchParams(params.toString())), [params]);
  const toast = useToast();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { data: catData } = useCategories();
  const categories = catData?.categories ?? [];
  const categoryName = categories.find((c) => c.slug === state.category)?.name;

  const tooShort = state.q.length > 0 && state.q.length < 2 && !state.category;
  const hasQuery = Boolean((state.q && !tooShort) || state.category);
  // Phase 4 Part A2: fastLocal asks the server to answer from the database immediately for a brand-new
  // query (instead of blocking on Daraz/PriceOye) while it checks the stores in the background; while the
  // response says that check is still pending, poll again shortly so the live results replace it as soon
  // as they land - never show only skeletons while local results already exist.
  const queryParams = { q: state.q, category: state.category, platform: state.platform.join(","), minPrice: state.minPrice, maxPrice: state.maxPrice, minRating: state.minRating, sort: state.sort, page: state.page, pageSize: PAGE_SIZE, limit: state.show, fastLocal: true };
  const key = hasQuery ? (["/search", queryParams] as const) : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR<SearchResponse>(key, fetcher as never, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    refreshInterval: (latest) => (latest?.liveStatus === "pending" ? 900 : 0),
  });

  // Ask the server to check the stores again (it ignores any earlier live result), then show the new results.
  async function refresh() {
    setRefreshing(true);
    try {
      const fresh = await api<SearchResponse>("/search", { params: { ...queryParams, refresh: true } });
      await mutate(fresh, { revalidate: false });
      if (fresh.source === "live") toast.success("Checked the stores: results are up to date");
      else toast.error(`Could not check the stores: ${problemsSentence(storeProblems(fresh.platformStatus)) || "no answer"}. Showing saved data.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }

  const update = useCallback(
    (patch: Partial<SearchState>, keepPage = false) => {
      const next = { ...state, ...patch, page: keepPage ? (patch.page ?? state.page) : 1, show: keepPage ? (patch.show ?? state.show) : SHOW_STEP };
      router.push(`/search?${toSearchParams(next).toString()}`, { scroll: false });
    },
    [router, state]
  );
  const reset = useCallback(() => update({ category: "", platform: [], minPrice: undefined, maxPrice: undefined, minRating: undefined }), [update]);
  const filterCount = activeFilterCount(state);
  const checkedSuppliers = SUPPLIER_PLATFORMS.filter((p) => Boolean(data?.platformStatus[p]));

  const heading = state.q ? (
    <>
      Results for <span className="swash">&ldquo;{state.q}&rdquo;</span>
    </>
  ) : (
    categoryName ?? "Browse products"
  );

  if (!hasQuery) {
    return (
      <div className="page">
        <EmptyState icon={Search} title={tooShort ? "Search for at least 2 characters" : "What are you looking for?"} description={tooShort ? "A single letter is too short to search. Try a product name such as “iphone 16”." : "Type a product name in the search bar, or browse a category."} action={<Link href="/categories" className="btn-primary">Browse categories</Link>} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="t-h1">{heading}</h1>
          <p className="mt-1.5 text-sm text-slate-500" aria-live="polite" data-testid="result-count">
            {data ? (
              <>
                {data.mode === "live" ? (
                  (() => {
                    const shown = Math.min(state.show, data.total);
                    const estimated = Math.max(data.estimatedTotal ?? 0, data.total);
                    const noun = estimated === 1 ? "product" : "products";
                    // "about" only makes sense once the store total is itself an estimate bigger than what's shown
                    return estimated > shown ? (
                      <>
                        {shown.toLocaleString("en-PK")} of about {estimated.toLocaleString("en-PK")} {noun} from the stores
                      </>
                    ) : (
                      <>
                        {shown.toLocaleString("en-PK")} {noun} from the stores
                      </>
                    );
                  })()
                ) : (
                  <>
                    {data.total.toLocaleString("en-PK")} {data.total === 1 ? "product" : "products"}
                  </>
                )}
                {state.q && categoryName ? ` in ${categoryName}` : ""}
              </>
            ) : isLoading ? (
              "Searching Daraz and PriceOye…"
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="btn-secondary lg:hidden" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters{filterCount > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs text-onbrand">{filterCount}</span>}
          </button>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="hidden text-sm text-slate-500 sm:block">
              Sort by
            </label>
            <div className="relative">
              <select
                id="sort"
                value={state.sort}
                onChange={(e) => update({ sort: e.target.value as SortValue })}
                className="input glass-select w-auto appearance-none py-2 pl-3.5 pr-9"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[16.5rem_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="card sticky top-24 p-5">
            <Filters state={state} checkedSuppliers={checkedSuppliers} categories={categories} onChange={(p) => update(p)} onReset={reset} />
          </div>
        </aside>

        <section aria-label="Search results" className="min-w-0">
          {data && (
            <details className="status-strip-mobile group rounded-3xl" data-testid="status-strip">
              <summary className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-3xl glass-panel px-5 py-3 text-sm text-white/85 sm:cursor-default">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className={clsx("shrink-0", TONE[kindOf(data)].chipCls)}>{TONE[kindOf(data)].chip}</span>
                  <span className="truncate">{bannerMessage(data)}</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-white/60 transition-transform group-open:rotate-180 sm:hidden" aria-hidden />
              </summary>
              <div className="status-strip-content mt-3 space-y-3">
                <SourceBanner data={data} onRefresh={refresh} refreshing={refreshing} />
                {!data.demoMode && state.q && !tooShort && (
                  <>
                    <AliExpressCheck query={state.q} checkedCount={data.platformStatus.aliexpress?.loaded} onChecked={() => mutate()} />
                    <EbayCheck query={state.q} checkedCount={data.platformStatus.ebay?.loaded} onChecked={() => mutate()} />
                  </>
                )}
              </div>
            </details>
          )}

          {error && !data ? (
            <ErrorState title="We could not load results" description="The search service did not respond. Check your connection and try again." onRetry={() => mutate()} />
          ) : isLoading && !data ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 rounded-full bg-surface px-5 py-3 text-sm text-slate-600 shadow-card" role="status">
                <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden /> Checking Daraz and PriceOye for the latest prices. This can take up to 30 seconds if a store is slow.
              </div>
              <ProductGridSkeleton count={PAGE_SIZE} />
            </div>
          ) : data && data.total === 0 && data.liveStatus === "pending" ? (
            // Phase 4 Part A1: a brand-new query with no saved match yet, DB check back instantly but the
            // live Daraz/PriceOye check is still running in the background (polled via refreshInterval
            // above) - never show "No results found" while that check hasn't actually finished.
            <div className="space-y-4" data-testid="pending-live-search">
              <div className="flex items-center gap-2.5 rounded-full bg-surface px-5 py-3 text-sm text-slate-600 shadow-card" role="status">
                <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden /> This is a new search - checking Daraz and PriceOye live. This can take a few seconds.
              </div>
              <ProductGridSkeleton count={PAGE_SIZE} />
            </div>
          ) : data && data.total === 0 ? (
            <NoResults query={state.q} filterCount={filterCount} platform={state.platform} onReset={reset} />
          ) : data ? (
            <>
              <div className={clsx("mt-5 grid grid-cols-1 gap-6 transition-opacity sm:grid-cols-2 xl:grid-cols-3", (isValidating || refreshing) && "opacity-60")} data-testid="results-grid">
                {data.results.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 3} />
                ))}
              </div>
              {error && <p className="mt-4 text-center text-sm text-rose-600">Could not refresh results. Showing the previous ones.</p>}
              {data.mode === "live" ? (
                data.hasMore && state.show < SHOW_MAX && data.results.length >= state.show && (
                  <div className="mt-8 flex flex-col items-center gap-2">
                    <button type="button" className="btn-primary" disabled={isValidating} onClick={() => update({ show: state.show + SHOW_STEP }, true)} data-testid="show-more">
                      {isValidating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                      {isValidating ? "Loading more from the stores…" : "Show more"}
                    </button>
                    <p className="text-xs text-slate-500">Showing {data.results.length.toLocaleString("en-PK")} so far. More are loaded from Daraz and PriceOye when you ask.</p>
                  </div>
                )
              ) : (
                <Pagination
                  page={data.page}
                  pages={data.pages}
                  onPage={(p) => {
                    update({ page: p }, true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              )}
              {data.otherResults && data.otherResults.length > 0 && (
                <details className="mt-10 rounded-2xl border border-slate-200 bg-surface p-4" data-testid="other-models">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                    {data.otherTotal} other model{data.otherTotal === 1 ? "" : "s"} close to this search
                  </summary>
                  <p className="mt-2 text-xs text-slate-500">
                    These did not pass the exact-model check above - a different storage size, variant, or model number - so they are not counted in the {data.total} results shown.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {data.otherResults.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                </details>
              )}
            </>
          ) : null}
        </section>
      </div>

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={
          <button type="button" className="btn-primary w-full" onClick={() => setFiltersOpen(false)}>
            Show {data ? data.total.toLocaleString("en-PK") : ""} results
          </button>
        }
      >
        <Filters state={state} checkedSuppliers={checkedSuppliers} categories={categories} onChange={(p) => update(p)} onReset={reset} showTitle={false} />
      </Drawer>
    </div>
  );
}

function NoResults({ query, filterCount, platform, onReset }: { query: string; filterCount: number; platform: Platform[]; onReset: () => void }) {
  const { data } = useTrendingSearches(6);
  // 2026-11-22 live-site review: Telex/Mega are synced in the background on a schedule, not checked
  // live per search (SourceBanner's own BACKGROUND_SYNC_PLATFORMS), so a zero-result search with one
  // of them checked means "not found in what we've synced from that store so far" - it does NOT mean
  // the store doesn't carry the product (ali's "Samsung Galaxy A17 on Telex.pk" report: the listing
  // existed on the real site but hadn't been matched into search yet). Telling a shopper "no products
  // match" here would read as a confirmed absence we can't actually back up, so the wording says what
  // we know instead whenever a background-synced store is part of the active filter.
  const syncOnlyStores = platform.filter((p) => BACKGROUND_SYNC_PLATFORMS.includes(p));
  const syncOnlyNames = syncOnlyStores.map((p) => PLATFORM_LABEL[p]).join(" or ");
  const title =
    filterCount > 0
      ? syncOnlyStores.length
        ? query
          ? `No “${query}” matches among what we’ve synced from ${syncOnlyNames} so far`
          : `No matches among what we’ve synced from ${syncOnlyNames} so far`
        : query
          ? `No “${query}” products match these filters`
          : "No products match these filters"
      : `No products found for “${query}”`;
  const description = syncOnlyStores.length
    ? `${syncOnlyNames} ${syncOnlyStores.length > 1 ? "are" : "is"} synced on a schedule, not checked live per search - this product may still be on their site and not yet matched into search. Try removing that filter, or check back later.`
    : filterCount > 0
      ? "Try removing a filter, or search for something broader."
      : "Check the spelling, or try a more general name such as the brand and model (for example “galaxy a55”).";
  return (
    <div className="mt-5">
      <EmptyState
        icon={PackageSearch}
        title={title}
        description={description}
        action={filterCount > 0 ? <button type="button" className="btn-primary" onClick={onReset}>Clear all filters</button> : <Link href="/categories" className="btn-secondary">Browse categories</Link>}
      />
      {data && data.trending.length > 0 && (
        <div className="mt-8">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
            <TrendingUp className="h-4 w-4 text-brand-600" aria-hidden /> Popular searches
          </p>
          <div className="flex flex-wrap gap-2">
            {data.trending.map((t) => (
              <Link key={t.query} href={`/search?q=${encodeURIComponent(t.query)}`} className="chip">
                {t.query}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Loader2, PackageSearch, Search, SlidersHorizontal, TrendingUp } from "lucide-react";
import clsx from "clsx";
import { api, errorMessage, fetcher } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { problemsSentence, storeProblems } from "@/lib/stores";
import { useCategories, useTrendingSearches } from "@/lib/hooks";
import { SHOW_MAX, SHOW_STEP, SORTS, SUPPLIER_PLATFORMS, activeFilterCount, parseSearchParams, toSearchParams, type SearchState, type SortValue } from "@/lib/search";
import type { SearchResponse } from "@/lib/types";
import { ErrorState, EmptyState } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/Drawer";
import { Pagination } from "@/components/ui/Pagination";
import { ProductCard, ProductGridSkeleton } from "@/components/product/ProductCard";
import { Filters } from "./Filters";
import { SourceBanner } from "./SourceBanner";
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
  const queryParams = { q: state.q, category: state.category, platform: state.platform.join(","), minPrice: state.minPrice, maxPrice: state.maxPrice, minRating: state.minRating, sort: state.sort, page: state.page, pageSize: PAGE_SIZE, limit: state.show };
  const key = hasQuery ? (["/search", queryParams] as const) : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR<SearchResponse>(key, fetcher as never, { keepPreviousData: true, revalidateOnFocus: false, shouldRetryOnError: false });

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
                  <>
                    Showing {Math.min(state.show, data.total).toLocaleString("en-PK")} of about {Math.max(data.estimatedTotal ?? 0, data.total).toLocaleString("en-PK")} {data.estimatedTotal === 1 ? "product" : "products"} found in the stores
                  </>
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
            <select id="sort" value={state.sort} onChange={(e) => update({ sort: e.target.value as SortValue })} className="input w-auto py-2 pr-9">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
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
          {data && <SourceBanner data={data} onRefresh={refresh} refreshing={refreshing} />}
          {data && !data.demoMode && state.q && !tooShort && (
            <>
              <AliExpressCheck query={state.q} checkedCount={data.platformStatus.aliexpress?.loaded} onChecked={() => mutate()} />
              <EbayCheck query={state.q} checkedCount={data.platformStatus.ebay?.loaded} onChecked={() => mutate()} />
            </>
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
          ) : data && data.total === 0 ? (
            <NoResults query={state.q} filterCount={filterCount} onReset={reset} />
          ) : data ? (
            <>
              <div className={clsx("mt-5 grid grid-cols-1 gap-6 transition-opacity sm:grid-cols-2 xl:grid-cols-3", (isValidating || refreshing) && "opacity-60")} data-testid="results-grid">
                {data.results.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 3} />
                ))}
              </div>
              {error && <p className="mt-4 text-center text-sm text-rose-600">Could not refresh results. Showing the previous ones.</p>}
              {data.mode === "live" ? (
                data.hasMore && state.show < SHOW_MAX && (
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
            </>
          ) : null}
        </section>
      </div>

      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <Filters state={state} checkedSuppliers={checkedSuppliers} categories={categories} onChange={(p) => update(p)} onReset={reset} />
        <button type="button" className="btn-primary mt-6 w-full" onClick={() => setFiltersOpen(false)}>
          Show {data ? data.total : ""} results
        </button>
      </Drawer>
    </div>
  );
}

function NoResults({ query, filterCount, onReset }: { query: string; filterCount: number; onReset: () => void }) {
  const { data } = useTrendingSearches(6);
  return (
    <div className="mt-5">
      <EmptyState
        icon={PackageSearch}
        title={filterCount > 0 ? (query ? `No “${query}” products match these filters` : "No products match these filters") : `No products found for “${query}”`}
        description={
          filterCount > 0 ? "Try removing a filter, or search for something broader." : "Check the spelling, or try a more general name such as the brand and model (for example “galaxy a55”)."
        }
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

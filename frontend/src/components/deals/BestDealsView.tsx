"use client";

import { useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";
import clsx from "clsx";
import { fetcher } from "@/lib/api";
import { PLATFORMS } from "@/lib/search";
import { PLATFORM_LABEL } from "@/lib/format";
import { useCategories } from "@/lib/hooks";
import type { Platform, ProductCard as ProductCardData } from "@/lib/types";
import { ProductCard, ProductGridSkeleton } from "@/components/product/ProductCard";
import { Button, EmptyState, ErrorState } from "@/components/ui/primitives";

const LIMIT = 24;

type SortMode = "drop" | "price_asc" | "price_desc";

const SORTS: { value: SortMode; label: string }[] = [
  { value: "drop", label: "Biggest drop" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

function sortProducts(products: ProductCardData[], sort: SortMode) {
  const copy = [...products];
  if (sort === "price_asc") copy.sort((a, b) => a.minPrice - b.minPrice);
  else if (sort === "price_desc") copy.sort((a, b) => b.minPrice - a.minPrice);
  else copy.sort((a, b) => a.priceChange7d - b.priceChange7d);
  return copy;
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx("chip", active && "!bg-brand-600 !text-onbrand !ring-brand-600 hover:!bg-brand-600 hover:!text-onbrand")}
    >
      {children}
    </button>
  );
}

/**
 * /best-deals — products currently at their biggest price drops across stores, quick to scan.
 * Reuses the same glass `.card`/`.chip` tokens and `ProductCard` the rest of the cinematic UI
 * already uses (home, search, categories), so this page matches without any bespoke styling.
 */
export function BestDealsView() {
  const [category, setCategory] = useState("");
  const [store, setStore] = useState<Platform | "">("");
  const [sort, setSort] = useState<SortMode>("drop");

  const { data: catData } = useCategories();
  const { data, error, isLoading, mutate } = useSWR<{ products: ProductCardData[] }>(
    ["/products/drops", { limit: LIMIT, category: category || undefined }],
    fetcher,
    { revalidateOnFocus: false }
  );

  const products = useMemo(() => {
    const base = data?.products ?? [];
    const filtered = store ? base.filter((p) => p.platforms.includes(store)) : base;
    return sortProducts(filtered, sort);
  }, [data, store, sort]);

  const categories = catData?.categories ?? [];
  const hasFilters = Boolean(category || store);

  return (
    <div className="page">
      <div className="mb-8">
        <div className="mb-2 flex items-end gap-3">
          <span className="t-numeral text-[2.75rem] leading-none sm:text-[3.25rem]">01</span>
          <span className="spec-label pb-1 text-xs sm:text-xs">Checked across every store, updated live</span>
        </div>
        <h1 className="t-h1">Best deals right now</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-500 sm:text-base">
          Products at their biggest price drops across Daraz, PriceOye and more — sort or filter to find yours.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
        <FilterChip active={!category} onClick={() => setCategory("")}>
          All categories
        </FilterChip>
        {categories.map((c) => (
          <FilterChip key={c.slug} active={category === c.slug} onClick={() => setCategory(c.slug)}>
            {c.name}
          </FilterChip>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by store">
          <FilterChip active={!store} onClick={() => setStore("")}>
            All stores
          </FilterChip>
          {PLATFORMS.map((p) => (
            <FilterChip key={p} active={store === p} onClick={() => setStore(p)}>
              {PLATFORM_LABEL[p]}
            </FilterChip>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-500">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="input w-auto py-2 text-sm">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && !data ? (
        <ErrorState title="Could not load deals" onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <ProductGridSkeleton count={8} />
      ) : products.length === 0 ? (
        <EmptyState
          title="No deals match these filters"
          description="Try a different store or category."
          action={
            hasFilters && (
              <Button
                variant="secondary"
                onClick={() => {
                  setCategory("");
                  setStore("");
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

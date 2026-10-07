"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useCategories } from "@/lib/hooks";
import { CategoryIcon } from "@/components/product/ProductImage";
import { ErrorState } from "@/components/ui/primitives";

/** Each category with its preset searches. */
export function CategoriesView() {
  const { data, error, isLoading, mutate } = useCategories();

  if (error && !data) return <ErrorState title="Could not load categories" onRetry={() => mutate()} />;
  if (isLoading || !data) {
    return (
      <div className="grid gap-5 lg:grid-cols-2" role="status" aria-label="Loading categories">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="card p-6" aria-hidden>
            <div className="flex items-center gap-4">
              <div className="skeleton h-14 w-14 rounded-2xl" />
              <div className="space-y-2">
                <div className="skeleton h-5 w-32" />
                <div className="skeleton h-3 w-20" />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {Array.from({ length: 4 }, (_, j) => (
                <div key={j} className="skeleton h-8 w-24 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {data.categories.map((c) => (
        <section key={c.slug} className="card card-pad flex flex-col" aria-labelledby={`cat-${c.slug}`} data-testid="category-section">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <CategoryIcon slug={c.slug} className="h-7 w-7" />
              </span>
              <div>
                <h2 id={`cat-${c.slug}`} className="t-h2">
                  {c.name}
                </h2>
                <p className="text-sm text-slate-500">{c.productCount} products compared</p>
              </div>
            </div>
            <Link href={`/search?category=${c.slug}`} className="btn-secondary btn-sm shrink-0">
              Browse all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Popular searches</p>
          <div className="flex flex-wrap gap-2">
            {c.keywords.map((k) => (
              <Link key={k} href={`/search?q=${encodeURIComponent(k)}&category=${c.slug}`} className="chip">
                {k}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

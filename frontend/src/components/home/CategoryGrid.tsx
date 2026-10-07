"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useCategories } from "@/lib/hooks";
import { CategoryIcon } from "@/components/product/ProductImage";
import { ErrorState } from "@/components/ui/primitives";

export function CategoryGrid({ compact = false }: { compact?: boolean }) {
  const { data, error, isLoading, mutate } = useCategories();

  if (error && !data) return <ErrorState title="Could not load categories" onRetry={() => mutate()} />;
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6" role="status" aria-label="Loading categories">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="card p-5" aria-hidden>
            <div className="skeleton h-12 w-12 rounded-xl" />
            <div className="skeleton mt-4 h-4 w-24" />
            <div className="skeleton mt-2 h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <ul className={compact ? "grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
      {data.categories.map((c) => (
        <li key={c.slug}>
          <Link href={`/search?category=${c.slug}`} className="card card-hover group flex h-full flex-col p-5" data-testid="category-card">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
              <CategoryIcon slug={c.slug} className="h-6 w-6" />
            </span>
            <span className="mt-4 text-base font-semibold text-ink">{c.name}</span>
            <span className="mt-0.5 text-sm text-slate-500">{c.productCount} products</span>
            {!compact && <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">Browse {c.name.toLowerCase()} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden /></span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

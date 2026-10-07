"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useCategories } from "@/lib/hooks";
import { CategoryTile } from "@/components/product/ProductImage";
import { ErrorState } from "@/components/ui/primitives";
import { RiseIn } from "@/components/landing/bits";

/** One pastel per category (token names), so every tile has its own colour. */
const PASTEL: Record<string, string> = {
  mobiles: "bg-sky",
  laptops: "bg-lilac",
  audio: "bg-peach",
  watches: "bg-butter",
  "home-appliances": "bg-mint",
  fashion: "bg-peach",
};
const pastelFor = (slug: string, i: number) => PASTEL[slug] ?? ["bg-peach", "bg-mint", "bg-sky", "bg-lilac", "bg-butter"][i % 5];

export function CategoryGrid({ compact = false }: { compact?: boolean }) {
  const { data, error, isLoading, mutate } = useCategories();

  if (error && !data) return <ErrorState title="Could not load categories" onRetry={() => mutate()} />;
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6" role="status" aria-label="Loading categories">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="card p-5" aria-hidden>
            <div className="skeleton h-24 w-full !rounded-2xl" />
            <div className="skeleton mt-4 h-4 w-24" />
            <div className="skeleton mt-2 h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <ul className={compact ? "grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6" : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"}>
      {data.categories.map((c, i) => (
        <li key={c.slug}>
          <RiseIn index={i} className="h-full">
            <Link href={`/search?category=${c.slug}`} className="card card-hover group flex h-full flex-col p-3 pb-5" data-testid="category-card">
              <span className={`${pastelFor(c.slug, i)} relative flex aspect-[5/4] items-center justify-center overflow-hidden rounded-[1.1rem]`}>
                <CategoryTile category={c.slug} label="" className="absolute inset-0 !bg-none transition duration-500 ease-soft group-hover:scale-110 group-hover:-rotate-3" />
              </span>
              <span className="mt-4 px-2 font-display text-base font-bold text-ink">{c.name}</span>
              <span className="mt-0.5 px-2 text-sm text-slate-600">{c.productCount} products</span>
              {!compact && (
                <span className="mt-4 inline-flex items-center gap-1 px-2 text-sm font-bold text-ink">
                  Browse {c.name.toLowerCase()} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
                </span>
              )}
            </Link>
          </RiseIn>
        </li>
      ))}
    </ul>
  );
}

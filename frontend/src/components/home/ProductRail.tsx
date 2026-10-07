"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight } from "lucide-react";
import { fetcher } from "@/lib/api";
import type { ProductCard as ProductCardData } from "@/lib/types";
import { ProductCard, ProductCardSkeleton } from "@/components/product/ProductCard";
import { EmptyState, ErrorState } from "@/components/ui/primitives";
import { PackageSearch } from "lucide-react";

interface Props {
  title: string;
  description: string;
  endpoint: "/products/drops" | "/products/trending";
  limit?: number;
  href?: string;
  linkLabel?: string;
}

/** A titled row of product cards loaded from the API, with loading, empty and error states. */
export function ProductRail({ title, description, endpoint, limit = 4, href, linkLabel = "See all" }: Props) {
  const { data, error, isLoading, mutate } = useSWR<{ products: ProductCardData[] }>([endpoint, { limit }], fetcher, { revalidateOnFocus: false });

  return (
    <section className="section" aria-labelledby={`rail-${endpoint}`}>
      <div className="container">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 id={`rail-${endpoint}`} className="t-h2">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          {href && (
            <Link href={href} className="hidden items-center gap-1 text-sm font-semibold text-brand-600 hover:underline sm:inline-flex">
              {linkLabel} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>

        {error && !data ? (
          <ErrorState title="Could not load products" onRetry={() => mutate()} />
        ) : isLoading || !data ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label={`Loading ${title}`}>
            {Array.from({ length: limit }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : data.products.length === 0 ? (
          <EmptyState icon={PackageSearch} title="Nothing here yet" description="Products will appear as prices are collected." />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

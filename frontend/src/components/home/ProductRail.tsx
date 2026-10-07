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
  /** no section padding/backdrop of its own (the parent provides it) */
  bare?: boolean;
}

/** A titled row of product cards loaded from the API, with loading, empty and error states. */
export function ProductRail({ title, description, endpoint, limit = 4, href, linkLabel = "See all", bare = false }: Props) {
  const { data, error, isLoading, mutate } = useSWR<{ products: ProductCardData[] }>([endpoint, { limit }], fetcher, { revalidateOnFocus: false });

  return (
    <section className={bare ? "py-10" : "section"} aria-labelledby={`rail-${endpoint}`}>
      <div className="container">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <h2 id={`rail-${endpoint}`} className="t-display !text-[clamp(2rem,1.2rem+3vw,3.5rem)]">
              {title}
            </h2>
            <p className="mt-3 max-w-xl text-base text-slate-600">{description}</p>
          </div>
          {href && (
            <Link href={href} className="btn-secondary hidden sm:inline-flex">
              {linkLabel} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>

        {error && !data ? (
          <ErrorState title="Could not load products" onRetry={() => mutate()} />
        ) : isLoading || !data ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label={`Loading ${title}`}>
            {Array.from({ length: limit }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : data.products.length === 0 ? (
          <EmptyState icon={PackageSearch} title="Nothing here yet" description="Products will appear as prices are collected." />
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 [scrollbar-width:none]" data-carousel>
            {data.products.map((p) => (
              <div key={p.id} className="w-[17.5rem] shrink-0 snap-start sm:w-auto">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

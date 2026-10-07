import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchView } from "@/components/search/SearchView";
import { ProductGridSkeleton } from "@/components/product/ProductCard";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="page">
          <div className="skeleton mb-8 h-9 w-72" />
          <ProductGridSkeleton count={6} />
        </div>
      }
    >
      <SearchView />
    </Suspense>
  );
}

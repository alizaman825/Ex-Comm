import { Suspense } from "react";
import { SearchBar } from "@/components/layout/SearchBar";

// Placeholder: the full landing page is built in T10.
export default function HomePage() {
  return (
    <section className="container py-24 text-center">
      <h1 className="t-display mx-auto max-w-3xl">Find the best price, across every store.</h1>
      <p className="t-lead mx-auto mt-5 max-w-xl">Search once to compare Daraz, PriceOye and AliExpress.</p>
      <div className="mx-auto mt-10 max-w-2xl">
        <Suspense fallback={null}>
          <SearchBar size="lg" />
        </Suspense>
      </div>
    </section>
  );
}

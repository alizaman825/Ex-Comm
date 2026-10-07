import { Suspense } from "react";
import Link from "next/link";
import { SearchBar } from "@/components/layout/SearchBar";

export default function NotFound() {
  return (
    <section className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="bg-gradient-to-br from-brand-500 to-brand-800 bg-clip-text text-8xl font-black tracking-tighter text-transparent sm:text-9xl">404</p>
      <h1 className="t-h1 mt-4">We could not find that page</h1>
      <p className="t-lead mt-3 max-w-md">The link may be broken or the page may have moved. Try searching for a product instead.</p>
      <div className="mt-8 w-full max-w-md">
        <Suspense fallback={null}>
          <SearchBar />
        </Suspense>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">
          Go to the home page
        </Link>
        <Link href="/categories" className="btn-secondary">
          Browse categories
        </Link>
      </div>
    </section>
  );
}

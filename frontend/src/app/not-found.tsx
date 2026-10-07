import { Suspense } from "react";
import Link from "next/link";
import { CategoryTile } from "@/components/product/ProductImage";
import { SearchBar } from "@/components/layout/SearchBar";

export default function NotFound() {
  return (
    <section className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div className="relative">
        <p className="select-none font-display text-[clamp(7rem,28vw,16rem)] font-extrabold leading-[0.8] tracking-tighter text-ink/[0.09]">404</p>
        <CategoryTile category="home-appliances" label="" className="absolute left-1/2 top-1/2 !h-28 !w-28 -translate-x-1/2 -translate-y-1/2 rotate-6 rounded-[2rem] shadow-float animate-float" />
      </div>
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

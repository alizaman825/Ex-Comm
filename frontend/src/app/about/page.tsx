import type { Metadata } from "next";
import Link from "next/link";
import { Database, LineChart, Scale, Search, ShieldCheck, Zap } from "lucide-react";
import { DataSourceBadge } from "@/components/product/badges";

export const metadata: Metadata = { title: "About", description: "What Ex-Comm is, how it works, and where its prices come from." };

const FAQ = [
  { q: "Why does a product sometimes show only one store?", a: "Stores name products differently, so Ex-Comm matches them by brand, model and key specs. When the match is not confident the products stay separate. You can always add products to the compare tray and compare them manually." },
  { q: "How fresh are the prices?", a: "Searches check Daraz and PriceOye live and keep the result for a few hours. Every result says whether it is live, cached or saved data, and shows when it was updated." },
  { q: "Is the price history real?", a: "Price history recorded after a product is searched or tracked is real. The history for the built-in sample products was generated to demonstrate the chart, and is labelled as sample data." },
  { q: "Do you sell anything?", a: "No. Ex-Comm only compares prices and links to the store. You buy from the store." },
];

export default function AboutPage() {
  return (
    <div className="page max-w-4xl">
      <header className="mb-12">
        <h1 className="t-h1">About Ex-Comm</h1>
        <p className="t-lead mt-3 max-w-2xl">
          Ex-Comm is a price comparison platform for online shopping in Pakistan. It was built as a university final-year project to help shoppers and small online sellers find the best price and the best time to buy.
        </p>
      </header>

      <section id="how-it-works" className="mb-14 scroll-mt-24">
        <h2 className="t-h2">How it works</h2>
        <ol className="mt-6 grid gap-5 sm:grid-cols-3">
          {[
            { icon: Search, t: "1. Search", d: "Search by product name. Results are gathered from Daraz and PriceOye, plus saved AliExpress supplier prices." },
            { icon: Scale, t: "2. Compare", d: "The same product from different stores is grouped, so you can see every price, rating and stock status side by side." },
            { icon: LineChart, t: "3. Track", d: "Save products, view price history, and set a target price. You get a notification when it is reached." },
          ].map(({ icon: Icon, t, d }) => (
            <li key={t} className="card p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="t-h3 mt-3">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="data" className="mb-14 scroll-mt-24">
        <h2 className="t-h2">Where the prices come from</h2>
        <p className="mt-3 text-slate-600">Every price in Ex-Comm carries a label so you always know how trustworthy it is.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-600" aria-hidden />
              <h3 className="t-h3">Live data</h3>
              <DataSourceBadge source="live" className="ml-auto" />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Read from the public pages of <strong>Daraz</strong> and <strong>PriceOye</strong> when you search or when a tracked product is checked. Requests are slow and polite: one at a time with short pauses, so the stores are not overloaded.
            </p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-amber-600" aria-hidden />
              <h3 className="t-h3">Saved data</h3>
              <DataSourceBadge source="saved" className="ml-auto" />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Stored sample data, used for <strong>AliExpress</strong> supplier prices and as a fallback when a store cannot be reached. Prices shown as saved may be out of date.
            </p>
          </div>
        </div>
        <div className="mt-5 flex gap-3 rounded-2xl border border-slate-200 bg-surface p-4 text-sm text-slate-600">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
          <p>
            <strong className="text-ink">Known limits.</strong> Matching products across stores is fuzzy and can miss or mix up items. Prices change often, and sample-data price history is generated for demonstration. Always confirm the price on the store before you buy.
          </p>
        </div>
      </section>

      <section className="mb-14">
        <h2 className="t-h2">Frequently asked questions</h2>
        <div className="mt-5 divide-y divide-slate-200 rounded-card border border-slate-200 bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="text-xl leading-none text-slate-400 transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="t-h3">Ready to compare?</h2>
          <p className="mt-1 text-sm text-slate-500">Search a product or browse a category.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/categories" className="btn-secondary">
            Browse categories
          </Link>
          <Link href="/search?q=iphone%2016" className="btn-primary">
            Try a search
          </Link>
        </div>
      </div>
    </div>
  );
}

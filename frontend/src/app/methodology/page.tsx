import type { Metadata } from "next";
import { AlertTriangle, Ban, Clock, Database, HelpCircle, TrendingDown, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How Ex-Comm collects prices, what each freshness label means, and how deals and savings are calculated.",
};

const STATUS_ROWS = [
  {
    icon: Zap,
    tone: "text-emerald-600",
    label: "Checked recently",
    body: "The store was scraped within its own freshness window (a few hours for Daraz and PriceOye) and had the item in stock. Only listings in this state count toward a product's headline price, its \"cheapest\" tag, deals, and price alerts.",
  },
  {
    icon: Database,
    tone: "text-amber-600",
    label: "Stale",
    body: "The store was scraped, but longer ago than the freshness window above. The price shown may have moved since. Excluded from headline price, deals and alerts.",
  },
  {
    icon: Database,
    tone: "text-amber-600",
    label: "Saved reference",
    body: "AliExpress supplier prices only. These are kept as a reference rather than checked on a schedule — AliExpress can block automated requests, so we only check it when you ask (the \"Check on AliExpress\" button), or keep what we recorded before. Never used for \"cheapest\", deals or alerts.",
  },
  {
    icon: Ban,
    tone: "text-slate-500",
    label: "Unavailable",
    body: "The store reported this item out of stock at the last check.",
  },
  {
    icon: AlertTriangle,
    tone: "text-amber-600",
    label: "Check failed",
    body: "We tried to re-check this price and the attempt failed (the store blocked us, timed out, or changed its page layout). The price shown is from the last successful check and may be out of date.",
  },
  {
    icon: HelpCircle,
    tone: "text-slate-400",
    label: "Unknown",
    body: "Never checked, or checked so long ago we don't call it \"stale\" any more.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="page max-w-4xl">
      <header className="mb-12">
        <h1 className="t-h1">Methodology</h1>
        <p className="t-lead mt-3 max-w-2xl">How we collect prices, what each freshness label means, and how deals and savings are calculated — in plain terms.</p>
      </header>

      <section className="mb-14">
        <h2 className="t-h2">How prices are collected</h2>
        <div className="mt-5 space-y-4">
          <div className="card p-5">
            <h3 className="t-h3">Daraz and PriceOye (live)</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Read from the stores&apos; own public search and product pages when you search, when a tracked product is checked, or on a scheduled catalog refresh. Requests go one at a time with short pauses between them, not in a burst.
            </p>
          </div>
          <div className="card p-5">
            <h3 className="t-h3">eBay (official API, on demand)</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Checked through eBay&apos;s own Browse API, not scraped. It is not part of an ordinary search — you trigger it yourself with &quot;Check on eBay&quot;, because eBay listings carry international shipping and customs that we don&apos;t otherwise track. Prices come back in USD and are converted to PKR for display.
            </p>
          </div>
          <div className="card p-5">
            <h3 className="t-h3">AliExpress (saved reference + on-demand check)</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              AliExpress is used as a supplier-price reference, not as a live store in ordinary search. We keep a saved price and check it live only when you ask (&quot;Check on AliExpress&quot;). Like eBay, AliExpress prices exclude international shipping and customs.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-14">
        <h2 className="t-h2">What each freshness label means</h2>
        <p className="mt-3 text-slate-600">Every price you see carries one of these labels, so you know exactly how it was obtained.</p>
        <div className="mt-5 space-y-3">
          {STATUS_ROWS.map(({ icon: Icon, tone, label, body }) => (
            <div key={label} className="card flex gap-3 p-4">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone}`} aria-hidden />
              <div>
                <h3 className="text-sm font-semibold text-ink">{label}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14">
        <h2 className="t-h2">How the headline price is chosen</h2>
        <p className="mt-3 text-slate-600 text-sm leading-relaxed">
          A product&apos;s headline price (the big number, &quot;cheapest&quot;, and what counts toward deals and alerts) is the lowest price among its <strong>currently &quot;checked recently&quot;</strong> retail listings (Daraz, PriceOye). If a product has no live retail listing right now, the headline falls back to its supplier price (AliExpress/eBay) instead. If nothing is currently trustworthy, we show an honest empty state rather than an old, unconfirmed number.
        </p>
      </section>

      <section className="mb-14">
        <div className="card flex gap-3 p-5">
          <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <h2 className="t-h3">How deals and savings are calculated</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              The 7-day price-change figure compares the current price to the price we actually recorded at least 7 days ago — only using real, confirmed scrapes, never a simulated or unverified data point.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              A product is only eligible to appear as a &quot;deal&quot; once we have <strong>at least 5 real price observations spanning at least 7 days</strong>. This stops a single lucky data point, or a product we&apos;ve barely tracked, from being shown as a discount. Products that don&apos;t yet meet this bar simply don&apos;t appear in deals, even if their price has moved.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-14">
        <div className="card flex gap-3 p-5">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div>
            <h2 className="t-h3">Known limits</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
              <li>Matching the same product across different stores is done by normalized title and fuzzy matching, with manual selection as a fallback. It can occasionally miss a match or group two different variants together.</li>
              <li>Prices, stock and shipping terms change on the store&apos;s own page faster than we can re-check them. Always confirm the final price, shipping cost and cash-on-delivery availability on the store before you buy.</li>
              <li>AliExpress and eBay prices exclude international shipping and customs duties, which can be significant.</li>
              <li>We don&apos;t control or guarantee the accuracy of anything shown on the store&apos;s own page — we only read and compare it.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

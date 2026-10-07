import Link from "next/link";
import { Logo } from "./Logo";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/categories", label: "Categories" },
      { href: "/compare", label: "Compare products" },
      { href: "/search?q=iphone%2016", label: "Trending: iPhone 16" },
    ],
  },
  {
    title: "Your account",
    links: [
      { href: "/wishlist", label: "Wishlist" },
      { href: "/alerts", label: "Price alerts" },
      { href: "/notifications", label: "Notifications" },
      { href: "/profile", label: "Profile & settings" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/about", label: "About Ex-Comm" },
      { href: "/about#how-it-works", label: "How it works" },
      { href: "/about#data", label: "Where prices come from" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative z-[6] mt-10 bg-canvas border-t border-slate-200/70">
      <div className="container py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              Compare prices across Daraz, PriceOye, AliExpress and eBay, watch price history, and get alerted when a product drops to the price you want.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-sm font-semibold text-ink">{col.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-slate-500 transition hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-slate-200/70 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Ex-Comm. A university final-year project.</p>
          <p>Prices come from public store pages and sample data and can change. Always confirm on the store before buying.</p>
        </div>
      </div>
    </footer>
  );
}

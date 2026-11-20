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
    <footer className="cine-section relative z-[6] mt-10 px-4 pb-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[85rem] rounded-[1.75rem] border border-white/20 bg-white/10 px-6 py-10 shadow-[0_1px_0_rgba(255,255,255,0.3)_inset] backdrop-blur-xl sm:px-10 sm:py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
              Compare prices across Daraz, PriceOye, AliExpress and eBay, watch price history, and get alerted when a product drops to the price you want.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-sm font-semibold text-white">{col.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-white/55 transition hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-white/15 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Ex-Comm. A university final-year project.</p>
          <p>Prices come from public store pages and sample data and can change. Always confirm on the store before buying.</p>
        </div>
      </div>
    </footer>
  );
}

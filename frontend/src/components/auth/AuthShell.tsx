import type { ReactNode } from "react";
import { CategoryTile } from "@/components/product/ProductImage";
import { BellRing, LineChart, ShieldCheck, Store } from "lucide-react";

const POINTS = [
  { icon: Store, title: "One search, every store", text: "Daraz, PriceOye and AliExpress side by side." },
  { icon: LineChart, title: "See the price history", text: "Know if today's price is actually a good one." },
  { icon: BellRing, title: "Never miss a drop", text: "Set a target price and we will notify you." },
];

/** Two-column layout for login and register: brand panel on the left (lg+), form on the right. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative m-4 hidden overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-peach via-butter to-mint p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-10 top-10 h-64 w-64 rotate-12 rounded-[3rem] bg-lilac/80" aria-hidden />
        <div className="pointer-events-none absolute -bottom-16 right-10 h-56 w-56 rounded-full bg-sky/80" aria-hidden />
        <div className="relative">
          <CategoryTile category="mobiles" label="" className="float-right !h-40 !w-40 rounded-[2rem] shadow-float animate-float" />
        </div>
        <div className="relative">
          <h2 className="max-w-md font-display text-5xl font-extrabold leading-[1] tracking-tight text-ink">
            Stop overpaying. <span className="swash">Compare first.</span>
          </h2>
          <ul className="mt-10 space-y-5">
            {POINTS.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-card">
                  <Icon className="h-5 w-5 text-ink" aria-hidden />
                </span>
                <div>
                  <p className="font-display font-bold text-ink">{t}</p>
                  <p className="text-sm text-slate-700">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-8 flex items-center gap-2 text-sm text-slate-700">
          <ShieldCheck className="h-4 w-4" aria-hidden /> Your password is hashed and your session is kept in a secure cookie.
        </p>
      </aside>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md animate-fade-up">
          <h1 className="t-h1">{title}</h1>
          <p className="mt-2 text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 text-center text-sm text-slate-500">{footer}</div>
        </div>
      </section>
    </div>
  );
}

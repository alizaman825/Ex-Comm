import type { ReactNode } from "react";
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
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" aria-hidden />
        <div className="relative" />
        <div className="relative">
          <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight !text-white">Stop overpaying. Compare before you buy.</h2>
          <ul className="mt-10 space-y-6">
            {POINTS.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface/10 ring-1 ring-surface/15">
                  <Icon className="h-5 w-5 text-brand-100" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-white">{t}</p>
                  <p className="text-sm text-brand-100/90">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative flex items-center gap-2 text-sm text-brand-100/80">
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

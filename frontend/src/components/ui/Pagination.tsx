import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

/** Page numbers to show: always first/last, a window around the current page, with gaps as null. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const btn = "inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-medium transition";
  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="Pagination">
      <button type="button" className={clsx(btn, "border-slate-200 bg-surface text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40")} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      {pageWindow(page, pages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-slate-400" aria-hidden>
            …
          </span>
        ) : (
          <button key={p} type="button" onClick={() => onPage(p)} aria-current={p === page ? "page" : undefined} aria-label={`Page ${p}`} className={clsx(btn, p === page ? "border-brand-600 bg-brand-600 text-onbrand" : "border-slate-200 bg-surface text-slate-600 hover:bg-slate-50")}>
            {p}
          </button>
        )
      )}
      <button type="button" className={clsx(btn, "border-slate-200 bg-surface text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40")} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}

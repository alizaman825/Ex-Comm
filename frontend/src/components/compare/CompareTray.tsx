"use client";

import Link from "next/link";
import { Scale, X } from "lucide-react";
import { MAX_COMPARE, useCompare } from "./CompareProvider";

/** Floating bar shown while products are selected for comparison. */
export function CompareTray() {
  const { ids, clear } = useCompare();
  if (ids.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" data-testid="compare-tray">
      <div className="pointer-events-auto flex max-w-full animate-fade-up items-center gap-3 rounded-2xl border border-slate-200 bg-surface py-2.5 pl-4 pr-2.5 shadow-lift">
        <Scale className="h-5 w-5 shrink-0 text-brand-600" aria-hidden />
        <p className="text-sm font-medium text-ink">
          {ids.length} of {MAX_COMPARE} selected
        </p>
        <Link href={`/compare?ids=${ids.join(",")}`} className="btn-primary btn-sm">
          Compare{ids.length > 1 ? ` ${ids.length}` : ""}
        </Link>
        <button type="button" onClick={clear} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Clear comparison selection">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

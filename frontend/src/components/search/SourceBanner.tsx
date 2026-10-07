import { AlertTriangle, CheckCircle2, Database } from "lucide-react";
import clsx from "clsx";
import { PLATFORM_LABEL, timeAgo } from "@/lib/format";
import type { Platform, SearchResponse } from "@/lib/types";
import { PlatformDot } from "@/components/product/badges";

const TONE = {
  live: { box: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: CheckCircle2, iconTone: "text-emerald-600" },
  cache: { box: "border-brand-200 bg-brand-50 text-brand-900", icon: Database, iconTone: "text-brand-600" },
  fallback: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: AlertTriangle, iconTone: "text-amber-600" },
} as const;

function message(data: SearchResponse): string {
  if (data.source === "live") return `Live results, updated ${timeAgo(data.fetchedAt)}.`;
  if (data.source === "cache") return `Showing saved results from ${timeAgo(data.fetchedAt)}. They refresh automatically after a few hours.`;
  return "Live store results are not available right now, so you are seeing saved sample data. Prices may be out of date.";
}

/** Tells the user where the results came from (live scrape, cache or saved fallback) and per-store status. */
export function SourceBanner({ data }: { data: SearchResponse }) {
  const tone = TONE[data.source];
  const Icon = tone.icon;
  const stores = Object.entries(data.platformStatus) as [Platform, NonNullable<SearchResponse["platformStatus"][Platform]>][];
  return (
    <div className={clsx("flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between", tone.box)} data-testid="source-banner" data-source={data.source}>
      <p className="flex items-start gap-2.5">
        <Icon className={clsx("mt-0.5 h-4 w-4 shrink-0", tone.iconTone)} aria-hidden />
        <span>{message(data)}</span>
      </p>
      {data.source === "live" && stores.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Store status">
          {stores.map(([platform, s]) => (
            <li key={platform} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-black/5">
              <PlatformDot platform={platform} />
              {PLATFORM_LABEL[platform]}
              <span className={s.status === "success" ? "text-emerald-700" : "text-rose-700"}>{s.status === "success" ? `${s.relevant ?? 0} found` : "unavailable"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

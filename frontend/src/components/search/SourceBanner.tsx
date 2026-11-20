import { AlertTriangle, CheckCircle2, Database, Loader2, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { PLATFORM_LABEL, timeAgo } from "@/lib/format";
import type { Platform, SearchResponse } from "@/lib/types";
import { PlatformDot } from "@/components/product/badges";
import { storeProblems } from "@/lib/stores";

const TONE = {
  live: { chip: "Live", chipCls: "tag-pill tag-pill-best", icon: CheckCircle2 },
  cache: { chip: "Cached", chipCls: "tag-pill tag-pill-neutral", icon: CheckCircle2 },
  fallback: { chip: "Sample", chipCls: "tag-pill tag-pill-warn", icon: AlertTriangle },
  demo: { chip: "Sample", chipCls: "tag-pill tag-pill-warn", icon: Database },
} as const;

type Kind = keyof typeof TONE;
const kindOf = (data: SearchResponse): Kind => (data.demoMode ? "demo" : data.source);

export function bannerMessage(data: SearchResponse): string {
  if (data.demoMode) return "Demo mode: live store search is switched off, so you are seeing saved sample data.";
  if (data.source === "live") return `Live results from the stores, checked ${timeAgo(data.fetchedAt)}.`;
  if (data.source === "cache") return `Live results from the stores, checked ${timeAgo(data.fetchedAt)}. Prices may have changed since: refresh to check the stores again.`;
  return "The stores could not be checked just now, so you are seeing saved data. Prices may be out of date.";
}

interface Props {
  data: SearchResponse;
  /** Re-checks the stores now, ignoring any earlier result. Omitted/ignored in demo mode. */
  onRefresh?: () => void;
  refreshing?: boolean;
}

/** Tells the user where the results came from (live stores, an earlier live check, or saved data) and when. */
export function SourceBanner({ data, onRefresh, refreshing = false }: Props) {
  const kind = kindOf(data);
  const tone = TONE[kind];
  const Icon = tone.icon;
  const stores = Object.entries(data.platformStatus) as [Platform, NonNullable<SearchResponse["platformStatus"][Platform]>][];
  const canRefresh = Boolean(onRefresh) && !data.demoMode;
  const problems = data.demoMode ? [] : storeProblems(data.platformStatus);
  return (
    <div className="glass-panel flex flex-col gap-3 rounded-3xl px-5 py-3.5 text-sm text-white/80 lg:flex-row lg:items-center lg:justify-between" data-testid="source-banner" data-source={data.source} data-demo={data.demoMode || undefined}>
      <div className="flex items-start gap-2.5">
        <span className={clsx("mt-px inline-flex shrink-0 items-center gap-1", tone.chipCls)} data-testid="source-chip">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {tone.chip}
        </span>
        <span>
          {bannerMessage(data)}
          {problems.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-[13px] text-white/60" data-testid="store-problems" aria-label="Stores that did not answer">
              {problems.map((p) => (
                <li key={p.platform}>
                  <strong className="text-white/80">{p.label}</strong> {p.text}.
                </li>
              ))}
            </ul>
          )}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!data.demoMode && data.source !== "fallback" && stores.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Store status">
            {stores.map(([platform, s]) => (
              <li key={platform} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80 ring-1 ring-white/15 backdrop-blur-sm">
                <PlatformDot platform={platform} />
                {PLATFORM_LABEL[platform]}
                <span className={s.status === "success" ? "text-emerald-300" : "text-rose-300"}>{s.status === "success" ? (s.total ? `${s.loaded ?? s.relevant ?? 0} of ${s.approximate ? "about " : ""}${s.total.toLocaleString("en-PK")}` : `${s.relevant ?? 0} found`) : "unavailable"}</span>
              </li>
            ))}
          </ul>
        )}
        {canRefresh && (
          <button type="button" onClick={onRefresh} disabled={refreshing} className="btn-secondary btn-sm" data-testid="refresh-results">
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
            {refreshing ? "Checking the stores…" : data.source === "fallback" ? "Try the stores again" : "Refresh from stores"}
          </button>
        )}
      </div>
    </div>
  );
}

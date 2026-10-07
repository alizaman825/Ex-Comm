import { ArrowDownRight, ArrowUpRight, Database, Star, Zap } from "lucide-react";
import clsx from "clsx";
import { PLATFORM_COLOR, PLATFORM_LABEL, formatPercent } from "@/lib/format";
import type { DataSource, Platform } from "@/lib/types";

export function PlatformDot({ platform, className }: { platform: Platform; className?: string }) {
  return <span aria-hidden className={clsx("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ backgroundColor: PLATFORM_COLOR[platform] }} />;
}

export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700", className)}>
      <PlatformDot platform={platform} />
      {PLATFORM_LABEL[platform]}
    </span>
  );
}

/** "Live" (scraped recently) or "Saved" (sample / stored data). */
export function DataSourceBadge({ source, className }: { source: DataSource; className?: string }) {
  if (source === "live") {
    return (
      <span className={clsx("badge-success", className)} title="Price read from the store recently">
        <Zap className="h-3 w-3" aria-hidden /> Live
      </span>
    );
  }
  return (
    <span className={clsx("badge-warning", className)} title="Saved data: stored sample or cached price, not read from the store right now">
      <Database className="h-3 w-3" aria-hidden /> Saved
    </span>
  );
}

/** 7-day change: green for drops, red for rises, hidden when negligible. */
export function PriceChange({ percent, className, label }: { percent: number; className?: string; label?: string }) {
  if (Math.abs(percent) < 0.5) return null;
  const down = percent < 0;
  const Icon = down ? ArrowDownRight : ArrowUpRight;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold", down ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700", className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {formatPercent(Math.abs(percent), 1).replace("+", "")}
      {label && <span className="font-medium opacity-80">{label}</span>}
      <span className="sr-only">{down ? "price drop" : "price rise"}</span>
    </span>
  );
}

export function Rating({ value, count, className }: { value: number | null; count?: number; className?: string }) {
  if (!value) return <span className={clsx("text-xs text-slate-400", className)}>No ratings yet</span>;
  return (
    <span className={clsx("inline-flex items-center gap-1 text-xs text-slate-600", className)} aria-label={`Rated ${value} out of 5${count ? ` from ${count} reviews` : ""}`}>
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
      <span className="font-semibold text-ink">{value.toFixed(1)}</span>
      {count ? <span className="text-slate-400">({count.toLocaleString("en-PK")})</span> : null}
    </span>
  );
}

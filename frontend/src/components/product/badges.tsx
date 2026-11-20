import { AlertTriangle, ArrowDownRight, ArrowUpRight, Ban, Database, HelpCircle, Star, Zap } from "lucide-react";
import clsx from "clsx";
import { PLATFORM_COLOR, PLATFORM_LABEL, formatPercent, timeAgo } from "@/lib/format";
import type { Condition, DataSource, Platform, PriceStatus } from "@/lib/types";

export function PlatformDot({ platform, className }: { platform: Platform; className?: string }) {
  return <span aria-hidden className={clsx("inline-block h-2 w-2 shrink-0 rounded-full", className)} style={{ backgroundColor: PLATFORM_COLOR[platform] }} />;
}

export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200", className)}>
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

/**
 * Replaces the old "Live"/"Saved" badge, which never expired (PLAN.md item 3: a listing scraped weeks
 * ago could still say "Live"). Always shows the real age of the price - "Live" never appears without it.
 */
export function StatusBadge({ status, lastScrapedAt, className }: { status: PriceStatus; lastScrapedAt: string | null; className?: string }) {
  const age = lastScrapedAt ? timeAgo(lastScrapedAt) : null;
  switch (status) {
    case "checked_recently":
      return (
        <span className={clsx("badge-success", className)} title="Price read from the store recently">
          <Zap className="h-3 w-3" aria-hidden /> Checked {age}
        </span>
      );
    case "stale":
      return (
        <span className={clsx("badge-warning", className)} title="Not re-checked recently - the price may have moved since">
          <Database className="h-3 w-3" aria-hidden /> Checked {age}
        </span>
      );
    case "unavailable":
      return (
        <span className={clsx("badge-neutral", className)} title="The store did not have this in stock at the last check">
          <Ban className="h-3 w-3" aria-hidden /> Unavailable
        </span>
      );
    case "check_failed":
      return (
        <span className={clsx("badge-warning", className)} title="The last attempt to re-check this price failed; the price shown may be out of date">
          <AlertTriangle className="h-3 w-3" aria-hidden /> Check failed
        </span>
      );
    default:
      return (
        <span className={clsx("badge-neutral", className)} title="This price has never been checked, or not recently enough to say">
          <HelpCircle className="h-3 w-3" aria-hidden /> Unknown
        </span>
      );
  }
}

/** Item condition (currently only set on eBay). Hidden when unknown, so nothing shows for stores that
 * don't report it instead of implying "new". */
export function ConditionBadge({ condition, label, className }: { condition: Condition; label?: string | null; className?: string }) {
  if (condition === "unknown") return null;
  const text = label || (condition === "new" ? "New" : condition === "refurbished" ? "Refurbished" : "Used");
  const style = condition === "new" ? "badge-success" : condition === "refurbished" ? "badge-neutral" : "badge-warning";
  return (
    <span className={clsx(style, className)} title={label && label.toLowerCase() !== condition ? `eBay condition: ${label}` : undefined}>
      {text}
    </span>
  );
}

/** 7-day change: green for drops, red for rises, hidden when negligible. */
export function PriceChange({ percent, className, label }: { percent: number; className?: string; label?: string }) {
  if (Math.abs(percent) < 0.5) return null;
  const down = percent < 0;
  const Icon = down ? ArrowDownRight : ArrowUpRight;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-bold", down ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700", className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {formatPercent(Math.abs(percent), 1).replace("+", "")}
      {label && <span className="font-medium opacity-80">{label}</span>}
      <span className="sr-only">{down ? "price drop" : "price rise"}</span>
    </span>
  );
}

export function Rating({ value, count, className }: { value: number | null; count?: number; className?: string }) {
  if (!value) return <span className={clsx("text-xs text-slate-500", className)}>No ratings yet</span>;
  return (
    <span className={clsx("inline-flex items-center gap-1 text-xs text-slate-600", className)} aria-label={`Rated ${value} out of 5${count ? ` from ${count} reviews` : ""}`}>
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
      <span className="font-semibold text-ink">{value.toFixed(1)}</span>
      {count ? <span className="text-slate-500">({count.toLocaleString("en-PK")})</span> : null}
    </span>
  );
}

import type { Platform } from "./types";

export const PLATFORM_LABEL: Record<Platform, string> = {
  daraz: "Daraz",
  priceoye: "PriceOye",
  aliexpress: "AliExpress",
};

export const PLATFORM_COLOR: Record<Platform, string> = {
  daraz: "#f57224",
  priceoye: "#0ea5e9",
  aliexpress: "#e62e04",
};

/** 129999 -> "Rs 129,999" */
export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return `Rs ${Math.round(value).toLocaleString("en-PK")}`;
}

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return "–";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** -4.2 -> "-4.2%", 3 -> "+3%" */
export function formatPercent(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

export function discountPercent(price: number, original: number | null | undefined): number {
  if (!original || original <= price) return 0;
  return Math.round((1 - price / original) * 100);
}

/** "5 minutes ago", "3 hours ago", "2 days ago", or a date for older values. */
export function timeAgo(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return "never";
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** Current page path including the query string, used as the post-login return address. */
export function currentPath(): string {
  return typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;
}

/** Only allow same-site relative paths for post-login redirects. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

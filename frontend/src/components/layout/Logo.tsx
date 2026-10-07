import Link from "next/link";
import { TrendingDown } from "lucide-react";
import clsx from "clsx";

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" className={clsx("inline-flex items-center gap-2.5 rounded-lg", className)} aria-label="Ex-Comm home">
      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-sm">
        <TrendingDown className="h-5 w-5" strokeWidth={2.75} aria-hidden />
      </span>
      <span className={clsx("text-lg font-bold tracking-tight", light ? "text-white" : "text-ink")}>
        Ex<span className={light ? "text-brand-200" : "text-brand-600"}>-Comm</span>
      </span>
    </Link>
  );
}

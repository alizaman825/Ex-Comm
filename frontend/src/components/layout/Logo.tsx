import Link from "next/link";
import { TrendingDown } from "lucide-react";
import clsx from "clsx";

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" className={clsx("inline-flex items-center gap-2 rounded-full", className)} aria-label="Ex-Comm home">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-highlight shadow-sm transition duration-300 ease-soft group-hover:rotate-[-8deg]">
        <TrendingDown className="h-[18px] w-[18px]" strokeWidth={3} aria-hidden />
      </span>
      <span className={clsx("font-display text-lg font-extrabold tracking-tight", light ? "text-white" : "text-ink")}>
        Ex<span className="text-slate-500">-</span>Comm
      </span>
    </Link>
  );
}

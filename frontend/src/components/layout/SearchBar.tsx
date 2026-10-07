"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import clsx from "clsx";

interface SearchBarProps {
  size?: "md" | "lg";
  autoFocus?: boolean;
  className?: string;
  placeholder?: string;
  /** Label on the large bar's button */
  buttonLabel?: string;
  /** Accessible name of the box (keep it distinct when a page has more than one large bar) */
  label?: string;
}

export function SearchBar({ size = "md", autoFocus, className, buttonLabel = "Compare prices", label = "Search products", placeholder = 'Search "iPhone 16", "air fryer", "Sony headphones"' }: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = pathname === "/search" ? (params.get("q") ?? "") : "";
  // Keep the box in sync with the URL (back/forward) while still letting the user type.
  const [typed, setTyped] = useState<{ base: string; value: string }>({ base: urlQuery, value: urlQuery });
  const value = typed.base === urlQuery ? typed.value : urlQuery;
  const [error, setError] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (q.length < 2) {
      setError(true);
      return;
    }
    setError(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  const large = size === "lg";
  return (
    <form onSubmit={onSubmit} role="search" className={clsx("w-full", className)}>
      <div className="relative">
        <Search className={clsx("pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400", large ? "left-6 h-5 w-5" : "left-3.5 h-4 w-4")} aria-hidden />
        <input
          type="search"
          name="q"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => {
            setTyped({ base: urlQuery, value: e.target.value });
            setError(false);
          }}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={error || undefined}
          autoComplete="off"
          className={clsx(
            "w-full border-0 text-ink transition duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-4",
            large ? "rounded-full bg-surface py-4 pl-14 pr-44 text-base shadow-float sm:py-5" : "rounded-full bg-slate-100 py-2.5 pl-10 pr-4 text-sm hover:bg-slate-200/70 focus:bg-surface",
            error ? "ring-2 ring-rose-400 focus:ring-rose-500/30" : "focus:ring-brand-500/15"
          )}
          />
        {large && (
          <button type="submit" className="btn-primary absolute right-2 top-1/2 !-translate-y-1/2 px-5 py-2.5 sm:px-6 sm:py-3">
            {buttonLabel}
          </button>
        )}
      </div>
      {error && (
        <p className="field-error" role="alert">
          Type at least 2 characters to search.
        </p>
      )}
    </form>
  );
}

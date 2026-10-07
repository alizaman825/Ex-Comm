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
}

export function SearchBar({ size = "md", autoFocus, className, placeholder = 'Search "iPhone 16", "air fryer", "Sony headphones"' }: SearchBarProps) {
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
        <Search className={clsx("pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400", large ? "left-5 h-5 w-5" : "left-3.5 h-4 w-4")} aria-hidden />
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
          aria-label="Search products"
          aria-invalid={error || undefined}
          autoComplete="off"
          className={clsx(
            "w-full border bg-surface text-ink shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-4",
            large ? "rounded-2xl py-4 pl-14 pr-32 text-base" : "rounded-full py-2.5 pl-10 pr-4 text-sm",
            error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15" : "border-slate-300 hover:border-slate-400 focus:border-brand-500 focus:ring-brand-500/15"
          )}
        />
        {large && (
          <button type="submit" className="btn-primary absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-5 py-2.5">
            Compare prices
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

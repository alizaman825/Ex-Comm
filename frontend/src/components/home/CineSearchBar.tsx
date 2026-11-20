"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import clsx from "clsx";

/**
 * The board's literal glass search bar: icon, transparent input, round white arrow button (not a
 * text "Compare prices" button — see Main.dc.html / Main-Desktop.dc.html). Same submit behaviour as
 * the shared SearchBar (navigate to /search?q=...), different chrome.
 */
export function CineSearchBar({ large = false, autoFocus }: { large?: boolean; autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (q.length < 2) {
      setError(true);
      return;
    }
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={onSubmit} role="search" className="w-full">
      <div
        className={clsx(
          "cine-search-pill flex items-center gap-2.5 rounded-full border border-white/30 bg-white/[0.12] shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_16px_38px_rgba(0,0,0,0.35)] backdrop-blur-2xl",
          large ? "py-2 pl-5 pr-2 sm:py-2.5" : "py-3 pl-[18px] pr-2.5"
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-white/75" aria-hidden />
        <input
          type="search"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          placeholder="Search any product, any store…"
          aria-label="Search any product"
          autoComplete="off"
          className="w-full min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-white placeholder:text-white/55 focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Search"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0b0812] transition hover:scale-105"
        >
          <ArrowRight className="h-4 w-4" aria-hidden strokeWidth={2.6} />
        </button>
      </div>
      {error && (
        <p className="mt-2 pl-4 text-xs font-medium text-rose-300" role="alert">
          Type at least 2 characters to search.
        </p>
      )}
    </form>
  );
}

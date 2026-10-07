"use client";

import { useState, type FormEvent } from "react";
import { RotateCcw } from "lucide-react";
import clsx from "clsx";
import { PLATFORM_LABEL } from "@/lib/format";
import { PLATFORMS, activeFilterCount, priceRangeError, type SearchState } from "@/lib/search";
import type { Category, Platform } from "@/lib/types";
import { PlatformDot } from "@/components/product/badges";

interface Props {
  state: SearchState;
  categories: Category[];
  onChange: (patch: Partial<SearchState>) => void;
  onReset: () => void;
  /** list AliExpress as a store filter (only after AliExpress has been checked for this search) */
  showAliExpress?: boolean;
}

const RATINGS = [
  { value: undefined, label: "Any rating" },
  { value: 3, label: "3.0 and up" },
  { value: 3.5, label: "3.5 and up" },
  { value: 4, label: "4.0 and up" },
  { value: 4.5, label: "4.5 and up" },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-slate-100 py-5 first:pt-0 last:border-0">
      <legend className="mb-3 text-sm font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function PriceRange({ state, onChange }: Pick<Props, "state" | "onChange">) {
  // Local text so the user can type freely; applied on Enter / "Apply".
  const [draft, setDraft] = useState({ base: `${state.minPrice ?? ""}|${state.maxPrice ?? ""}`, min: String(state.minPrice ?? ""), max: String(state.maxPrice ?? "") });
  const base = `${state.minPrice ?? ""}|${state.maxPrice ?? ""}`;
  const current = draft.base === base ? draft : { base, min: String(state.minPrice ?? ""), max: String(state.maxPrice ?? "") };
  const min = current.min === "" ? undefined : Number(current.min);
  const max = current.max === "" ? undefined : Number(current.max);
  const invalidNumber = (min !== undefined && !(min >= 0)) || (max !== undefined && !(max >= 0));
  const error = invalidNumber ? "Enter prices as positive numbers" : priceRangeError(min, max);

  function apply(e: FormEvent) {
    e.preventDefault();
    if (error) return;
    onChange({ minPrice: min, maxPrice: max });
  }

  return (
    <form onSubmit={apply} noValidate>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="filter-min-price">
          Minimum price (Rs)
        </label>
        <input id="filter-min-price" inputMode="numeric" placeholder="Min" value={current.min} onChange={(e) => setDraft({ ...current, min: e.target.value.replace(/[^0-9]/g, "") })} className={clsx("input py-2", error && "input-error")} aria-invalid={Boolean(error)} />
        <span className="text-slate-400" aria-hidden>
          –
        </span>
        <label className="sr-only" htmlFor="filter-max-price">
          Maximum price (Rs)
        </label>
        <input id="filter-max-price" inputMode="numeric" placeholder="Max" value={current.max} onChange={(e) => setDraft({ ...current, max: e.target.value.replace(/[^0-9]/g, "") })} className={clsx("input py-2", error && "input-error")} aria-invalid={Boolean(error)} />
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-secondary btn-sm mt-3 w-full" disabled={Boolean(error)}>
        Apply price range
      </button>
    </form>
  );
}

export function Filters({ state, categories, onChange, onReset, showAliExpress = false }: Props) {
  const count = activeFilterCount(state);

  function togglePlatform(p: Platform) {
    const next = state.platform.includes(p) ? state.platform.filter((x) => x !== p) : [...state.platform, p];
    onChange({ platform: next });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">
          Filters{count > 0 && <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-onbrand">{count}</span>}
        </h2>
        {count > 0 && (
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
            <RotateCcw className="h-3 w-3" aria-hidden /> Clear all
          </button>
        )}
      </div>

      <Section title="Category">
        <div className="space-y-1" role="radiogroup" aria-label="Category">
          {[{ slug: "", name: "All categories" }, ...categories].map((c) => {
            const active = state.category === c.slug;
            return (
              <button
                key={c.slug || "all"}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ category: c.slug })}
                className={clsx("flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition", active ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-100")}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Store">
        <div className="space-y-2.5">
          {PLATFORMS.filter((p) => p !== "aliexpress" || showAliExpress || state.platform.includes(p)).map((p) => (
            <label key={p} className="flex cursor-pointer items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={state.platform.includes(p)} onChange={() => togglePlatform(p)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              <PlatformDot platform={p} />
              {PLATFORM_LABEL[p]}
              {p === "aliexpress" && <span className="text-xs text-slate-400">(supplier)</span>}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Price (Rs)">
        <PriceRange state={state} onChange={onChange} />
      </Section>

      <Section title="Customer rating">
        <div className="space-y-2.5" role="radiogroup" aria-label="Minimum rating">
          {RATINGS.map((r) => (
            <label key={r.label} className="flex cursor-pointer items-center gap-3 text-sm text-slate-700">
              <input type="radio" name="min-rating" checked={state.minRating === r.value} onChange={() => onChange({ minRating: r.value })} className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500" />
              {r.label}
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}

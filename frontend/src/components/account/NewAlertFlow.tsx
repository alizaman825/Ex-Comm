"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Search } from "lucide-react";
import { fetcher } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { ProductCard, SearchResponse } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { ErrorState, Spinner } from "@/components/ui/primitives";
import { ProductImage } from "@/components/product/ProductImage";
import { AlertDialog } from "@/components/product/AlertDialog";

/** Two steps from the Alerts page: find a product, then set the target price. */
export function NewAlertFlow({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<ProductCard | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(text.trim()), 300);
    return () => window.clearTimeout(t);
  }, [text]);

  const searching = debounced.length >= 2;
  const { data, error, isLoading, mutate } = useSWR<SearchResponse>(searching ? ["/search", { q: debounced, pageSize: 6, live: false }] : null, fetcher as never, { revalidateOnFocus: false, shouldRetryOnError: false });

  function reset() {
    setText("");
    setDebounced("");
    setPicked(null);
  }
  function close() {
    reset();
    onClose();
  }

  if (!open) return null;
  if (picked) {
    const retail = picked.offers.filter((o) => o.role !== "supplier");
    const current = (retail.length ? retail : picked.offers)[0]?.price ?? picked.minPrice;
    return (
      <AlertDialog
        open
        onClose={close}
        productId={picked.id}
        title={picked.title}
        currentPrice={current}
        platforms={picked.platforms}
        onSaved={onSaved}
      />
    );
  }

  return (
    <Modal open onClose={close} title="Create a price alert" description="Search for the product you want to track.">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. galaxy a55, airpods pro" aria-label="Search for a product" className="input pl-10" autoFocus autoComplete="off" />
      </div>

      <div className="mt-4 min-h-[8rem]" aria-live="polite">
        {!searching ? (
          <p className="py-8 text-center text-sm text-slate-500">Type at least 2 characters to search.</p>
        ) : error ? (
          <ErrorState title="Search failed" description="Could not search right now." onRetry={() => mutate()} className="border-0 py-6 shadow-none" />
        ) : isLoading || !data ? (
          <div className="flex justify-center py-8">
            <Spinner label="Searching…" />
          </div>
        ) : data.results.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No products found for “{debounced}”. Try a different name.</p>
        ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto" aria-label="Search results">
            {data.results.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setPicked(p)} className="flex w-full items-center gap-3 rounded-xl border border-transparent p-2.5 text-left transition hover:border-brand-200 hover:bg-brand-50">
                  <ProductImage src={p.image} alt="" category={p.category} className="h-12 w-12 shrink-0 rounded-lg p-1" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 block text-sm font-medium text-ink">{p.title}</span>
                    <span className="text-xs text-slate-500">from {formatPrice(p.minPrice)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

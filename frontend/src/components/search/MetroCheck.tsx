"use client";

import { useState } from "react";
import { Loader2, Store } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { PlatformDot } from "@/components/product/badges";

interface CheckResponse {
  status: "success" | "failed" | "skipped";
  found: number;
  error?: string;
}

interface Props {
  query: string;
  /** how many Metro Online results an earlier check found for this search (undefined = not checked yet) */
  checkedCount?: number;
  /** called after a successful check, so the results can be reloaded */
  onChecked: () => void | Promise<unknown>;
}

/**
 * Metro Online is not searched automatically yet (its scraper is newer and not yet proven reliable), so
 * the user asks for it. The check can take several seconds.
 */
export function MetroCheck({ query, checkedCount, onChecked }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const checked = checkedCount !== undefined;

  async function run() {
    setBusy(true);
    try {
      const res = await api<CheckResponse>("/search/metro", { method: "POST", body: { q: query } });
      if (res.status === "success") {
        await onChecked();
        toast.success(res.found ? `Added ${res.found} Metro Online results` : "Metro Online has nothing for this search");
      } else {
        toast.error(`Could not check Metro Online${res.error ? `: ${res.error}` : ""}. Try again in a few minutes.`);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-3xl bg-surface px-5 py-3.5 text-sm shadow-card sm:flex-row sm:items-center sm:justify-between" data-testid="metro-check">
      <div className="flex items-start gap-2.5 text-slate-700">
        <PlatformDot platform="metro" className="mt-1.5" />
        <p>
          {busy ? (
            <span role="status">Checking Metro Online… this can take a few seconds. You can keep browsing the results.</span>
          ) : checked ? (
            <span>
              Metro Online checked: {checkedCount} {checkedCount === 1 ? "result" : "results"} added.
            </span>
          ) : (
            <span>Metro Online is not searched automatically yet. Checking it takes a few seconds.</span>
          )}
        </p>
      </div>
      <button type="button" className="btn-secondary btn-sm shrink-0" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Store className="h-3.5 w-3.5" aria-hidden />}
        {busy ? "Checking Metro Online…" : checked ? "Check Metro Online again" : "Check on Metro Online"}
      </button>
    </div>
  );
}

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
  /** how many Amazon results an earlier check found for this search (undefined = not checked yet) */
  checkedCount?: number;
  /** called after a successful check, so the results can be reloaded */
  onChecked: () => void | Promise<unknown>;
}

/**
 * Amazon is not searched automatically: it is an international reference price (converted from USD),
 * fetched through a managed scraping service rather than directly, so the check can take up to a minute.
 */
export function AmazonCheck({ query, checkedCount, onChecked }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const checked = checkedCount !== undefined;

  async function run() {
    setBusy(true);
    try {
      const res = await api<CheckResponse>("/search/amazon", { method: "POST", body: { q: query } });
      if (res.status === "success") {
        await onChecked();
        toast.success(res.found ? `Added ${res.found} Amazon results` : "Amazon has nothing for this search");
      } else {
        toast.error(`Could not check Amazon${res.error ? `: ${res.error}` : ""}. Try again in a few minutes.`);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-3xl bg-surface px-5 py-3.5 text-sm shadow-card sm:flex-row sm:items-center sm:justify-between" data-testid="amazon-check">
      <div className="flex items-start gap-2.5 text-slate-700">
        <PlatformDot platform="amazon" className="mt-1.5" />
        <p>
          {busy ? (
            <span role="status">Checking Amazon… this can take up to a minute. You can keep browsing the results.</span>
          ) : checked ? (
            <span>
              Amazon checked: {checkedCount} {checkedCount === 1 ? "result" : "results"} added (supplier prices, converted from USD).
            </span>
          ) : (
            <span>Amazon is not searched automatically. It is an international reference price and can take up to a minute to check.</span>
          )}
        </p>
      </div>
      <button type="button" className="btn-secondary btn-sm shrink-0" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Store className="h-3.5 w-3.5" aria-hidden />}
        {busy ? "Checking Amazon…" : checked ? "Check Amazon again" : "Check on Amazon"}
      </button>
    </div>
  );
}

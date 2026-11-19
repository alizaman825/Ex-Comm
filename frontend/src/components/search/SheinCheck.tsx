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
  /** how many SHEIN results an earlier check found for this search (undefined = not checked yet) */
  checkedCount?: number;
  /** called after a successful check, so the results can be reloaded */
  onChecked: () => void | Promise<unknown>;
}

/**
 * SHEIN is not searched automatically (it is an international catalog and can block automated requests
 * at any time), so the user asks for it. The check can take several seconds.
 */
export function SheinCheck({ query, checkedCount, onChecked }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const checked = checkedCount !== undefined;

  async function run() {
    setBusy(true);
    try {
      const res = await api<CheckResponse>("/search/shein", { method: "POST", body: { q: query } });
      if (res.status === "success") {
        await onChecked();
        toast.success(res.found ? `Added ${res.found} SHEIN results` : "SHEIN has nothing for this search");
      } else {
        toast.error(`Could not check SHEIN${res.error ? `: ${res.error}` : ""}. Try again in a few minutes.`);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-3xl bg-surface px-5 py-3.5 text-sm shadow-card sm:flex-row sm:items-center sm:justify-between" data-testid="shein-check">
      <div className="flex items-start gap-2.5 text-slate-700">
        <PlatformDot platform="shein" className="mt-1.5" />
        <p>
          {busy ? (
            <span role="status">Checking SHEIN… this can take a few seconds. You can keep browsing the results.</span>
          ) : checked ? (
            <span>
              SHEIN checked: {checkedCount} {checkedCount === 1 ? "result" : "results"} added (supplier prices).
            </span>
          ) : (
            <span>SHEIN is not searched automatically. It is an international catalog, checked on demand.</span>
          )}
        </p>
      </div>
      <button type="button" className="btn-secondary btn-sm shrink-0" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Store className="h-3.5 w-3.5" aria-hidden />}
        {busy ? "Checking SHEIN…" : checked ? "Check SHEIN again" : "Check on SHEIN"}
      </button>
    </div>
  );
}

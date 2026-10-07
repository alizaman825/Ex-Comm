"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { BellRing, CheckCircle2, Info } from "lucide-react";
import { api, errorMessage, ApiError } from "@/lib/api";
import { PLATFORM_LABEL, formatPrice } from "@/lib/format";
import type { AlertItem, Platform } from "@/lib/types";
import { Button, Field } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface Props {
  open: boolean;
  onClose: () => void;
  productId: string;
  title: string;
  /** Cheapest current retail price, used for the default target and the hint */
  currentPrice: number | null;
  platforms: Platform[];
  onSaved?: () => void;
}

/** Parses "119,999" / "119999" / "Rs 119,999" into a number; anything else (including "12abc") is NaN. */
export function parseTarget(input: string): number {
  const cleaned = input.trim().replace(/^rs[.]?/i, "").replace(/[, ]/g, "");
  return /^-?[0-9]+([.][0-9]+)?$/.test(cleaned) ? Number(cleaned) : NaN;
}

export function validateTarget(input: string): string | undefined {
  const n = parseTarget(input);
  if (input.trim() === "") return "Enter the price you want to pay";
  if (!Number.isFinite(n)) return "Enter a number, for example 99999";
  if (n <= 0) return "Target price must be greater than 0";
  if (n > 100_000_000) return "That price is too high";
  return undefined;
}

export function AlertDialog({ open, onClose, productId, title, currentPrice, platforms, onSaved }: Props) {
  const toast = useToast();
  const suggested = currentPrice ? Math.max(1, Math.floor((currentPrice * 0.9) / 100) * 100) : 0;
  const [target, setTarget] = useState(suggested ? String(suggested) : "");
  const [platform, setPlatform] = useState<"" | Platform>("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<null | { updated: boolean; triggeredNow: boolean }>(null);

  const n = parseTarget(target);
  const reached = Number.isFinite(n) && currentPrice !== null && n >= currentPrice;

  function close() {
    setDone(null);
    setFormError(null);
    setError(undefined);
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validateTarget(target);
    setError(problem);
    setFormError(null);
    if (problem) return;
    setSaving(true);
    try {
      const res = await api<{ alert: AlertItem; updated: boolean; triggeredNow: boolean }>("/alerts", {
        method: "POST",
        body: { productId, targetPrice: n, platform: platform || null },
      });
      setDone({ updated: res.updated, triggeredNow: res.triggeredNow });
      toast.success(res.updated ? "Price alert updated" : "Price alert created");
      onSaved?.();
    } catch (err) {
      if (err instanceof ApiError && err.fieldError("targetPrice")) setError(err.fieldError("targetPrice"));
      else setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title={done ? "Alert saved" : "Set a price alert"} description={done ? undefined : title}>
      {done ? (
        <div className="text-center" data-testid="alert-success">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-4 text-sm text-slate-600">
            {done.triggeredNow
              ? "This product is already at or below your target price, so we sent you a notification straight away."
              : `We will notify you when ${platform ? PLATFORM_LABEL[platform] : "any store"} drops to ${formatPrice(n)} or less.`}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/alerts" className="btn-primary" onClick={close}>
              View my alerts
            </Link>
            <Button variant="secondary" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {formError}
            </div>
          )}
          {currentPrice !== null && (
            <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
              <BellRing className="h-4 w-4 shrink-0 text-brand-600" aria-hidden /> Current lowest price: <strong className="text-ink">{formatPrice(currentPrice)}</strong>
            </p>
          )}
          <Field label="Notify me when the price is" name="targetPrice" inputMode="numeric" autoComplete="off" placeholder="e.g. 99999" value={target} onChange={(e) => setTarget(e.target.value)} error={error} hint="In Pakistani rupees (Rs). We suggest 10% below the current price." autoFocus />
          <div>
            <label htmlFor="alert-platform" className="label">
              Store
            </label>
            <select id="alert-platform" className="input" value={platform} onChange={(e) => setPlatform(e.target.value as "" | Platform)}>
              <option value="">Any store (retail)</option>
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                  {p === "aliexpress" ? " (supplier)" : ""}
                </option>
              ))}
            </select>
          </div>
          {reached && !error && (
            <p className="flex items-start gap-2 rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> This price has already been reached. You will be notified immediately.
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <Button type="submit" className="flex-1" loading={saving}>
              {saving ? "Saving…" : "Create alert"}
            </Button>
            <Button variant="secondary" onClick={close} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

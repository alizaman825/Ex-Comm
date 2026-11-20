"use client";

import { useState, type FormEvent } from "react";
import { Flag, CheckCircle2 } from "lucide-react";
import { api, errorMessage, ApiError } from "@/lib/api";
import { Button, Field } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";

type ReportType = "wrong_price" | "wrong_product" | "other";

const TYPE_LABEL: Record<ReportType, string> = {
  wrong_price: "The price shown is wrong",
  wrong_product: "This is the wrong product",
  other: "Something else",
};

/** PLAN.md Phase 1 item 8: a simple, rate-limited way to flag a wrong price or product - no account
 * required, since most visitors reporting a problem aren't signed in. */
export function ReportProblem({ productId, title }: { productId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ReportType>("wrong_price");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function close() {
    setOpen(false);
    setDone(false);
    setMessage("");
    setEmail("");
    setError(undefined);
    setFormError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) {
      setError("Please describe the problem (at least 5 characters)");
      return;
    }
    setError(undefined);
    setFormError(null);
    setSaving(true);
    try {
      await api("/reports", { method: "POST", body: { type, productId, message: message.trim(), email: email.trim() || undefined } });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.fieldError("message")) setError(err.fieldError("message"));
      else setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/50 hover:text-white/80">
        <Flag className="h-3.5 w-3.5" aria-hidden /> Report a wrong price or product
      </button>
      <Modal open={open} onClose={close} title={done ? "Thanks for the report" : "Report a problem"} description={done ? undefined : title}>
        {done ? (
          <div className="text-center" data-testid="report-success">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-4 text-sm text-slate-600">We&apos;ll take a look. This doesn&apos;t change the listing automatically.</p>
            <Button variant="secondary" onClick={close} className="mt-6">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {formError && (
              <div role="alert" className="alert-danger rounded-2xl border p-3 text-sm">
                {formError}
              </div>
            )}
            <div>
              <label htmlFor="report-type" className="label">
                What&apos;s wrong
              </label>
              <select id="report-type" className="input" value={type} onChange={(e) => setType(e.target.value as ReportType)}>
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="report-message" className="label">
                Details
              </label>
              <textarea
                id="report-message"
                rows={3}
                placeholder="What did you see, and where?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-invalid={error ? true : undefined}
                className={`input${error ? " input-error" : ""}`}
                autoFocus
              />
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <Field label="Email (optional)" name="email" type="email" placeholder="So we can follow up" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="flex gap-3 pt-1">
              <Button type="submit" className="flex-1" loading={saving}>
                {saving ? "Sending…" : "Send report"}
              </Button>
              <Button variant="secondary" onClick={close} disabled={saving}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

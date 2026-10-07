"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { BellRing, CheckCircle2, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { api, errorMessage, fetcher } from "@/lib/api";
import { PLATFORM_LABEL, formatPrice, timeAgo } from "@/lib/format";
import type { AlertItem } from "@/lib/types";
import { Button, EmptyState, ErrorState, Field, PageHeader, Skeleton } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ProductImage } from "@/components/product/ProductImage";
import { parseTarget, validateTarget } from "@/components/product/AlertDialog";
import { NewAlertFlow } from "./NewAlertFlow";

type Tab = "all" | "reached" | "watching" | "paused";

export function alertStatus(a: AlertItem): Exclude<Tab, "all"> {
  if (!a.active) return "paused";
  return a.reached ? "reached" : "watching";
}

const STATUS_BADGE = {
  reached: <span className="badge-success"><CheckCircle2 className="h-3 w-3" aria-hidden /> Target reached</span>,
  watching: <span className="badge-brand"><BellRing className="h-3 w-3" aria-hidden /> Watching</span>,
  paused: <span className="badge-neutral"><Pause className="h-3 w-3" aria-hidden /> Paused</span>,
} as const;

function EditTarget({ alert, onClose, onSaved }: { alert: AlertItem; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [value, setValue] = useState(String(alert.targetPrice ?? ""));
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = validateTarget(value);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      await api(`/alerts/${alert.id}`, { method: "PATCH", body: { targetPrice: parseTarget(value) } });
      toast.success("Target price updated");
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Change target price" description={alert.product.title}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
          Current price: <strong className="text-ink">{formatPrice(alert.currentPrice)}</strong>
          {alert.currentPlatform && <> on {PLATFORM_LABEL[alert.currentPlatform]}</>}
        </p>
        <Field label="Notify me when the price is" name="targetPrice" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} error={error} autoFocus autoComplete="off" />
        <div className="flex gap-3">
          <Button type="submit" className="flex-1" loading={saving}>
            Save
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmDelete({ alert, onClose, onDeleted }: { alert: AlertItem; onClose: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    try {
      await api(`/alerts/${alert.id}`, { method: "DELETE" });
      toast.success("Alert deleted");
      onDeleted();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title="Delete this alert?" description={`You will no longer be notified about ${alert.product.title}.`}>
      <div className="flex gap-3">
        <Button variant="danger" className="flex-1" loading={busy} onClick={remove}>
          Delete alert
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Keep it
        </Button>
      </div>
    </Modal>
  );
}

function AlertRow({ alert, onEdit, onDelete, onToggle }: { alert: AlertItem; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  const status = alertStatus(alert);
  return (
    <li className={clsx("card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5", status === "paused" && "opacity-75")} data-testid="alert-item" data-status={status}>
      <Link href={`/products/${alert.product.id}`} className="flex min-w-0 flex-1 items-center gap-4">
        <ProductImage src={alert.product.image} alt="" category={null} className="h-16 w-16 shrink-0 rounded-xl border border-slate-100 p-1.5" />
        <span className="min-w-0">
          <span className="line-clamp-2 block text-sm font-semibold leading-snug text-ink hover:text-brand-700">{alert.product.title}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2">
            {STATUS_BADGE[status]}
            <span className="text-xs text-slate-500">{alert.platform ? PLATFORM_LABEL[alert.platform] : "Any store"}</span>
          </span>
        </span>
      </Link>
      <dl className="grid grid-cols-2 gap-6 sm:w-80">
        <div>
          <dt className="text-xs font-medium text-slate-500">Your target</dt>
          <dd className="t-price text-lg">{formatPrice(alert.targetPrice)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Price now</dt>
          <dd className={clsx("text-lg font-semibold tabular-nums", status === "reached" ? "text-emerald-700" : "text-ink")}>{formatPrice(alert.currentPrice)}</dd>
          {alert.currentPlatform && <dd className="text-xs text-slate-400">on {PLATFORM_LABEL[alert.currentPlatform]}</dd>}
        </div>
        {alert.lastTriggeredAt && <p className="col-span-2 -mt-3 text-xs text-slate-400">Last notified {timeAgo(alert.lastTriggeredAt)}</p>}
      </dl>
      <div className="flex shrink-0 gap-1.5">
        <button type="button" onClick={onEdit} className="btn-ghost btn-sm" aria-label={`Edit target price for ${alert.product.title}`}>
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={onToggle} className="btn-ghost btn-sm" aria-label={`${alert.active ? "Pause" : "Resume"} alert for ${alert.product.title}`}>
          {alert.active ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
        </button>
        <button type="button" onClick={onDelete} className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700" aria-label={`Delete alert for ${alert.product.title}`}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}

export function AlertsView() {
  const toast = useToast();
  const { mutate: globalMutate } = useSWRConfig();
  const refreshBell = () => globalMutate(["/notifications/unread-count"]);
  const { data, error, isLoading, mutate } = useSWR<{ alerts: AlertItem[] }>(["/alerts"], fetcher, { revalidateOnFocus: false });
  const [tab, setTab] = useState<Tab>("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AlertItem | null>(null);
  const [deleting, setDeleting] = useState<AlertItem | null>(null);

  const alerts = data?.alerts ?? [];
  const counts = { all: alerts.length, reached: 0, watching: 0, paused: 0 };
  for (const a of alerts) counts[alertStatus(a)] += 1;
  const shown = tab === "all" ? alerts : alerts.filter((a) => alertStatus(a) === tab);

  async function toggle(a: AlertItem) {
    try {
      await api(`/alerts/${a.id}`, { method: "PATCH", body: { active: !a.active } });
      toast.success(a.active ? "Alert paused" : "Alert resumed");
      await Promise.all([mutate(), refreshBell()]);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "watching", label: "Watching" },
    { id: "reached", label: "Target reached" },
    { id: "paused", label: "Paused" },
  ];

  return (
    <div className="page max-w-5xl">
      <PageHeader
        title="Price alerts"
        description="Set the price you want to pay. We re-check prices regularly and notify you when a product reaches your target."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New alert
          </Button>
        }
      />

      {error && !data ? (
        <ErrorState title="We could not load your alerts" onRetry={() => mutate()} />
      ) : isLoading || !data ? (
        <ul className="space-y-4" role="status" aria-label="Loading alerts">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="card flex items-center gap-4 p-5" aria-hidden>
              <Skeleton className="h-16 w-16" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-5 w-28" />
              </div>
              <Skeleton className="h-10 w-40" />
            </li>
          ))}
        </ul>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="No price alerts yet"
          description="Pick a product and the price you would be happy to pay. We will notify you the moment it drops to that price."
          action={
            <>
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" aria-hidden /> Create your first alert
              </Button>
              <Link href="/categories" className="btn-secondary">
                Browse products
              </Link>
            </>
          }
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Filter alerts">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={clsx("rounded-full border px-4 py-1.5 text-sm font-medium transition", tab === t.id ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
                {t.label} <span className={clsx("ml-1 tabular-nums", tab === t.id ? "text-brand-100" : "text-slate-400")}>{counts[t.id]}</span>
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <EmptyState title={`No ${tab === "reached" ? "alerts with a reached target" : tab} alerts`} description="Try another tab." className="py-10" />
          ) : (
            <ul className="space-y-4">
              {shown.map((a) => (
                <AlertRow key={a.id} alert={a} onEdit={() => setEditing(a)} onDelete={() => setDeleting(a)} onToggle={() => toggle(a)} />
              ))}
            </ul>
          )}
        </>
      )}

      <NewAlertFlow open={creating} onClose={() => setCreating(false)} onSaved={() => mutate()} />
      {editing && <EditTarget alert={editing} onClose={() => setEditing(null)} onSaved={() => { void mutate(); void refreshBell(); }} />}
      {deleting && <ConfirmDelete alert={deleting} onClose={() => setDeleting(null)} onDeleted={() => mutate()} />}
    </div>
  );
}

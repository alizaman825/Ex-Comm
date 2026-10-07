"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import clsx from "clsx";
import { api, errorMessage, fetcher } from "@/lib/api";
import { PLATFORM_LABEL, formatPrice, timeAgo } from "@/lib/format";
import type { NotificationItem, NotificationsResponse } from "@/lib/types";
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { ProductImage } from "@/components/product/ProductImage";

const PAGE_SIZE = 10;
type Filter = "all" | "unread";

function Row({ n, onOpen }: { n: NotificationItem; onOpen: () => void }) {
  return (
    <li data-testid="notification" data-read={n.read}>
      <button type="button" onClick={onOpen} className={clsx("flex w-full items-start gap-4 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-6", !n.read && "bg-brand-50/50")}>
        <span className="relative mt-0.5 shrink-0">
          <ProductImage src={n.product?.image} alt="" category={null} className="h-14 w-14 rounded-2xl border border-slate-100 p-1" />
          {!n.read && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-brand-600 ring-2 ring-surface" aria-label="Unread" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={clsx("block text-sm leading-relaxed", n.read ? "text-slate-600" : "font-semibold text-ink")}>{n.message}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            {n.price !== null && <span className="font-semibold tabular-nums text-emerald-700">{formatPrice(n.price)}</span>}
            {n.platform && <span>{PLATFORM_LABEL[n.platform]}</span>}
            <span>{timeAgo(n.createdAt)}</span>
          </span>
        </span>
      </button>
    </li>
  );
}

export function NotificationsView() {
  const router = useRouter();
  const toast = useToast();
  const { mutate: globalMutate } = useSWRConfig();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [marking, setMarking] = useState(false);

  const key = ["/notifications", { unread: filter === "unread" ? "true" : undefined, page, limit: PAGE_SIZE }] as const;
  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(key, fetcher as never, { keepPreviousData: true, revalidateOnFocus: true, shouldRetryOnError: false });

  const refreshCounts = () => globalMutate(["/notifications/unread-count"]);

  async function open(n: NotificationItem) {
    if (!n.read) {
      try {
        await api(`/notifications/${n.id}/read`, { method: "PATCH" });
        await Promise.all([mutate(), refreshCounts()]);
      } catch (err) {
        toast.error(errorMessage(err));
      }
    }
    if (n.product) router.push(`/products/${n.product.id}`);
  }

  async function markAll() {
    setMarking(true);
    try {
      const res = await api<{ updated: number }>("/notifications/read-all", { method: "PATCH" });
      toast.success(res.updated ? `Marked ${res.updated} as read` : "Everything is already read");
      await Promise.all([mutate(), refreshCounts()]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setMarking(false);
    }
  }

  const unread = data?.unreadCount ?? 0;
  return (
    <div className="page max-w-4xl">
      <PageHeader
        title="Notifications"
        description="Price alerts that reached your target price."
        actions={
          <Button variant="secondary" onClick={markAll} loading={marking} disabled={unread === 0}>
            <CheckCheck className="h-4 w-4" aria-hidden /> Mark all as read
          </Button>
        }
      />

      <div className="mb-5 inline-flex rounded-full bg-slate-100 p-1" role="tablist" aria-label="Filter notifications">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
            className={clsx("rounded-full px-4 py-1.5 text-sm font-medium transition", filter === f ? "bg-surface text-ink shadow-sm" : "text-slate-500 hover:text-ink")}
          >
            {f === "all" ? "All" : `Unread${unread ? ` (${unread})` : ""}`}
          </button>
        ))}
      </div>

      {error && !data ? (
        <ErrorState title="We could not load your notifications" onRetry={() => mutate()} />
      ) : isLoading || !data ? (
        <ul className="card divide-y divide-slate-100" role="status" aria-label="Loading notifications">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="flex gap-4 p-5" aria-hidden>
              <Skeleton className="h-14 w-14 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-40" />
              </div>
            </li>
          ))}
        </ul>
      ) : data.notifications.length === 0 ? (
        filter === "unread" ? (
          <EmptyState icon={CheckCheck} title="You are all caught up" description="No unread notifications." action={<Button variant="secondary" onClick={() => setFilter("all")}>Show all notifications</Button>} />
        ) : (
          <EmptyState icon={BellOff} title="No notifications yet" description="When a product reaches the target price of one of your alerts, you will see it here." action={<a href="/alerts" className="btn-primary"><Bell className="h-4 w-4" aria-hidden /> Manage price alerts</a>} />
        )
      ) : (
        <>
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {data.notifications.map((n) => (
              <Row key={n.id} n={n} onOpen={() => open(n)} />
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </div>
  );
}

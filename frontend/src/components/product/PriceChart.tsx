"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";
import clsx from "clsx";
import { fetcher } from "@/lib/api";
import { PLATFORM_COLOR, PLATFORM_LABEL, formatDate, formatPercent, formatPrice } from "@/lib/format";
import type { HistoryResponse, Platform } from "@/lib/types";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";

const RANGES = [7, 30, 90] as const;

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const axisPrice = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={clsx("mt-0.5 text-lg font-semibold tabular-nums", tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-rose-700" : "text-ink")}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

interface TooltipEntry {
  dataKey?: string | number;
  value?: number | string;
  color?: string;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: readonly TooltipEntry[]; label?: string | number }) {
  if (!active || !payload?.length || typeof label !== "string") return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-surface px-3.5 py-2.5 text-xs shadow-lift">
      <p className="mb-1.5 font-semibold text-ink">{formatDate(label)}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center justify-between gap-6 py-0.5 text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            {PLATFORM_LABEL[p.dataKey as Platform] ?? p.dataKey}
          </span>
          <span className="font-semibold tabular-nums text-ink">{formatPrice(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

export function PriceChart({ productId, hasSavedData = false }: { productId: string; hasSavedData?: boolean }) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [hidden, setHidden] = useState<Set<Platform>>(new Set());
  const { data, error, isLoading, mutate } = useSWR<HistoryResponse>([`/products/${productId}/history`, { days }], fetcher, { keepPreviousData: true, revalidateOnFocus: false });

  const rows = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const s of data?.series ?? []) {
      for (const p of s.points) {
        const row = byDate.get(p.date) ?? { date: p.date };
        row[s.platform] = p.price;
        byDate.set(p.date, row);
      }
    }
    return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [data]);

  const toggle = (p: Platform) =>
    setHidden((cur) => {
      const next = new Set(cur);
      if (next.has(p)) next.delete(p);
      else if (next.size < (data?.series.length ?? 1) - 1) next.add(p); // keep at least one line visible
      return next;
    });

  return (
    <section className="card card-pad" aria-labelledby="history-heading" data-testid="price-chart">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="history-heading" className="t-h2">
          Price history
        </h2>
        <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label="History range">
          {RANGES.map((r) => (
            <button key={r} type="button" onClick={() => setDays(r)} aria-pressed={days === r} className={clsx("rounded-md px-3.5 py-1.5 text-sm font-medium transition", days === r ? "bg-surface text-ink shadow-sm" : "text-slate-500 hover:text-ink")}>
              {r} days
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {error ? (
          <ErrorState title="Could not load price history" onRetry={() => mutate()} className="border-0 shadow-none" />
        ) : isLoading && !data ? (
          <div role="status" aria-label="Loading price history" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-[74px]" />
              ))}
            </div>
            <Skeleton className="h-72 w-full" />
          </div>
        ) : !data || rows.length === 0 ? (
          <EmptyState icon={LineChartIcon} title="No price history yet" description="History builds up as this product's prices are checked. Check back soon." className="border-0 shadow-none" />
        ) : (
          <>
            {data.summary && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="history-summary">
                <Stat label="Current (lowest)" value={formatPrice(data.summary.current)} />
                <Stat label="Lowest in period" value={formatPrice(data.summary.lowest)} sub={formatDate(data.summary.lowestDate)} tone="good" />
                <Stat label="Highest in period" value={formatPrice(data.summary.highest)} />
                <Stat label="Average" value={formatPrice(data.summary.average)} />
                <Stat label={`Change, ${days} days`} value={formatPercent(data.summary.changePct)} tone={data.summary.changePct < -0.5 ? "good" : data.summary.changePct > 0.5 ? "bad" : undefined} />
              </div>
            )}
            <div className="mt-5 h-72 w-full" role="img" aria-label={`Price history over the last ${days} days for ${data.series.map((s) => PLATFORM_LABEL[s.platform]).join(", ")}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} minTickGap={32} />
                  <YAxis tickFormatter={axisPrice} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} width={44} domain={["auto", "auto"]} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }} />
                  <Legend content={() => null} />
                  {data.series.map((s) => (
                    <Line key={s.platform} type="monotone" dataKey={s.platform} name={PLATFORM_LABEL[s.platform]} stroke={PLATFORM_COLOR[s.platform]} strokeWidth={2.25} strokeDasharray={s.role === "supplier" ? "6 4" : undefined} dot={false} activeDot={{ r: 4 }} connectNulls hide={hidden.has(s.platform)} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Chart legend">
              {data.series.map((s) => (
                <li key={s.platform}>
                  <button type="button" onClick={() => toggle(s.platform)} aria-pressed={!hidden.has(s.platform)} className={clsx("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition", hidden.has(s.platform) ? "border-slate-200 bg-surface text-slate-400 line-through" : "border-slate-200 bg-slate-50 text-slate-700")}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLATFORM_COLOR[s.platform] }} />
                    {PLATFORM_LABEL[s.platform]}
                    {s.role === "supplier" && <span className="text-slate-400">(supplier, dashed)</span>}
                  </button>
                </li>
              ))}
            </ul>
            {hasSavedData && <p className="mt-4 rounded-lg bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800">Some prices on this page are saved sample data. For built-in sample products the history is generated to demonstrate the chart, so do not treat it as real market history.</p>}
          </>
        )}
      </div>
    </section>
  );
}

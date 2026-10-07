"use client";

import useSWR from "swr";
import { fetcher } from "./api";
import { useAuth } from "./auth";

/** Unread notification count for the bell; refreshed every minute while signed in. */
export function useUnreadCount() {
  const { user } = useAuth();
  const { data } = useSWR<{ count: number }>(user ? ["/notifications/unread-count"] : null, fetcher, {
    refreshInterval: 60_000,
    shouldRetryOnError: false,
  });
  return data?.count ?? 0;
}

import type { Category, TrendingSearch } from "./types";

const STATIC = { revalidateOnFocus: false, dedupingInterval: 60_000 } as const;

export function useCategories() {
  return useSWR<{ categories: Category[] }>(["/categories"], fetcher, STATIC);
}

export function useTrendingSearches(limit = 8) {
  return useSWR<{ trending: TrendingSearch[] }>(["/search/trending", { limit }], fetcher, STATIC);
}

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

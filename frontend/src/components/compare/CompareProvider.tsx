"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";

export const MAX_COMPARE = 4;
const STORAGE_KEY = "excomm.compare";

// Selection lives in a tiny external store backed by sessionStorage, so it survives page
// navigation within the tab and is read without hydration mismatches (server snapshot is empty).
const EMPTY: string[] = [];
let current: string[] | null = null;
const listeners = new Set<() => void>();

function load(): string[] {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_COMPARE) : [];
  } catch {
    return []; // storage blocked or corrupt
  }
}

const read = (): string[] => (current ??= load());

function write(next: string[]) {
  current = next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the selection just will not persist */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Test helper: forget the in-memory copy so the next read goes to storage again. */
export function resetCompareStore() {
  current = null;
  listeners.forEach((l) => l());
}

interface CompareContextValue {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

/** Products the visitor ticked for manual comparison (kept for the browser tab session). */
export function CompareProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const ids = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggle = useCallback(
    (id: string) => {
      const cur = read();
      if (cur.includes(id)) return write(cur.filter((x) => x !== id));
      if (cur.length >= MAX_COMPARE) return toast.info(`You can compare up to ${MAX_COMPARE} products. Remove one first.`);
      return write([...cur, id]);
    },
    [toast]
  );
  const remove = useCallback((id: string) => write(read().filter((x) => x !== id)), []);
  const clear = useCallback(() => write([]), []);

  const value = useMemo<CompareContextValue>(() => ({ ids, has: (id) => ids.includes(id), toggle, remove, clear }), [ids, toggle, remove, clear]);
  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used inside <CompareProvider>");
  return ctx;
}

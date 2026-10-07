"use client";

import type { ReactNode } from "react";
import { useRequireAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/primitives";

/** Wraps pages that need a signed-in user: redirects to /login (keeping the return address) otherwise. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { ready } = useRequireAuth();
  if (!ready) {
    return (
      <div className="page" role="status" aria-label="Loading your account">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        <Skeleton className="mt-8 h-56 w-full rounded-card" />
      </div>
    );
  }
  return <>{children}</>;
}

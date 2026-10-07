"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { api, ApiError } from "./api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  /** True only during the very first session check. */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<{ user: User } | null> {
  try {
    return await api<{ user: User }>("/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null; // signed out is not an error
    throw err;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { mutate: globalMutate } = useSWRConfig();
  const { data, isLoading, mutate } = useSWR("auth-me", fetchMe, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ user: User }>("/auth/login", { method: "POST", body: { email, password } });
      await mutate(res, { revalidate: false });
      return res.user;
    },
    [mutate]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await api<{ user: User }>("/auth/register", { method: "POST", body: { name, email, password } });
      await mutate(res, { revalidate: false });
      return res.user;
    },
    [mutate]
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      await mutate(null, { revalidate: false });
      // Drop cached per-user data (wishlist, alerts, notifications).
      await globalMutate((key) => key !== "auth-me", undefined, { revalidate: false });
    }
  }, [mutate, globalMutate]);

  const setUser = useCallback((user: User) => void mutate({ user }, { revalidate: false }), [mutate]);

  const value = useMemo<AuthContextValue>(
    () => ({ user: data?.user ?? null, loading: isLoading, login, register, logout, setUser }),
    [data, isLoading, login, register, logout, setUser]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** For pages that need a signed-in user: redirects to /login?next=<this page> when signed out. */
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [auth.loading, auth.user, router, pathname]);
  return { ...auth, ready: !auth.loading && Boolean(auth.user) };
}

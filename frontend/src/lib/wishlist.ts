"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, errorMessage, fetcher } from "./api";
import { useAuth } from "./auth";
import { currentPath } from "./format";
import { useToast } from "@/components/ui/Toast";
import type { WishlistItem } from "./types";

const KEY = ["/wishlist"] as const;

/** The signed-in user's wishlist with an optimistic save/remove toggle for product cards and pages. */
export function useWishlist() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { data, error, isLoading, mutate } = useSWR<{ items: WishlistItem[] }>(user ? KEY : null, fetcher, { revalidateOnFocus: false });

  const ids = useMemo(() => new Set((data?.items ?? []).map((i) => i.product.id)), [data]);

  const toggle = useCallback(
    async (productId: string, title?: string) => {
      if (!user) {
        toast.info("Log in to save products to your wishlist.");
        router.push(`/login?next=${encodeURIComponent(currentPath())}`);
        return;
      }
      const saved = ids.has(productId);
      try {
        if (saved) {
          await mutate(
            async (cur) => {
              await api(`/wishlist/${productId}`, { method: "DELETE" });
              return { items: (cur?.items ?? []).filter((i) => i.product.id !== productId) };
            },
            { optimisticData: (cur) => ({ items: (cur?.items ?? []).filter((i) => i.product.id !== productId) }), rollbackOnError: true, revalidate: false }
          );
          toast.success(title ? `Removed "${title}" from your wishlist` : "Removed from your wishlist");
        } else {
          await api("/wishlist", { method: "POST", body: { productId } });
          await mutate(); // reload so the saved item has its full card data
          toast.success(title ? `Saved "${title}" to your wishlist` : "Saved to your wishlist");
        }
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
    [user, ids, mutate, router, toast]
  );

  return { items: data?.items ?? [], ids, has: (id: string) => ids.has(id), toggle, loading: isLoading, error, reload: () => mutate() };
}

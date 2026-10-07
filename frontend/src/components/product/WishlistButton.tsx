"use client";

import { Heart } from "lucide-react";
import clsx from "clsx";
import { useWishlist } from "@/lib/wishlist";

interface Props {
  productId: string;
  title: string;
  className?: string;
  /** "icon" for cards (round button), "full" for the product page (labelled button) */
  variant?: "icon" | "full";
}

export function WishlistButton({ productId, title, className, variant = "icon" }: Props) {
  const { has, toggle } = useWishlist();
  const saved = has(productId);
  const label = saved ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`;

  if (variant === "full") {
    return (
      <button type="button" onClick={() => toggle(productId, title)} aria-pressed={saved} className={clsx(saved ? "btn-secondary border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" : "btn-secondary", className)}>
        <Heart className={clsx("h-4 w-4", saved && "fill-rose-500 text-rose-500")} aria-hidden />
        {saved ? "Saved to wishlist" : "Save to wishlist"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle(productId, title);
      }}
      aria-pressed={saved}
      aria-label={label}
      title={saved ? "Remove from wishlist" : "Save to wishlist"}
      className={clsx("flex h-9 w-9 items-center justify-center rounded-full border bg-surface/95 shadow-sm backdrop-blur transition hover:scale-105", saved ? "border-rose-200 text-rose-500" : "border-slate-200 text-slate-400 hover:text-rose-500", className)}
    >
      <Heart className={clsx("h-[18px] w-[18px]", saved && "fill-current")} aria-hidden />
    </button>
  );
}

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
      <button type="button" onClick={() => toggle(productId, title)} aria-pressed={saved} className={clsx(saved ? "btn-secondary !bg-rose-50 !text-rose-700 !ring-rose-200" : "btn-secondary", className)}>
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
      className={clsx("flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 shadow-sm backdrop-blur transition duration-200 ease-soft hover:scale-110 active:scale-95", saved ? "text-rose-500" : "text-slate-500 hover:text-rose-500", className)}
    >
      <Heart className={clsx("h-[18px] w-[18px]", saved && "fill-current")} aria-hidden />
    </button>
  );
}

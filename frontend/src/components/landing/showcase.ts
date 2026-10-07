"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { ProductCard } from "@/lib/types";

/** Hero category order: phone, sneaker, headphones, watch, laptop, kitchen appliance. */
const HERO_CATEGORIES = ["mobiles", "fashion", "audio", "watches", "laptops", "home-appliances"] as const;

export interface Showcase {
  /** up to six real products with real images, one per category */
  floaters: ProductCard[];
  /** a product sold in all three stores, for the compare scene */
  compare: ProductCard | null;
  /** product whose price range drives the number on the tag */
  tag: { high: number; low: number };
}

const FALLBACK_TAG = { high: 129_999, low: 117_999 };

export function buildShowcase(products: ProductCard[]): Showcase {
  const withImage = products.filter((p) => p.image);
  const floaters: ProductCard[] = [];
  for (const cat of HERO_CATEGORIES) {
    const inCat = withImage.filter((p) => p.category === cat);
    const pick = (cat === "fashion" && inCat.find((p) => /sneaker|shoe/i.test(p.title))) || inCat[0];
    if (pick) floaters.push(pick);
  }
  const compare =
    withImage.find((p) => ["daraz", "priceoye", "aliexpress"].every((s) => p.offers.some((o) => o.platform === s)) && p.offers.filter((o) => o.role !== "supplier").length > 1) ?? null;
  const spread = floaters.find((p) => p.maxPrice > p.minPrice * 1.02);
  return { floaters, compare, tag: spread ? { high: spread.maxPrice, low: spread.minPrice } : FALLBACK_TAG };
}

/** Real products for the landing hero and scenes (one shared request). */
export function useShowcase(): Showcase | null {
  const { data } = useSWR<{ products: ProductCard[] }>(["/products/trending", { limit: 30 }], fetcher, { revalidateOnFocus: false });
  return data ? buildShowcase(data.products) : null;
}

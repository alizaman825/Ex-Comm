import { describe, expect, it } from "vitest";
import type { AlertItem, ProductCard, WishlistItem } from "@/lib/types";
import { sortWishlist } from "./WishlistView";
import { alertStatus } from "./AlertsView";

const product = (minPrice: number): ProductCard => ({ id: String(minPrice), title: "P", brand: null, category: null, image: null, minPrice, maxPrice: minPrice, rating: null, reviewCount: 0, priceChange7d: 0, platforms: [], offers: [] });
const item = (id: string, price: number, change: number, addedAt: string): WishlistItem => ({ id, addedAt, priceWhenAdded: price, changeSinceAdded: change, product: product(price) });

const items = [item("a", 300, -2, "2026-10-01T00:00:00Z"), item("b", 100, -9, "2026-10-03T00:00:00Z"), item("c", 200, 4, "2026-10-02T00:00:00Z")];

describe("sortWishlist", () => {
  it("most recently saved first", () => expect(sortWishlist(items, "recent").map((i) => i.id)).toEqual(["b", "c", "a"]));
  it("biggest drop since saving first", () => expect(sortWishlist(items, "drop").map((i) => i.id)).toEqual(["b", "a", "c"]));
  it("lowest price first", () => expect(sortWishlist(items, "price").map((i) => i.id)).toEqual(["b", "c", "a"]));
  it("does not mutate the input", () => {
    const before = items.map((i) => i.id);
    sortWishlist(items, "price");
    expect(items.map((i) => i.id)).toEqual(before);
  });
});

const alert = (active: boolean, reached: boolean): AlertItem => ({
  id: "x", type: "price", targetPrice: 100, targetMargin: null, platform: null, active, lastTriggeredAt: null, createdAt: "", product: { id: "p", title: "T", image: null, minPrice: 1 }, currentPrice: 90, currentPlatform: "daraz", reached,
});

describe("alertStatus", () => {
  it("paused wins over reached", () => expect(alertStatus(alert(false, true))).toBe("paused"));
  it("active and reached", () => expect(alertStatus(alert(true, true))).toBe("reached"));
  it("active and not reached is watching", () => expect(alertStatus(alert(true, false))).toBe("watching"));
});
